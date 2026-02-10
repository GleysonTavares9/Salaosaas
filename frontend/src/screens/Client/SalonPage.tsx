import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Salon, Service, Product, Professional, GalleryItem, ViewRole } from '../../types.ts';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface SalonPageProps {
  salons: Salon[];
  role: ViewRole | null;
  setBookingDraft: React.Dispatch<React.SetStateAction<any>>;
}

type TabType = 'services' | 'portfolio' | 'reviews' | 'info';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={`${className} flex-shrink-0`} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.01 3.01c-5.53 0-10.01 4.47-10.01 10 0 1.74.45 3.39 1.23 4.84l-1.31 4.79 4.89-1.28c1.39.75 2.97 1.18 4.65 1.18 5.53 0 10.01-4.47 10.01-10s-4.48-10-10.01-10zm0 18.33c-1.57 0-3.04-.42-4.32-1.15l-.31-.18-3.21.84.85-3.13-.2-.31a8.31 8.31 0 0 1-1.29-4.39c0-4.61 3.74-8.35 8.35-8.35 2.24 0 4.34.87 5.92 2.45s2.45 3.68 2.45 5.92c-.01 4.62-3.76 8.36-8.36 8.36zm4.56-6.22c-.25-.13-1.47-.72-1.7-.8-.23-.08-.39-.13-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.01-1.24-.74-.66-1.24-1.48-1.38-1.73-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.5-.4-.43-.56-.44-.14 0-.31-.01-.47-.01-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.1-.25-.23-.5-.36z" />
  </svg>
);

