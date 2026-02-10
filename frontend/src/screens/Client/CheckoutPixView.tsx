import React, { useState, useEffect } from 'react';
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
    setIsProcessing: (v: boolean) => void;
}

const CheckoutPixView: React.FC<CheckoutPixViewProps> = ({
    lastOrder,
    total,
    onSuccess,
    onBack,
    isProcessing,
    setIsProcessing
}) => {
    const { showToast } = useToast();
    const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes

    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const copyPixCode = () => {
        const code = lastOrder?.pixData?.copyPaste;
        if (code) {
            navigator.clipboard.writeText(code);
            showToast('Código PIX copiado com sucesso!', 'success');
        }
    };

    const handleCheckStatus = () => {
        setIsProcessing(true);
        // Simulando verificação - Na produção aqui haveria um webhook ou polling real
        setTimeout(() => {
            setIsProcessing(false);
            onSuccess({}); // Agora chama a função de sucesso para abrir o modal de confirmação
            showToast('Pagamento confirmado com sucesso!', 'success');
        }, 2000);
    };

    const pixCode = lastOrder?.pixData?.copyPaste;
    const qrCodeUrl = lastOrder?.pixData?.qrCodeBase64
        ? `data:image/png;base64,${lastOrder.pixData.qrCodeBase64}`
        : lastOrder?.pixData?.ticketUrl;

    return (
        <div className="flex flex-col items-center justify-center w-full py-4 lg:py-10 animate-fade-in">
            <div className="w-full max-w-[500px] bg-surface-dark border border-white/5 rounded-[48px] shadow-3xl overflow-hidden relative backdrop-blur-3xl">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent opacity-50"></div>

                {/* Header do PIX */}
                <div className="relative p-8 lg:p-12 text-center border-b border-white/5">
                    <div className="size-16 lg:size-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-primary/20">
                        <span className="material-symbols-outlined text-primary text-3xl lg:text-4xl">pix</span>
                    </div>
                    <h2 className="font-display text-2xl lg:text-3xl font-black text-white italic tracking-tighter uppercase mb-2">
                        {lastOrder?.salonName || "Aguardando Pagamento"}
                    </h2>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/20 rounded-full border border-primary/30">
                        <span className="size-2 bg-primary rounded-full animate-pulse"></span>
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Aguardando Confirmação</span>
                    </div>
                </div>

                {/* QR Code Section */}
                <div className="relative p-8 lg:p-12 space-y-8 text-center bg-black/20">
                    <div className="space-y-4">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">QR CODE EXPIRA EM</p>
                        <div className="text-4xl lg:text-5xl font-display font-black text-primary italic tracking-tighter drop-shadow-gold">
                            {formatTime(timeLeft)}
                        </div>
                    </div>

                    <div className="relative flex justify-center group">
                        <div className="absolute inset-0 bg-primary/10 blur-[60px] rounded-full scale-75 group-hover:scale-100 transition-transform duration-1000"></div>
                        <div className="relative bg-white p-6 lg:p-8 rounded-[40px] shadow-2xl transition-all duration-700 hover:scale-[1.02]">
                            {qrCodeUrl ? (
                                <img
                                    src={qrCodeUrl}
                                    className="size-48 lg:size-64 object-contain"
                                    alt="PIX QR Code"
                                />
                            ) : (
                                <div className="size-48 lg:size-64 flex flex-col items-center justify-center gap-4 text-slate-300">
                                    <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Gerando Código...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions Section */}
                <div className="p-8 lg:p-12 space-y-8">
                    <div className="space-y-4">
                        <div className="flex flex-col gap-3">
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.4em] ml-2">Código Copia e Cola</p>
                            <button
                                onClick={copyPixCode}
                                className="w-full bg-[#121214] border border-white/5 hover:border-primary/40 p-5 rounded-[24px] flex flex-col gap-3 group transition-all relative overflow-hidden active:scale-[0.98]"
                            >
                                <div className="flex items-center justify-between w-full">
                                    <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">content_copy</span>
                                    <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full">Clique para Copiar</span>
                                </div>
                                <p className="text-[10px] text-zinc-400 font-mono break-all leading-relaxed text-left line-clamp-2 w-full">
                                    {pixCode || 'Gerando código de pagamento...'}
                                </p>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 pt-4 border-t border-white/5 relative z-10">
                        <button
                            onClick={() => {
                                console.log("Botão clicado!");
                                handleCheckStatus();
                            }}
                            disabled={isProcessing}
                            className="w-full h-18 lg:h-22 gold-gradient text-background-dark rounded-[28px] font-black uppercase text-[12px] lg:text-sm tracking-[0.4em] flex items-center justify-center gap-4 shadow-gold active:scale-[0.98] transition-all group disabled:opacity-50 relative z-[100] cursor-pointer pointer-events-auto"
                        >
                            {isProcessing ? (
                                <div className="size-7 border-3 border-background-dark/20 border-t-background-dark rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    CONFIRMAR PAGAMENTO
                                    <span className="material-symbols-outlined font-black group-hover:translate-x-1 transition-transform text-xl">verified</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={onBack}
                            className="text-slate-700 font-black uppercase text-[9px] tracking-[0.4em] py-4 hover:text-slate-500 transition-colors"
                        >
                            ALTERAR FORMA DE PAGAMENTO
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CheckoutPixView;
