import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Appointment, Service, Salon, Product } from '../../types';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import CheckoutPixView from './CheckoutPixView';
import { useToast } from '../../contexts/ToastContext';

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
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M18.894 5.106A9.957 9.957 0 0011.967 2.158c-5.484 0-9.946 4.462-9.946 9.946 0 1.758.46 3.475 1.337 4.996L2.152 22l5.093-1.336a9.92 9.92 0 004.721 1.192h.004c5.485 0 9.948-4.462 9.948-9.946 0-2.656-1.034-5.155-2.913-7.034h-.005.005zm-6.927 15.08h-.004a8.261 8.261 0 01-4.212-1.155l-.302-.18-3.132.822.836-3.055-.196-.312a8.235 8.235 0 01-1.264-4.402c0-4.55 3.702-8.252 8.252-8.252 2.204 0 4.276.859 5.834 2.417a8.22 8.22 0 012.42 5.835c-.002 4.55-3.704 8.251-8.253 8.251.021.03-.01.03 0 0zm4.52-6.183c-.247-.124-1.465-.723-1.692-.806-.227-.082-.392-.123-.557.124-.165.247-.64.805-.783.97-.144.165-.289.186-.536.062-.248-.124-1.045-.385-1.99-1.229-.738-.658-1.237-1.47-1.382-1.717-.144-.248-.015-.382.109-.505.111-.111.247-.29.371-.433.124-.145.165-.248.248-.413.082-.165.041-.31-.02-.433s-.557-1.342-.763-1.837c-.2-.486-.403-.42-.557-.428h-.474c-.165 0-.433.062-.66.31-.227.247-.866.846-.866 2.064 0 1.218.887 2.395 1.01 2.56.124.165 1.745 2.665 4.227 3.738 1.487.643 2.046.685 2.768.571.815-.129 1.55-.63 1.777-1.239.227-.609.227-1.135.159-1.239-.068-.103-.248-.165-.495-.29l.001.001z"
    />
  </svg>
);

