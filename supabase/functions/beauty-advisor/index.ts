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

        // 2. Controle de Uso
        const { data: canProcess, error: usageError } = await supabase.rpc('check_and_increment_usage', { p_max_limit: 100 });
        if (usageError || !canProcess) {
            return new Response(JSON.stringify({ error: 'Limite de mensagens da IA atingido.' }), { status: 429, headers: corsHeaders });
        }

        const API_KEY = Deno.env.get('GEMINI_API_KEY');
        if (!API_KEY) throw new Error('GEMINI_API_KEY missing');

        const { prompt } = await req.json();

        // 3. BUSCAR CONTEXTO DO USUÁRIO (RICO)
        // Perfil
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

        // Histórico de Agendamentos (Últimos 5)
        const { data: history } = await supabase
            .from('appointments')
            .select(`
                *,
                salons(nome),
                services(nome)
            `)
            .eq('client_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

        // 4. PESQUISA INTELIGENTE NO ECOSSISTEMA
        // Se o usuário pedir "agendar", "serviço" ou citar um nome, buscamos opções
        let relevantSalons = [];
        const lowerPrompt = prompt.toLowerCase();

        if (lowerPrompt.includes('agendar') || lowerPrompt.includes('quero') || lowerPrompt.includes('corte') || lowerPrompt.includes('unha')) {
            const { data } = await supabase
                .from('salons')
                .select('id, nome, slug_publico, segmento, cidade')
                .limit(3);
            relevantSalons = data || [];
        }

        // 5. CONSTRUIR O PROMPT PARA O GEMINI
        const userContext = {
            nome: profile?.full_name || 'Usuário',
            historico: history?.map(h => `${h.services?.nome} na ${h.salons?.nome} em ${h.date}`).join(' | ') || 'Sem agendamentos recentes',
            estabelecimentos_aura: relevantSalons.map(s => `${s.nome} (${s.segmento}) em ${s.cidade}`).join(' | ')
        };

        const systemRole = `Você é a CONCIERGE AURA, uma IA de elite para gestão de beleza e bem-estar.
Sua missão: Facilitar o agendamento e ser a secretária pessoal do usuário.

CONTEXTO DO USUÁRIO:
- Nome: ${userContext.nome}
- Últimos atendimentos: ${userContext.historico}
- Sugestões para agendar: ${userContext.estabelecimentos_aura}

REGRAS DE OURO:
1. Seja elegante, prestativa e rápida (1-3 frases).
2. Sempre use o histórico do usuário para dar referências (ex: "Vi que você curte cortar na Salon X, quer repetir lá?").
3. Se o usuário quiser agendar algo novo, sugira um dos estabelecimentos do ecossistema Aura acima.
4. Para concluir um agendamento, diga ao usuário para clicar no link de agendamento rápido (ex: "/q/nome-do-salao"). Se ele quiser agendar o 'de sempre', diga que você já preparou o atalho para ele.

RESPONDA SEMPRE EM PORTUGUÊS (PT-BR).`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

        const response = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: `${systemRole}\n\nUsuário: ${prompt}` }] }],
                generationConfig: { maxOutputTokens: 250, temperature: 0.7 }
            })
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, estou com uma instabilidade momentânea. Pode repetir?";

        return new Response(JSON.stringify({ response: text.trim().replace(/\n+/g, ' ') }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Erro na Edge Function:", error);
        return new Response(JSON.stringify({ error: 'Erro ao processar sua solicitação.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
})
