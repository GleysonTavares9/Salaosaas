import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

serve(async (req) => {
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const MASTER_MP_ACCESS_TOKEN = Deno.env.get('MASTER_MP_ACCESS_TOKEN');
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { searchParams } = new URL(req.url);
        const topic = searchParams.get('topic') || req.headers.get('x-topic');
        const id = searchParams.get('id') || searchParams.get('data.id');

        if (topic === 'payment' && id) {
            // 1. Consultar o pagamento no Mercado Pago do Desenvolvedor
            const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
                headers: { 'Authorization': `Bearer ${MASTER_MP_ACCESS_TOKEN}` }
            });
            const payment = await mpResponse.json();

            if (payment.status === 'approved') {
                const salonId = payment.external_reference;
                const amount = payment.transaction_amount;

                // Determinar o novo plano baseado no valor pago
                // Se a pessoa pagar ~99 é premium, se for ~49 é pro.
                const newPlan = amount > 80 ? 'premium' : 'pro';

                // 2. Atualizar o Salão no Banco de Dados
                // Prolongamos a assinatura ou ativamos o plano
                const { error: updateError } = await supabase
                    .from('salons')
                    .update({
                        subscription_status: 'active',
                        subscription_plan: newPlan, // <--- CORREÇÃO CRÍTICA AQUI
                        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 dias de uso
                    })
                    .eq('id', salonId);

                if (updateError) throw updateError;

                await supabase.from('billing_history').insert({
                    salon_id: salonId,
                    amount: amount,
                    plan_charged: amount > 80 ? 'premium' : 'pro',
                    payment_status: 'paid',
                    payment_method: payment.payment_method_id,
                    memo: `Assinatura confirmada via Webhook (ID: ${id})`,
                    paid_at: new Date().toISOString()
                });
            }
        }

        return new Response('ok', { status: 200 });

    } catch (error: any) {
        return new Response(error.message, { status: 500 });
    }
})
