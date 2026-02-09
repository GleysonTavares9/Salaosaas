import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

interface CheckoutPixViewProps {
    lastOrder: any;
    bookingDraft: any;
    total: number;
    activeSalon: any;
    userId: string | null;
    onSuccess: (newAppt: any) => void;
    onBack: () => void;
    isProcessing: boolean;
    setIsProcessing: (val: boolean) => void;
}

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M18.894 5.106A9.957 9.957 0 0011.967 2.158c-5.484 0-9.946 4.462-9.946 9.946 0 1.758.46 3.475 1.337 4.996L2.152 22l5.093-1.336a9.92 9.92 0 004.721 1.192h.004c5.485 0 9.948-4.462 9.948-9.946 0-2.656-1.034-5.155-2.913-7.034h-.005.005zm-6.927 15.08h-.004a8.261 8.261 0 01-4.212-1.155l-.302-.18-3.132.822.836-3.055-.196-.312a8.235 8.235 0 01-1.264-4.402c0-4.55 3.702-8.252 8.252-8.252 2.204 0 4.276.859 5.834 2.417a8.22 8.22 0 012.42 5.835c-.002 4.55-3.704 8.251-8.253 8.251.021.03-.01.03 0 0zm4.52-6.183c-.247-.124-1.465-.723-1.692-.806-.227-.082-.392-.123-.557.124-.165.247-.64.805-.783.97-.144.165-.289.186-.536.062-.248-.124-1.045-.385-1.99-1.229-.738-.658-1.237-1.47-1.382-1.717-.144-.248-.015-.382.109-.505.111-.111.247-.29.371-.433.124-.145.165-.248.248-.413.082-.165.041-.31-.02-.433s-.557-1.342-.763-1.837c-.2-.486-.403-.42-.557-.428h-.474c-.165 0-.433.062-.66.31-.227.247-.866.846-.866 2.064 0 1.218.887 2.395 1.01 2.56.124.165 1.745 2.665 4.227 3.738 1.487.643 2.046.685 2.768.571.815-.129 1.55-.63 1.777-1.239.227-.609.227-1.135.159-1.239-.068-.103-.248-.165-.495-.29l.001.001z" />
    </svg>
);

// Ícone PIX Oficial - Dourado (Fallback)
const PixIcon = ({ className }: { className?: string }) => (
    <svg
        className={className}
        viewBox="0 0 256 256"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        role="img"
        aria-label="PIX"
    >
        <path d="M128 16c-8.2 0-16.1 3.3-21.9 9.1L25.1 106c-12.1 12.1-12.1 31.7 0 43.8l81 81c5.8 5.8 13.7 9.1 21.9 9.1s16.1-3.3 21.9-9.1l81-81c12.1-12.1 12.1-31.7 0-43.8l-81-80.9C144.1 19.3 136.2 16 128 16zm0 24c2 0 4 .8 5.4 2.2l64.3 64.3c3 3 3 7.8 0 10.8l-64.3 64.3c-1.4 1.4-3.4 2.2-5.4 2.2s-4-.8-5.4-2.2L58.3 117.3c-3-3-3-7.8 0-10.8l64.3-64.3c1.4-1.4 3.4-2.2 5.4-2.2z" />
    </svg>
);

