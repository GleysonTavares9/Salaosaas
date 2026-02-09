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

        // 1. Identificação do Usuário (Opcional)
        const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
        let user = null;
        if (authHeader && authHeader !== 'Bearer null') {
            try {
                const token = authHeader.replace(/^[Bb]earer\s+/, '');
                const { data: authData } = await supabase.auth.getUser(token);
                user = authData?.user;
            } catch (e) { console.warn("Visitor Mode"); }
        }

        const { prompt, history: sessionHistory, context } = await req.json();
        const lowerPrompt = prompt.toLowerCase();

        let specificSalonData = null;
        let relevantSalons = [];
        let ownerIdForUsage = user?.id;

        // 2. MODO CONCIERGE DO SALÃO
        if (context?.salonId) {
            console.log("DEBUG: Modo Salão Específico:", context.salonId);
            const { data: salon } = await supabase.from('salons').select('*').eq('id', context.salonId).single();
            if (salon) {
                const [svc, pro] = await Promise.all([
                    supabase.from('services').select('*').eq('salon_id', salon.id),
                    supabase.from('professionals').select('user_id').eq('salon_id', salon.id).eq('status', 'active').limit(1).maybeSingle()
                ]);
                specificSalonData = { ...salon, services: svc.data || [] };
                relevantSalons = [salon];
                if (!ownerIdForUsage && pro.data?.user_id) ownerIdForUsage = pro.data.user_id;
            }
        }

        // 3. Controle de Cotas
        if (ownerIdForUsage) {
            await supabase.rpc('check_and_increment_usage', { p_user_id: ownerIdForUsage, p_max_limit: 1000 });
        }

        const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')?.trim();
        if (!GROQ_API_KEY) return new Response(JSON.stringify({ error: 'IA offline' }), { status: 500, headers: corsHeaders });

        let systemRole = '';
        if (specificSalonData) {
            const servicos = specificSalonData.services.map(s => `- ${s.name} (ID: ${s.id}): R$ ${s.price}`).join('\n');
            const userContext = user ? `Cliente Logado (${user.email})` : "Visitante (Não logado)";

            systemRole = `Você é a Aura, Concierge do ${specificSalonData.nome}.
Status: ${userContext}.
Objetivo: Agendamento rápido e direto.
Tom: Elegante, curtíssimo e objetivo. Use emojis.

SERVIÇOS (com IDs para agendamento):
${servicos}

${specificSalonData.ai_promo_text ? `PROMO: "${specificSalonData.ai_promo_text}"` : ''}

REGRAS:
1. Respostas curtíssimas (1 parágrafo ideal).
2. NUNCA mostre o (ID: ...) no texto final para o cliente.
3. Mencione a oferta: "${specificSalonData.ai_promo_text || 'Desconto exclusivo'}" e quanto ele economiza.
4. Gere o link oculto no final: /choose-time?promo=true&serviceId=ID
5. Se "Visitante", apenas lembre que o login é no final.
6. Endereço: ${specificSalonData.endereco || 'Ver no perfil'}.`;
        } else {
            systemRole = `Você é a AURA, a inteligência central do Luxe Aura. Ajude o usuário a encontrar os melhores salões.`;
        }

        // 4. Chamada da IA
        const messages = [{ role: "system", content: systemRole }];
        if (sessionHistory) {
            sessionHistory.slice(-6).forEach(m => messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
        }
        messages.push({ role: "user", content: prompt });

        const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages, temperature: 0.6 })
        });

        const aiData = await aiRes.json();
        const response = aiData.choices?.[0]?.message?.content || "Estou processando sua solicitação... ✨";

        return new Response(JSON.stringify({ response }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Erro fatal:", error);
        return new Response(JSON.stringify({ error: 'Aura em manutenção' }), { status: 500, headers: corsHeaders });
    }
})
