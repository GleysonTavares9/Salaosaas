import React from 'react';
import { useNavigate } from 'react-router-dom';

const TermsOfUse: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="flex-1 bg-background-dark min-h-screen flex flex-col p-8 sm:p-8 lg:p-8 overflow-y-auto no-scrollbar relative">
            <header className="pt-[calc(env(safe-area-inset-top)+2rem)] pb-8 flex items-center justify-between sticky top-0 bg-background-dark/80 backdrop-blur-md z-10 -mx-8 px-8 sm:px-8 lg:px-8">
                <button onClick={() => navigate(-1)} className="size-10 sm:size-12 lg:size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="font-display text-xs font-black text-white italic tracking-[0.3em] uppercase opacity-90 text-center">Contrato</h1>
                <div className="size-10 sm:size-12 lg:size-12"></div>
            </header>

            <main className="max-w-full sm:max-w-2xl mx-auto w-full pb-32">
                <div className="mb-12 text-center">
                    <div className="px-4 sm:px-4 lg:px-4 py-2 sm:py-2 lg:py-2 bg-primary/10 border border-primary/20 rounded-full inline-block mb-4">
                        <span className="text-[8px] font-black text-primary uppercase tracking-[0.3em]">Termos Legais</span>
                    </div>
                    <h2 className="text-4xl lg:text-4xl font-display font-black text-white italic tracking-tighter mb-4 leading-none">
                        Termos de <br /> <span className="text-primary tracking-[-0.05em]">Serviço Aura.</span>
                    </h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Versão 1.0.1 - 2026</p>
                </div>

                <section className="space-y-10 prose prose-invert prose-sm max-w-none text-slate-400">
                    <div className="space-y-4">
                        <h3 className="text-white text-xs font-black uppercase tracking-widest border-l-2 border-primary pl-4">1. Aceitação dos Termos</h3>
                        <p className="text-[11px] leading-relaxed font-medium uppercase tracking-wider">
                            Ao acessar e utilizar a plataforma Luxe Aura, você concorda em cumprir estes Termos de Uso e todas as leis e regulamentos aplicáveis. A plataforma facilita o agendamento de serviços de beleza e bem-estar.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-white text-xs font-black uppercase tracking-widest border-l-2 border-primary pl-4">2. Responsabilidades do Usuário</h3>
                        <p className="text-[11px] leading-relaxed font-medium uppercase tracking-wider">
                            O usuário é responsável por fornecer informações precisas e manter a confidencialidade de sua conta. Agendamentos não comparecidos (no-show) podem estar sujeitos a políticas de cancelamento específicas de cada salão parceiro.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-white text-xs font-black uppercase tracking-widest border-l-2 border-primary pl-4">3. Pagamentos e Reembolsos</h3>
                        <p className="text-[11px] leading-relaxed font-medium uppercase tracking-wider">
                            Pagamentos realizados via plataforma são processados de forma segura. Pedidos de reembolso devem ser tratados diretamente com o estabelecimento prestador do serviço, respeitando as normas do Código de Defesa do Consumidor.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-white text-xs font-black uppercase tracking-widest border-l-2 border-primary pl-4">4. Limitação de Responsabilidade</h3>
                        <p className="text-[11px] leading-relaxed font-medium uppercase tracking-wider">
                            A Aura atua como intermediária de agendamento. A responsabilidade técnica pela execução dos serviços de beleza, higiene e saúde é exclusiva do profissional e do salão selecionado pelo usuário.
                        </p>
                    </div>

                    <div className="mt-16 pt-12 border-t border-white/5 text-center">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Luxe Aura Software as a Service</p>
                        <div className="flex justify-center mt-6">
                            <span className="material-symbols-outlined text-4xl lg:text-4xl text-primary/20">gavel</span>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default TermsOfUse;
