-- Fix Login Trigger Issue (Error 500 on signIn)
-- Checks if the trigger exists and replaces it to ensure it doesn't break login (UPDATE on auth.users)

-- 1. Recria a função de handler para ser mais segura
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    COALESCE(new.raw_user_meta_data->>'role', 'client'),
    new.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    email = EXCLUDED.email; -- Mantém email sincronizado
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Remove gatilhos conflitantes antigos (limpeza)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- 3. Cria o gatilho APENAS para INSERT (Criação de conta)
-- Isso evita que o login (que faz UPDATE em last_sign_in_at) dispare o trigger e cause erro 500.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Opcional: Se quisermos sincronizar updates de metadados, criamos um trigger separado filtrado
-- mas por enquanto, vamos deixar apenas INSERT para garantir que o login funcione.
-- Se precisar de sync de update, descomentar abaixo COM A CLAUSULA WHEN:
/*
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (old.raw_user_meta_data IS DISTINCT FROM new.raw_user_meta_data)
  EXECUTE FUNCTION public.handle_new_user();
*/
