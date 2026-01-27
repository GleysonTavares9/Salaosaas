# Luxe Aura - Salão SaaS 💇‍♂️✨

O **Luxe Aura** é uma plataforma SaaS premium completa para gestão de salões de beleza, barbearias e centros de estética. Desenvolvido com foco em uma experiência de usuário luxuosa, o sistema oferece desde o agendamento inteligente até a descoberta de estabelecimentos via geolocalização.

---

## 🌟 Diferenciais Premium

- **Discovery Experience (Leaflet + OSM)**: Mapa interativo em modo escuro com geolocalização em tempo real, cálculo de distância (Haversine) e ordenação por proximidade.
- **Agenda Ultra-Fluida**: Sistema de agendamento com suporte a Drag & Drop para reagendamentos rápidos.
- **Aura Design System**: Interface 100% customizada com Tailwind CSS, eliminando elementos nativos do navegador para uma experiência imersiva e luxuosa.
- **AI Concierge**: Inteligência artificial integrada para auxiliar clientes na escolha de serviços e agendamentos.
- **Gestão Completa**: Controle de profissionais, catálogo de serviços, produtos e analytics detalhados para o proprietário.

---

## 🛠️ Stack Tecnológica

### Frontend
- **React 18** + **TypeScript**
- **Tailwind CSS** (Design System Customizado)
- **React Router DOM** (Navegação SPA)
- **Leaflet & OpenStreetMap** (Mapas e Geodados)
- **Lucide & Material Symbols** (Iconografia Premium)

### Backend & Infra
- **Supabase** (Database, Auth, Realtime)
- **PostgreSQL** (Scripts de funções e encriptação incluídos)
- **Vercel** (Deploy & CI/CD)

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js (v18 ou superior)
- NPM ou Yarn

### 1. Clonar o Repositório
```bash
git clone https://github.com/GleysonTavares9/Salaosaas.git
cd Salaosaas
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na pasta `frontend` com suas credenciais do Supabase:
```env
VITE_SUPABASE_URL=seu_url
VITE_SUPABASE_ANON_KEY=sua_chave_anon
```

---

## 📂 Estrutura do Projeto

- `/frontend`: Aplicação React com telas de cliente e profissional.
- `/backend`: Scripts SQL para setup do banco de dados no Supabase.
- `update_db_mp.sql`: Script para atualização de tabelas de pagamento (Mercado Pago).
- `encrypt_mp_token.sql`: Segurança de tokens via vault.

---

## 🛡️ Segurança e Privacidade

O sistema utiliza Row Level Security (RLS) no Supabase para garantir que proprietários e profissionais acessem apenas os dados de seus respectivos estabelecimentos, enquanto clientes gerenciam apenas seus próprios agendamentos.

---

<p align="center">
  Desenvolvido com ❤️ para transformar a gestão da beleza. <br>
  <b>Luxe Aura - Onde a tecnologia encontra a elegância.</b>
</p>
