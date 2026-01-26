-- 1. Habilita extensão de criptografia
create extension if not exists pgcrypto;

-- 2. Cria a função que será executada antes de salvar
create or replace function encrypt_mp_token() returns trigger as $$
begin
  -- Verifica se existe um novo token para salvar
  if new.mp_access_token is not null and new.mp_access_token <> '' then
     
     -- Verifica se o token mudou em relação ao que já estava salvo
     if (TG_OP = 'INSERT') or (old.mp_access_token is null) or (new.mp_access_token <> old.mp_access_token) then
        
        -- CRIPTOGRAFA O DADO ANTES DE ENTRAR NO BANCO
        -- A função pgp_sym_encrypt usa criptografia simétrica forte.
        -- 'AURA_MASTER_KEY_2026' é a senha usada para criptografar.
        -- Se quiser mudar, altere aqui antes de rodar.
        new.mp_access_token = pgp_sym_encrypt(new.mp_access_token, 'AURA_MASTER_KEY_2026');
        
     end if;
  end if;
  return new;
end;
$$ language plpgsql;

-- 3. Cria o Gatilho (Trigger) na tabela salons
drop trigger if exists trg_encrypt_mp_token on public.salons;

create trigger trg_encrypt_mp_token
before insert or update on public.salons
for each row execute procedure encrypt_mp_token();