const CheckoutPixView: React.FC<CheckoutPixViewProps> = ({
    lastOrder,
    bookingDraft,
    total,
    activeSalon,
    userId,
    onSuccess,
    onBack,
    isProcessing,
    setIsProcessing
}) => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [timeLeft, setTimeLeft] = useState(30 * 60);
    const [isApproved, setIsApproved] = useState(false);

    // EFEITO 1: Timer Regressivo (independente)
    useEffect(() => {
        if (isApproved || timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft, isApproved]);

    // EFEITO 2: Polling de Pagamento - REATIVADO E CORRIGIDO
    useEffect(() => {
        let isMounted = true;
        const checkInterval = setInterval(async () => {
            if (!lastOrder?.pixData?.id || !activeSalon || isApproved) return;

            try {
                const data = await api.payments.checkStatus(lastOrder.pixData.id, activeSalon.id);
                if (data && data.status === 'approved' && isMounted) {
                    clearInterval(checkInterval);
                    handleSuccessSequence(data);
                }
            } catch (err) {
                console.warn("Polling de status aguardando confirmação...", err);
            }
        }, 5000);

        return () => {
            isMounted = false;
            clearInterval(checkInterval);
        };
    }, [lastOrder?.pixData?.id, activeSalon?.id, isApproved]);

    const handleSuccessSequence = async (paymentData: any) => {
        if (isApproved) return;
        setIsApproved(true);

        try {
            // Aguardamos 6 segundos para o efeito de confirmação ser lido com calma
            setTimeout(() => {
                if (onSuccess) {
                    onSuccess(paymentData);
                }
            }, 6000);
        } catch (error) {
            console.error("Erro na sequência de sucesso:", error);
        }
    };

    const handleWhatsAppConfirmation = () => {
        const orderData = {
            salonName: activeSalon?.nome || 'Salão',
            endereco: activeSalon?.endereco || '',
            services: bookingDraft.services || [],
            products: bookingDraft.products || [],
            total: lastOrder?.total || total,
            date: bookingDraft.date,
            time: bookingDraft.time,
            telefone: activeSalon?.telefone
        };

        const servicesText = orderData.services.map((s: any) => `• *${s.name}*`).join('\n');
        const productsText = orderData.products.map((p: any) => `• *${p.name}*`).join('\n');

        let text = `Olá, tudo bem? Gostaria de confirmar minha reserva feita pelo App *Luxe Aura*.\n\n🏛️ *Local:* ${orderData.salonName}\n📍 *Endereço:* ${orderData.endereco}\n`;
        if (orderData.services && orderData.services.length > 0) text += `\n✂️ *Rituais:*\n${servicesText}\n📅 *Data:* ${orderData.date}\n⏰ *Hora:* ${orderData.time}\n`;
        if (orderData.products && orderData.products.length > 0) text += `\n🛍️ *Boutique:*\n${productsText}\n`;
        text += `\n💰 *Total Investido:* R$ ${(lastOrder?.total || total).toFixed(2)}`;
        text += `\n✨ *Forma:* Pix (Confirmado ✅)`;
        text += `\n\n_Aguardo o atendimento!_ 🎩💎`;

        const phoneNumber = orderData.telefone?.replace(/\D/g, '') || '5511999999999';
        window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleCheckStatus = async () => {
        if (!lastOrder?.pixData?.id || !activeSalon) {
            showToast("Dados de pagamento não encontrados.", "error");
            return;
        }
        setIsProcessing(true);
        try {
            const data = await api.payments.checkStatus(lastOrder.pixData.id, activeSalon.id);
            if (data && (data.status === 'approved' || data.status === 'confirmed')) {
                handleSuccessSequence(data);
            } else {
                showToast(`Pagamento em análise (${data?.status || 'pendente'}). Verificando...`, 'info');
            }
        } catch (err) {
            console.error("Erro ao verificar PIX:", err);
            showToast("Ainda não detectamos o pagamento. Tente novamente em instantes.", 'info');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="absolute inset-0 z-[100] flex flex-col items-center px-4 animate-fade-in overflow-y-auto no-scrollbar py-4">
            {/* Background Glamour */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-[#c1a571]/5 rounded-full blur-[120px]"></div>
                <div className="absolute top-1/2 -right-32 w-80 h-80 bg-[#c1a571]/3 rounded-full blur-[100px]"></div>
            </div>

            <div className="w-full max-w-[420px] mx-auto flex flex-col gap-4 relative z-10 h-full">
                {!isApproved ? (
                    <>
                        {/* HEADER COMPACTO CENTRALIZADO */}
                        <div className="flex flex-col items-center gap-2 pt-2 shrink-0 px-2 text-center relative">
                            <div className="relative">
                                <div className="absolute inset-0 bg-[#c1a571]/20 blur-xl rounded-full scale-125"></div>
                                {activeSalon?.logo_url ? (
                                    <img
                                        src={activeSalon.logo_url}
                                        alt={activeSalon?.nome}
                                        className="w-14 h-14 rounded-full object-cover border-2 border-[#c1a571]/40 shadow-2xl relative z-10"
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1a1b1e] to-[#0c0d10] border-2 border-[#c1a571]/40 flex items-center justify-center shadow-2xl relative z-10">
                                        <span className="material-symbols-outlined text-[#c1a571] text-2xl">storefront</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[7px] font-display font-black text-[#c1a571] tracking-[0.4em] uppercase opacity-80">Luxe Aura</span>
                                </div>
                                <h1 className="text-2xl font-display font-black italic text-white tracking-tighter leading-none uppercase drop-shadow-md">
                                    {activeSalon?.nome || 'Luxe Aura'}
                                </h1>
                                <div className="mt-1 flex items-center gap-2 px-2 py-0.5 bg-[#c1a571]/5 border border-[#c1a571]/20 rounded-full">
                                    <span className="material-symbols-outlined text-[8px] text-[#c1a571]">shield_with_heart</span>
                                    <p className="text-[7px] text-[#c1a571] font-black uppercase tracking-[0.1em]">Pagamento Seguro</p>
                                </div>
                            </div>
                        </div>

                        {/* TIMER COMPACTO */}
                        <div className="text-center shrink-0 bg-[#c1a571]/10 backdrop-blur-xl rounded-[20px] py-2 px-6 border border-[#c1a571]/20 shadow-lg relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
                            <div className="flex flex-col items-center">
                                <p className="text-[8px] text-[#c1a571] font-black uppercase tracking-[0.4em] opacity-80 mb-[-2px]">Expira em</p>
                                <div className="text-3xl font-display font-black italic tracking-tighter text-[#ecd3a5] drop-shadow-[0_0_10px_rgba(236,211,165,0.4)]">
                                    {formatTime(timeLeft)}
                                </div>
                            </div>
                        </div>

                        {/* CARD DE PAGAMENTO COMPACTO */}
                        <div className={`bg-gradient-to-b from-white/[0.04] to-transparent backdrop-blur-2xl border border-white/5 rounded-[28px] p-4 space-y-3 shadow-2xl relative transition-all duration-700`}>
                            <div className="relative flex justify-center mt-[-5px]">
                                <div className="relative p-2 bg-white rounded-[20px] shadow-lg">
                                    {lastOrder?.pixData?.qrCodeBase64 ? (
                                        <img src={`data:image/png;base64,${lastOrder.pixData.qrCodeBase64}`} className="size-32 object-contain" alt="QR Code" />
                                    ) : (
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(lastOrder?.pixData?.copyPaste || 'erro')}`} className="size-32 object-contain" alt="QR Code" />
                                    )}

                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="bg-white rounded-full p-1 shadow-md size-10 flex items-center justify-center border border-zinc-100">
                                            {activeSalon?.logo_url ? (
                                                <img src={activeSalon.logo_url} className="rounded-full w-full h-full object-cover" />
                                            ) : (
                                                <PixIcon className="text-[#c1a571] size-6" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
                                onClick={() => {
                                    if (lastOrder?.pixData?.copyPaste) {
                                        navigator.clipboard.writeText(lastOrder.pixData.copyPaste);
                                        showToast('Código copiado!', 'success');
                                    }
                                }}
                                className="bg-black/60 hover:bg-[#c1a571]/10 border border-[#c1a571]/30 rounded-2xl p-4 transition-all cursor-pointer group shadow-inner"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#c1a571] text-xs">content_copy</span>
                                        <p className="text-[7px] text-[#c1a571] font-black uppercase tracking-[0.4em]">Copia e Cola</p>
                                    </div>
                                    <span className="text-[7px] text-zinc-500 group-hover:text-white uppercase font-black">Copiar</span>
                                </div>
                                <p className="text-[9px] text-zinc-400 font-mono break-all tracking-tight leading-relaxed">
                                    {lastOrder?.pixData?.copyPaste}
                                </p>
                            </div>

                            <div className="pt-2 border-t border-white/5 flex flex-col items-center gap-3">
                                <div className="flex flex-col items-center text-center">
                                    <p className="text-[7px] text-zinc-600 font-bold uppercase tracking-[0.3em] mb-0.5">Recebedor</p>
                                    <div className="flex items-center gap-1.5 text-zinc-300 font-display font-black italic uppercase tracking-widest text-[9px]">
                                        <span className="material-symbols-outlined text-xs text-[#c1a571]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                                        {activeSalon?.nome}
                                    </div>
                                </div>

                                <div className="flex flex-col items-center">
                                    <p className="text-[8px] text-[#c1a571] font-black uppercase tracking-[0.4em] mb-0.5">Total</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-sm font-display italic text-[#c1a571] font-black">R$</span>
                                        <span className="text-4xl font-display font-black text-white italic tracking-tighter">
                                            {(lastOrder?.total || total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 gap-2 flex flex-col">
                            <button
                                disabled={isProcessing}
                                onClick={handleCheckStatus}
                                className="group relative w-full h-14 flex items-center justify-center overflow-hidden rounded-[20px] transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-[#b1945f] via-[#ecd3a5] to-[#b1945f]"></div>
                                <div className="relative flex items-center gap-2">
                                    {isProcessing ? (
                                        <div className="size-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                    ) : (
                                        <span className="text-black text-xs font-black uppercase tracking-[0.1em] italic">
                                            Já realizei o Pix
                                        </span>
                                    )}
                                    {!isProcessing && (
                                        <span className="material-symbols-outlined text-black text-lg group-hover:translate-x-1 transition-transform">arrow_right_alt</span>
                                    )}
                                </div>
                            </button>

                            <button
                                onClick={onBack}
                                disabled={isProcessing}
                                className="w-full text-center text-[9px] text-zinc-600 font-bold uppercase tracking-[0.4em] hover:text-[#c1a571] transition-colors py-2 disabled:opacity-0"
                            >
                                Trocar método
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center flex-1 py-10 animate-fade-in text-center">
                        <div className="relative mb-8">
                            <span
                                className="material-symbols-outlined bg-gradient-to-br from-[#c1a571] via-[#ecd3a5] to-[#c1a571] bg-clip-text text-transparent relative z-10 animate-stamp-double"
                                style={{ fontSize: '180px', fontVariationSettings: "'FILL' 1, 'wght' 400" }}
                            >
                                verified
                            </span>
                        </div>

                        <div className="space-y-2 mb-10 animate-slide-up">
                            <span className="text-[10px] text-[#c1a571] font-black uppercase tracking-[0.5em]">Pagamento Realizado</span>
                            <h2 className="text-4xl font-display font-black text-white italic uppercase tracking-tighter">
                                Pix Recebido!
                            </h2>
                            <div className="flex items-center justify-center gap-2 pt-2">
                                <span className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Valor:</span>
                                <span className="text-2xl font-display font-black text-[#ecd3a5] italic tracking-tight">
                                    R$ {(lastOrder?.total || total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-6 w-full max-w-xs backdrop-blur-md animate-slide-up [animation-delay:200ms]">
                            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.2em] leading-relaxed">
                                Estamos finalizando sua reserva em <br />
                                <span className="text-white text-[11px]">{activeSalon?.nome}</span>
                            </p>
                            <div className="mt-4 flex justify-center gap-1.5">
                                <div className="size-1.5 bg-[#c1a571] rounded-full animate-bounce [animation-delay:0ms]"></div>
                                <div className="size-1.5 bg-[#c1a571] rounded-full animate-bounce [animation-delay:200ms]"></div>
                                <div className="size-1.5 bg-[#c1a571] rounded-full animate-bounce [animation-delay:400ms]"></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CheckoutPixView;
