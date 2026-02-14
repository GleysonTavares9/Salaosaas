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
        const MASTER_MP_ACCESS_TOKEN = Deno.env.get('MASTER_MP_ACCESS_TOKEN');

        const supabase = createClient(supabaseUrl, supabaseKey);

        const requestData = await req.json();
        const { action, salonId, plan, paymentId, paymentData } = requestData;

        if (action === 'process_client_payment') {
            const { userId } = requestData; // <--- Recebendo ID do usuário
            const { data: salon } = await supabase.from('salons').select('mp_access_token, nome').eq('id', salonId).single();
            if (!salon?.mp_access_token) return new Response(JSON.stringify({ error: 'Salão sem chave MP' }), { status: 404, headers: corsHeaders });

            const cleanToken = salon.mp_access_token.trim();
            const payer = paymentData.payer || {};

            // 1. TENTA NOME DO PERFIL (Melhor opção)
            let finalFirstName = 'Cliente';
            let finalLastName = 'Aura';

            if (userId) {
                const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
                if (profile?.full_name) {
                    const parts = profile.full_name.trim().split(' ');
                    finalFirstName = parts[0];
                    finalLastName = parts.length > 1 ? parts.slice(1).join(' ') : 'App';
                }
            }

            // 2. FALLBACK PARA O EMAIL (Se não achou perfil)
            if (finalFirstName === 'Cliente') {
                const emailName = payer.email ? payer.email.split('@')[0] : 'Cliente';
                finalFirstName = payer.first_name || emailName;
                finalLastName = payer.last_name || 'App';
            }

            // Limpa o nome do salão para caber nos descritores (max 20 chars para statement)
            const cleanSalonName = salon.nome.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 20);

            const payload = {
                transaction_amount: Number(paymentData.transaction_amount),
                description: paymentData.description || `Pagamento para ${salon.nome}`,
                payment_method_id: paymentData.payment_method_id,
                statement_descriptor: cleanSalonName, // Nome na fatura
                payer: {
                    email: payer.email || 'cliente@aura.com',
                    first_name: finalFirstName,
                    last_name: finalLastName
                },
                external_reference: paymentData.external_reference || `AURA-${Date.now()}`,
                metadata: paymentData.metadata || {},
                notification_url: `https://sycwdapzkvzvjedowfjq.supabase.co/functions/v1/payment-webhook?salon_id=${salonId}`
            };
            if (paymentData.token) (payload as any).token = paymentData.token;

            console.log(`[AuraPay] Tentando pagamento para: ${salon.nome} | Token: ${cleanToken.substring(0, 15)}...`);

            const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${cleanToken}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': crypto.randomUUID()
                },
                body: JSON.stringify(payload)
            });

            const mpData = await mpResponse.json();

            // LOG CRÍTICO PARA DETECTAR A ORIGEM DO 403
            if (!mpResponse.ok) {
                console.error("ERRO 403 DETALHADO DO MP:", JSON.stringify({
                    status: mpResponse.status,
                    body: mpData,
                    salon: salon.nome,
                    token_type: cleanToken.startsWith('TEST') ? 'SANDBOX' : 'PRODUCTION'
                }, null, 2));
            }

            return new Response(JSON.stringify(mpData), {
                status: mpResponse.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // CHECK STATUS OF CLIENT PAYMENT
        if (action === 'check_client_payment_status') {
            const { data: salon } = await supabase.from('salons').select('mp_access_token').eq('id', salonId).single();
            if (!salon?.mp_access_token) return new Response(JSON.stringify({ error: 'Salão sem chave MP' }), { status: 404, headers: corsHeaders });

            const cleanToken = salon.mp_access_token.trim();

            const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${cleanToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const mpData = await mpResponse.json();

            return new Response(JSON.stringify(mpData), {
                status: mpResponse.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Fluxo Assinatura (Master)
        if (action === 'create_subscription_pix') {
            let amount = 49.0;
            if (plan === 'premium') amount = 99.0;
            if (plan === 'starter') amount = 19.0;

            const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${MASTER_MP_ACCESS_TOKEN.trim()}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
                body: JSON.stringify({
                    transaction_amount: amount,
                    description: `Assinatura Aura ${plan || 'PRO'}`,
                    payment_method_id: "pix",
                    payer: { email: 'contato@aura.com', first_name: 'Proprietario', last_name: 'Aura' },
                    external_reference: salonId
                })
            });
            const mpData = await mpResponse.json();

            // Extrair dados específicos do PIX com segurança
            const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code;
            const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64;

            return new Response(JSON.stringify({
                id: mpData.id,
                status: mpData.status,
                qrCode: qrCode,
                qrCodeBase64: qrCodeBase64,
                raw: mpData // manter raw para debug se precisar
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // CHECK SUBSCRIPTION STATUS (MASTER TOKEN)
        if (action === 'check_payment_status') {
            const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${MASTER_MP_ACCESS_TOKEN.trim()}`,
                    'Content-Type': 'application/json'
                }
            });

            const mpData = await mpResponse.json();

            // Se aprovado, atualiza o plano no banco de dados
            if (mpData.status === 'approved') {
                const newPlan = mpData.description?.includes('premium') ? 'premium' : 'pro';

                // Pega o ID do salão da external_reference
                const paidSalonId = mpData.external_reference;

                if (paidSalonId) {
                    await supabase.from('salons').update({
                        plan: newPlan,
                        subscription_status: 'active',
                        subscription_updated_at: new Date()
                    }).eq('id', paidSalonId);
                }

                return new Response(JSON.stringify({
                    status: 'approved',
                    newPlan: newPlan
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            return new Response(JSON.stringify({
                status: mpData.status
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ error: 'Ação não permitida' }), { status: 400, headers: corsHeaders });

    } catch (error: any) {
        console.error("ERRO FATAL BILLING:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
})
