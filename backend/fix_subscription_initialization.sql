-- ==========================================================
-- FIX: Inicialização de Assinaturas e Trial para Novos Salões
-- ==========================================================

-- 1. Garantir que a RPC de registro inicializa o Trial corretamente
CREATE OR REPLACE FUNCTION public.register_new_salon_and_owner(
    p_user_id uuid,
    p_salon_name text,
    p_segment text,
    p_owner_name text,
    p_slug text,
    p_email text,
    p_logo_url text,
    p_banner_url text,
    p_initial_hours jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_salon_id uuid;
BEGIN
    -- Criar o Salão com 30 dias de Trial Automático
    INSERT INTO public.salons (
        nome, 
        slug_publico, 
        segmento, 
        logo_url, 
        banner_url, 
        horario_funcionamento,
        subscription_plan,
        subscription_status,
        trial_start_at,
        trial_ends_at
    )
    VALUES (
        p_salon_name, 
        p_slug, 
        p_segment, 
        p_logo_url, 
        p_banner_url, 
        p_initial_hours,
        'pro', -- Começa no PRO para testar tudo
        'trialing',
        now(),
        now() + interval '30 days'
    )
    RETURNING id INTO v_salon_id;

    -- Criar o Perfil de Admin
    -- (O trigger handle_new_user já deve ter criado o profile básico, aqui garantimos os dados)
    UPDATE public.profiles
    SET 
        full_name = p_owner_name,
        role = 'admin'
    WHERE id = p_user_id;

    -- Criar o Profissional (Dono) vinculado à unidade
    INSERT INTO public.professionals (
        salon_id,
        user_id,
        name,
        email,
        role,
        image,
        horario_funcionamento,
        status
    )
    VALUES (
        v_salon_id,
        p_user_id,
        p_owner_name,
        p_email,
        'Proprietário',
        p_logo_url,
        p_initial_hours,
        'active'
    );

    RETURN v_salon_id;
END;
$$;

-- 2. Melhorar a get_salon_billing_info para auto-recuperar trials sem data
CREATE OR REPLACE FUNCTION public.get_salon_billing_info(p_salon_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_plan_id text;
    v_subscription_status text;
    v_trial_ends_at timestamptz;
    v_plan_data jsonb;
    v_limits jsonb;
    v_is_trial_active boolean;
BEGIN
    SELECT subscription_plan, subscription_status, trial_ends_at
    INTO v_plan_id, v_subscription_status, v_trial_ends_at
    FROM public.salons WHERE id = p_salon_id;

    IF NOT FOUND THEN RETURN NULL; END IF;

    -- Auto-correção: Se não tem data de trial mas está trialing, inicia agora
    IF v_subscription_status = 'trialing' AND v_trial_ends_at IS NULL THEN
        UPDATE public.salons 
        SET 
            trial_start_at = now(),
            trial_ends_at = now() + interval '30 days'
        WHERE id = p_salon_id
        RETURNING trial_ends_at INTO v_trial_ends_at;
    END IF;

    SELECT to_jsonb(sp.*) INTO v_plan_data FROM public.subscription_plans sp WHERE sp.id = v_plan_id;
    
    IF v_plan_data IS NULL THEN
         SELECT to_jsonb(sp.*) INTO v_plan_data FROM public.subscription_plans sp WHERE sp.id = 'starter';
         v_plan_id := 'starter';
    END IF;

    v_limits := v_plan_data->'limits';
    v_is_trial_active := (v_subscription_status = 'trialing' AND v_trial_ends_at > now());

    RETURN jsonb_build_object(
        'id', p_salon_id,
        'plan', v_plan_id,
        'subscription_status', v_subscription_status,
        'trial_ends_at', v_trial_ends_at,
        'is_trial_active', v_is_trial_active,
        'plan_name', v_plan_data->>'name',
        'price', v_plan_data->>'price',
        'limits', v_limits,
        'features', v_plan_data->'features',
        'blocked_features', v_plan_data->'blocked_features'
    );
END;
$function$;

-- 3. Corrigir salões existentes sem dados de trial
UPDATE public.salons 
SET 
    trial_start_at = now(),
    trial_ends_at = now() + interval '30 days',
    subscription_status = 'trialing',
    subscription_plan = 'pro'
WHERE trial_ends_at IS NULL AND subscription_status = 'trialing';
