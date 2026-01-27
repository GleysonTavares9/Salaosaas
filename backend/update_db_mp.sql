ALTER TABLE public.salons 
ADD COLUMN IF NOT EXISTS mp_public_key TEXT;

ALTER TABLE public.salons 
ADD COLUMN IF NOT EXISTS mp_access_token TEXT;
