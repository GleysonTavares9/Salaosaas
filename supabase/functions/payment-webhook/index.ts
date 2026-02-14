import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

serve(async (req) => {
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { searchParams } = new URL(req.url);
        const salonId = searchParams.get('salon_id');
        const topic = searchParams.get('topic') || req.headers.get('x-topic');
        const id = searchParams.get('id') || searchParams.get('data.id');

        console.log(`[Webhook] Recebido: Topic=${topic} ID=${id} Salon=${salonId}`);

        if ((topic === 'payment' || topic === 'merchant_order') && id && salonId) {
            // 1. Buscar a chave do salão para autenticar a consulta
            const { data: salon } = await supabase.from('salons').select('mp_access_token, nome').eq('id', salonId).single();

            if (!salon?.mp_access_token) {
                console.error(`[Webhook] Salão ${salonId} não encontrado ou sem token.`);
                return new Response('Salon not found', { status: 404 });
            }

            // 2. Consultar o pagamento no Mercado Pago
            const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
                headers: { 'Authorization': `Bearer ${salon.mp_access_token.trim()}` }
            });

            if (!mpResponse.ok) {
                console.error(`[Webhook] Erro ao consultar MP: ${mpResponse.status}`);
                return new Response('MP fetch error', { status: 502 });
            }

            const payment = await mpResponse.json();
            const appointmentId = payment.external_reference || payment.metadata?.appointment_id;

            console.log(`[Webhook] Status=${payment.status} Appointment=${appointmentId}`);

            if (payment.status === 'approved' && appointmentId) {
                // 3. Atualizar o Agendamento no Banco de Dados
                const { error: updateError } = await supabase
                    .from('appointments')
                    .update({
                        status: 'confirmed',
                        payment_id: id,
                        payment_method: payment.payment_method_id,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', appointmentId);

                if (updateError) {
                    console.error("[Webhook] Erro no update:", updateError);
                    throw updateError;
                }

                console.log(`[Webhook] SUCESSO: Agendamento ${appointmentId} confirmado.`);
            }
        }

        return new Response('ok', { status: 200 });

    } catch (error: any) {
        console.error("[Webhook] ERRO FATAL:", error.message);
        return new Response(error.message, { status: 500 });
    }
})
