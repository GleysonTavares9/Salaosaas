-- 1. Forçar TODAS as contas atuais para o plano FREE (sem trial)
UPDATE public.salons
SET 
    subscription_plan = 'free',
    subscription_status = 'active', -- Status ativo normal (não trialing)
    trial_ends_at = now() - interval '1 day' -- Data de fim no passado
WHERE 
    subscription_plan = 'free' OR subscription_status = 'trialing';


-- 2. Alterar a função gatilho para que NOVAS contas nasçam SEM TRIAL
CREATE OR REPLACE FUNCTION public.handle_new_salon_trial()
RETURNS trigger AS $$
BEGIN
    -- Define plano como 'free' e status como 'active' (sem trial)
    NEW.subscription_plan := 'free';
    NEW.subscription_status := 'active';
    NEW.trial_ends_at := NULL; -- Sem data de fim de trial
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
