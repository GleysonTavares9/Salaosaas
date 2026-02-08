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
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Validar AUTH de forma ultra-robusta
        const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Sessão não encontrada.' }), { status: 401, headers: corsHeaders });
        }

        const token = authHeader.replace(/^[Bb]earer\s+/, '');
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        const user = authData?.user;

        if (authError || !user) {
            console.error("DEBUG Auth Error:", authError);
            return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada.' }), { status: 401, headers: corsHeaders });
        }

        // 2. Controle de Uso
        const { data: canProcess, error: usageError } = await supabase.rpc('check_and_increment_usage', {
            p_user_id: user.id,
            p_max_limit: 100
        });

        if (usageError || !canProcess) {
            console.error("DEBUG Usage Error:", usageError);
            return new Response(JSON.stringify({ error: 'Limite de mensagens atingido ou erro no banco.' }), { status: 429, headers: corsHeaders });
        }

        let API_KEY = Deno.env.get('GEMINI_API_KEY')?.trim().replace(/^["']|["']$/g, '') || '';
        if (!API_KEY) {
            console.error("DEBUG: GEMINI_API_KEY is missing in Deno.env");
            return new Response(JSON.stringify({ error: 'Configuração da IA ausente (Chave API).' }), { status: 500, headers: corsHeaders });
        }

        if (!API_KEY.startsWith('AIza')) {
            console.warn("DEBUG: GEMINI_API_KEY does not start with AIza. This is highly unusual for Gemini keys.");
        }

        console.log("DEBUG: Key status:", API_KEY.substring(0, 4) + "..." + API_KEY.substring(API_KEY.length - 3));

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

        // TENTATIVA MULTI-MODELO (BATE EM UM, SE NÃO DER BATE NO OUTRO)
        const models = ["gemini-2.0-flash-exp", "gemini-1.5-flash"];
        let lastError = null;
        let responseText = "";

        for (const modelName of models) {
            try {
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
                console.log(`DEBUG: Tentando modelo ${modelName}...`);

                const response = await fetch(geminiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: `${systemRole}\n\nPERGUNTA: ${prompt}` }]
                        }]
                    })
                });

                const data = await response.json();

                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    responseText = data.candidates[0].content.parts[0].text;
                    console.log(`DEBUG: Sucesso com o modelo ${modelName}`);
                    break;
                } else if (data.error) {
                    console.warn(`DEBUG: Erro no modelo ${modelName}:`, data.error.message);
                    lastError = data.error;
                }
            } catch (e) {
                console.error(`DEBUG: Falha crítica no modelo ${modelName}:`, e);
                lastError = e;
            }
        }

        if (!responseText) {
            return new Response(JSON.stringify({
                error: "IA indisponível no momento.",
                detail: lastError?.message || "Todos os modelos falharam.",
                code: lastError?.status || 500
            }), { status: 500, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ response: responseText.trim().replace(/\n+/g, ' ') }), {
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
