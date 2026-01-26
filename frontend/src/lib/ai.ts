import { GoogleGenAI } from "@google/genai";

export async function getBeautyAdvice(prompt: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Você é o Localizador de Serviços da Luxe Aura. 
      Sua missão é ajudar o cliente a encontrar o serviço ideal no catálogo.
      Se o cliente perguntar sobre um problema (ex: cabelo seco), sugira um serviço (ex: Hidratação Profunda ou Ritual Glow).
      Baseie-se em: ${prompt}. Seja extremamente breve, direto e refinado.`,
    });
    
    return response.text;
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return "Não consegui consultar o catálogo agora. Que tal explorar a aba de serviços?";
  }
}