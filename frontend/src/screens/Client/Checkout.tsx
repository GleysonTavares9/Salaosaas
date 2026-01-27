
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Appointment, Service, Salon, Product } from '../../types';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

interface CheckoutProps {
  bookingDraft: any;
  salons: Salon[];
  onConfirm: (appt: Appointment) => void;
  setBookingDraft: React.Dispatch<React.SetStateAction<any>>;
}

type CheckoutStep = 'summary' | 'payment_detail' | 'waiting_pix' | 'success';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    className={`${className} shrink-0`}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    style={{ aspectRatio: '1/1' }}
  >
    <path d="M12.037 3C6.411 3 1.84 7.585 1.84 13.23c0 1.804.47 3.56 1.362 5.097L2 22l3.811-1.002c1.488.812 3.167 1.24 4.885 1.242h.004c5.624 0 10.196-4.585 10.198-10.231 0-2.735-1.064-5.308-2.996-7.243C16.071 3.829 13.5 2.768 12.037 3zm0 1.902c2.196 0 4.261.859 5.814 2.417 1.554 1.558 2.409 3.63 2.409 5.8 0 4.524-3.66 8.205-8.156 8.205-1.442-.001-2.858-.386-4.1-1.115l-.295-.174-2.535.666.677-2.479-.191-.305c-.801-1.277-1.224-2.753-1.224-4.276 0-4.525 3.661-8.204 8.156-8.204zm3.604 5.921c-.197-.1-.197-.1-.591-.3s-1.182-.592-1.38-.692-.394-.1-.591.2-.788.989-.985 1.187s-.394.2-.788 0-1.677-.618-2.268-1.336c-.591-.718-1.084-1.583-1.182-1.781s-.099-.346.1-.445c.184-.091.394-.445.591-.643s.296-.297.394-.495.049-.395-.05-.593-.788-1.879-.985-2.275c-.197-.396-.394-.346-.542-.346s-.345-.049-.591-.049-.64.099-.985.495c-.345.395-1.33 1.335-1.33 3.264s1.379 3.758 1.576 4.055 2.71 4.153 6.553 5.835c.915.4 1.63.639 2.187.816.924.293 1.765.251 2.429.152.74-.11 2.268-.923 2.583-1.815.315-.89.315-1.653.222-1.812-.094-.158-.345-.256-.739-.452z" />
  </svg>
);

