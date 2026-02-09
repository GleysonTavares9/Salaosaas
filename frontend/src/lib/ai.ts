import { supabase } from './supabase';

interface ContextData {
  services?: any[];
  products?: any[];
  salonId?: string;
  salonName?: string;
  mode?: 'specific_salon' | 'global_search';
}

export async function getBeautyAdvice(prompt: string, history?: any[], context?: ContextData) {
  try {
    // Chamada liberada para visitantes

    const { data, error } = await supabase.functions.invoke('beauty-advisor', {
      body: { prompt, history, context }
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