import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/oracleAuth';
import { canUseOracleHttpFallback, forwardToOracleBackend } from '@/lib/oracleProxy';
import {
  HARDENED_SYSTEM_PROMPT,
  buildHardenedOpenRouterMessages,
  inspectUserInput,
  sanitizeAiOutput,
} from '@/lib/aiGuardrails';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, apikey',
};

const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const BUILTIN_OPENROUTER_FALLBACK_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'openrouter/free',
];

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function extractOpenRouterContent(choice) {
  const content = choice?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('\n')
      .trim();
  }
  return '';
}

function buildCandidateOpenRouterModels(primaryModel) {
  const envFallbacks = String(process.env.OPENROUTER_FALLBACK_MODEL || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  const candidates = [primaryModel, ...envFallbacks, ...BUILTIN_OPENROUTER_FALLBACK_MODELS];
  const unique = [];
  for (const model of candidates) {
    if (model && !unique.includes(model)) {
      unique.push(model);
    }
  }
  return unique;
}

async function callOpenRouter({ messages, model, apiKey, timeoutMs = 22000 }) {
  const siteUrl =
    process.env.OPENROUTER_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://medicare-cuidador.duckdns.org';

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': 'MediCare Assistente de Saude',
    },
    body: JSON.stringify({
      model: model || DEFAULT_OPENROUTER_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1800,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errDetail = data?.error?.message || data?.message || `HTTP ${res.status}`;
    const err = new Error(`OpenRouter error (${res.status}): ${errDetail}`);
    err.status = res.status;
    throw err;
  }

  const choice = data?.choices?.[0];
  const text = extractOpenRouterContent(choice);
  if (!text) {
    console.warn('[AI] OpenRouter retornou conteúdo vazio:', {
      requestedModel: model || DEFAULT_OPENROUTER_MODEL,
      resolvedModel: data?.model || null,
      finishReason: choice?.finish_reason || null,
      hasReasoning: Boolean(choice?.message?.reasoning),
    });
  }
  return {
    text,
    resolvedModel: data?.model || model || DEFAULT_OPENROUTER_MODEL,
  };
}

async function callGemini({ messages, cleanedText, apiKey }) {
  const ai = new GoogleGenAI({ apiKey });
  const userTurn = messages[messages.length - 1]?.content || cleanedText;
  const historyPrompt = messages
    .slice(1, -1)
    .map((m) => `${m.role === 'user' ? 'Paciente' : 'Assistente'}: ${m.content}`)
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: historyPrompt ? `${historyPrompt}\nPaciente: ${userTurn}` : userTurn,
    config: {
      systemInstruction: HARDENED_SYSTEM_PROMPT,
      temperature: 0.3,
      maxOutputTokens: 1800,
    },
  });
  return String(response?.text || '').trim();
}

export async function POST(req) {
  try {
    const ip =
      String(req.headers.get('x-forwarded-for') || '')
        .split(',')[0]
        .trim() || 'local';

    if (!checkRateLimit(`ai:${ip}`, 25, 60_000)) {
      return NextResponse.json(
        {
          error: 'Muitas mensagens enviadas em pouco tempo. Por favor, aguarde alguns segundos e tente novamente.',
        },
        { status: 429, headers: corsHeaders }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawQuestion = String(body?.message ?? body?.prompt ?? '').trim();

    // 1. Camada determinística de defesa (anti-injection, zero código, apenas saúde)
    const inputCheck = inspectUserInput(rawQuestion);
    if (!inputCheck.allowed) {
      return NextResponse.json(
        {
          text: inputCheck.refusalMessage,
          guardrailBlocked: true,
          reason: inputCheck.reason,
          provider: 'guardrail',
        },
        { status: 200, headers: corsHeaders }
      );
    }

    const patientContext =
      body?.context && typeof body.context === 'object'
        ? body.context
        : {
            patientName: body?.patientName,
            role: body?.role,
            medicamentos: body?.medicamentos,
            allergies: body?.allergies,
            conditions: body?.conditions,
            doseLogs: body?.doseLogs,
          };

    const messages = buildHardenedOpenRouterMessages({
      userMessage: inputCheck.cleanedText,
      history: body?.history,
      patientContext,
    });

    const openRouterKey = String(process.env.OPENROUTER_API_KEY || '').trim();
    const openRouterModel = String(process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL).trim();
    const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();

    // Se nenhuma chave está configurada localmente (ex: preview isolado), encaminha ao backend Oracle
    if (!openRouterKey && !geminiKey && canUseOracleHttpFallback(req)) {
      return forwardToOracleBackend(req, '/api/ai');
    }

    if (!openRouterKey && !geminiKey) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY não configurada no servidor.' },
        { status: 503, headers: corsHeaders }
      );
    }

    let rawAiText = '';
    let usedProvider = 'openrouter';
    let usedModel = openRouterModel;
    let lastOpenRouterError = null;

    if (openRouterKey) {
      const candidateModels = buildCandidateOpenRouterModels(openRouterModel).slice(0, 4);
      for (let i = 0; i < candidateModels.length; i += 1) {
        const candidateModel = candidateModels[i];
        try {
          const result = await callOpenRouter({
            messages,
            model: candidateModel,
            apiKey: openRouterKey,
            timeoutMs: i === 0 ? 22000 : 15000,
          });
          if (result.text) {
            rawAiText = result.text;
            usedModel = result.resolvedModel || candidateModel;
            lastOpenRouterError = null;
            break;
          }
        } catch (err) {
          lastOpenRouterError = err;
          const errStatus = Number(err?.status || 0);
          // Erro de chave inválida não resolve tentando outro modelo do mesmo provedor
          if (errStatus === 401 || errStatus === 403) {
            break;
          }
        }
      }
    }

    if (!rawAiText && geminiKey) {
      usedProvider = 'gemini_fallback';
      usedModel = 'gemini-2.5-flash';
      rawAiText = await callGemini({
        messages,
        cleanedText: inputCheck.cleanedText,
        apiKey: geminiKey,
      });
    }

    if (!rawAiText && lastOpenRouterError) {
      throw lastOpenRouterError;
    }

    // 2. Validação pós-resposta contra vazamento de código ou instruções do sistema
    const sanitized = sanitizeAiOutput(rawAiText, {
      preserveMarkdown: Boolean(body?.richMarkdown),
    });

    return NextResponse.json(
      {
        text: sanitized.text,
        provider: usedProvider,
        model: usedModel,
        guardrailBlocked: !sanitized.safe,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('AI Route Error:', error?.message || error);

    let friendlyMessage = 'Não foi possível conectar ao assistente de saúde agora. Tente novamente em instantes.';
    const errMsg = String(error?.message || '');
    const status = Number(error?.status || 0);

    if (status === 429 || errMsg.includes('429') || errMsg.includes('rate limit') || errMsg.includes('RESOURCE_EXHAUSTED')) {
      friendlyMessage = 'Muitas perguntas em pouco tempo. Aguarde alguns segundos e tente novamente.';
    } else if (status === 401 || status === 403) {
      friendlyMessage = 'Configuração de autenticação do assistente de IA indisponível no servidor.';
    } else if (status === 503 || errMsg.includes('503') || errMsg.includes('timeout')) {
      friendlyMessage = 'O assistente de saúde está com alta demanda no momento. Tente novamente em instantes.';
    }

    return NextResponse.json({ error: friendlyMessage }, { status: 502, headers: corsHeaders });
  }
}
