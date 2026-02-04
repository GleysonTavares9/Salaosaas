import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  }, []);

  // Validação robusta para garantir que a chave MP é válida e não um e-mail ou lixo
  const isMpEnabled = React.useMemo(() => {
    const key = activeSalon?.mp_public_key;
    // Chave deve existir, não ter '@' (comum em erros de user colocando email), e ter tamanho razoável
    return !!(key && typeof key === 'string' && !key.includes('@') && key.length > 10);
  }, [activeSalon?.mp_public_key]);

  useEffect(() => {
    if (isMpEnabled && activeSalon?.mp_public_key) {
      try {
        initMercadoPago(activeSalon.mp_public_key, { locale: 'pt-BR' });
        setMpReady(true);
      } catch (e) {
        console.error("Erro ao inicializar MP:", e);
        setMpReady(false);
      }
    } else {
      setMpReady(false);
    }
  }, [isMpEnabled, activeSalon?.mp_public_key]);

  useEffect(() => {
    const fetchSalon = async () => {
      if (bookingDraft.salonId) {
        try {
          const salon = await api.salons.getById(bookingDraft.salonId);
          setActiveSalon(salon);
          console.log("Dados do salão atualizados:", salon.paga_no_local ? "Pagar no local habilitado" : "Checkout online obrigatório");
        } catch (error) {
          console.error('Erro ao carregar salão:', error);
        }
      }
    };
    fetchSalon();
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

  const addProduct = (product: Product) => {
    const isAlreadyAdded = products.some((p: Product) => p.id === product.id);
    if (!isAlreadyAdded) {
      setBookingDraft({ ...bookingDraft, products: [...products, product] });
      showToast('Produto adicionado!', 'success');
    }
  };

  const handleFinalConfirm = async (paymentDataOrMethodId?: any) => {
    if (!userId) return;

    const currentIsPix = paymentDataOrMethodId === 'pix' || paymentDataOrMethodId === 'bank_transfer' || (typeof paymentDataOrMethodId === 'object' && paymentDataOrMethodId.payment_method_id === 'pix');
    setIsPix(currentIsPix);

    // Validate total is a valid number
    if (isNaN(total) || total <= 0) {
      showToast('Erro: Valor total inválido. Por favor, adicione serviços ou produtos.', 'error');
      return;
    }

    // Convert date to ISO format if needed
    let isoDate = bookingDraft.date;

    // Se a data vier no formato PT-BR ou texto, vamos garantir o formato YYYY-MM-DD
    if (!isoDate || typeof isoDate !== 'string' || !isoDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const d = new Date();
      isoDate = d.toISOString().split('T')[0];
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

      // --- INTEGRAÇÃO REAL COM MERCADO PAGO ORDERS API ---
      let pixData = null;
      if (typeof paymentDataOrMethodId === 'object' && activeSalon) {
        try {
          // Garantir que temos o email do payer (exigido pela API)
          if (!paymentDataOrMethodId.payer) paymentDataOrMethodId.payer = {};
          if (!paymentDataOrMethodId.payer.email) paymentDataOrMethodId.payer.email = userEmail;

          const paymentResponse = await api.payments.createOrder(activeSalon, paymentDataOrMethodId);

          // Verificar se é PIX e capturar QR Code
          if (paymentResponse.point_of_interaction?.transaction_data) {
            const tData = paymentResponse.point_of_interaction.transaction_data;
            pixData = {
              qrCodeBase64: tData.qr_code_base64,
              copyPaste: tData.qr_code,
              ticketUrl: tData.ticket_url,
              id: paymentResponse.id
            };
          }

        } catch (paymentError: any) {
          console.error("Falha no pagamento MP:", paymentError);
          showToast(`Pagamento não processado: ${paymentError.message}`, 'error');
          setIsProcessing(false);
          return;
        }
      }

      // Se for PIX, paramos aqui e mostramos a tela de QR Code
      if (pixData) {
        setLastOrder(prev => ({ ...prev, pixData }));
        setStep('waiting_pix');
        setIsProcessing(false);
        return;
      }

      // --- CORREÇÃO DE INTEGRIDADE: Garantir que o Profile existe ---
      // Evita erro 23503 (Foreign Key Violation) se o perfil não tiver sido criado na auth
      try {
        await api.profiles.update(userId, {
          email: userEmail,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Tentativa de autocorreção de perfil:", e);
      }

      const newAppt = await api.appointments.create({
        salon_id: bookingDraft.salonId || '',
        client_id: userId,
        professional_id: bookingDraft.professionalId || null,
        service_names: finalServices.length > 0 ? finalServices.map((s: any) => s.name).join(', ') : 'Shopping Boutique',
        valor: Number(finalTotal.toFixed(2)),
        date: isoDate,
        time: bookingDraft.time || '10:00:00', // Formato HH:MM:SS para o Postgres
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
      showToast("Erro ao finalizar reserva: " + (error.message || 'Erro desconhecido'), 'error');
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
      <header className="px-6 pt-12 pb-6 bg-background-dark/95 backdrop-blur-xl border-b border-white/5 z-50 shrink-0 flex items-center justify-between relative">
        <button onClick={() => step === 'payment_detail' ? setStep('summary') : navigate(-1)} className="size-12 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 font-display text-xs font-black text-white italic tracking-[0.3em] uppercase opacity-90">Confirmação</h1>
        <div className="size-12 flex items-center justify-center text-primary group">
          <span className="material-symbols-outlined text-xl font-black group-hover:scale-110 transition-transform">verified_user</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar">
        {step === 'summary' && (
          <div className="px-6 pt-6 pb-[500px] space-y-6">

            {/* 1. SERVIÇOS SELECIONADOS */}
            {services.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="material-symbols-outlined text-primary text-sm">spa</span>
                  <p className="text-[9px] font-black text-white uppercase tracking-widest">Rituais Escolhidos</p>
                </div>
                {services.map((s: Service) => (
                  <div key={s.id} className="bg-[#121417]/60 border border-primary/20 rounded-[32px] p-5 flex items-start gap-4 shadow-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="relative shrink-0">
                      <img src={s.image} className="size-16 rounded-2xl object-cover shadow-xl" alt={s.name} />
                      <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 ring-inset"></div>
                    </div>

                    <div className="flex-1 min-w-0 py-1">
                      <h4 className="text-white font-black text-sm italic font-display uppercase tracking-widest leading-tight line-clamp-2 mb-2">{s.name}</h4>
                      <div className="flex items-center gap-2 opacity-40">
                        <span className="text-[7px] text-white font-black uppercase tracking-widest">{s.duration_min} MIN</span>
                        <span className="text-white">•</span>
                        <span className="text-[7px] text-white font-black uppercase tracking-widest">SERVIÇO</span>
                      </div>
                      <div className="mt-3">
                        <span className="text-primary font-display font-black text-xl italic tracking-tight">R$ {s.price.toFixed(2)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => removeItem(s.id, 'service')}
                      className="size-10 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90 shrink-0"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 2. CARD DE UPSELL (Se não tiver produtos) */}
            {availableProducts.length > 0 && products.length === 0 && (
              <div className="relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-primary px-4 py-1.5 rounded-full shadow-lg animate-bounce">
                  <span className="text-[7px] text-background-dark font-black uppercase tracking-[0.2em] flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">local_fire_department</span>
                    Oferta Especial
                  </span>
                </div>

                <div className="bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 border-2 border-primary/50 rounded-[32px] p-6 shadow-2xl backdrop-blur-md relative overflow-hidden animate-pulse-slow">
                  <div className="absolute top-0 right-0 opacity-5">
                    <span className="material-symbols-outlined text-9xl text-primary">shopping_bag</span>
                  </div>

                  <div className="relative z-10 space-y-4">
                    <div className="text-center space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-primary text-2xl">auto_awesome</span>
                        <h3 className="text-white font-display font-black text-lg italic tracking-tight">Complete Seu Ritual</h3>
                        <span className="material-symbols-outlined text-primary text-2xl">auto_awesome</span>
                      </div>
                      <p className="text-slate-300 text-xs font-bold leading-relaxed">Potencialize os resultados com produtos profissionais</p>
                    </div>

                    <div className="relative">
                      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-2 px-2">
                        {availableProducts.slice(0, 3).map((product, index) => (
                          <div
                            key={product.id}
                            className="min-w-[280px] snap-center bg-background-dark/60 border border-primary/30 rounded-[24px] p-4 flex items-center gap-4 relative"
                          >
                            {index === 0 && (
                              <div className="absolute -top-2 -right-2 bg-primary size-8 rounded-full flex items-center justify-center shadow-lg z-10">
                                <span className="material-symbols-outlined text-background-dark text-sm font-black">star</span>
                              </div>
                            )}

                            <div className="relative shrink-0">
                              <img src={product.image} className="size-20 rounded-2xl object-cover shadow-2xl" alt={product.name} />
                              <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 ring-inset"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-black text-sm italic font-display uppercase tracking-widest leading-tight line-clamp-2 mb-1">{product.name}</h4>
                              <p className="text-[7px] text-slate-500 font-black uppercase tracking-widest mb-2">{product.category}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-primary font-display font-black text-xl italic tracking-tight">R$ {product.price.toFixed(2)}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => addProduct(product)}
                              className="size-8 rounded-full bg-primary text-background-dark flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                            >
                              <span className="material-symbols-outlined text-sm font-black">add</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. PRODUTOS DISPONÍVEIS E SELECIONADOS */}
            {availableProducts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">
                    {products.length > 0 ? 'Produtos Adicionados' : 'Produtos Disponíveis'}
                  </h3>
                </div>

                {/* Lista de Produtos Selecionados */}
                {products.map((p: Product) => (
                  <div key={p.id} className="bg-[#121417]/60 border border-primary/20 rounded-[32px] p-5 flex items-start gap-4 shadow-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="absolute top-3 right-14 bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 rounded-lg">
                      <span className="text-[6px] text-emerald-400 font-black uppercase tracking-widest">Adicionado</span>
                    </div>
                    <div className="relative shrink-0">
                      <img src={p.image} className="size-16 rounded-2xl object-cover shadow-xl" alt={p.name} />
                      <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 ring-inset"></div>
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <h4 className="text-white font-black text-sm italic font-display uppercase tracking-widest leading-tight line-clamp-2 mb-2">{p.name}</h4>
                      <span className="text-primary font-display font-black text-xl italic tracking-tight">R$ {p.price.toFixed(2)}</span>
                    </div>
                    <button
                      onClick={() => removeItem(p.id, 'product')}
                      className="size-10 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90 shrink-0"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>
                ))}

                {/* Lista de Outros Produtos Disponíveis */}
                {availableProducts
                  .filter(p => !products.some((selected: Product) => selected.id === p.id))
                  .map((p: Product) => (
                    <div key={p.id} className="bg-[#121417]/60 border border-white/5 rounded-[32px] p-5 flex items-start gap-4 shadow-2xl backdrop-blur-md relative overflow-hidden group hover:border-primary/20 transition-all">
                      <div className="relative shrink-0">
                        <img src={p.image} className="size-16 rounded-2xl object-cover shadow-xl group-hover:scale-105 transition-transform" alt={p.name} />
                        <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 ring-inset"></div>
                      </div>
                      <div className="flex-1 min-w-0 py-1">
                        <h4 className="text-white font-black text-sm italic font-display uppercase tracking-widest leading-tight line-clamp-2 mb-2">{p.name}</h4>
                        <span className="text-primary font-display font-black text-xl italic tracking-tight">R$ {p.price.toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => addProduct(p)}
                        className="size-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center hover:bg-primary hover:text-background-dark transition-all active:scale-90 shrink-0 group-hover:scale-110"
                      >
                        <span className="material-symbols-outlined text-lg font-black">add</span>
                      </button>
                    </div>
                  ))
                }
              </div>
            )}

            {/* 4. CARD DE RESUMO COMPLETO */}
            <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-[40px] p-6 space-y-5 shadow-2xl backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
                <span className="material-symbols-outlined text-9xl text-primary">receipt_long</span>
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-10 rounded-xl gold-gradient flex items-center justify-center shadow-lg">
                    <span className="material-symbols-outlined text-background-dark text-lg font-black">checklist</span>
                  </div>
                  <h3 className="text-white font-display font-black text-base italic uppercase tracking-tight">Resumo da Reserva</h3>
                </div>

                {/* Detalhes do Agendamento */}
                {(bookingDraft.date || bookingDraft.time || bookingDraft.professionalName) && (
                  <div className="bg-background-dark/60 border border-primary/30 rounded-[24px] p-5 mb-5">
                    <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-3">Detalhes do Agendamento</p>
                    <div className="space-y-3">
                      {bookingDraft.date && (
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-primary text-lg">calendar_today</span>
                          <div>
                            <p className="text-[7px] text-slate-500 font-black uppercase tracking-widest">Data</p>
                            <p className="text-white text-xs font-bold">{new Date(bookingDraft.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                          </div>
                        </div>
                      )}
                      {bookingDraft.time && (
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-primary text-lg">schedule</span>
                          <div>
                            <p className="text-[7px] text-slate-500 font-black uppercase tracking-widest">Horário</p>
                            <p className="text-white text-xs font-bold">{bookingDraft.time}</p>
                          </div>
                        </div>
                      )}
                      {bookingDraft.professionalName && (
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-primary text-lg">person</span>
                          <div>
                            <p className="text-[7px] text-slate-500 font-black uppercase tracking-widest">Profissional</p>
                            <p className="text-white text-xs font-bold">{bookingDraft.professionalName}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Resumo de Itens (Totais) */}
                <div className="space-y-2 pt-2">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 px-1">Itens Adicionados</p>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 bg-background-dark/40 p-3 rounded-xl border border-white/5">
                    <span>{services.length} Serviço(s)</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 bg-background-dark/40 p-3 rounded-xl border border-white/5">
                    <span>{products.length} Produto(s)</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. TOTAIS E PAGAMENTO */}
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

            <section className="space-y-4">
              <div className="bg-primary/5 border border-white/5 p-6 rounded-[32px] flex items-center gap-5 backdrop-blur-sm">
                <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined font-black">shield_with_heart</span>
                </div>
                <div className="flex-1">
                  <p className="text-[9px] font-black text-white uppercase tracking-[0.2em] mb-1">Compromisso Aura</p>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Sua reserva é garantida com os mais altos padrões de segurança.</p>
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
                    handleFinalConfirm={stableSubmit}
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
        )}
      </main>

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
              <WhatsAppIcon className="size-7" /> NOTIFICAR ESTABELECIMENTO
            </button>
            <button onClick={() => navigate('/my-appointments')} className="w-full bg-white/5 border border-white/10 text-white/60 py-6 rounded-[32px] font-black uppercase text-[10px] tracking-[0.3em] hover:bg-white/10 active:scale-95 transition-all shadow-lg">MEUS AGENDAMENTOS</button>
            <button onClick={() => navigate('/explore')} className="w-full text-slate-700 font-black uppercase text-[9px] tracking-[0.4em] py-4 active:opacity-50 transition-opacity">Voltar para o Início</button>
          </div>
        </div>
      )}

      {step !== 'success' && (
        <footer className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none p-4 md:p-8 pb-[calc(1rem+var(--sab))]">
          <div className="w-full max-w-md bg-background-dark/95 backdrop-blur-2xl border border-white/10 p-6 pt-8 rounded-[32px] shadow-2xl pointer-events-auto">
            <div className="flex justify-between items-end mb-6 px-4">
              <div className="text-left">
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1.5">Investimento Total</p>
                <p className="text-4xl font-display font-black text-white italic tracking-tighter">R$ {total.toFixed(2)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-white bg-green-500/20 border border-green-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                  Secured <span className="material-symbols-outlined text-sm">verified_user</span>
                </span>
              </div>
            </div>
            {/* Botão Finalizar - Oculto durante o checkout MP */}
            {(!mpReady || step !== 'payment_detail') && (
              <button
                onClick={() => {
                  if (step === 'summary') {
                    // SE o salão permite pagar no local, finalizamos direto (fluxo mais rápido esperado)
                    // OU se não tem MP habilitado de qualquer forma.
                    if (activeSalon?.paga_no_local || !isMpEnabled) {
                      handleFinalConfirm();
                    } else {
                      // Se o salão OBRIGA pagamento online (paga_no_local = false) E tem MP
                      setStep('payment_detail');
                    }
                  } else {
                    // No passo payment_detail, o botão finaliza (usado no modo simulação ou fallback)
                    if (!mpReady) {
                      handleFinalConfirm();
                    }
                  }
                }}
                disabled={isProcessing}
                className={`w-full gold-gradient text-background-dark font-black py-7 rounded-[36px] shadow-[0_30px_70px_rgba(193,165,113,0.3)] uppercase tracking-[0.4em] text-[12px] flex items-center justify-center gap-4 active:scale-95 transition-all border border-white/20`}
              >
                {isProcessing ? <div className="size-7 border-3 border-background-dark/20 border-t-background-dark rounded-full animate-spin"></div> : (
                  <>
                    {step === 'summary' ? (
                      (activeSalon?.paga_no_local || !isMpEnabled) ? 'FINALIZAR RESERVA' : 'ESCOLHER FORMA DE PAGAMENTO'
                    ) : 'FINALIZAR RESERVA'}
                    <span className="material-symbols-outlined font-black">arrow_forward</span>
                  </>
                )}
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};

// Componente auxiliar para memoizar props e evitar re-render loop do Mercado Pago
const MPPaymentWrapper: React.FC<{ total: number, handleFinalConfirm: (param: any) => Promise<void> }> = React.memo(({ total, handleFinalConfirm }) => {
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
        theme: 'dark' as const, /* VOLTANDO PARA DARK para garantir textos brancos */
        customVariables: {
          baseColor: '#c1a571', /* Nova base color Khaki */
          baseColorFirstVariant: '#c1a571',

          formBackgroundColor: '#121212',
          inputBackgroundColor: '#1A1B25',
          inputTextColor: '#FFFFFF',

          outlinePrimaryColor: '#c1a571',
        }
      }
    }
  }), []);

  return (
    <div className="mp-brick-container min-h-[500px] rounded-[32px] border-2 border-[#D4AF37]/40 shadow-[0_0_30px_rgba(212,175,55,0.15)] overflow-hidden bg-[#121212] p-4">
      <style>{`
        /* --- MP PREMIUM GOLD STYLE OVERRIDE vFINAL (MATCHING APP THEME) --- */
        
        /* 1. CORREÇÃO DE TEXTO DA BADGE (Parcelamento) - SELETORES NUCLEARES */
        .mp-payment-brick [class*="installments"], 
        .mp-payment-brick [class*="badge"], 
        .mp-payment-brick span[style*="color: #009ee3"], 
        .mp-payment-brick .mp-text-color-success,
        [class*="mp-payment-brick"][class*="pill"],
        /* Força Bruta para qualquer pill verde dentro do brick */
        .mp-payment-brick__payment-method-option-tag {
            background-color: rgba(193, 165, 113, 0.2) !important; 
            background: rgba(193, 165, 113, 0.2) !important;
            color: #ecd3a5 !important;
            border: 1px solid rgba(193, 165, 113, 0.4) !important;
            font-size: 10px !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            text-shadow: none !important;
        }

        /* Removendo qualquer azul remanescente - NUCLEAR OPTION */
        .mp-payment-brick *[style*="#009ee3"], 
        .mp-payment-brick *[style*="rgb(0, 158, 227)"],
        .svelte-1mcg7o8 {
            color: #c1a571 !important;
            border-color: #c1a571 !important;
            background-color: transparent !important;
        }
      `}</style>
      <Payment
        initialization={initialization}
        customization={customization}
        onSubmit={handleFinalConfirm}
      />
    </div>
  );
});

export default Checkout;
