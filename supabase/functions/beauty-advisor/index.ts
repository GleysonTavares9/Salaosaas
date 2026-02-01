import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Validar AUTH
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

        // 2. Controle de Uso (RPC OBRIGATÓRIO)
        const { data: canProcess, error: usageError } = await supabase.rpc('check_and_increment_usage', { p_max_limit: 40 });
        if (usageError || !canProcess) {
            return new Response(JSON.stringify({ error: 'Limite atingido' }), { status: 429, headers: corsHeaders });
        }

        const API_KEY = Deno.env.get('GEMINI_API_KEY');
        if (!API_KEY) throw new Error('GEMINI_API_KEY missing');

        const { prompt, context } = await req.json();

        // 3. Payload Mínimo para LLM (JSON Enxuto)
        const llmContext = {
            dia: context?.date || null,
            horarios: context?.slots || [],
            servico: context?.service || null,
            profissional: context?.professional || null
        };

        const systemRole = `Você é um assistente de agendamento. Curto, direto, objetivo. 
Regras: 1-3 frases. Sem emojis, sem markdown, sem cumprimentos longos.
Fluxo: 1. Se serviço nulo -> peça apenas o serviço. 2. Se pro nulo -> peça apenas o pro. 3. Se horário nulo -> ofereça 3 slots. 4. Completo -> confirme: data, hora, serviço, pro. Pergunte: "Confirmar?".
Dados: ${JSON.stringify(llmContext)}`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

        const response = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: `${systemRole}\n\nUsuário: ${prompt}` }] }],
                generationConfig: { maxOutputTokens: 100, temperature: 0.1 }
            })
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro.";

        return new Response(JSON.stringify({ response: text.trim().replace(/\n+/g, ' ') }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Falha processamento' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
})
