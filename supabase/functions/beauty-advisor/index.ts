import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        // 1. Inicialização e Auth
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

        // 2. Controle de Uso (RPC OBRIGATÓRIO)
        const { data: canProcess, error: usageError } = await supabase.rpc('check_and_increment_usage', { p_max_limit: 40 });
        if (usageError || !canProcess) {
            return new Response(
                JSON.stringify({ error: 'Limite mensal de IA atingido. Tente novamente no próximo mês.' }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const API_KEY = Deno.env.get('GEMINI_API_KEY');
        if (!API_KEY) throw new Error('GEMINI_API_KEY is not set');

        const { prompt, context } = await req.json();

        // 3. Otimização de Contexto (JSON Enxuto)
        let contextString = "";
        if (context) {
            if (context.services) {
                contextString += `\nSERVIÇOS: ${context.services.slice(0, 10).map((s: any) => `${s.name}(R$${s.price})`).join(', ')}`;
            }
            if (context.products) {
                contextString += `\nPRODUTOS: ${context.products.slice(0, 10).map((p: any) => `${p.name}(R$${p.price})`).join(', ')}`;
            }
        }

        const systemInstructions = `Você é a Aura da Luxe Aura. Responda de forma técnica, formal e objetiva. Use apenas o catálogo fornecido. Não use emojis desnecessários.${contextString}`;

        // 4. Chamada LLM (Payload Mínimo)
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

        const response = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: `${systemInstructions}\n\nUser: ${prompt}` }] }],
                generationConfig: { maxOutputTokens: 250, temperature: 0.1 }
            })
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro ao processar.";

        return new Response(
            JSON.stringify({ response: text }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }
})
