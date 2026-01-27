# 🚨 Guia de Solução de Erros - Luxe Aura

## Erro 1: 401 Unauthorized (Acesso Negado)

### 🔍 Sintoma:
```
Failed to load resource: the server responded with a status of 401
```

### 🎯 Causa:
As políticas de RLS (Row Level Security) estão bloqueando o acesso público aos dados.

### ✅ Solução:
1. Abra o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Execute o script `backend/fix_rls_401.sql`
4. Recarregue a página (F5)

### 📝 O que o script faz:
- Permite leitura pública de salões, serviços, produtos, etc.
- Mantém proteção em operações de escrita
- Necessário para o marketplace funcionar

---

## Erro 2: 429 Too Many Requests (Limite de Taxa)

### 🔍 Sintoma:
```
POST /auth/v1/signup 429 (Too Many Requests)
AuthApiError: email rate limit exceeded
```

### 🎯 Causa:
Você tentou criar muitas contas em pouco tempo. O Supabase limita cadastros para prevenir spam.

### ✅ Soluções:

#### Opção 1: Aguardar (Recomendado)
⏰ **Aguarde 1 hora** e tente novamente. O limite é resetado automaticamente.

#### Opção 2: Usar Conta Existente
Em vez de criar nova conta, faça **login** com uma conta que já existe.

#### Opção 3: Desabilitar Confirmação de Email (Dev)
**Apenas para desenvolvimento:**
1. Supabase Dashboard → **Authentication** → **Settings**
2. Desative **"Enable email confirmations"**
3. Isso permite criar contas mais rapidamente

#### Opção 4: Aumentar Limite (Produção)
**Para produção:**
1. Supabase Dashboard → **Settings** → **Auth** → **Rate Limits**
2. Aumente o limite de **signups por hora**

### 🛡️ Proteção Implementada:
Agora o app mostra uma mensagem amigável:
```
⏰ Limite de cadastros atingido!

Você tentou criar muitas contas em pouco tempo. 
Por favor, aguarde 1 hora e tente novamente.

Se já possui uma conta, faça login em vez de criar uma nova.
```

---

## 📊 Resumo dos Limites do Supabase (Free Tier)

| Operação | Limite | Período |
|----------|--------|---------|
| Cadastros (signup) | 30-60 | Por hora |
| Login (signin) | Ilimitado | - |
| Requisições API | 500 | Por segundo |
| Armazenamento | 500 MB | Total |
| Bandwidth | 5 GB | Por mês |

---

## 🔧 Checklist de Troubleshooting

### Antes de testar cadastro:
- [ ] Executou o script `fix_rls_401.sql` no Supabase?
- [ ] Aguardou 1 hora desde o último erro 429?
- [ ] Verificou se o email já não está cadastrado?
- [ ] Está usando um email válido?

### Se o erro persistir:
1. **Limpe o cache** do navegador (Ctrl + Shift + Delete)
2. **Abra em aba anônima** para testar
3. **Verifique o console** do navegador (F12)
4. **Veja os logs** do Supabase Dashboard

---

## 🎯 Fluxo Correto de Teste

### Para testar cadastro de parceiros:
1. ✅ Execute `fix_rls_401.sql` (uma vez)
2. ✅ Aguarde 1 hora se já tentou antes
3. ✅ Use um email NOVO (não cadastrado)
4. ✅ Preencha todos os campos
5. ✅ Clique em "Criar minha conta"
6. ✅ Aguarde o redirecionamento

### Para testar cadastro de clientes:
1. ✅ Execute `fix_rls_401.sql` (uma vez)
2. ✅ Aguarde 1 hora se já tentou antes
3. ✅ Use um email DIFERENTE do parceiro
4. ✅ Preencha todos os campos
5. ✅ Clique em "Criar minha conta"
6. ✅ Aguarde o redirecionamento

---

## 🚀 Próximos Passos

Após resolver os erros:

1. **Cadastre um salão** (conta de parceiro)
2. **Configure o negócio** (endereço, horários)
3. **Adicione serviços** (corte, barba, etc.)
4. **Teste como cliente** (crie outra conta)
5. **Faça um agendamento** de teste
6. **Avalie o salão** após o agendamento

---

## 📞 Suporte

Se os erros persistirem após seguir este guia:

1. Verifique os **logs do Supabase**
2. Confira as **políticas de RLS** no dashboard
3. Teste com **email diferente**
4. Aguarde **1 hora completa** para rate limit

**Lembre-se:** Estes erros são **normais em desenvolvimento** e foram tratados com mensagens amigáveis para o usuário final! ✅
