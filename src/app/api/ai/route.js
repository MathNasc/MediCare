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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

async function callOpenRouter({ messages, model, apiKey }) {
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
      temperature: 0.25,
      max_tokens: 750,
    }),
    signal: AbortSignal.timeout(22000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errDetail = data?.error?.message || data?.message || `HTTP ${res.status}`;
    const err = new Error(`OpenRouter error (${res.status}): ${errDetail}`);
    err.status = res.status;
    throw err;
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('\n');
  }
  return '';
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

    let rawAiText = '';
    let usedProvider = 'openrouter';

    if (openRouterKey) {
      rawAiText = await callOpenRouter({
        messages,
        model: openRouterModel,
        apiKey: openRouterKey,
      });
    } else if (geminiKey) {
      usedProvider = 'gemini_fallback';
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const userTurn = messages[messages.length - 1]?.content || inputCheck.cleanedText;
      const historyPrompt = messages
        .slice(1, -1)
        .map((m) => `${m.role === 'user' ? 'Paciente' : 'Assistente'}: ${m.content}`)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: historyPrompt ? `${historyPrompt}\nPaciente: ${userTurn}` : userTurn,
        config: {
          systemInstruction: HARDENED_SYSTEM_PROMPT,
          temperature: 0.25,
          maxOutputTokens: 750,
        },
      });
      rawAiText = response?.text || '';
    } else {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY não configurada no servidor.' },
        { status: 503, headers: corsHeaders }
      );
    }

    // 2. Validação pós-resposta contra vazamento de código ou instruções do sistema
    const sanitized = sanitizeAiOutput(rawAiText);

    return NextResponse.json(
      {
        text: sanitized.text,
        provider: usedProvider,
        model: usedProvider === 'openrouter' ? openRouterModel : 'gemini-2.5-flash',
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
