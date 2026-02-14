
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 0. Verificar Auth manualmente (para resolver 401/CORS no Gateway)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized', details: authError }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 1. Cliente Admin para operações de banco
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Data de amanhã
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        console.log("Buscando agendamentos para:", dateStr);

        // Buscar agendamentos de amanhã que não foram cancelados
        // Buscar agendamentos de amanhã que não foram cancelados
        // Simplificado: Buscar dados crus primeiro para evitar erros de join
        const { data: appts, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('date', dateStr)
            .neq('status', 'cancelled')
            .neq('status', 'canceled');

        if (error) {
            console.error("Erro Supabase select appts:", error);
            throw error;
        }

        let sentCount = 0;
        const details = [];

        // Coletar IDs para buscar detalhes em massa (ou buscar individualmente se volume for baixo)
        // Para simplificar e garantir funcionamento, vamos buscar dados auxiliares sob demanda ou em massa.
        // Dado que é um script diário, buscar em loop não é crítico, mas em massa é melhor.

        if (!appts || appts.length === 0) {
            return new Response(JSON.stringify({ message: "Nenhum agendamento para amanhã." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const clientIds = [...new Set(appts.map(a => a.client_id))];
        const proIds = [...new Set(appts.map(a => a.professional_id))];
        const salonIds = [...new Set(appts.map(a => a.salon_id))];
        const serviceIds = [...new Set(appts.map(a => a.service_id).filter(id => id))];

        // Buscar Perfis
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, name, comissao').in('id', [...clientIds, ...proIds]);
        const profilesMap = new Map((profiles || []).map(p => [p.id, p]));

        // Buscar Salões
        const { data: salons } = await supabase.from('salons').select('id, nome').in('id', salonIds);
        const salonsMap = new Map((salons || []).map(s => [s.id, s]));

        // Buscar Serviços
        const { data: services } = await supabase.from('services').select('id, name').in('id', serviceIds);
        const servicesMap = new Map((services || []).map(s => [s.id, s]));


        for (const appt of appts) {
            const client = profilesMap.get(appt.client_id);
            const pro = profilesMap.get(appt.professional_id);
            // Salões e Serviços são opcionais ou podem vir de outras tabelas, mas vamos tentar mapear
            const salon = salonsMap.get(appt.salon_id);
            const service = servicesMap.get(appt.service_id);

            const clientName = client?.full_name || client?.name || 'Cliente';
            // const proName = pro?.full_name || pro?.name; // Não usado no texto, mas disponível
            const salonName = salon?.nome || 'Salão';
            const serviceName = service?.name || 'Serviço';

            if (!appt.client_id || !appt.professional_id) {
                console.log(`Skipping appt ${appt.id}: missing IDs`);
                continue;
            }

            const senderId = appt.professional_id;
            const clientId = appt.client_id;

            // Buscar conversa existente
            const { data: existingConv } = await supabase
                .from('conversations')
                .select('id')
                .or(`and(user1_id.eq.${senderId},user2_id.eq.${clientId}),and(user1_id.eq.${clientId},user2_id.eq.${senderId})`)
                .maybeSingle();

            let convId = existingConv?.id;

            if (!convId) {
                // Criar conversa se não existir
                const { data: newConv, error: createError } = await supabase.from('conversations').insert({
                    user1_id: senderId,
                    user2_id: clientId,
                    last_message: 'Início Automático',
                    unread_count: 0
                }).select().single();

                if (createError) {
                    console.error("Erro criando conversa:", createError);
                    continue;
                }
                convId = newConv?.id;
            }

            if (convId) {
                const text = `🔔 *Lembrete Automático*\nOlá ${clientName}, seu agendamento é amanhã (${dateStr}) às ${appt.time} no ${salonName} (${serviceName}). Confirmado! ✨`;

                await supabase.from('messages').insert({
                    conversation_id: convId,
                    sender_id: senderId,
                    content: text,
                    timestamp: new Date().toISOString()
                });

                // Atualizar status da conversa
                await supabase.from('conversations').update({
                    last_message: '🔔 Lembrete de Agendamento',
                    unread_count: 1
                }).eq('id', convId);

                sentCount++;
                details.push({ client: clientName, status: "sent" });
            }
        }

        return new Response(
            JSON.stringify({ message: `Lembretes enviados: ${sentCount}`, details }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }
})
