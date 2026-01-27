# Checklist de Layout Mobile - Luxe Aura

## ✅ Telas Já Otimizadas:
- [x] Discovery (mapa + lista de salões)
- [x] SalonPage (detalhes do salão)
- [x] ProductShowcase (boutique)
- [x] SelectService (seleção de serviços)
- [x] ChooseTime (escolha de horário)
- [x] Checkout (finalização)
- [x] MyAppointments (meus agendamentos)
- [x] Profile (perfil do usuário)

## 📐 Padrões de Espaçamento:
- **Padding lateral:** `px-6` (24px)
- **Padding vertical:** `py-6` (24px)
- **Padding inferior (com botão fixo):** `pb-32` (128px)
- **Gap entre elementos:** `gap-4` ou `gap-6`

## 🔍 Pontos de Atenção:

### 1. Botões Fixos no Rodapé
Todas as telas com botão fixo devem ter `pb-32` no conteúdo principal para não cortar.

### 2. Scroll Containers
Usar classe `scroll-container` para scroll suave:
```css
.scroll-container {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
```

### 3. Tamanhos de Fonte Mínimos
- Títulos: `text-xl` ou maior
- Subtítulos: `text-sm` ou `text-xs`
- Corpo: `text-xs` (12px mínimo)
- Labels: `text-[10px]` ou maior

### 4. Áreas de Toque
- Botões: mínimo `h-12` (48px)
- Ícones clicáveis: mínimo `size-10` (40px)

## 🐛 Problemas Conhecidos:

### Serviços não aparecem:
**Causa:** Salão sem serviços cadastrados ou RLS bloqueando
**Solução:** 
1. Cadastrar serviços via painel admin
2. Executar script RLS no Supabase

### Layout cortado no rodapé:
**Causa:** Falta de padding inferior
**Solução:** Adicionar `pb-32` no container principal

## 📱 Testes Recomendados:

1. **Telas pequenas (320px):** iPhone SE
2. **Telas médias (375px):** iPhone 12/13
3. **Telas grandes (428px):** iPhone 14 Pro Max
4. **Android:** Testar em dispositivo real

## 🎨 Melhorias Futuras:

- [ ] Adicionar skeleton loading em todas as telas
- [ ] Implementar pull-to-refresh
- [ ] Adicionar haptic feedback nos botões
- [ ] Otimizar imagens para mobile (WebP)
