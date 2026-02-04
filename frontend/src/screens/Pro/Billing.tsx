import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

import { useToast } from '../../contexts/ToastContext';
const Billing: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [billingInfo, setBillingInfo] = useState<any>(null);
    const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
    const [showPixModal, setShowPixModal] = useState(false);
    const [billingPixData, setBillingPixData] = useState<any>(null);

    const handleCheckout = async (plan: any) => {
        if (plan.price === "0.00" || plan.id === 'free') {
            showToast("Este é o plano gratuito padrão.", "info");
            return;
        }

        if (!billingInfo?.id) {
            showToast("Erro: ID do salão não identificado.", "error");
            return;
        }

        setIsCheckoutLoading(true);
        showToast(`Gerando checkout via Mercado Pago...`, 'info');

        try {
            // Força a obtenção do token atual
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error("Sessão expirada. Por favor, faça login novamente.");
            }

            const { data, error } = await supabase.functions.invoke('billing-service', {
                body: {
                    action: 'create_subscription_pix',
                    salonId: billingInfo.id,
                    plan: plan.id // 'pro' ou 'premium'
                },
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            if (error) throw error;

            if (data?.qrCodeBase64) {
                setBillingPixData({ ...data, planName: plan.name, planPrice: plan.price });
                setShowPixModal(true);
            } else {
                throw new Error("Dados do PIX não retornados.");
            }

        } catch (error: any) {
            showToast("Falha no pagamento: " + (error.message || "Erro de conexão"), "error");
        } finally {
            setIsCheckoutLoading(false);
        }
    };
    const [plans, setPlans] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Buscar Planos do Banco
                const dbPlans = await api.salons.getPlans();
                if (dbPlans && dbPlans.length > 0) {
                    setPlans(dbPlans);
                } else {
                    // Fallback se não tiver tabela criada ainda
                    setPlans([
                        {
                            id: 'free',
                            name: 'Gratuito',
                            price: 'R$ 0',
                            desc: 'Essencial para começar',
                            features: ['Até 2 profissionais', 'Agenda completa', 'Página pública', 'Agendamentos ilimitados'],
                            blocked_features: ['IA Concierge', 'Gestão Financeira', 'Relatórios', 'Comissões'],
                            color: 'slate'
                        },
                        {
                            id: 'pro',
                            name: 'PRO',
                            price: 'R$ 49',
                            period: '/mês',
                            desc: 'Gestão completa do salão',
                            features: ['Profissionais ilimitados', 'Gestão financeira', 'Relatórios básicos', 'Comissões', 'IA limitada'],
                            color: 'primary',
                            highlight: true
                        },
                        {
                            id: 'premium',
                            name: 'PREMIUM',
                            price: 'R$ 99',
                            period: '/mês',
                            desc: 'Escala e inteligência',
                            features: ['IA avançada', 'Insights automáticos', 'Relatórios detalhados', 'Suporte prioritário', 'Marca personalizada'],
                            color: 'purple'
                        }
                    ]);
                }

                // 2. Buscar Info do Salão
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: pro } = await supabase.from('professionals').select('salon_id').eq('user_id', user.id).maybeSingle();
                    if (pro?.salon_id) {
                        const info = await api.salons.getBilling(pro.salon_id);
                        setBillingInfo(info);
                    }
                }
            } catch (err) {
                // Silencioso em produção
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const handleCheckPayment = async (isAuto = false) => {
        if (!billingPixData?.id) return;

        if (!isAuto) {
            setIsCheckoutLoading(true);
            showToast("Verificando pagamento...", "info");
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const { data, error } = await supabase.functions.invoke('billing-service', {
                body: {
                    action: 'check_payment_status',
                    paymentId: billingPixData.id
                },
                headers: { Authorization: `Bearer ${session?.access_token}` }
            });

            if (data?.status === 'approved') {
                showToast("Pagamento Confirmado! Bem-vindo(a) ao " + data.newPlan.toUpperCase(), "success");
                setShowPixModal(false);
                setTimeout(() => window.location.reload(), 1500);
                return true;
            } else {
                if (!isAuto) showToast("Pagamento ainda pendente. Aguarde alguns segundos.", "info");
                return false;
            }
        } catch (e) {
            if (!isAuto) showToast("Erro ao verificar. Tente novamente.", "error");
            return false;
        } finally {
            if (!isAuto) setIsCheckoutLoading(false);
        }
    };

    // Polling Automático (A cada 3s)
    useEffect(() => {
        let interval: any;
        if (showPixModal && billingPixData?.id) {
            interval = setInterval(async () => {
                const paid = await handleCheckPayment(true);
                if (paid) clearInterval(interval);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [showPixModal, billingPixData]);


    return (
        <div className="flex-1 bg-background-dark overflow-y-auto h-full no-scrollbar">
            <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-xl px-6 pt-12 pb-6 border-b border-white/5 flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="size-10 rounded-full border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div>
                    <h1 className="text-xl font-display font-black text-white italic tracking-tighter uppercase leading-none">Plano & Assinatura</h1>
                    <p className="text-primary text-[8px] font-black uppercase tracking-[0.2em] mt-1">Sua Conta Aura</p>
                </div>
            </header>

            <main className="px-6 py-10 space-y-10 safe-area-bottom pb-40 max-w-[450px] mx-auto animate-fade-in">

                <section className="text-center space-y-4">
                    <div className="size-20 rounded-[32px] gold-gradient flex items-center justify-center text-background-dark mx-auto shadow-2xl">
                        <span className="material-symbols-outlined text-4xl">workspace_premium</span>
                    </div>
                    <h2 className="text-2xl font-display font-black text-white italic tracking-tight uppercase leading-tight">Escolha o próximo<br /><span className="text-primary text-3xl">Nível de Sucesso.</span></h2>

                    {billingInfo?.is_trial_active && (
                        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mt-4 animate-pulse">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">✨ Trial Elite Ativo</p>
                            <p className="text-[8px] text-white font-bold uppercase tracking-widest mt-1">
                                {(() => {
                                    if (!billingInfo?.trial_ends_at) return '30 dias restantes';
                                    const diff = new Date(billingInfo.trial_ends_at).getTime() - new Date().getTime();
                                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                    return days > 0 ? `${days} dias de acesso premium liberado` : 'Trial encerrado';
                                })()}
                            </p>
                        </div>
                    )}
                </section>

                <div className="space-y-6">
                    {plans.map((p, i) => {
                        const isCurrent = billingInfo?.plan === p.id;
                        return (
                            <div key={i} className={`relative bg-surface-dark border p-8 rounded-[40px] shadow-2xl transition-all hover:scale-[1.02] ${p.highlight ? 'border-primary ring-1 ring-primary/50' : 'border-white/5'} ${isCurrent ? 'border-emerald-500/50' : ''}`}>
                                {p.highlight && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 gold-gradient px-4 py-1 rounded-full text-[8px] font-black text-background-dark uppercase tracking-widest">Mais Popular</div>
                                )}
                                {isCurrent && (
                                    <div className="absolute -top-3 right-8 bg-emerald-500 px-4 py-1 rounded-full text-[8px] font-black text-white uppercase tracking-widest">Plano Atual</div>
                                )}

                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className={`text-xl font-display font-black italic uppercase italic tracking-tighter ${p.color === 'primary' ? 'text-primary' : 'text-white'}`}>{p.name}</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{p.desc}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-display font-black text-white tracking-tighter leading-none">{p.price}<span className="text-[10px] text-slate-500">{p.period}</span></p>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    {p.features.map((f, fi) => (
                                        <div key={fi} className="flex items-center gap-3">
                                            <span className="material-symbols-outlined text-emerald-500 text-sm font-black">check_circle</span>
                                            <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest">{f}</span>
                                        </div>
                                    ))}
                                    {p.blocked?.map((b, bi) => (
                                        <div key={bi} className="flex items-center gap-3 opacity-40">
                                            <span className="material-symbols-outlined text-red-500 text-sm">block</span>
                                            <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest line-through">{b}</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => isCurrent ? null : handleCheckout(p)}
                                    disabled={isCurrent}
                                    className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl active:scale-95 transition-all ${isCurrent ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : p.highlight ? 'gold-gradient text-background-dark' : 'bg-white/5 border border-white/10 text-white'}`}
                                >
                                    {isCurrent ? 'Plano Ativo' : 'Migrar Plano'}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <section className="bg-primary/5 border border-primary/20 p-8 rounded-[40px] text-center">
                    <span className="material-symbols-outlined text-primary mb-2">lock_reset</span>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                        Todas as transações são seguras e processadas pelo Mercado Pago. Cancele quando quiser.
                    </p>
                </section>

            </main>

            {/* MODAL PIX NATIVO */}
            {showPixModal && billingPixData && (
                <div className="fixed inset-0 z-[100] bg-background-dark/95 backdrop-blur-xl animate-fade-in flex flex-col justify-center items-center p-6">
                    <div className="bg-surface-dark border border-white/10 rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative overflow-hidden">
                        <button onClick={() => setShowPixModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>

                        <div className="flex flex-col items-center text-center space-y-6">
                            <div>
                                <h3 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">Pagamento Pix</h3>
                                <p className="text-[9px] text-primary font-black uppercase tracking-widest mt-1">Plano {billingPixData.planName}</p>
                            </div>

                            <div className="bg-white p-4 rounded-3xl border-4 border-primary shadow-lg">
                                {billingPixData.qrCodeBase64 ? (
                                    <img src={`data:image/jpeg;base64,${billingPixData.qrCodeBase64}`} className="size-48 object-contain" alt="QR Code" />
                                ) : (
                                    <div className="size-48 flex items-center justify-center text-black font-bold text-xs">QR Code Indisponível</div>
                                )}
                            </div>

                            <div className="space-y-2 w-full">
                                <label className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Copia e Cola</label>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={billingPixData.qrCode}
                                        className="w-full bg-black/20 border border-white/5 rounded-xl px-3 py-2 text-[10px] text-slate-300 font-mono truncate outline-none select-all"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(billingPixData.qrCode);
                                            showToast('Código copiado!', 'success');
                                        }}
                                        className="bg-primary text-background-dark p-2 rounded-xl active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-lg">content_copy</span>
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4 w-full space-y-3">
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                                    <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wide">
                                        Valor Final: R$ {billingPixData.planPrice}
                                    </p>
                                </div>
                                <button
                                    onClick={handleCheckPayment}
                                    className="w-full gold-gradient text-background-dark py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all"
                                >
                                    {isCheckoutLoading ? 'Verificando...' : 'Já Paguei'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Billing;
