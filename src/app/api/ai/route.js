import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave da API Gemini não configurada no servidor." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const { prompt, jsonMode } = await req.json();
    
    const config = {};
    if (jsonMode) {
      config.responseMimeType = "application/json";
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config,
    });
    
    return NextResponse.json({ text: response.text });
  } catch (error) {
    console.error("AI Error:", error);
    
    let friendlyMessage = "Erro interno ao conectar com a IA.";
    const errMsg = error.message || "";
    
    if (errMsg.includes("429") || errMsg.includes("Quota exceeded") || errMsg.includes("RESOURCE_EXHAUSTED")) {
      friendlyMessage = "Muitas mensagens enviadas em pouco tempo. Por favor, aguarde alguns segundos e tente novamente.";
    } else if (errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE")) {
      friendlyMessage = "A inteligência artificial está com alta demanda no momento. Tente novamente em alguns instantes.";
    }

    return NextResponse.json({ error: friendlyMessage }, { status: 500 });
  }
}