const Checkout: React.FC<CheckoutProps> = ({ bookingDraft, salons, onConfirm, setBookingDraft }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardData, setCardData] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [userId, setUserId] = useState<string | null>(null);
  const [mpReady, setMpReady] = useState(false);
  const [activeSalon, setActiveSalon] = useState<Salon | undefined>(salons.find(s => s.id === bookingDraft.salonId));
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [isPix, setIsPix] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    // 1. Prioridade: Chave configurada no Banco de Dados (SaaS Real)
    if (activeSalon?.mp_public_key) {
      initMercadoPago(activeSalon.mp_public_key, { locale: 'pt-BR' });
      setMpReady(true);
      return;
    }

    // 2. Fallback: LocalStorage (apenas para Admin/Dev testando localmente sem banco atualizado)
    const configStr = localStorage.getItem('aura_mp_config');
    if (configStr) {
      try {
        const config = JSON.parse(configStr);
        if (config.publicKey && config.publicKey.startsWith('TEST-')) {
          initMercadoPago(config.publicKey, { locale: 'pt-BR' });
          setMpReady(true);
        } else {
          setMpReady(false);
        }
      } catch (e) {
        setMpReady(false);
      }
    } else {
      setMpReady(false);
    }
  }, [activeSalon]);

  useEffect(() => {
    // Se não encontrou nas props, busca direto da API para garantir dados (telefone, endereço)
    if (!activeSalon && bookingDraft.salonId) {
      api.salons.getById(bookingDraft.salonId).then(data => {
        if (data) setActiveSalon(data);
      }).catch(err => console.error("Erro ao buscar salão:", err));
    } else if (!activeSalon && salons.length > 0 && bookingDraft.salonId) {
      // Tenta encontrar novamente se salons mudou
      const s = salons.find(s => s.id === bookingDraft.salonId);
      if (s) setActiveSalon(s);
    }
  }, [bookingDraft.salonId, salons, activeSalon]);

  // Use activeSalon ao invés de buscar toda vez
  const salonInfo = activeSalon;

  const services = bookingDraft.services || [];
  const products = bookingDraft.products || [];

  const subtotalServices = services.reduce((acc: number, curr: Service) => acc + curr.price, 0);
  const subtotalProducts = products.reduce((acc: number, curr: Product) => acc + curr.price, 0);
  const subtotal = subtotalServices + subtotalProducts;
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  const removeItem = (id: string, type: 'service' | 'product') => {
    if (type === 'service') {
      const newServices = services.filter((s: Service) => s.id !== id);
      setBookingDraft({ ...bookingDraft, services: newServices });
    } else {
      const newProducts = products.filter((p: Product) => p.id !== id);
      setBookingDraft({ ...bookingDraft, products: newProducts });
    }
  };

  const handleFinalConfirm = async (paymentMethodId?: string) => {
    if (!userId) return;

    const currentIsPix = paymentMethodId === 'pix' || paymentMethodId === 'bank_transfer';
    setIsPix(currentIsPix);

    // Validate total is a valid number
    if (isNaN(total) || total <= 0) {
      alert('Erro: Valor total inválido. Por favor, adicione serviços ou produtos.');
      return;
    }

    // Convert date to ISO format if needed
    let isoDate = bookingDraft.date || new Date().toISOString().split('T')[0];

    // If date is in Brazilian format like "26 de jan.", convert to ISO
    if (isoDate && !isoDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Try to parse and convert to ISO
      const today = new Date();
      isoDate = today.toISOString().split('T')[0];
    }

    const finalTotal = total;
    const finalServices = [...services];
    const finalProducts = [...products];
    const finalSalonName = bookingDraft.salonName || salonInfo?.nome;
    const finalEndereco = salonInfo?.endereco;
    const finalTelefone = salonInfo?.telefone;

    setIsProcessing(true);
    try {
      const totalDuration = finalServices.reduce((acc: number, curr: any) => acc + (curr.duration_min || 30), 0);

      const orderSnapshot = {
        salonName: finalSalonName,
        endereco: finalEndereco,
        services: finalServices,
        products: finalProducts,
        total: finalTotal,
        date: isoDate,
        time: bookingDraft.time || '10:00',
        telefone: finalTelefone,
        isPix: currentIsPix
      };

      setLastOrder(orderSnapshot);

      const newAppt = await api.appointments.create({
        salon_id: bookingDraft.salonId || '',
        client_id: userId,
        professional_id: bookingDraft.professionalId || null,
        service_names: finalServices.length > 0 ? finalServices.map((s: any) => s.name).join(', ') : 'Shopping Boutique',
        valor: Number(finalTotal.toFixed(2)),
        date: isoDate,
        time: bookingDraft.time || '10:00',
        duration_min: totalDuration,
        status: 'confirmed'
      });

      onConfirm(newAppt);
      if (currentIsPix) {
        setStep('waiting_pix');
      } else {
        setStep('success');
      }
      setBookingDraft({ services: [], products: [] });
    } catch (error: any) {
      console.error('Erro ao criar agendamento:', error);
      alert("Erro ao finalizar reserva: " + (error.message || 'Erro desconhecido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWhatsAppConfirmation = () => {
    const orderData = lastOrder || {
      salonName: bookingDraft.salonName || salonInfo?.nome,
      endereco: salonInfo?.endereco,
      services: services,
      products: products,
      total: total,
      date: bookingDraft.date,
      time: bookingDraft.time,
      telefone: salonInfo?.telefone
    };

    const servicesText = orderData.services.map((s: any) => `• *${s.name}*`).join('\n');
    const productsText = orderData.products.map((p: any) => `• *${p.name}*`).join('\n');

    let text = `Olá, tudo bem? Gostaria de confirmar minha reserva feita pelo App *Luxe Aura*.\n\n🏛️ *Local:* ${orderData.salonName}\n📍 *Endereço:* ${orderData.endereco}\n`;
    if (orderData.services && orderData.services.length > 0) text += `\n✂️ *Rituais:*\n${servicesText}\n📅 *Data:* ${orderData.date}\n⏰ *Hora:* ${orderData.time}\n`;
    if (orderData.products && orderData.products.length > 0) text += `\n🛍️ *Boutique:*\n${productsText}\n`;
    const totalValue = typeof orderData.total === 'number' ? orderData.total : 0;
    text += `\n💰 *Total Investido:* R$ ${totalValue.toFixed(2)}`;
    if (orderData.isPix) text += `\n✨ *Forma:* Pix (Aguardando Confirmação)`;
    text += `\n\n_Aguardo o atendimento!_ 🎩💎`;

    const phoneNumber = orderData.telefone?.replace(/\D/g, '') || '5511999999999';
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!services.length && !products.length && step !== 'success') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-background-dark animate-fade-in">
        <span className="material-symbols-outlined text-6xl text-primary/20 mb-4 scale-150">shopping_bag</span>
        <h2 className="text-2xl font-display font-black text-white italic mb-6 uppercase tracking-tighter">Sua Sacola está vazia</h2>
        <button onClick={() => navigate('/products')} className="gold-gradient text-background-dark px-10 py-5 rounded-[24px] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-2xl">Explorar Boutique</button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background-dark relative overflow-hidden">
      <header className="px-6 pt-12 pb-4 bg-background-dark/95 backdrop-blur-xl border-b border-white/5 z-50 shrink-0 flex items-center justify-between">
        <button onClick={() => step === 'payment_detail' ? setStep('summary') : navigate(-1)} className="size-10 rounded-xl border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-display text-lg font-black text-white italic tracking-tighter uppercase">Confirmação</h1>
        <div className="size-10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined fill-1">verified_user</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pt-8 pb-[280px] no-scrollbar">
        {step === 'summary' && (
          <div className="animate-fade-in space-y-8">
            <section className="bg-surface-dark border border-white/5 rounded-[40px] p-8 space-y-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <span className="material-symbols-outlined text-8xl">receipt_long</span>
              </div>
              <div className="flex items-center gap-5 border-b border-white/5 pb-6">
                <div className="size-14 rounded-2xl gold-gradient flex items-center justify-center text-background-dark shadow-lg">
                  <span className="material-symbols-outlined font-black">location_on</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] font-black text-primary uppercase tracking-[0.3em] mb-1">Destino Aura</p>
                  <h3 className="text-white font-display font-black text-lg italic truncate leading-none mb-1">{bookingDraft.salonName}</h3>
                  <p className="text-slate-500 text-[8px] font-bold uppercase truncate tracking-tight">{salonInfo?.endereco}</p>
                </div>
              </div>

              <div className="space-y-6 py-2">
                {services.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Seus Rituais</p>
                    {services.map((s: Service) => (
                      <div key={s.id} className="flex justify-between items-start gap-3 group animate-fade-in">
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-white text-xs font-black italic tracking-tight break-words">{s.name}</span>
                          <span className="text-primary text-[8px] font-black uppercase mt-1">🗓️ {bookingDraft.date} • {bookingDraft.time}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-white text-xs font-black font-display italic">R$ {s.price.toFixed(2)}</span>
                          <button onClick={() => removeItem(s.id, 'service')} className="size-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 transition-colors hover:text-white">
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {products.length > 0 && (
                  <div className={`space-y-4 ${services.length > 0 ? 'pt-6 border-t border-white/5' : ''}`}>
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Boutique & Insumos</p>
                    {products.map((p: Product) => (
                      <div key={p.id} className="flex justify-between items-center gap-4 animate-fade-in">
                        <div className="flex items-center gap-4 min-w-0">
                          <img src={p.image} className="size-12 rounded-2xl object-cover border border-white/10 shadow-lg" alt={p.name} />
                          <div className="min-w-0">
                            <span className="text-white text-xs font-black italic truncate block">{p.name}</span>
                            <span className="text-slate-500 text-[8px] font-black uppercase mt-0.5">Retirada na Unidade</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-white text-xs font-black font-display italic">R$ {p.price.toFixed(2)}</span>
                          <button onClick={() => removeItem(p.id, 'product')} className="size-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 transition-colors hover:text-white">
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="bg-surface-dark/40 rounded-[40px] p-8 border border-white/5 space-y-4 shadow-inner relative">
              <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <span>Subtotal</span>
                <span className="text-white">R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <span>Taxa Concierge (5%)</span>
                <span className="text-white">R$ {tax.toFixed(2)}</span>
              </div>
              <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                <span className="text-xs font-black text-primary uppercase tracking-[0.3em]">Total Investido</span>
                <span className="text-3xl font-display font-black text-white italic tracking-tighter">R$ {total.toFixed(2)}</span>
              </div>
            </section>

            {/* Remover seleção manual, o Payment Brick cuida disso */}
            <section className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-3xl flex items-center gap-4">
                <div className="size-10 rounded-full bg-primary text-background-dark flex items-center justify-center">
                  <span className="material-symbols-outlined font-black">lock</span>
                </div>
                <div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Ambiente Seguro</p>
                  <p className="text-[9px] text-slate-400 font-bold">Escolha Pix ou Cartão na próxima etapa.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {step === 'payment_detail' && (
          <div className="animate-fade-in space-y-8 pb-32">
            <div className="bg-surface-dark/40 border border-white/5 rounded-[40px] overflow-hidden shadow-2xl relative">
              <div className="p-4 min-h-[450px]">
                {mpReady ? (
                  <MPPaymentWrapper
                    total={total}
                    handleFinalConfirm={handleFinalConfirm}
                  />
                ) : (
                  <div className="space-y-6 py-4">
                    <div className="bg-gradient-to-br from-surface-dark to-black border border-white/10 p-8 rounded-3xl text-center space-y-6 shadow-2xl">
                      <div className="inline-flex size-16 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500 mb-2 ring-1 ring-yellow-500/20">
                        <span className="material-symbols-outlined text-3xl">integration_instructions</span>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-white font-display font-black uppercase tracking-widest text-lg italic">Modo de Simulação</h3>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide max-w-xs mx-auto leading-relaxed">
                          O Checkout Seguro do Mercado Pago ainda não foi configurado pelo estabelecimento.
                        </p>
                      </div>

                      <div className="text-[10px] bg-white/5 p-4 rounded-xl text-slate-400 border border-white/5">
                        <p className="mb-2 font-black uppercase tracking-wider text-slate-500">Fluxo de Teste</p>
                        <ul className="text-left space-y-2 pl-4 list-disc marker:text-primary">
                          <li>Confirmação instantânea do agendamento</li>
                          <li>Nenhuma cobrança será efetuada</li>
                          <li>Acesso à tela de sucesso e WhatsApp</li>
                        </ul>
                      </div>

                      <button onClick={handleFinalConfirm} className="w-full gold-gradient text-background-dark font-black py-5 rounded-[24px] uppercase tracking-[0.3em] text-[10px] active:scale-95 transition-all shadow-[0_10px_30px_rgba(212,175,55,0.2)] flex items-center justify-center gap-3">
                        <span className="material-symbols-outlined">check_circle</span>
                        Simular Pagamento Aprovado
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'waiting_pix' && (
          <div className="absolute inset-0 z-[100] bg-background-dark flex flex-col px-8 pt-20 animate-fade-in overflow-y-auto no-scrollbar pb-32">
            <div className="text-center space-y-4 mb-10">
              <div className="size-20 rounded-3xl gold-gradient flex items-center justify-center mx-auto shadow-lg rotate-3">
                <span className="material-symbols-outlined text-4xl text-background-dark font-black">pix</span>
              </div>
              <h2 className="text-3xl font-display font-black text-white italic uppercase tracking-tighter">Quase lá!</h2>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Finalize o pagamento via Pix</p>
            </div>

            <div className="bg-surface-dark/60 border border-white/5 rounded-[40px] p-8 space-y-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <span className="material-symbols-outlined text-8xl text-primary">qr_code_2</span>
              </div>

              <div className="flex flex-col items-center gap-6">
                <div className="p-4 bg-white rounded-3xl shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('https://luxeaura.app/simulated-pix-payment')}`}
                    className="size-48"
                    alt="Pix QR Code"
                  />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-xs font-black text-white italic">R$ {total.toFixed(2)}</p>
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Escaneie o código acima ou copie a chave abaixo</p>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <div className="bg-background-dark/80 rounded-2xl p-4 border border-white/5 flex items-center justify-between gap-4">
                  <p className="text-[10px] text-primary font-black uppercase tracking-tight truncate flex-1 leading-none pt-1">00020101021226840014br.gov.bcb.pix...</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('00020101021226840014br.gov.bcb.pix011400010101010101...0520400005303986540510.005802BR5913LUXE_AURA_APP6009SAO_PAULO62070503***6304ABCD');
                      alert('Chave Pix copiada!');
                    }}
                    className="size-10 rounded-xl gold-gradient flex items-center justify-center text-background-dark active:scale-90 transition-all shrink-0 shadow-lg"
                  >
                    <span className="material-symbols-outlined text-lg">content_copy</span>
                  </button>
                </div>
                <p className="text-[7px] text-slate-600 font-bold uppercase text-center tracking-widest leading-relaxed">
                  Após o pagamento, sua reserva será <br /> confirmada automaticamente em até 2 minutos.
                </p>
              </div>
            </div>

            <div className="mt-10 space-y-4">
              <button
                onClick={() => setStep('success')}
                className="w-full gold-gradient text-background-dark py-6 rounded-full font-black uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(193,165,113,0.2)] active:scale-95 transition-all"
              >
                JÁ REALIZEI O PAGAMENTO
              </button>
              <button
                onClick={() => setStep('payment_detail')}
                className="w-full bg-white/5 text-slate-500 py-4 rounded-full font-black uppercase text-[8px] tracking-[0.2em] active:opacity-50 transition-all"
              >
                ALTERAR FORMA DE PAGAMENTO
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="absolute inset-0 z-[99999] bg-background-dark flex flex-col items-center justify-center p-10 text-center animate-fade-in shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]">
            <div className="size-32 rounded-full gold-gradient flex items-center justify-center mb-10 shadow-[0_25px_60px_rgba(193,165,113,0.4)] animate-bounce relative">
              <span className="material-symbols-outlined text-6xl text-background-dark font-black">verified</span>
              <div className="absolute -inset-4 border border-primary/20 rounded-full animate-ping"></div>
            </div>
            <h2 className="text-5xl font-display font-black text-white italic mb-4 uppercase tracking-tighter leading-[0.9]">Sua Aura <br /> Brilha!</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mb-12 max-w-[280px] leading-relaxed">Reserva confirmada em<br /><span className="text-white">{lastOrder?.salonName || bookingDraft.salonName}</span>.</p>

            <div className="w-full space-y-5 px-4 max-w-sm">
              <button
                onClick={handleWhatsAppConfirmation}
                className="w-full gold-gradient text-background-dark py-6 rounded-[32px] font-black uppercase text-[11px] tracking-[0.4em] flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(193,165,113,0.3)] active:scale-95 transition-all"
              >
                <WhatsAppIcon className="size-5" /> NOTIFICAR UNIDADE
              </button>
              <button onClick={() => navigate('/my-appointments')} className="w-full bg-white/5 border border-white/10 text-white/60 py-6 rounded-[32px] font-black uppercase text-[10px] tracking-[0.3em] hover:bg-white/10 active:scale-95 transition-all">MEUS AGENDAMENTOS</button>
              <button onClick={() => navigate('/explore')} className="w-full text-slate-700 font-black uppercase text-[9px] tracking-[0.3em] py-4 active:opacity-50 transition-opacity">Início da Aura</button>
            </div>
          </div>
        )}
      </main>

      {step !== 'success' && (
        <footer className="fixed bottom-0 left-0 right-0 p-10 bg-background-dark/95 backdrop-blur-2xl border-t border-white/5 max-w-[450px] mx-auto z-50">
          <div className="flex justify-between items-end mb-8 px-2">
            <div className="text-left">
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1.5">Investimento Total</p>
              <p className="text-4xl font-display font-black text-white italic tracking-tighter">R$ {total.toFixed(2)}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                Secured <span className="material-symbols-outlined text-lg">verified_user</span>
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              if (step === 'summary') {
                if (salonInfo?.mp_public_key) {
                  setStep('payment_detail');
                } else {
                  handleFinalConfirm(); // Agendamento direto se não cobrar no ato
                }
              } else {
                if (!mpReady) {
                  handleFinalConfirm();
                }
              }
            }}
            disabled={isProcessing || (step === 'payment_detail' && mpReady)}
            className={`w-full gold-gradient text-background-dark font-black py-7 rounded-[36px] shadow-[0_30px_70px_rgba(193,165,113,0.3)] uppercase tracking-[0.4em] text-[12px] flex items-center justify-center gap-4 active:scale-95 transition-all border border-white/20 ${step === 'payment_detail' && mpReady ? 'opacity-0 pointer-events-none absolute' : ''}`}
          >
            {isProcessing ? <div className="size-7 border-3 border-background-dark/20 border-t-background-dark rounded-full animate-spin"></div> : (
              <> {step === 'summary' ? (salonInfo?.mp_public_key ? 'ESCOLHER PAGAMENTO' : 'CONFIRMAR AGENDAMENTO') : 'FINALIZAR'} <span className="material-symbols-outlined font-black">arrow_forward</span> </>
            )}
          </button>
        </footer>
      )}
    </div>
  );
};

// Componente auxiliar para memoizar props e evitar re-render loop do Mercado Pago
const MPPaymentWrapper: React.FC<{ total: number, handleFinalConfirm: () => Promise<void> }> = React.memo(({ total, handleFinalConfirm }) => {
  const initialization = React.useMemo(() => ({
    amount: Number(total.toFixed(2)),
  }), [total]);

  const customization = React.useMemo(() => ({
    paymentMethods: {
      ticket: "all" as const,
      bankTransfer: "all" as const,
      creditCard: "all" as const,
      debitCard: "all" as const,
      mercadoPago: "all" as const,
    },
    texts: {
      paymentsTitle: ' ',
    },
    visual: {
      style: {
        theme: 'dark' as const,
        customVariables: {
          baseColor: '#D4AF37',
          formBackgroundColor: 'transparent',
          inputBackgroundColor: '#121212',
          baseColorFirstVariant: '#C1A571',
          borderRadiusMedium: '16px',
        }
      }
    }
  }), []);

  return (
    <div className="mp-brick-container">
      <Payment
        initialization={initialization}
        customization={customization}
        onReady={() => console.log('Payment Brick Ready')}
        onError={(error) => console.error('Payment Brick Error:', error)}
        onSubmit={async (param) => {
          console.log('MP Param:', param);
          // @ts-ignore
          await handleFinalConfirm(param.payment_method_id);
        }}
      />
      <style>{`
        .mp-payment-brick__title, .mp-payment-brick__subtitle { display: none !important; }
        #paymentCard-form > div > div.mp-payment-brick__container > div > div.mp-payment-brick__header { display: none !important; }
        .mp-payment-brick__header { display: none !important; }
      `}</style>
    </div>
  );
});

export default Checkout;