const PreciseRatingStars: React.FC<{ rating: number; size?: string; className?: string }> = ({ rating, size = "text-xs", className = "gap-1" }) => {
  return (
    <div className={`flex ${className} items-center`}>
      {[1, 2, 3, 4, 5].map(star => {
        const diff = rating - (star - 1);
        const fillWidth = Math.max(0, Math.min(100, diff * 100));
        return (
          <div key={star} className={`relative ${size} flex items-center justify-center`}>
            <span className="material-symbols-outlined text-white/20 select-none" style={{ fontSize: 'inherit' }}>star</span>
            <div className="absolute inset-0 overflow-hidden select-none pointer-events-none" style={{ width: `${fillWidth}%` }}>
              <span className="material-symbols-outlined text-primary fill-1" style={{ fontSize: 'inherit' }}>star</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SalonPage: React.FC<SalonPageProps> = ({ salons, role, setBookingDraft }) => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('services');
  const [currentSalon, setCurrentSalon] = useState<Salon | null>(null);
  const [salonServices, setSalonServices] = useState<Service[]>([]);
  const [salonProducts, setSalonProducts] = useState<Product[]>([]);
  const [salonGallery, setSalonGallery] = useState<string[]>([]);
  const [salonReviews, setSalonReviews] = useState<any[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [dynamicRating, setDynamicRating] = useState(0);
  const [dynamicReviewsCount, setDynamicReviewsCount] = useState(0);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);

  const initialSalon = useMemo(() => salons.find(s => s.slug_publico === slug), [salons, slug]);

  useEffect(() => {
    const fetchLatestSalonData = async () => {
      if (!slug) return;
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id || null);

        const freshSalon = await api.salons.getBySlug(slug);
        if (freshSalon) {
          setCurrentSalon(freshSalon);
          setDynamicRating(Number(freshSalon.rating) || 0);
          setDynamicReviewsCount(Number(freshSalon.reviews) || 0);
          setSalonGallery(freshSalon.gallery_urls || []);

          const [services, products, reviews] = await Promise.all([
            api.services.getBySalon(freshSalon.id),
            api.products.getBySalon(freshSalon.id),
            api.reviews.getBySalon(freshSalon.id)
          ]);

          setSalonServices(services);
          setSalonProducts(products);
          setSalonReviews(reviews.map((r: any) => ({
            ...r,
            clientName: r.client?.full_name || 'Usuário Aura',
            clientAvatar: r.client?.avatar_url
          })));
        }
      } catch (err) {
        console.error("Error fetching fresh salon data:", err);
        if (initialSalon) {
          setCurrentSalon(initialSalon);
          setDynamicRating(Number(initialSalon.rating) || 0);
          setDynamicReviewsCount(Number(initialSalon.reviews) || 0);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchLatestSalonData();
  }, [slug]);

  const salon = currentSalon || initialSalon;

  if (!salon && !isLoading) return <div className="p-10 text-center text-white">Salão não encontrado.</div>;
  if (!salon) return null;

  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const isSelected = prev.find(s => s.id === service.id);
      if (isSelected) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  const startBooking = () => {
    if (selectedServices.length === 0) {
      showToast('Selecione pelo menos um serviço', 'error');
      return;
    }
    setBookingDraft({
      salonId: salon.id,
      salonName: salon.nome,
      services: selectedServices,
      products: []
    });
    navigate(role ? '/choose-time' : '/login-user');
  };

  const handlePublicReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return navigate('/login-user');

    setIsSubmittingReview(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Auth error');

      const reviewData = {
        salon_id: salon.id,
        client_id: user.id,
        rating: newRating,
        comment: newComment
      };

      const result = await api.reviews.create(reviewData);

      const newTotal = dynamicReviewsCount + 1;
      const newAvg = ((dynamicRating * dynamicReviewsCount) + newRating) / newTotal;

      setDynamicRating(Number(newAvg.toFixed(1)));
      setDynamicReviewsCount(newTotal);

      const newEntry = {
        ...result,
        clientName: user.user_metadata.full_name || 'VIP Client',
        clientAvatar: user.user_metadata.avatar_url,
        rating: newRating,
        comment: newComment,
        created_at: new Date().toISOString()
      };

      setSalonReviews(prev => [newEntry, ...prev]);
      setShowReviewForm(false);
      setNewComment('');
    } catch (err) {
      console.error('Review error:', err);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-background-dark">
      <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        {/* Banner e Header Section */}
        <section className="relative h-[300px] lg:h-[400px] w-full shrink-0 flex items-center justify-center overflow-hidden">
          <img src={salon.banner_url} className="absolute inset-0 w-full h-full object-cover grayscale opacity-30 scale-110" alt="Banner" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-background-dark/20 to-background-dark pointer-events-none"></div>

          {/* Header Superior */}
          <header className="absolute top-0 left-0 right-0 z-20 p-6 pt-[calc(env(safe-area-inset-top)+2rem)]">
            <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between">
              <button onClick={() => navigate(-1)} className="size-12 flex items-center justify-center rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 text-white active:scale-95 transition-all">
                <span className="material-symbols-outlined text-xl">arrow_back</span>
              </button>
              <h2 className="font-display font-black text-white italic tracking-[0.4em] uppercase opacity-90" style={{ fontSize: 'var(--step-0)', transform: 'scale(0.8)' }}>Detalhes da Unidade</h2>
              <div className="size-12"></div>
            </div>
          </header>

          {/* Info Principal do Salão */}
          <div className="relative z-10 w-full max-w-[1200px] px-6 mt-12 lg:mt-20">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 py-8">
              <div className="flex items-center gap-6">
                <div className="relative shrink-0">
                  <img src={salon.logo_url} className="size-20 lg:size-24 rounded-[32px] border-2 border-primary/20 shadow-2xl object-cover" alt="Logo" />
                  <div className="absolute inset-0 rounded-[32px] ring-1 ring-white/10 ring-inset"></div>
                </div>
                <div className="min-w-0">
                  <h1 className="text-white font-display font-black italic tracking-tight leading-[0.9] mb-4" style={{ fontSize: 'var(--step-4)' }}>{salon.nome}</h1>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-primary font-black uppercase tracking-[0.2em] bg-primary/10 border border-primary/20 px-3 py-1 rounded-full" style={{ fontSize: 'var(--step-0)', transform: 'scale(0.8)', transformOrigin: 'left' }}>{salon.segmento}</span>
                    <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                      <span className="text-white font-black tracking-widest" style={{ fontSize: 'var(--step-1)' }}>{dynamicRating.toFixed(1)}</span>
                      <PreciseRatingStars rating={dynamicRating} size="text-[12px]" className="gap-1" />
                      <span className="text-slate-500 font-bold uppercase tracking-widest ml-1" style={{ fontSize: 'var(--step-0)', transform: 'scale(0.7)' }}>({dynamicReviewsCount} Reviews)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="max-w-[400px]">
                <p className="text-slate-400 font-medium italic opacity-70 leading-relaxed" style={{ fontSize: 'var(--step-0)' }}>"{salon.descricao}"</p>
              </div>
            </div>
          </div>
        </section>

        <nav className="sticky top-0 z-[60] bg-background-dark/80 backdrop-blur-2xl border-b border-white/5 overflow-x-auto no-scrollbar">
          <div className="max-w-[1200px] mx-auto w-full flex p-4 lg:py-6 gap-3 lg:gap-6 min-w-max">
            {['services', 'portfolio', 'reviews', 'info'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as TabType)}
                className={`py-3 px-6 lg:py-4 lg:px-8 font-black uppercase tracking-[0.3em] rounded-[20px] lg:rounded-[24px] transition-all outline-none whitespace-nowrap shadow-xl border ${activeTab === tab
                  ? 'gold-gradient text-background-dark border-transparent scale-100'
                  : 'bg-white/5 text-slate-500 hover:text-white border-white/5 hover:bg-white/10'
                  }`}
                style={{ fontSize: 'var(--step-0)', transform: 'scale(0.8)' }}
              >
                {tab === 'services' ? 'Rituais' : tab === 'portfolio' ? 'Portfólio' : tab === 'reviews' ? 'Avaliações' : 'Local'}
              </button>
            ))}
          </div>
        </nav>

        <main className="max-w-[1200px] mx-auto w-full px-6 py-10 pb-48">
          {activeTab === 'reviews' && (
            <div className="grid lg:grid-cols-12 gap-8 lg:items-start animate-fade-in">
              <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-32">
                <div className="bg-surface-dark/40 border border-white/5 rounded-[40px] p-8 shadow-2xl backdrop-blur-md">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center gap-2 mb-2">
                      <h3 className="text-6xl font-display font-black text-white italic tracking-tighter">{dynamicRating.toFixed(1)}</h3>
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">/ 5.0</span>
                    </div>
                    <div className="flex justify-center">
                      <PreciseRatingStars rating={dynamicRating} size="text-lg" className="gap-1.5" />
                    </div>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-6 leading-relaxed">Sinfonia de {dynamicReviewsCount} Experiências</p>
                  </div>

                  <div className="mt-10">
                    <button onClick={() => setShowReviewForm(true)} className="w-full gold-gradient text-background-dark py-6 rounded-[32px] font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(193,165,113,0.2)] active:scale-95 transition-all flex items-center justify-center gap-3" style={{ fontSize: 'var(--step-0)', transform: 'scale(0.8)' }}>
                      <span className="material-symbols-outlined font-black">add_comment</span>
                      Avaliar Aura
                    </button>
                  </div>
                </div>

                {showReviewForm && (
                  <div className="bg-surface-dark border border-primary/30 rounded-[40px] p-8 animate-slide-up space-y-8 shadow-2xl backdrop-blur-xl">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Sua Experiência</h4>
                      <button onClick={() => setShowReviewForm(false)} className="text-slate-500 hover:text-white transition-colors"><span className="material-symbols-outlined">close</span></button>
                    </div>
                    <div className="flex justify-center gap-3">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} onClick={() => setNewRating(star)} className="hover:scale-110 transition-transform">
                          <span className={`material-symbols-outlined text-4xl ${star <= newRating ? 'text-primary fill-1 drop-shadow-[0_0_15px_rgba(193,165,113,0.5)]' : 'text-white/10'}`}>star</span>
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Descreva seu ritual..."
                      className="w-full bg-black/40 border border-white/5 rounded-[24px] p-6 text-sm text-white outline-none h-40 focus:border-primary/30 transition-all placeholder:text-slate-700"
                    />
                    <button onClick={handlePublicReview} disabled={isSubmittingReview} className="w-full bg-primary text-background-dark py-6 rounded-[32px] text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:shadow-primary/20 transition-all">
                      {isSubmittingReview ? 'Divulgando...' : 'Publicar Agora'}
                    </button>
                  </div>
                )}
              </div>

              <div className="lg:col-span-8 space-y-6">
                {salonReviews.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-6">
                    {salonReviews.map((rev: any) => (
                      <div key={rev.id} className="bg-[#121417]/40 border border-white/5 rounded-[40px] p-8 space-y-6 shadow-2xl backdrop-blur-md hover:border-primary/20 transition-all group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <img src={rev.clientAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(rev.clientName)}&background=c1a571&color=0c0d10&bold=true`} className="size-12 rounded-2xl border border-white/10 object-cover" alt="Avatar" />
                              <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 ring-inset"></div>
                            </div>
                            <div>
                              <h4 className="font-display font-black text-white italic uppercase tracking-widest" style={{ fontSize: 'var(--step-0)' }}>{rev.clientName}</h4>
                              <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">{new Date(rev.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            </div>
                          </div>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(star => (
                              <span key={star} className={`material-symbols-outlined text-[10px] ${star <= rev.rating ? 'text-primary fill-1' : 'text-white/5'}`}>star</span>
                            ))}
                          </div>
                        </div>
                        <p className="text-slate-400 font-medium italic leading-relaxed" style={{ fontSize: 'var(--step-0)' }}>"{rev.comment}"</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-surface-dark/20 border border-white/5 rounded-[40px] py-32 text-center flex flex-col items-center">
                    <div className="size-20 rounded-full bg-white/5 flex items-center justify-center mb-8 border border-white/10">
                      <span className="material-symbols-outlined text-4xl text-white/20">reviews</span>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 max-w-[200px] leading-relaxed">Inicie a música das avaliações detalhadas</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'services' && (
            <div className="grid lg:grid-cols-2 gap-6 animate-fade-in">
              {salonServices.map(service => {
                const isSelected = selectedServices.some(s => s.id === service.id);
                return (
                  <button
                    key={service.id}
                    onClick={() => toggleService(service)}
                    className={`bg-[#121417]/60 border-2 ${isSelected ? 'border-primary ring-4 ring-primary/10' : 'border-white/5'
                      } p-6 rounded-[40px] flex items-center gap-6 shadow-2xl backdrop-blur-md group active:scale-[0.98] transition-all relative overflow-hidden text-left w-full hover:bg-[#1a1d21]/80 hover:border-white/10`}
                  >
                    {/* Imagem do Ritual */}
                    <div className="relative shrink-0">
                      <img src={service.image} className="size-20 lg:size-24 rounded-[24px] object-cover shadow-2xl group-hover:scale-105 transition-transform" alt={service.name} />
                      <div className="absolute inset-0 rounded-[24px] ring-1 ring-white/10 ring-inset"></div>
                    </div>

                    {/* Informações Centrais */}
                    <div className="flex-1 min-w-0 py-1">
                      <h4 className="text-white font-black italic font-display uppercase tracking-widest leading-tight line-clamp-2 mb-2" style={{ fontSize: 'var(--step-0)' }}>{service.name}</h4>
                      <div className="flex items-center gap-2 opacity-40">
                        <span className="text-[8px] text-white font-black uppercase tracking-widest">{service.duration_min} MIN</span>
                        <span className="text-white">•</span>
                        <span className="text-[8px] text-white font-black uppercase tracking-widest">RITUAL</span>
                      </div>
                      <div className="mt-4">
                        <span className="text-primary font-display font-black italic tracking-tight" style={{ fontSize: 'var(--step-2)' }}>R$ {service.price.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Botão de Seleção (Indicador Premium) */}
                    <div className={`size-12 lg:size-14 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-primary text-background-dark shadow-[0_0_20px_rgba(193,165,113,0.4)]' : 'bg-white/5 text-white/10 border border-white/5'
                      }`}>
                      <span className="material-symbols-outlined text-2xl font-black">{isSelected ? 'check' : 'add'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
              {salonGallery.length > 0 ? (
                salonGallery.map((url, idx) => (
                  <div key={idx} className="aspect-square rounded-[32px] overflow-hidden border-2 border-white/5 shadow-2xl group relative">
                    <img src={url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Portfolio" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                      <span className="text-[8px] font-black text-white uppercase tracking-[0.3em]">Ambiente Original</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-40 text-center flex flex-col items-center justify-center">
                  <div className="size-20 rounded-full bg-white/5 flex items-center justify-center mb-8 border border-white/10">
                    <span className="material-symbols-outlined text-4xl text-white/20">grid_view</span>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Galeria de Arte em Construção</p>
                </div>
              )}
            </div>
          )}
          {activeTab === 'info' && (
            <div className="grid lg:grid-cols-12 gap-10 animate-fade-in lg:items-start">
              {/* Coluna Central com Infos principais */}
              <div className="lg:col-span-8 space-y-8">
                <div className="bg-surface-dark/40 border border-white/5 rounded-[48px] p-10 lg:p-16 shadow-2xl backdrop-blur-sm grid sm:grid-cols-2 gap-12 lg:gap-20">

                  {/* Endereço Centralizado */}
                  <button
                    onClick={() => {
                      const searchquery = `${salon.nome} ${salon.endereco} ${salon.cidade}`;
                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchquery)}`, '_blank');
                    }}
                    className="flex flex-col items-center group outline-none"
                  >
                    <div className="size-20 lg:size-24 rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-primary/30 group-active:scale-95 transition-all mb-8 shadow-2xl relative overflow-hidden">
                      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <span className="material-symbols-outlined text-primary text-4xl relative z-10">location_on</span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <h4 className="text-[11px] font-black text-white uppercase tracking-[0.4em] mb-4">Localização</h4>
                      <p className="text-base text-slate-400 font-medium leading-[1.8] max-w-[280px]">{salon.endereco}, {salon.cidade}</p>
                    </div>
                  </button>

                  {/* Contato com WhatsApp Centralizado */}
                  <button
                    onClick={() => {
                      const phone = salon.telefone?.replace(/\D/g, '');
                      const message = encodeURIComponent(`Olá ${salon.nome}, vi seu salão no App Aura e gostaria de tirar uma dúvida.`);
                      if (phone) window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
                    }}
                    className="flex flex-col items-center group outline-none"
                  >
                    <div className="size-20 lg:size-24 rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-primary/30 group-active:scale-95 transition-all mb-8 shadow-2xl relative overflow-hidden">
                      <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <WhatsAppIcon className="size-10 text-primary relative z-10" />
                    </div>
                    <div className="flex flex-col items-center text-center space-y-6">
                      <h4 className="text-[11px] font-black text-white uppercase tracking-[0.4em] mb-2">Concierge Digital</h4>
                      <p className="text-3xl font-display font-black text-white italic tracking-tighter">{salon.telefone || '(31) 99124-1598'}</p>
                      <div className="bg-primary/10 border border-primary/20 px-8 py-3 rounded-full shadow-lg animate-pulse-slow">
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">
                          Canais Abertos
                        </span>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Comodidades Estilo Original */}
                {salon.amenities && salon.amenities.length > 0 && (
                  <div className="bg-surface-dark/20 border border-white/5 rounded-[48px] p-10 lg:p-12">
                    <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-10 text-center">Protocolos & Amenidades</h3>
                    <div className="flex flex-wrap gap-4 justify-center">
                      {salon.amenities.map((item: string, idx: number) => (
                        <span key={idx} className="bg-white/5 border border-white/5 px-8 py-4 rounded-[20px] text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-lg hover:border-primary/20 hover:text-white transition-all cursor-default">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar de Horários */}
              <aside className="lg:col-span-4 space-y-8">
                <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-[48px] p-10 shadow-2xl backdrop-blur-md">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="size-14 rounded-2xl gold-gradient flex items-center justify-center shadow-lg">
                      <span className="material-symbols-outlined text-background-dark text-2xl font-black">schedule</span>
                    </div>
                    <h3 className="text-white font-display font-black italic uppercase tracking-tight" style={{ fontSize: 'var(--step-1)' }}>Horários</h3>
                  </div>

                  <div className="space-y-5">
                    {(() => {
                      const getSchedule = (dayKey: string) => {
                        if (!salon.horario_funcionamento) return null;
                        const h = salon.horario_funcionamento as any;
                        const keyMaps: { [key: string]: string[] } = {
                          'monday': ['monday', 'segunda', 'segunda-feira'],
                          'tuesday': ['tuesday', 'terca', 'terça', 'terça-feira'],
                          'wednesday': ['wednesday', 'quarta', 'quarta-feira'],
                          'thursday': ['thursday', 'quinta', 'quinta-feira'],
                          'friday': ['friday', 'sexta', 'sexta-feira'],
                          'saturday': ['saturday', 'sabado', 'sábado'],
                          'sunday': ['sunday', 'domingo']
                        };
                        const possibleKeys = keyMaps[dayKey] || [dayKey];
                        for (const k of possibleKeys) {
                          if (h[k]) return h[k];
                        }
                        return null;
                      };

                      return [
                        { key: 'monday', label: 'Segunda' },
                        { key: 'tuesday', label: 'Terça' },
                        { key: 'wednesday', label: 'Quarta' },
                        { key: 'thursday', label: 'Quinta' },
                        { key: 'friday', label: 'Sexta' },
                        { key: 'saturday', label: 'Sábado' },
                        { key: 'sunday', label: 'Domingo' }
                      ].map(day => {
                        const schedule = getSchedule(day.key);
                        const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase();
                        const isToday = today.includes(day.label.toLowerCase());

                        return (
                          <div key={day.key} className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${isToday ? 'bg-primary/20 border-primary/30 shadow-lg scale-105' : 'bg-black/20 border-white/5'}`}>
                            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-white' : 'text-slate-600'}`}>
                              {day.label}
                            </span>
                            <span className={`text-[11px] font-black tracking-wider ${!schedule || schedule.closed ? 'text-red-500/40 italic' : 'text-primary'}`}>
                              {!schedule || schedule.closed ? 'Fechado' : `${schedule.open} — ${schedule.close}`}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="mt-10 p-6 bg-background-dark/60 rounded-3xl border border-white/5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed text-center">
                      {(() => {
                        const todayIndex = new Date().getDay();
                        const enDays: { [key: number]: string } = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };
                        const getSchedule = (dayKey: string) => {
                          const h = salon.horario_funcionamento as any;
                          return h && h[dayKey] ? h[dayKey] : null;
                        };
                        const schedule = getSchedule(enDays[todayIndex]);
                        if (!schedule || schedule.closed) return 'Recarregando Energias: Fechado Hoje';
                        return `Ciclo de Atendimento: ${schedule.open} às ${schedule.close}`;
                      })()}
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </main >
      </div >
      {/* Footer Fixo com Botão Premium Centralizado */}
      {selectedServices.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 p-4 lg:p-6 bg-gradient-to-t from-background-dark via-background-dark/80 to-transparent z-[100] pb-safe flex justify-center animate-slide-up">
          <div className="w-full max-w-[450px]">
            <button
              onClick={startBooking}
              className="w-full gold-gradient text-background-dark p-4 lg:p-6 rounded-[24px] lg:rounded-[32px] shadow-[0_20px_50px_rgba(193,165,113,0.3)] flex items-center justify-between gap-4 active:scale-95 transition-all"
            >
              <div className="text-left">
                <p className="font-black uppercase tracking-widest opacity-60" style={{ fontSize: 'var(--step-0)', transform: 'scale(0.7)', transformOrigin: 'left' }}>{selectedServices.length} {selectedServices.length === 1 ? 'Ritual Selecionado' : 'Rituais Selecionados'}</p>
                <p className="font-display font-black italic tracking-tighter" style={{ fontSize: 'var(--step-2)' }}>R$ {selectedServices.reduce((acc, s) => acc + s.price, 0).toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-black uppercase tracking-widest" style={{ fontSize: 'var(--step-0)', transform: 'scale(0.8)' }}>ESCOLHER HORÁRIO</span>
                <span className="material-symbols-outlined text-lg lg:text-xl font-black">arrow_forward</span>
              </div>
            </button>
          </div>
        </footer>
      )}
    </div >
  );
};


export default SalonPage;
