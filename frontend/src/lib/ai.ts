import { supabase } from './supabase';

interface ContextData {
  services: any[];
  products: any[];
}

export async function getBeautyAdvice(prompt: string, context?: ContextData) {
  try {
    console.log("Chamando AI via Edge Function...");

    const { data, error } = await supabase.functions.invoke('beauty-advisor', {
      body: { prompt, context }
    });

    if (error) {
      console.error("Erro na Edge Function:", error);
      throw error;
    }

    return data.response;
  } catch (error) {
    console.error("AI Error:", error);
    // Fallback amigável
    return "No momento, minha conexão inteligente está passando por uma manutenção. Por favor, tente novamente em alguns instantes. (Verifique se a função 'beauty-advisor' foi implantada no Supabase).";
  }
}