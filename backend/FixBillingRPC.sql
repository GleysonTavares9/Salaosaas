CREATE OR REPLACE FUNCTION public.get_salon_billing_info(p_salon_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_salon public.salons%ROWTYPE;
    v_plan public.subscription_plans%ROWTYPE;
    v_is_trial boolean;
BEGIN
    -- 1. Buscar dados do salão
    SELECT * INTO v_salon FROM public.salons WHERE id = p_salon_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- 2. Calcular se está em trial checkando datas
    v_is_trial := (v_salon.subscription_status = 'trialing' AND v_salon.trial_ends_at > now());

    -- 3. Se o trial acabou mas o status ainda era trialing, forçamos a leitura como 'free' visualmente
    -- (Embora o script ForceFreePlan.sql já tenha corrigido isso, é bom ter redundância)
    IF v_salon.subscription_status = 'trialing' AND v_salon.trial_ends_at <= now() THEN
        v_is_trial := false;
    END IF;

    -- 4. Buscar as regras do plano ATUAL do salão na tabela de planos
    -- Se estiver em trial, assumimos que ele tem os poderes do plano que está testando (geralmente PRO)
    -- Mas se caiu pro free, pega do free.
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_salon.subscription_plan;

    -- 5. Montar o JSON de resposta fundindo os dados e garantindo que os limites venham da tabela oficial
    RETURN jsonb_build_object(
        'id', v_salon.id,
        'name', v_salon.nome,
        'plan', v_salon.subscription_plan,
        'status', v_salon.subscription_status,
        'is_trial_active', v_is_trial,
        'trial_ends_at', v_salon.trial_ends_at,
        'limits', v_plan.limits, -- AQUI ESTÁ A MÁGICA: Pega o JSON de limites da tabela planos
        'features', v_plan.features
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
