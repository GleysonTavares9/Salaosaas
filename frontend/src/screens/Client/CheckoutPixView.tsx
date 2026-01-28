import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

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
    const [timeLeft, setTimeLeft] = useState(30 * 60);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        if (timeLeft === 0) {
            alert('O código PIX expirou. Por favor, gere um novo código.');
            onBack();
            return;
        }
        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft, onBack]);

    const handleCheckStatus = async () => {
        if (!lastOrder?.pixData?.id || !activeSalon) return;
        setIsProcessing(true);
        try {
            const data = await api.payments.checkStatus(lastOrder.pixData.id, activeSalon.mp_access_token);
            if (data.status === 'approved') {
                const services = bookingDraft.services || [];
                const newAppt = await api.appointments.create({
                    salon_id: bookingDraft.salonId || '',
                    client_id: userId,
                    professional_id: bookingDraft.professionalId || null,
                    service_names: services.length > 0 ? services.map((s: any) => s.name).join(', ') : 'Shopping Boutique',
                    valor: bookingDraft.totalPrice || 0,
                    date: bookingDraft.date || new Date().toISOString().split('T')[0],
                    time: bookingDraft.time || '10:00',
                    duration_min: services ? services.reduce((acc: number, cur: any) => acc + (cur.duration_min || 30), 0) : 30,
                    status: 'confirmed'
                });
                onSuccess(newAppt);
            } else {
                alert(`Status atual: ${data.status_detail || data.status}. Se você já pagou, aguarde alguns segundos e tente novamente.`);
            }
        } catch (err) {
            console.error("Erro ao verificar PIX:", err);
            alert("Erro ao verificar status. Tente novamente.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="absolute inset-0 z-[100] bg-background-dark flex flex-col px-6 pt-4 animate-fade-in overflow-y-auto no-scrollbar pb-32">
            <div className="text-center space-y-0.5 mb-1 shrink-0">
                {/* Espaço do ícone removido, mantendo apenas titulo e timer */}
                <div>
                    <h2 className="text-2xl font-display font-black text-white italic uppercase tracking-tighter">Quase lá!</h2>
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Pague via Pix em até:</p>
                    <div className="text-4xl font-display font-black bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] bg-clip-text text-transparent mt-0 tracking-tighter drop-shadow-lg scale-110">
                        {formatTime(timeLeft)}
                    </div>
                </div>
            </div>

            <div className="bg-surface-dark border border-white/5 rounded-[32px] p-4 space-y-3 shadow-2xl relative shrink-0">
                <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                    <span className="material-symbols-outlined text-6xl text-primary">qr_code_2</span>
                </div>

                <div className="flex flex-col items-center justify-center pb-3 border-b border-white/5 mx-4 gap-2">
                    <p className="text-[8px] text-slate-400 uppercase tracking-widest">Pagamento para</p>

                    <div className="flex items-center gap-3">
                        {/* LOGO NO CABEÇALHO RESTAURADO */}
                        {activeSalon?.logo_url && !imgError && (
                            <img
                                src={activeSalon.logo_url}
                                className="size-8 rounded-full object-cover border border-[#D4AF37]/50 shadow-md"
                                alt={activeSalon.nome}
                                onError={() => setImgError(true)}
                            />
                        )}
                        <h3 className="text-base font-display font-black text-white italic">{activeSalon?.nome || bookingDraft.salonName}</h3>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-3">
                    {/* Container QR Code - Compactado */}
                    <div className="p-3 bg-white rounded-3xl border-4 border-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.15)] relative">
                        <div className="absolute inset-0 border-2 border-dashed border-[#D4AF37]/30 rounded-2xl m-2 pointer-events-none"></div>
                        {lastOrder?.pixData?.qrCodeBase64 ? (
                            <img
                                src={`data:image/jpeg;base64,${lastOrder.pixData.qrCodeBase64}`}
                                className="size-44 object-contain"
                                alt="Pix QR Code Real"
                            />
                        ) : (
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(lastOrder?.pixData?.copyPaste || 'erro')}`}
                                className="size-44 object-contain"
                                alt="Pix QR Code Fallback"
                            />
                        )}

                        {/* LOGO CENTRAL FULL */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-white rounded-full shadow-lg border border-[#D4AF37]/20 size-10 flex items-center justify-center overflow-hidden">
                                {activeSalon?.logo_url && !imgError ? (
                                    <img
                                        src={activeSalon.logo_url}
                                        className="w-full h-full object-cover"
                                        alt="Logo Salão"
                                    />
                                ) : (
                                    <PixIcon className="size-6 text-[#D4AF37]" />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="text-center space-y-1">
                        <div className="inline-flex items-center gap-2 bg-gradient-to-br from-[#D4AF37]/20 to-[#c1a571]/5 px-6 py-2 rounded-full border border-[#D4AF37]/40 shadow-[0_0_20px_rgba(212,175,55,0.15)] transform hover:scale-105 transition-transform duration-300">
                            <span className="text-[#ecd3a5] font-black text-lg">R$</span>
                            <span className="text-white font-display font-black text-4xl italic tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{total.toFixed(2)}</span>
                        </div>
                        <p className="text-[7px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Escaneie o QR Code acima</p>
                    </div>
                </div>

                <div className="space-y-2 pt-2">
                    <div className="bg-background-dark/80 rounded-2xl p-3 border border-white/5 flex items-center justify-between gap-3">
                        <p className="text-[9px] text-primary font-black uppercase tracking-tight truncate flex-1 leading-none pt-0.5">
                            {lastOrder?.pixData?.copyPaste?.slice(0, 30)}...
                        </p>
                        <button
                            onClick={() => {
                                if (lastOrder?.pixData?.copyPaste) {
                                    navigator.clipboard.writeText(lastOrder.pixData.copyPaste);
                                    alert('Chave Pix copiada!');
                                }
                            }}
                            className="size-8 rounded-lg gold-gradient flex items-center justify-center text-background-dark active:scale-90 transition-all shrink-0 shadow-lg"
                        >
                            <span className="material-symbols-outlined text-base">content_copy</span>
                        </button>
                    </div>
                    <p className="text-[7px] text-slate-600 font-bold uppercase text-center tracking-widest leading-relaxed">
                        Após o pagamento, sua reserva será <br /> confirmada automaticamente em até 2 minutos.
                    </p>
                </div>
            </div>

            <div className="mt-4 space-y-3 shrink-0">
                <button
                    disabled={isProcessing}
                    onClick={handleCheckStatus}
                    className="w-full gold-gradient text-background-dark py-5 rounded-full font-black uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(193,165,113,0.2)] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                >
                    {isProcessing ? 'VERIFICANDO...' : 'JÁ REALIZEI O PAGAMENTO'}
                </button>
                <button
                    onClick={onBack}
                    className="w-full bg-white/5 text-slate-500 py-3 rounded-full font-black uppercase text-[8px] tracking-[0.2em] active:opacity-50 transition-all"
                >
                    ALTERAR FORMA DE PAGAMENTO
                </button>
            </div>
        </div>
    );
};

export default CheckoutPixView;
