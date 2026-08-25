import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req) {
  try {
    const { prompt, jsonMode } = await req.json();
    
    const config = {};
    if (jsonMode) {
      config.responseMimeType = "application/json";
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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
