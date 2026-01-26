
# Estrutura do Banco de Dados Luxe Aura (Supabase)

## Arquitetura Multi-Tenant
O sistema utiliza o `salon_id` como chave mestra de isolamento. Cada salão é uma entidade independente que gerencia seus próprios profissionais, serviços, produtos e horários.

## Tabelas e Interligações

### 1. `salons` (O Coração)
Contém metadados da marca e o campo `horario_funcionamento` (JSONB). 
- **Interligação**: O frontend de agendamento (`ChooseTime.tsx`) consome este JSON para validar se o estabelecimento está aberto.

### 2. `products` (Gestão de Estoque)
Gerencia o inventário da Aura Boutique.
- **Campos Críticos**: `stock` (quantidade) e `price`.
- **Interligação**: O `ProductShowcase.tsx` oculta produtos com `stock <= 0` e o `ProductCatalog.tsx` permite ao admin repor o estoque.

### 3. `appointments` (Fluxo de Receita)
Registra serviços e compras de produtos.
- **Relacionamentos**: Conecta `clients`, `professionals` e `salons`.
- **Status de Pagamento**: Determina se a reserva está confirmada ou pendente.

### 4. `professionals` (Recursos Humanos)
- **Comissão**: Campo para cálculo automático de ganhos no `Dashboard`.

## Regras de Negócio Implementadas
- **Reserva Exige Login**: Nenhuma transação (`Checkout`) é permitida sem um `client_id` válido.
- **Estoque Dinâmico**: O sistema deve decrementar o `stock` em `products` após uma confirmação de pagamento de compra de produto.
