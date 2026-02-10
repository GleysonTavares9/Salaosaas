import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { supabase, supabaseAnonKey } from '../../lib/supabase';

import { useToast } from '../../contexts/ToastContext';
const Billing: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [billingInfo, setBillingInfo] = useState<any>(null);
    const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
    const [showPixModal, setShowPixModal] = useState(false);
    const [billingPixData, setBillingPixData] = useState<any>(null);

    const handleCheckout = async (plan: any) => {

        // Bloqueia apenas se for explicitamente gratuito/zero, mas permite Starter
        if ((plan.price === "0.00" || plan.id === 'free') && plan.id !== 'starter') {
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

            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/billing-service`;

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseAnonKey}`, // Teste com Anon Key para passar pelo Gateway
                    'apikey': supabaseAnonKey
                },
                body: JSON.stringify({
                    action: 'create_subscription_pix',
                    salonId: billingInfo.id,
                    plan: plan.id
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
            }

            const data = await response.json();

            // Lógica Híbrida: Tenta pegar do novo formato (raiz) ou do antigo (aninhado)
            const qrCodeBase64 = data.qrCodeBase64 || data.point_of_interaction?.transaction_data?.qr_code_base64;
            const qrCode = data.qrCode || data.point_of_interaction?.transaction_data?.qr_code;
            const paymentId = data.id;

            if (qrCodeBase64) {
                setBillingPixData({
                    id: paymentId,
                    qrCodeBase64,
                    qrCode,
                    planName: plan.name,
                    planPrice: plan.price
                });
                setShowPixModal(true);
            } else {
                throw new Error("Dados do PIX não retornados pelo Mercado Pago.");
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
            console.log("🚀 Iniciando carregamento de cobrança...");
            try {
                // 1. Tentar buscar Planos do Banco
                let mappedPlans = [];
                try {
                    const dbPlans = await api.salons.getPlans();
                    if (dbPlans && dbPlans.length > 0) {
                        mappedPlans = dbPlans.map((p: any) => ({
                            id: p.id,
                            name: p.name,
                            price: `R$ ${p.price}`,
                            period: p.period || '/mês',
                            desc: p.description,
                            features: p.features || [],
                            blocked_features: p.blocked_features || [],
                            color: p.color || (p.id === 'pro' ? 'primary' : p.id === 'premium' ? 'yellow' : 'slate'),
                            highlight: p.highlight || false
                        }));
                    }
                } catch (planErr) {
                    console.error("❌ Erro ao buscar planos do banco, usando fallback:", planErr);
                }

                // Fallback se o banco estiver vazio ou falhar
                if (mappedPlans.length === 0) {
                    mappedPlans = [
                        { id: 'starter', name: 'Starter', price: 'R$ 19', period: '/mês', desc: 'Manutenção & Servidor', features: ['Acesso ao sistema', 'Até 2 profissionais', 'Agendamentos ilimitados'], color: 'slate' },
                        { id: 'pro', name: 'PRO', price: 'R$ 49', period: '/mês', desc: 'Gestão completa', features: ['Profissionais ilimitados', 'Gestão financeira', 'Relatórios', 'Comissões', 'IA limitada'], color: 'primary', highlight: true },
                        { id: 'premium', name: 'PREMIUM', price: 'R$ 99', period: '/mês', desc: 'Elite com IA', features: ['IA Concierge Ilimitada', 'Relatórios Avançados', 'Suporte Prioritário'], color: 'yellow' }
                    ];
                }
                setPlans(mappedPlans);

                // 2. Buscar Info do Salão
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    console.log("👤 Usuário identificado:", user.id);

                    // Estratégia de busca de Salon ID mais segura
                    let salonId = null;

                    // Tenta primeiro via Professionals (funciona para Admin e Pro)
                    const { data: pro } = await supabase.from('professionals').select('salon_id').eq('user_id', user.id).maybeSingle();
                    salonId = pro?.salon_id;

                    if (!salonId) {
                        // Se não for profissional, tenta ver se é admin master ou dono direto
                        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                        if (profile?.role === 'admin') {
                            const salons = await api.salons.getAll();
                            if (salons?.length > 0) salonId = salons[0].id;
                        }
                    }

                    if (salonId) {
                        console.log("🏢 Salão identificado:", salonId);
                        const info = await api.salons.getBilling(salonId);
                        setBillingInfo({
                            ...info,
                            plan: info?.plan || info?.plan_id || 'starter',
                            id: salonId
                        });
                    }
                }
            } catch (err) {
                console.error("🔥 Erro crítico no faturamento:", err);
                showToast("Erro ao carregar dados de assinatura.", "error");
            } finally {
                console.log("✅ Fim do carregamento.");
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
            // Check manual usando fetch + anon key para garantir permissão
            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/billing-service`;
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                    'apikey': supabaseAnonKey
                },
                body: JSON.stringify({
                    action: 'check_payment_status',
                    paymentId: billingPixData.id
                })
            });

            const data = await response.json();

            if (data?.status === 'approved') {
                showToast("Pagamento Confirmado! Bem-vindo(a) ao " + (data.newPlan || 'Novo Plano').toUpperCase(), "success");
                setShowPixModal(false);
                setTimeout(() => window.location.reload(), 1500);
                return true;
            } else {
                if (!isAuto && response.ok) showToast("Pagamento ainda pendente. Aguarde alguns segundos.", "info");
                return false;
            }
        } catch (e) {
            if (!isAuto) showToast("Erro ao verificar status.", "error");
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
        <div className="flex-1 overflow-y-auto h-full no-scrollbar">
            <header className="sticky top-0 z-50 bg-background-dark/30 backdrop-blur-xl px-4 lg:px-6 pt-2 lg:pt-12 pb-2 lg:pb-6 border-b border-white/5 flex items-center gap-3 lg:gap-4">
                <button onClick={() => navigate(-1)} className="size-9 lg:size-10 rounded-full border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                </button>
                <div>
                    <h1 className="text-base lg:text-xl font-display font-black text-white italic tracking-tighter uppercase leading-none">Plano & Assinatura</h1>
                    <p className="text-primary text-[7px] font-black uppercase tracking-[0.2em] mt-0.5">Sua Conta Aura</p>
                </div>
            </header>

            <main className="px-6 sm:px-6 lg:px-6 lg:px-12 sm:px-12 lg:px-12 py-10 sm:py-10 lg:py-10 lg:py-20 sm:py-20 lg:py-20 space-y-16 safe-area-bottom pb-40 max-w-full max-w-[1400px] mx-auto animate-fade-in">

                <section className="text-center space-y-6">
                    <div className="size-14 sm:size-16 lg:size-20 lg:size-18 sm:size-20 lg:size-24 rounded-2xl sm:rounded-3xl lg:rounded-[32px] lg:rounded-2xl sm:rounded-3xl lg:rounded-[40px] gold-gradient flex items-center justify-center text-background-dark mx-auto shadow-2xl">
                        <span className="material-symbols-outlined text-4xl lg:text-4xl lg:text-3xl sm:text-4xl lg:text-5xl lg:text-3xl sm:text-4xl lg:text-5xl">workspace_premium</span>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl lg:text-2xl lg:text-3xl sm:text-4xl lg:text-5xl lg:text-3xl sm:text-4xl lg:text-5xl font-display font-black text-white italic tracking-tighter uppercase leading-tight">Escolha o próximo<br /><span className="text-primary text-3xl lg:text-3xl lg:text-5xl sm:text-6xl lg:text-7xl lg:text-5xl sm:text-6xl lg:text-7xl">Nível de Sucesso.</span></h2>
                        <p className="text-[10px] lg:text-xs text-slate-500 font-bold uppercase tracking-[0.5em] lg:mt-4">Planos desenhados para a escala do seu negócio</p>
                    </div>

                    {billingInfo?.is_trial_active && (
                        <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6 sm:p-6 lg:p-6 lg:p-8 sm:p-8 lg:p-8 mt-8 animate-pulse max-w-full max-w-[600px] mx-auto">
                            <p className="text-[10px] lg:text-xs font-black text-primary uppercase tracking-[0.4em] mb-2 leading-none">✨ Trial Elite Ativo</p>
                            <p className="text-[11px] lg:text-sm text-white font-bold uppercase tracking-widest mt-1">
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

                <div className="grid grid-cols-1 md:grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-8 lg:gap-12 lg:gap-12">
                    {plans.map((p, i) => {
                        const isCurrent = billingInfo?.plan === p.id || billingInfo?.plan_id === p.id;
                        return (
                            <div key={i} className={`relative flex flex-col bg-surface-dark border p-8 sm:p-8 lg:p-8 lg:p-10 sm:p-10 lg:p-10 rounded-2xl sm:rounded-3xl lg:rounded-[40px] lg:rounded-2xl sm:rounded-3xl lg:rounded-[56px] shadow-2xl transition-all hover:scale-[1.02] ${p.highlight ? 'border-primary shadow-[0_30px_100px_rgba(193,165,113,0.15)] ring-1 ring-primary/30' : 'border-white/5'} ${isCurrent ? 'border-emerald-500/50' : ''}`}>
                                {p.highlight && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 gold-gradient px-6 sm:px-6 lg:px-6 py-2 sm:py-2 lg:py-2 rounded-full text-[9px] font-black text-background-dark uppercase tracking-widest shadow-gold">Mais Popular</div>
                                )}
                                {isCurrent && (
                                    <div className="absolute -top-3 right-8 bg-emerald-500 px-5 sm:px-5 lg:px-5 py-2 sm:py-2 lg:py-2 rounded-full text-[9px] font-black text-white uppercase tracking-widest shadow-2xl">Plano Atual</div>
                                )}

                                <div className="space-y-6 mb-10">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className={`text-2xl lg:text-2xl lg:text-3xl lg:text-3xl font-display font-black italic uppercase italic tracking-tighter ${p.color === 'primary' ? 'text-primary' : 'text-white'}`}>{p.name}</h3>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{p.desc}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-baseline gap-1 lg:gap-1">
                                        <p className="text-4xl lg:text-4xl lg:text-3xl sm:text-4xl lg:text-5xl lg:text-3xl sm:text-4xl lg:text-5xl font-display font-black text-white tracking-tighter leading-none">{p.price}</p>
                                        <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest">{p.period}</p>
                                    </div>
                                </div>

                                <div className="space-y-5 mb-10 flex-1">
                                    {p.features.map((f, fi) => (
                                        <div key={fi} className="flex items-center gap-4 lg:gap-4">
                                            <div className="size-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-emerald-500 text-[14px] font-black">check</span>
                                            </div>
                                            <span className="text-[10px] lg:text-[11px] text-slate-300 font-bold uppercase tracking-widest">{f}</span>
                                        </div>
                                    ))}
                                    {p.blocked?.map((b, bi) => (
                                        <div key={bi} className="flex items-center gap-4 lg:gap-4 opacity-30">
                                            <div className="size-5 rounded-full bg-white/5 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-slate-500 text-[14px]">close</span>
                                            </div>
                                            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest line-through">{b}</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => (isCurrent || isLoading) ? null : handleCheckout(p)}
                                    disabled={isCurrent || isLoading}
                                    className={`w-full py-6 sm:py-6 lg:py-6 rounded-2xl lg:rounded-3xl font-black uppercase tracking-[0.3em] text-[10px] lg:text-[11px] shadow-2xl active:scale-95 transition-all
                                        ${isCurrent ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                            : p.highlight ? 'gold-gradient text-background-dark shadow-gold hover:brightness-110'
                                                : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'} 
                                        ${(isLoading && !isCurrent) ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                    {isLoading ? 'Carregando...' : (isCurrent ? 'Plano Ativo' : 'Efetivar Assinatura')}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <section className="bg-primary/5 border border-white/5 p-10 sm:p-10 lg:p-10 lg:p-14 sm:p-16 lg:p-18 sm:p-14 sm:p-16 lg:p-18 lg:p-14 sm:p-16 lg:p-18 rounded-2xl sm:rounded-3xl lg:rounded-[40px] lg:rounded-2xl sm:rounded-3xl lg:rounded-[64px] text-center max-w-full max-w-[800px] mx-auto">
                    <div className="size-10 sm:size-12 lg:size-14 lg:size-10 sm:size-12 lg:size-16 rounded-3xl bg-white/5 flex items-center justify-center text-primary mx-auto mb-8 border border-white/5 shadow-inner">
                        <span className="material-symbols-outlined text-3xl lg:text-3xl">verified_user</span>
                    </div>
                    <p className="text-[10px] lg:text-xs text-slate-400 font-bold uppercase tracking-widest leading-loose">
                        Segurança Platinum by Mercado Pago. Acesso instantâneo após confirmação. Gestão transparente sem contratos de fidelidade. Cancele ou mude de nível a qualquer momento.
                    </p>
                </section>

            </main>

            {/* MODAL PIX NATIVO - VISUAL REDESENHADO */}
            {showPixModal && billingPixData && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl animate-fade-in flex flex-col justify-center items-center p-6 sm:p-6 lg:p-6">
                    <div className="w-full max-w-full max-w-[360px] bg-surface-dark border border-white/10 rounded-2xl sm:rounded-3xl lg:rounded-[48px] p-8 sm:p-8 lg:p-8 shadow-2xl relative animate-scale-in">

                        <button
                            onClick={() => setShowPixModal(false)}
                            className="absolute top-6 right-6 size-10 sm:size-12 lg:size-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>

                        <div className="flex flex-col items-center text-center">
                            <h3 className="text-2xl lg:text-2xl font-display font-black text-white italic tracking-tighter uppercase mb-1">
                                Pagamento Pix
                            </h3>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-8">
                                Plano {billingPixData.planName}
                            </p>

                            <div className="bg-white p-4 sm:p-4 lg:p-4 rounded-2xl sm:rounded-3xl lg:rounded-[32px] border-4 border-primary shadow-gold-lg mb-8 relative group cursor-pointer"
                                onClick={() => {
                                    navigator.clipboard.writeText(billingPixData.qrCode);
                                    showToast('Código copiado!', 'success');
                                }}
                            >
                                {billingPixData.qrCodeBase64 ? (
                                    <img
                                        src={`data:image/jpeg;base64,${billingPixData.qrCodeBase64}`}
                                        className="size-42 sm:size-44 lg:size-48 object-contain"
                                        alt="QR Code"
                                    />
                                ) : (
                                    <div className="size-42 sm:size-44 lg:size-48 flex items-center justify-center text-black font-bold text-xs uppercase tracking-widest">
                                        QR Code Indisponível
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-primary/90 opacity-0 group-hover:opacity-100 transition-opacity rounded-[28px] flex flex-col items-center justify-center gap-2 lg:gap-2">
                                    <span className="material-symbols-outlined text-background-dark text-4xl lg:text-4xl">content_copy</span>
                                    <span className="text-[10px] font-black text-background-dark uppercase tracking-widest">Clique para Copiar</span>
                                </div>
                            </div>

                            <div className="w-full space-y-4">
                                <div className="bg-black/40 border border-white/5 rounded-2xl p-2 sm:p-2 lg:p-2 flex items-center pl-4 pr-1 gap-3 lg:gap-3 shadow-inner">
                                    <span className="material-symbols-outlined text-primary text-xl">account_balance_wallet</span>
                                    <input
                                        readOnly
                                        value={billingPixData.qrCode}
                                        className="flex-1 bg-transparent text-[11px] text-slate-400 font-mono focus:outline-none truncate tracking-wide"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(billingPixData.qrCode);
                                            showToast('Copiado!', 'success');
                                        }}
                                        className="bg-primary hover:bg-white text-background-dark size-10 sm:size-12 lg:size-10 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-lg"
                                    >
                                        <span className="material-symbols-outlined text-lg">content_copy</span>
                                    </button>
                                </div>

                                <div className="flex items-center justify-center gap-3 lg:gap-3 bg-black/40 border border-white/5 rounded-2xl px-4 sm:px-4 lg:px-4 py-4 sm:py-4 lg:py-4 shadow-inner">
                                    <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Valor Total:</span>
                                    <span className="text-3xl lg:text-3xl font-display font-black text-primary italic tracking-tighter drop-shadow-sm leading-none">
                                        R$ {billingPixData.planPrice}
                                    </span>
                                </div>

                                <button
                                    onClick={() => handleCheckPayment()}
                                    disabled={isCheckoutLoading}
                                    className="w-full gold-gradient text-background-dark py-5 sm:py-5 lg:py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-gold-lg active:scale-95 hover:brightness-110 transition-all mt-4 disabled:opacity-50 flex items-center justify-center gap-2 lg:gap-2"
                                >
                                    {isCheckoutLoading ? (
                                        <>
                                            <span className="size-4 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></span>
                                            Verificando...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-base">check_circle</span>
                                            Já Realizei o Pagamento
                                        </>
                                    )}
                                </button>

                                <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">
                                    A validação pode levar alguns segundos
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Billing;
