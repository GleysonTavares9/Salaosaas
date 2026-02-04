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
        // CHAVE MESTRA DO DESENVOLVEDOR (Para receber as assinaturas)
        const MASTER_MP_ACCESS_TOKEN = Deno.env.get('MASTER_MP_ACCESS_TOKEN');

        const supabase = createClient(supabaseUrl, supabaseKey);

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

        const { action, salonId, plan, paymentId } = await req.json();

        // 1. Informações de Faturamento
        if (action === 'get_info') {
            const { data, error } = await supabase.rpc('get_salon_billing_info', { p_salon_id: salonId });
            if (error) throw error;
            return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 2. Criar Preferência de Pagamento (Link externo - LEGADO)
        if (action === 'create_subscription_link') {
            if (!MASTER_MP_ACCESS_TOKEN) return new Response(JSON.stringify({ error: 'MASTER_MP_ACCESS_TOKEN ausente' }), { status: 500, headers: corsHeaders });

            const price = plan === 'premium' ? 99.00 : 49.00;
            const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${MASTER_MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: [{ title: `Assinatura Aura ${plan.toUpperCase()}`, quantity: 1, unit_price: price, currency_id: 'BRL' }],
                    external_reference: salonId,
                    back_urls: { success: `${Deno.env.get('SITE_URL')}/#/pro`, failure: `${Deno.env.get('SITE_URL')}/#/pro` },
                    auto_return: "approved",
                    notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/billing-webhook`
                })
            });
            const mpData = await mpResponse.json();
            return new Response(JSON.stringify({ checkoutUrl: mpData.init_point }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 3. Criar Pagamento PIX Nativo (QR Code direto)
        if (action === 'create_subscription_pix') {
            if (!MASTER_MP_ACCESS_TOKEN) return new Response(JSON.stringify({ error: 'MASTER_MP_ACCESS_TOKEN ausente' }), { status: 500, headers: corsHeaders });

            const price = plan === 'premium' ? 99.00 : 49.00;
            const email = user.email || 'cliente@aura.com';

            // Pega o nome real do usuário logado
            const fullName = user.user_metadata?.name || user.user_metadata?.full_name || "Cliente SaaS";
            const firstName = fullName.split(' ')[0];
            const lastName = fullName.split(' ').slice(1).join(' ') || "SaaS";

            const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${MASTER_MP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': crypto.randomUUID()
                },
                body: JSON.stringify({
                    transaction_amount: price,
                    description: `Assinatura Aura ${plan.toUpperCase()}`,
                    payment_method_id: "pix",
                    payer: {
                        email: email,
                        first_name: firstName,
                        last_name: lastName
                    },
                    external_reference: salonId,
                    notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/billing-webhook`
                })
            });

            const mpData = await mpResponse.json();

            if (mpData.status === 'pending' || mpData.status === 'created') {
                return new Response(JSON.stringify({
                    id: mpData.id,
                    status: mpData.status,
                    qrCode: mpData.point_of_interaction.transaction_data.qr_code,
                    qrCodeBase64: mpData.point_of_interaction.transaction_data.qr_code_base64,
                    ticketUrl: mpData.point_of_interaction.transaction_data.ticket_url
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } else {
                throw new Error("Erro MP: " + (mpData.message || JSON.stringify(mpData)));
            }
        }

        // 4. Verificar Status Manualmente (Botão "Já Paguei")
        if (action === 'check_payment_status') {
            if (!MASTER_MP_ACCESS_TOKEN) return new Response(JSON.stringify({ error: 'MASTER_MP_ACCESS_TOKEN ausente' }), { status: 500, headers: corsHeaders });
            if (!paymentId) return new Response(JSON.stringify({ error: 'Payment ID ausente' }), { status: 400, headers: corsHeaders });

            const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: { 'Authorization': `Bearer ${MASTER_MP_ACCESS_TOKEN}` }
            });
            const payment = await mpResponse.json();

            if (payment.status === 'approved') {
                const salonIdRef = payment.external_reference;
                const amount = payment.transaction_amount;
                const newPlan = amount > 80 ? 'premium' : 'pro';

                // Atualizar Banco de Dados (Mesma lógica do Webhook)
                await supabase.from('salons').update({
                    subscription_status: 'active',
                    subscription_plan: newPlan,
                    trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                }).eq('id', salonIdRef);

                // Registrar Histórico
                await supabase.from('billing_history').insert({
                    salon_id: salonIdRef,
                    amount: amount,
                    plan_charged: newPlan,
                    payment_status: 'paid',
                    payment_method: 'pix_manual_check',
                    memo: `Verificação manual (ID: ${paymentId})`,
                    paid_at: new Date().toISOString()
                });

                return new Response(JSON.stringify({ status: 'approved', newPlan }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            return new Response(JSON.stringify({ status: payment.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400, headers: corsHeaders });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
})