const Checkout: React.FC<CheckoutProps> = ({ bookingDraft, salons, onConfirm, setBookingDraft }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>(''); // E-mail capturado
  const [mpReady, setMpReady] = useState(false);
  const [activeSalon, setActiveSalon] = useState<Salon | undefined>(salons.find(s => s.id === bookingDraft.salonId));
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [isPix, setIsPix] = useState(false);
  const location = useLocation();
  const [promoDiscount, setPromoDiscount] = useState(bookingDraft.discount_applied || 0);
  const [isFromAI, setIsFromAI] = useState(!!bookingDraft.discount_applied);
  // Mantemos o state para compatibilidade, mas não usaremos para renderização condicional estrita de abas
  const [activeItemTab, setActiveItemTab] = useState<'services' | 'products'>(
    (bookingDraft.services?.length > 0 && bookingDraft.products?.length === 0) ? 'products' : 'services'
  );
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email || 'anonimo@luxe-aura.com');
      }
    });

    // Detecção de promoção da Aura via URL ou Draft
    const urlParams = new URLSearchParams(location.search);
    const hasPromoParam = urlParams.get('promo') === 'true';

    if (hasPromoParam || bookingDraft.discount_applied) {
      setIsFromAI(true);
      const discount = bookingDraft.discount_applied || activeSalon?.ai_promo_discount;
      if (discount) {
        setPromoDiscount(discount);
        // Só mostra o toast se não estiver já no draft (para não repetir)
        if (!bookingDraft.discount_applied) {
          showToast(`✨ Oferta Aura aplicada: ${discount}% de desconto!`, 'success');
        }
      }
    }
  }, [activeSalon, location.search, bookingDraft.discount_applied]);

  // Validação robusta para garantir que a chave MP é válida e não um e-mail ou lixo
  const isMpEnabled = React.useMemo(() => {
    const key = activeSalon?.mp_public_key;
    // Chave deve existir, não ter '@' (comum em erros de user colocando email), e ter tamanho razoável
    return !!(key && typeof key === 'string' && !key.includes('@') && key.length > 10);
  }, [activeSalon?.mp_public_key]);

  const lastInitedKey = useRef<string | null>(null);

  useEffect(() => {
    if (isMpEnabled && activeSalon?.mp_public_key && lastInitedKey.current !== activeSalon.mp_public_key) {
      try {
        console.log("Iniciando Mercado Pago para o salão...");
        initMercadoPago(activeSalon.mp_public_key, { locale: 'pt-BR' });
        lastInitedKey.current = activeSalon.mp_public_key;
        setMpReady(true);
      } catch (e) {
        console.error("Erro ao inicializar MP:", e);
        setMpReady(false);
      }
    } else if (isMpEnabled && activeSalon?.mp_public_key) {
      setMpReady(true);
    } else {
      setMpReady(false);
    }
  }, [isMpEnabled, activeSalon?.mp_public_key]);

  // Efeito para carregar produtos se necessário (opcional, pode vir do pai também)
  useEffect(() => {
    if (bookingDraft.salonId && !availableProducts.length) {
      api.products.getBySalon(bookingDraft.salonId)
        .then(data => setAvailableProducts(data))
        .catch(err => console.error('Erro ao buscar produtos:', err));
    }
  }, [bookingDraft.salonId]);

  // Fetch available products
  useEffect(() => {
    if (bookingDraft.salonId) {
      api.products.getBySalon(bookingDraft.salonId)
        .then(data => setAvailableProducts(data))
        .catch(err => console.error('Erro ao buscar produtos:', err));
    }
  }, [bookingDraft.salonId]);

  // Use activeSalon ao invés de buscar toda vez
  const salonInfo = activeSalon;

  const services = bookingDraft.services || [];
  const products = bookingDraft.products || [];

  const subtotalServices = services.reduce((acc: number, curr: Service) => acc + curr.price, 0);
  const subtotalProducts = products.reduce((acc: number, curr: Product) => acc + curr.price, 0);
  const subtotal = subtotalServices + subtotalProducts;
  const tax = subtotal * 0.05;
  const calculatedDiscount = (subtotal + tax) * (promoDiscount / 100);
  const total = Math.max(0, subtotal + tax - calculatedDiscount);

  const removeItem = (id: string, type: 'service' | 'product') => {
    if (type === 'service') {
      const newServices = services.filter((s: Service) => s.id !== id);
      setBookingDraft({ ...bookingDraft, services: newServices });
    } else {
      const newProducts = products.filter((p: Product) => p.id !== id);
      setBookingDraft({ ...bookingDraft, products: newProducts });
    }
  };

  const addProduct = (product: Product) => {
    const isAlreadyAdded = products.some((p: Product) => p.id === product.id);
    if (!isAlreadyAdded) {
      setBookingDraft({ ...bookingDraft, products: [...products, product] });
      showToast('Produto adicionado!', 'success');
    }
  };

  const handleFinalConfirm = async (paymentDataOrMethodId?: any) => {
    if (!userId) return;

    const mpObject = typeof paymentDataOrMethodId === 'object' ? paymentDataOrMethodId : null;
    const explicitMethod = typeof paymentDataOrMethodId === 'string' ? paymentDataOrMethodId : null;

    // Detecção robusta se é PIX
    const isPixMethod =
      explicitMethod === 'pix' ||
      explicitMethod === 'bank_transfer' ||
      (mpObject && (
        mpObject.payment_method_id === 'pix' ||
        mpObject.payment_method_id === 'bank_transfer' ||
        mpObject.formData?.payment_method_id === 'pix' ||
        mpObject.formData?.payment_method_id === 'bank_transfer'
      ));

    setIsProcessing(true);
    try {
      const finalServices = [...services];
      const finalProducts = [...products];
      const finalTotal = total;
      // 1. CRIAR O AGENDAMENTO NO BANCO PRIMEIRO
      const totalDuration = finalServices.reduce((acc: number, curr: any) => acc + (curr.duration_min || 30), 0);

      // Determine o status inicial: Se é "paga no local" e não passou dados de pagamento, já nasce confirmado.
      // Se está tentando pagar via MP, nasce pendente.
      const isPayAtLocal = !mpObject && (activeSalon?.paga_no_local || !isMpEnabled);
      const initialStatus = isPayAtLocal ? 'confirmed' : 'pending';

      const newAppt = await api.appointments.create({
        salon_id: bookingDraft.salonId || '',
        client_id: userId,
        professional_id: bookingDraft.professionalId || null,
        service_names: finalServices.length > 0 ? finalServices.map((s: any) => s.name).join(', ') : 'Shopping Boutique',
        valor: Number(finalTotal.toFixed(2)),
        date: bookingDraft.date || new Date().toISOString().split('T')[0],
        time: bookingDraft.time || '10:00:00',
        duration_min: totalDuration,
        status: initialStatus,
        booked_by_ai: isFromAI
      });

      // 2. Tentar criar o pedido no Mercado Pago se houver dados
      let pixData = null;
      if (mpObject && activeSalon) {
        try {
          if (!mpObject.payer) mpObject.payer = {};
          if (!mpObject.payer.email) mpObject.payer.email = userEmail;

          // Adiciona metadados cruciais para o Webhook e Rastreabilidade
          mpObject.external_reference = newAppt.id;
          if (!mpObject.metadata) mpObject.metadata = {};
          mpObject.metadata.appointment_id = newAppt.id;
          mpObject.metadata.salon_id = activeSalon.id;

          const mpResponse = await api.payments.createOrder(activeSalon, mpObject);
          const actualResponse = mpResponse.response || mpResponse.data || mpResponse;
          const poi = actualResponse.point_of_interaction || mpResponse.point_of_interaction;

          if (poi && poi.transaction_data) {
            const tData = poi.transaction_data;
            pixData = {
              qrCodeBase64: tData.qr_code_base64,
              copyPaste: tData.qr_code,
              ticketUrl: tData.ticket_url,
              id: actualResponse.id || mpResponse.id
            };
          } else if (actualResponse.id) {
            pixData = { id: actualResponse.id, copyPaste: '', qrCodeBase64: '' };
          }

          // Se for cartão e já aprovou (status approved), confirma o appt na hora
          if (actualResponse.status === 'approved') {
            await api.appointments.updateStatus(newAppt.id, 'confirmed');
            newAppt.status = 'confirmed';
          }
        } catch (payErr: any) {
          console.error("Erro MP:", payErr);
          // Se falhou o pagamento, deletamos o agendamento pendente para não sujar a agenda
          try { await api.appointments.delete(newAppt.id); } catch (e) { }
          showToast(payErr.message || "Erro no processamento do pagamento", 'error');
          setIsProcessing(false);
          return;
        }
      }

      // Snapshot para a tela de sucesso/Pix
      const orderSnapshot = {
        appointmentId: newAppt.id, // <--- ADICIONADO ID DO AGENDAMENTO
        salonName: bookingDraft.salonName || salonInfo?.nome,
        endereco: salonInfo?.endereco,
        services: finalServices,
        products: finalProducts,
        total: finalTotal,
        date: bookingDraft.date,
        time: bookingDraft.time || '10:00',
        telefone: salonInfo?.telefone,
        isPix: isPixMethod,
        pixData: pixData
      };
      setLastOrder(orderSnapshot);

      // Se não for PIX (ex: Cartão aprovado ou local), finaliza a UI do bot
      if (!isPixMethod) {
        onConfirm(newAppt);
      }

      // 3. DIRECIONAR PARA A TELA CORRETA
      if (isPixMethod) {
        setStep('waiting_pix');
      } else {
        setStep('success');
      }

      // Limpa o rascunho
      setBookingDraft({ services: [], products: [] });

    } catch (error: any) {
      console.error('Erro no checkout:', error);
      showToast("Falha ao finalizar: " + error.message, 'error');
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

  // REF STABLE: Criar uma referência estável para a função de submit
  // Isso impede que o Payment Brick seja desmontado/remontado quando o pai renderiza
  const handleFinalConfirmRef = useRef(handleFinalConfirm);
  // Atualiza a ref a cada render para ter sempre a versão mais nova da função
  useEffect(() => {
    handleFinalConfirmRef.current = handleFinalConfirm;
  });

  // Callback estável que nunca muda
  const stableSubmit = useCallback(async (param: any) => {
    return await handleFinalConfirmRef.current(param);
  }, []); // Sem dependências = referência fixa


  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background-dark relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] pointer-events-none"></div>

      {step !== 'success' && (
        <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-3xl px-4 lg:px-6 pt-10 lg:pt-12 pb-6 lg:pb-10 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto w-full text-center">
            <div className="flex items-center justify-between mb-6 lg:mb-8">
              <button
                onClick={() => step === 'payment_detail' ? setStep('summary') : navigate(-1)}
                className="size-9 lg:size-12 rounded-xl lg:rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-base lg:text-xl">arrow_back</span>
              </button>
              <div className="text-center">
                <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none text-sm lg:text-3xl">
                  Finalização Elite
                </h1>
                <p className="text-[6px] lg:text-[7px] text-primary font-black uppercase tracking-[0.4em] mt-2">{step === 'summary' ? 'Revisão do Ritual' : 'Pagamento Seguro'}</p>
              </div>
              <div className="size-9 lg:size-12 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-lg lg:text-xl">verified_user</span>
              </div>
            </div>
          </div>
        </header>
      )}

      {(!services.length && !products.length && step !== 'success' && step !== 'waiting_pix') ? (
        <div className="h-full flex flex-col items-center justify-center p-8 sm:p-8 lg:p-8 text-center animate-fade-in relative z-10 py-60 sm:py-60 lg:py-60">
          <div className="size-18 sm:size-20 lg:size-24 rounded-2xl sm:rounded-3xl lg:rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-700 mb-8">
            <span className="material-symbols-outlined text-3xl sm:text-4xl lg:text-5xl lg:text-3xl sm:text-4xl lg:text-5xl">shopping_bag</span>
          </div>
          <h2 className="text-2xl lg:text-2xl lg:text-3xl lg:text-3xl font-display font-black text-white italic mb-8 uppercase tracking-tighter">Sua Sacola está vazia</h2>
          <button
            onClick={() => navigate('/products')}
            className="gold-gradient text-background-dark h-20 px-12 sm:px-12 lg:px-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.4em] active:scale-95 transition-all shadow-gold"
          >
            EXPLORAR ACERVO
          </button>
        </div>
      ) : (
        <main className={`max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-20 animate-fade-in relative z-10 flex-1 ${step !== 'waiting_pix' ? 'flex flex-col items-center justify-center' : ''}`}>
          {step === 'summary' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start w-full lg:mb-20">
              {/* Coluna Principal: Itens Selecionados */}
              <div className="lg:col-span-7 space-y-16">
                {/* 1. SERVIÇOS SELECIONADOS */}
                {services.length > 0 && (
                  <div className="space-y-6 lg:space-y-10">
                    <div className="flex items-center gap-4 lg:gap-6 px-2 lg:px-4">
                      <div className="h-[1px] w-8 lg:w-12 bg-primary"></div>
                      <h2 className="text-[9px] lg:text-xs font-black uppercase tracking-[0.5em] text-primary">Rituais Escolhidos</h2>
                    </div>
                    <div className="space-y-4 lg:space-y-6">
                      {services.map((s: Service) => (
                        <div key={s.id} className="group relative bg-surface-dark/40 rounded-2xl lg:rounded-[48px] border border-white/5 p-4 lg:p-8 shadow-2xl transition-all backdrop-blur-3xl overflow-hidden active:scale-[0.99] flex items-center gap-4 lg:gap-8">
                          <div className="relative shrink-0">
                            <div className="size-12 lg:size-24 rounded-xl lg:rounded-[32px] overflow-hidden border border-white/5 shadow-2xl relative">
                              <img src={s.image} className="size-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt={s.name} />
                              <div className="absolute inset-0 bg-gradient-to-t from-background-dark/40 to-transparent"></div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-display text-base lg:text-2xl font-black text-white italic tracking-tighter uppercase leading-none truncate group-hover:text-primary transition-colors">{s.name}</h4>
                            <div className="flex items-center gap-2 lg:gap-4 mt-2 lg:mt-3">
                              <span className="text-[6px] lg:text-[8px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-1.5 py-0.5 lg:px-2.5 lg:py-1.5 rounded-lg border border-white/5">{s.duration_min} MIN</span>
                              <span className="text-[6px] lg:text-[8px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 lg:px-2.5 lg:py-1.5 rounded-lg border border-primary/10">RITUAL</span>
                            </div>
                            <div className="mt-2 lg:mt-4">
                              <span className="text-lg lg:text-2xl font-display font-black text-white italic tracking-tight">R$ {s.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeItem(s.id, 'service')}
                            className="size-8 lg:size-12 rounded-xl lg:rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center active:scale-90 transition-all shrink-0"
                          >
                            <span className="material-symbols-outlined text-base lg:text-xl font-black underline">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 1.1 PRODUTOS SELECIONADOS */}
                {products.length > 0 && (
                  <div className="space-y-8 lg:space-y-10">
                    <div className="flex items-center gap-6 lg:gap-6 px-2 sm:px-2 lg:px-2 lg:px-4 sm:px-4 lg:px-4">
                      <div className="h-0.5 w-10 lg:w-12 bg-slate-800"></div>
                      <h2 className="text-[10px] lg:text-xs font-black uppercase tracking-[0.5em] text-slate-600 opacity-80">Ativos Adicionados</h2>
                    </div>
                    <div className="space-y-6">
                      {products.map((p: Product) => (
                        <div key={p.id} className="group relative bg-surface-dark/40 rounded-2xl sm:rounded-3xl lg:rounded-[32px] lg:rounded-2xl sm:rounded-3xl lg:rounded-[48px] border border-white/5 p-5 sm:p-5 lg:p-5 lg:p-8 sm:p-8 lg:p-8 shadow-2xl transition-all backdrop-blur-3xl overflow-hidden active:scale-[0.99] flex items-center gap-6 lg:gap-6 lg:gap-8 lg:gap-8">
                          <div className="relative shrink-0">
                            <div className="size-10 sm:size-12 lg:size-16 lg:size-18 sm:size-20 lg:size-24 rounded-2xl lg:rounded-2xl sm:rounded-3xl lg:rounded-[32px] overflow-hidden border-2 border-white/5 shadow-2xl relative">
                              <img src={p.image} className="size-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt={p.name} />
                              <div className="absolute inset-0 bg-gradient-to-t from-background-dark/40 to-transparent"></div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-display text-lg lg:text-2xl lg:text-2xl font-black text-white italic tracking-tighter uppercase leading-none truncate group-hover:text-primary transition-colors">{p.name}</h4>
                            <div className="flex items-center gap-3 lg:gap-3 lg:gap-4 lg:gap-4 mt-3">
                              <span className="text-[7px] lg:text-[8px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 sm:px-2 lg:px-2 py-1 sm:py-1 lg:py-1 lg:px-2 sm:px-2 lg:px-2.5 lg:py-1 sm:py-1 lg:py-1.5 rounded-lg lg:rounded-xl border border-primary/10">BOUTIQUE</span>
                            </div>
                            <div className="mt-4">
                              <span className="text-xl lg:text-2xl lg:text-2xl font-display font-black text-white italic tracking-tight">R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeItem(p.id, 'product')}
                            className="size-10 sm:size-12 lg:size-10 lg:size-10 sm:size-12 lg:size-12 rounded-xl lg:rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center active:scale-90 transition-all shrink-0"
                          >
                            <span className="material-symbols-outlined text-lg lg:text-xl font-black">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Coluna Lateral: Resumo, Upsell e Checkout */}
              <div className="lg:col-span-5 space-y-10 lg:space-y-12">
                {/* 2. CARD DE UPSELL */}
                {availableProducts.length > 0 && products.length === 0 && (
                  <div className="gold-gradient p-[1px] rounded-2xl lg:rounded-[48px] shadow-[0_30px_100px_rgba(0,0,0,0.5)] group transition-all hover:scale-[1.01]">
                    <div className="bg-background-dark/98 backdrop-blur-3xl rounded-2xl lg:rounded-[47px] p-5 lg:p-10 relative overflow-hidden">
                      <div className="absolute top-0 -left-1/2 w-full h-full bg-gradient-to-r from-transparent via-primary/10 to-transparent skew-x-[-25deg] group-hover:left-[120%] transition-all duration-1500 ease-in-out"></div>
                      <div className="relative z-10 space-y-4 lg:space-y-8">
                        <div className="text-center">
                          <span className="bg-primary/20 text-primary border border-primary/30 px-3 lg:px-5 py-1 lg:py-2 rounded-full text-[7px] lg:text-[9px] font-black uppercase tracking-[0.5em]">Oferta Especial</span>
                          <h3 className="text-base lg:text-2xl font-display font-black text-white italic uppercase tracking-tighter mt-3 lg:mt-6">Complete o Ritual</h3>
                        </div>
                        <div className="space-y-3">
                          {availableProducts.slice(0, 2).map((product) => (
                            <div key={product.id} className="bg-surface-dark border border-white/5 rounded-xl lg:rounded-[32px] p-3 lg:p-4 flex items-center gap-3 lg:gap-6 group/item hover:border-primary/40 transition-all">
                              <div className="size-10 lg:size-16 rounded-xl lg:rounded-2xl overflow-hidden border border-white/10 shrink-0">
                                <img src={product.image} className="size-full object-cover grayscale-[0.3] group-hover/item:grayscale-0 transition-all" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-[10px] lg:text-sm font-black text-white uppercase tracking-widest truncate">{product.name}</h4>
                                <span className="text-primary font-display font-black text-sm lg:text-lg italic mt-1 block">R$ {product.price.toFixed(2)}</span>
                              </div>
                              <button onClick={() => addProduct(product)} className="size-7 lg:size-10 rounded-lg lg:rounded-2xl gold-gradient text-background-dark flex items-center justify-center shadow-gold group-hover/item:scale-110 transition-all">
                                <span className="material-symbols-outlined text-xs lg:text-base font-black">add</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resumo Consolidado */}
                <div className="bg-surface-dark border border-white/5 rounded-[32px] lg:rounded-[56px] p-6 lg:p-10 shadow-3xl space-y-6 lg:space-y-10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 lg:p-8 opacity-5">
                    <span className="material-symbols-outlined text-5xl lg:text-8xl text-white">receipt_long</span>
                  </div>
                  <div className="relative z-10 space-y-6 lg:space-y-10">
                    <div className="flex items-center gap-4 lg:gap-6">
                      <div className="size-10 lg:size-16 rounded-2xl lg:rounded-[24px] gold-gradient flex items-center justify-center text-background-dark shadow-gold">
                        <span className="material-symbols-outlined text-2xl lg:text-3xl font-black">checklist</span>
                      </div>
                      <div>
                        <p className="text-[8px] lg:text-[10px] text-slate-500 font-black uppercase tracking-[0.5em]">SÍNTESE DA RESERVA</p>
                        <h3 className="text-lg lg:text-2xl font-display font-black text-white italic uppercase tracking-tighter">Manifesto Aura</h3>
                      </div>
                    </div>
                    <div className="space-y-3 lg:space-y-6">
                      {bookingDraft.date && (
                        <div className="bg-background-dark/40 border border-white/5 p-4 lg:p-6 rounded-2xl lg:rounded-[32px] flex items-center gap-4 lg:gap-6 group hover:border-primary/20 transition-all">
                          <span className="material-symbols-outlined text-primary text-xl lg:text-2xl">calendar_today</span>
                          <div>
                            <p className="text-[7px] lg:text-[8px] text-slate-600 font-black uppercase tracking-widest mb-1">DATA DO RITUAL</p>
                            <p className="text-xs lg:text-sm font-black text-white uppercase tracking-widest">{new Date(bookingDraft.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</p>
                          </div>
                        </div>
                      )}
                      {bookingDraft.time && (
                        <div className="bg-background-dark/40 border border-white/5 p-4 lg:p-6 rounded-2xl lg:rounded-[32px] flex items-center gap-4 lg:gap-6 group hover:border-primary/20 transition-all">
                          <span className="material-symbols-outlined text-primary text-xl lg:text-2xl">schedule</span>
                          <div>
                            <p className="text-[7px] lg:text-[8px] text-slate-600 font-black uppercase tracking-widest mb-1">HORÁRIO MARCADO</p>
                            <p className="text-xs lg:text-sm font-black text-white uppercase tracking-widest">{bookingDraft.time}</p>
                          </div>
                        </div>
                      )}
                      {bookingDraft.professionalName && (
                        <div className="bg-background-dark/40 border border-white/5 p-4 lg:p-6 rounded-2xl lg:rounded-[32px] flex items-center gap-4 lg:gap-6 group hover:border-primary/20 transition-all">
                          <span className="material-symbols-outlined text-primary text-xl lg:text-2xl">person</span>
                          <div>
                            <p className="text-[7px] lg:text-[8px] text-slate-600 font-black uppercase tracking-widest mb-1">ARTISTA RESPONSÁVEL</p>
                            <p className="text-xs lg:text-sm font-black text-white uppercase tracking-widest">{bookingDraft.professionalName}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="pt-6 lg:pt-10 border-t border-white/5 space-y-4 lg:space-y-6">
                      <div className="flex justify-between items-center text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                        <span>Rituais & Ativos</span>
                        <span className="text-white">R$ {subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                        <span>Taxa Concierge (5%)</span>
                        <span className="text-white">R$ {tax.toFixed(2)}</span>
                      </div>
                      {promoDiscount > 0 && (
                        <div className="flex justify-between items-center text-[8px] lg:text-[10px] font-black text-emerald-400 uppercase tracking-widest px-1 group">
                          <span className="flex items-center gap-1.5 lg:gap-2">PLATINUM DISCOUNT <span className="material-symbols-outlined text-[12px] lg:text-[14px]">auto_awesome</span></span>
                          <span>- R$ {calculatedDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="pt-6 lg:pt-8 flex justify-between items-center px-1">
                        <span className="text-[9px] lg:text-[11px] font-black text-primary uppercase tracking-[0.5em]">INVESTIMENTO TOTAL</span>
                        <span className="text-2xl lg:text-4xl font-display font-black text-white italic tracking-tighter">R$ {total.toFixed(2)}</span>
                      </div>

                      {/* Desktop Integrated Button */}
                      <div className="hidden lg:block pt-10 relative z-10">
                        <button
                          onClick={() => {
                            if (step === 'summary') {
                              if (activeSalon?.paga_no_local || !isMpEnabled) {
                                handleFinalConfirm();
                              } else {
                                setStep('payment_detail');
                              }
                            } else {
                              if (!mpReady) handleFinalConfirm();
                            }
                          }}
                          disabled={isProcessing}
                          className="w-full h-20 rounded-[32px] gold-gradient text-background-dark font-black uppercase text-[11px] tracking-[0.4em] flex items-center justify-center gap-6 shadow-gold active:scale-95 transition-all group overflow-hidden relative z-20 cursor-pointer pointer-events-auto"
                        >
                          <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                          {isProcessing ? (
                            <div className="size-7 border-3 border-background-dark/20 border-t-background-dark rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <span className="relative z-10">
                                {step === 'summary' ? (
                                  (activeSalon?.paga_no_local || !isMpEnabled) ? 'FINALIZAR RITUAL' : 'ESCOLHER PAGAMENTO'
                                ) : 'REALIZAR PAGAMENTO'}
                              </span>
                              <span className="material-symbols-outlined text-2xl font-black relative z-10 group-hover:translate-x-1 transition-transform">arrow_forward</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/10 p-8 sm:p-8 lg:p-8 rounded-2xl sm:rounded-3xl lg:rounded-[40px] flex items-center gap-6 lg:gap-6 backdrop-blur-3xl group">
                    <div className="size-10 sm:size-12 lg:size-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-3xl lg:text-3xl font-black">shield_with_heart</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Protocolo de Confiança</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Sua experiência é monitorada e assegurada pelos padrões Aura Signature.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'payment_detail' && (
            <div className="max-w-[840px] mx-auto w-full animate-fade-in space-y-12">
              <div className="bg-surface-dark border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[56px] shadow-3xl p-4 sm:p-8 lg:p-16">
                <header className="mb-10 text-center">
                  <p className="text-[10px] text-primary font-black uppercase tracking-[0.5em] mb-4">MÉTODO DE PAGAMENTO</p>
                  <h2 className="text-3xl lg:text-3xl font-display font-black text-white italic tracking-tighter uppercase">Ambiente Criptografado</h2>
                </header>

                <div className="min-h-auto min-h-[450px]">
                  {mpReady && total > 0 ? (
                    <MPPaymentWrapper
                      total={total}
                      handleFinalConfirm={stableSubmit}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 sm:py-20 lg:py-20 gap-8 lg:gap-8">
                      <div className="size-10 sm:size-12 lg:size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                      <p className="text-[11px] text-primary font-black uppercase tracking-[0.5em] animate-pulse">Iniciando Gateway Elite...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'waiting_pix' && (
            <div className="max-w-[900px] mx-auto w-full animate-fade-in py-10">
              <CheckoutPixView
                lastOrder={lastOrder}
                bookingDraft={bookingDraft}
                total={total}
                activeSalon={activeSalon}
                userId={userId}
                onSuccess={(newAppt: any) => {
                  onConfirm(newAppt);
                  setStep('success');
                  setBookingDraft({ services: [], products: [] });
                }}
                onBack={() => setStep('payment_detail')}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
              />
            </div>
          )}
        </main>
      )}

      {step === 'success' && (
        <div className="fixed inset-0 z-[200] bg-background-dark flex flex-col items-center justify-center p-6 lg:p-20 text-center overflow-auto animate-fade-in">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-radial from-primary/10 via-transparent to-transparent opacity-50"></div>

          <div className="relative z-10 space-y-12 max-w-[800px] w-full px-6">
            <div className="relative flex justify-center">
              <div className="absolute inset-0 bg-primary/30 blur-[100px] rounded-full"></div>
              <span
                className="material-symbols-outlined text-primary drop-shadow-[0_0_50px_rgba(193,165,113,0.5)] relative z-20 animate-pulse-slow"
                style={{ fontSize: 'clamp(100px, 15vw, 220px)', fontVariationSettings: "'FILL' 1, 'wght' 200" }}
              >
                verified
              </span>
            </div>

            <div className="space-y-6 lg:space-y-10">
              <h2 className="text-4xl lg:text-8xl font-display font-black text-white italic uppercase tracking-tighter leading-[0.85] animate-slide-up">Reserva <br /> Confirmada</h2>
              <p className="text-[10px] lg:text-sm text-slate-500 font-black uppercase tracking-[0.5em] leading-loose max-w-md mx-auto">
                Seu ritual em <span className="text-white">{lastOrder?.salonName || bookingDraft.salonName}</span> está garantido.
                <br className="hidden lg:block" /> Confira os detalhes na sua agenda.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-8 pt-10">
              <button
                onClick={handleWhatsAppConfirmation}
                className="w-full gold-gradient text-background-dark h-16 lg:h-24 rounded-2xl lg:rounded-[32px] font-black uppercase text-[10px] lg:text-sm tracking-[0.4em] flex items-center justify-center gap-4 shadow-gold active:scale-95 transition-all group"
              >
                <WhatsAppIcon className="size-5 lg:size-8 group-hover:scale-110 transition-transform" /> NOTIFICAR ARTISTA
              </button>
              <button
                onClick={() => navigate('/my-appointments')}
                className="w-full bg-white/5 border border-white/10 text-white h-16 lg:h-24 rounded-2xl lg:rounded-[32px] font-black uppercase text-[10px] lg:text-sm tracking-[0.3em] hover:bg-white/10 active:scale-95 transition-all"
              >
                MEUS RITUAIS
              </button>
              <button
                onClick={() => navigate('/explore')}
                className="col-span-full text-slate-700 font-black uppercase text-[9px] lg:text-xs tracking-[0.6em] py-8 active:opacity-50 transition-opacity hover:text-slate-500"
              >
                VOLTAR AO INÍCIO
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'summary' && (
        <footer className="fixed bottom-0 left-0 right-0 z-[160] lg:hidden">
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background-dark via-background-dark/95 to-transparent pointer-events-none"></div>
          <div className="relative px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
            <div className="max-w-[600px] mx-auto bg-surface-dark/95 backdrop-blur-3xl border border-white/10 p-3 rounded-[32px] shadow-[0_30px_100px_rgba(0,0,0,0.8)] flex items-center justify-between gap-4 pointer-events-auto">
              <div className="text-left pl-3">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em] mb-0.5 leading-none">TOTAL</p>
                <p className="text-xl font-display font-black text-white italic tracking-tighter">R$ {total.toFixed(2)}</p>
              </div>
              <button
                onClick={() => {
                  if (step === 'summary') {
                    if (activeSalon?.paga_no_local || !isMpEnabled) {
                      handleFinalConfirm();
                    } else {
                      setStep('payment_detail');
                    }
                  } else {
                    if (!mpReady) handleFinalConfirm();
                  }
                }}
                disabled={isProcessing}
                className="flex-1 sm:flex-none gold-gradient text-background-dark h-12 px-6 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 shadow-gold active:scale-95 transition-all group overflow-hidden relative cursor-pointer hover:scale-[1.02]"
              >
                <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                {isProcessing ? (
                  <div className="size-5 border-2 border-background-dark/20 border-t-background-dark rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="relative z-10 whitespace-nowrap">
                      {step === 'summary' ? (
                        (activeSalon?.paga_no_local || !isMpEnabled) ? 'FINALIZAR' : 'PAGAMENTO'
                      ) : 'PAGAR AGORA'}
                    </span>
                    <span className="material-symbols-outlined text-lg font-black relative z-10 group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

// Componente auxiliar para memoizar props e evitar re-render loop do Mercado Pago
const MPPaymentWrapper: React.FC<{ total: number, handleFinalConfirm: (param: any) => Promise<void> }> = React.memo(({ total, handleFinalConfirm }) => {
  const [shouldRender, setShouldRender] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setShouldRender(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const initialization = React.useMemo(() => ({
    amount: total > 0 ? Number(total.toFixed(2)) : 0.01, // Valor mínimo seguro
  }), [total]);

  const customization = React.useMemo(() => ({
    paymentMethods: {
      ticket: "all" as const,
      bankTransfer: "all" as const,
      creditCard: "all" as const,
      debitCard: "all" as const,
      mercadoPago: "all" as const,
    },
    visual: {
      theme: 'dark' as const,
      style: {
        theme: 'dark' as const,
        customVariables: {
          baseColor: "#c1a571",
          borderRadiusSmall: "8px",
          borderRadiusMedium: "16px",
          borderRadiusLarge: "24px",
        }
      }
    }
  }), []);

  return (
    <div
      className="mp-brick-container min-h-[500px] w-full max-w-[600px] mx-auto rounded-2xl sm:rounded-3xl lg:rounded-[40px] border border-[#c1a571]/20 shadow-2xl bg-[#0c0d10] flex flex-col items-center justify-start relative transition-all duration-1000 pb-10"
      style={{ opacity: shouldRender ? 1 : 0, transform: shouldRender ? 'translateY(0)' : 'translateY(20px)' }}
    >
      <style>{`
        /* 1. FUNDO E BORDAS - ESPECÍFICO */
        .mp-payment-brick,
        .mp-payment-brick__container,
        .mp-payment-method-option,
        .mp-payment-method-option--selected,
        .mp-payment-method-option-header,
        .mp-payment-method-option-header--selected,
        .mp-form-container {
            background-color: #0c0d10 !important;
            background: #0c0d10 !important;
        }

        .mp-payment-method-option--selected {
            border: 1px solid #c1a571 !important;
        }

        /* 2. TIPOGRAFIA - APENAS ELEMENTOS DE TEXTO */
        .mp-method-title, 
        .mp-method-description,
        .mp-payment-brick .mp-text,
        .mp-payment-brick p,
        .mp-payment-brick span,
        .mp-payment-brick label {
            font-family: 'Outfit', sans-serif !important;
        }

        .mp-method-title, 
        .mp-method-description,
        .mp-payment-brick p,
        .mp-payment-brick span,
        .mp-text-color-primary,
        .mp-text-color-secondary {
            color: #ffffff !important;
        }

        .mp-payment-brick label, .mp-form-label {
            color: #c1a571 !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            font-size: 10px !important;
            letter-spacing: 2px !important;
        }

        /* 3. CONTROLES - RADIO BUTTONS */
        .mp-radio-button__outer-circle {
            border-color: rgba(193, 165, 113, 0.5) !important;
        }

        .mp-radio-button--checked .mp-radio-button__outer-circle {
            border-color: #c1a571 !important;
        }

        .mp-radio-button__inner-circle {
            background-color: #c1a571 !important;
        }

        /* 4. FORMULÁRIO - SEM INTERFERIR EM SVG */
        .mp-input-text,
        .mp-payment-brick input:not([type="radio"]):not([type="checkbox"]),
        .mp-payment-brick select {
            background-color: rgba(255, 255, 255, 0.05) !important;
            border: 1px solid rgba(193, 165, 113, 0.3) !important;
            color: #ffffff !important;
            border-radius: 12px !important;
        }

        /* 5. AÇÃO FINAL */
        .mp-payment-brick__submit-button,
        .mp-payment-brick button[type="submit"] {
            background: linear-gradient(135deg, #b1945f 0%, #ecd3a5 50%, #b1945f 100%) !important;
            color: #000000 !important;
            font-weight: 900 !important;
            border-radius: 20px !important;
            box-shadow: 0 15px 40px rgba(177, 148, 95, 0.3) !important;
            border: none !important;
        }
      `}</style>

      {!shouldRender ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
          <div className="size-10 sm:size-12 lg:size-12 border-4 border-[#c1a571]/20 border-t-[#c1a571] rounded-full animate-spin"></div>
          <p className="text-[10px] text-[#c1a571] font-black uppercase tracking-widest animate-pulse">Personalizando sua Aura...</p>
        </div>
      ) : (
        <div className="w-full h-full animate-slide-up">
          <Payment
            initialization={initialization}
            customization={customization}
            onSubmit={handleFinalConfirm}
          />
        </div>
      )}
    </div>
  );
});

export default Checkout;
