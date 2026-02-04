import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 bg-background-dark min-h-screen flex flex-col p-8 overflow-y-auto no-scrollbar relative">
      <header className="pt-[calc(env(safe-area-inset-top)+2rem)] pb-8 flex items-center justify-between sticky top-0 bg-background-dark/80 backdrop-blur-md z-10 -mx-8 px-8">
        <button onClick={() => navigate(-1)} className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-display text-xs font-black text-white italic tracking-[0.3em] uppercase opacity-90 text-center">Privacidade</h1>
        <div className="size-12"></div>
      </header>

      <main className="max-w-2xl mx-auto w-full pb-32">
        <div className="mb-12 text-center">
          <div className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-full inline-block mb-4">
            <span className="text-[8px] font-black text-primary uppercase tracking-[0.3em]">Segurança Aura</span>
          </div>
          <h2 className="text-4xl font-display font-black text-white italic tracking-tighter mb-4 leading-none">
            Política de <br /> <span className="text-primary tracking-[-0.05em]">Privacidade.</span>
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Última atualização: Fevereiro 2026</p>
        </div>

        <section className="space-y-10 prose prose-invert prose-sm max-w-none text-slate-400">
          <div className="space-y-4">
            <h3 className="text-white text-xs font-black uppercase tracking-widest border-l-2 border-primary pl-4">1. Coleta de Informações</h3>
            <p className="text-[11px] leading-relaxed font-medium uppercase tracking-wider">
              Coletamos informações necessárias para a prestação de nossos serviços, incluindo nome, e-mail, telefone e dados de agendamento. Ao utilizar a Aura, você concorda com a coleta e uso de informações de acordo com esta política.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-white text-xs font-black uppercase tracking-widest border-l-2 border-primary pl-4">2. Uso de Dados</h3>
            <p className="text-[11px] leading-relaxed font-medium uppercase tracking-wider">
              Seus dados são utilizados exclusivamente para gerenciar seus agendamentos, facilitar a comunicação com os salões e melhorar sua experiência na plataforma. Nunca vendemos seus dados para terceiros.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-white text-xs font-black uppercase tracking-widest border-l-2 border-primary pl-4">3. Pagamento Seguro</h3>
            <p className="text-[11px] leading-relaxed font-medium uppercase tracking-wider">
              As transações financeiras são processadas via Mercado Pago. A Aura não armazena dados completos de cartões de crédito em seus servidores, garantindo total conformidade com os padrões de segurança PCI-DSS.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-white text-xs font-black uppercase tracking-widest border-l-2 border-primary pl-4">4. Seus Direitos</h3>
            <p className="text-[11px] leading-relaxed font-medium uppercase tracking-wider">
              Você tem o direito de acessar, corrigir ou excluir suas informações pessoais a qualquer momento através das configurações do seu perfil ou entrando em contato com nosso suporte.
            </p>
          </div>

          <div className="mt-16 pt-12 border-t border-white/5 text-center">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Compromisso Luxe Aura Premium</p>
            <div className="flex justify-center mt-6">
              <span className="material-symbols-outlined text-4xl text-primary/20">verified_user</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
