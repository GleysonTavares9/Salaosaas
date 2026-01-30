
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
        const { data: appts, error } = await supabase
            .from('appointments')
            .select(`
        id, 
        time,
        client:client_id(id, full_name), 
        salon:salon_id(id, nome),
        professional:professional_id(id, nome),
        services(name)
      `)
            .eq('date', dateStr)
            .neq('status', 'cancelled');

        if (error) {
            console.error("Erro ao buscar agendamentos:", error);
            throw error;
        }

        let sentCount = 0;
        const details = [];

        for (const appt of appts || []) {
            // @ts-ignore
            const client = appt.client;
            // @ts-ignore
            const pro = appt.professional;
            // @ts-ignore
            const salon = appt.salon;
            // @ts-ignore
            const service = appt.services;

            if (!client?.id || !pro?.id) {
                details.push({ id: appt.id, status: "skipped (missing client or pro id)" });
                continue;
            }

            const senderId = pro.id;

            // Buscar conversa existente
            const { data: existingConv } = await supabase
                .from('conversations')
                .select('id')
                .or(`and(user1_id.eq.${senderId},user2_id.eq.${client.id}),and(user1_id.eq.${client.id},user2_id.eq.${senderId})`)
                .maybeSingle();

            let convId = existingConv?.id;

            if (!convId) {
                // Criar conversa se não existir
                const { data: newConv, error: createError } = await supabase.from('conversations').insert({
                    user1_id: senderId,
                    user2_id: client.id,
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
                const text = `🔔 *Lembrete Automático*\nOlá ${client.full_name}, seu agendamento é amanhã (${dateStr}) às ${appt.time} no ${salon?.nome || 'Salão'} (${service?.name || 'Serviço'}). Confirmado! ✨`;

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
                details.push({ client: client.full_name, status: "sent" });
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
