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
    <div className="flex-1 flex flex-col h-full bg-background-dark relative overflow-hidden">
      <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        <div className="relative h-[300px] w-full shrink-0">
          <img src={salon.banner_url} className="absolute inset-0 w-full h-full object-cover grayscale opacity-30" alt="Banner" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-background-dark pointer-events-none"></div>

          <header className="relative z-10 p-6 pt-[calc(env(safe-area-inset-top)+2rem)] flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="size-12 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 text-white active:scale-95 transition-all">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <h2 className="absolute left-1/2 -translate-x-1/2 text-white font-display font-black text-xs italic tracking-[0.3em] uppercase opacity-90">Itens da Reserva</h2>
            <div className="size-12"></div> {/* Spacer for symmetry */}
          </header>

          <div className="absolute bottom-6 left-6 right-6 z-10">
            <div className="flex items-center gap-4 mb-3">
              <img src={salon.logo_url} className="size-14 rounded-2xl border-2 border-background-dark shadow-xl object-cover" alt="Logo" />
              <div className="flex-1 min-w-0">
                <h1 className="text-white text-xl font-display font-black leading-tight italic truncate">{salon.nome}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-primary font-black text-[8px] uppercase tracking-widest">{salon.segmento}</span>
                  <div className="flex gap-2 items-center pl-2 border-l border-white/20">
                    <span className="text-white text-[8px] font-black tracking-widest">{dynamicRating.toFixed(1)}</span>
                    <PreciseRatingStars rating={dynamicRating} size="text-[10px]" className="gap-0.5" />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-slate-400 text-[10px] italic opacity-60 line-clamp-2">"{salon.descricao}"</p>
          </div>
        </div>

        <nav className="sticky top-0 z-[60] bg-background-dark/95 backdrop-blur-xl border-b border-white/5 overflow-x-auto no-scrollbar">
          <div className="flex p-4 gap-2 min-w-max">
            {['services', 'portfolio', 'reviews', 'info'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as TabType)}
                className={`py-3 px-5 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all outline-none whitespace-nowrap ${activeTab === tab
                  ? 'gold-gradient text-background-dark shadow-lg scale-100'
                  : 'bg-white/5 text-slate-500 hover:text-white border border-white/5'
                  }`}
              >
                {tab === 'services' ? 'Rituais' : tab === 'portfolio' ? 'Portfólio' : tab === 'reviews' ? 'Avaliações' : 'Local'}
              </button>
            ))}
          </div>
        </nav>

        <main className="px-6 py-6 pb-48">
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              <div className="bg-surface-dark/40 border border-white/5 rounded-3xl p-6 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-4xl font-display font-black text-white italic">{dynamicRating.toFixed(1)}</h3>
                    <span className="text-[10px] font-bold text-slate-600">/ 5.0</span>
                  </div>
                  <PreciseRatingStars rating={dynamicRating} size="text-sm" className="gap-1 mt-2" />
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mt-3">Baseado em {dynamicReviewsCount} avaliações reais</p>
                </div>
                <button onClick={() => setShowReviewForm(true)} className="size-14 rounded-2xl gold-gradient text-background-dark flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-xl">add_comment</span>
                  <span className="text-[6px] font-black uppercase mt-1">Avaliar</span>
                </button>
              </div>

              {showReviewForm && (
                <div className="bg-surface-dark border border-primary/30 rounded-[32px] p-6 animate-slide-up space-y-6">
                  <div className="flex justify-between items-center text-white">
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Sua Avaliação</h4>
                    <button onClick={() => setShowReviewForm(false)}><span className="material-symbols-outlined">close</span></button>
                  </div>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setNewRating(star)}>
                        <span className={`material-symbols-outlined text-3xl ${star <= newRating ? 'text-primary fill-1' : 'text-white/10'}`}>star</span>
                      </button>
                    ))}
                  </div>
                  <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="O que achou?" className="w-full bg-black/20 border border-white/5 rounded-2xl p-4 text-xs text-white outline-none h-24" />
                  <button onClick={handlePublicReview} disabled={isSubmittingReview} className="w-full bg-primary text-background-dark py-4 rounded-xl text-[9px] font-black uppercase tracking-widest">{isSubmittingReview ? 'Enviando...' : 'Publicar'}</button>
                </div>
              )}

              <div className="space-y-4">
                {salonReviews.length > 0 ? (
                  salonReviews.map((rev: any) => (
                    <div key={rev.id} className="bg-surface-dark/20 border border-white/5 rounded-3xl p-5 space-y-3 relative group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={rev.clientAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(rev.clientName)}&background=c1a571&color=0c0d10&bold=true`} className="size-10 rounded-full border border-white/10" alt="Avatar" />
                          <div>
                            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{rev.clientName}</h4>
                            <p className="text-[7px] text-slate-600 font-bold">{new Date(rev.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} className={`material-symbols-outlined text-[10px] ${star <= rev.rating ? 'text-primary fill-1' : 'text-white/5'}`}>star</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-300 italic">"{rev.comment}"</p>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center opacity-30 flex flex-col items-center">
                    <span className="material-symbols-outlined text-6xl mb-4 text-white/10">reviews</span>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Ainda não há comentários detalhados</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'services' && (
            <div className="flex flex-col gap-4 -mx-6">
              {salonServices.map(service => {
                const isSelected = selectedServices.some(s => s.id === service.id);
                return (
                  <button
                    key={service.id}
                    onClick={() => toggleService(service)}
                    className={`bg-[#121417]/60 border ${isSelected ? 'border-primary' : 'border-white/5'
                      } p-5 flex items-center gap-6 shadow-2xl backdrop-blur-md group active:scale-[0.98] transition-all relative overflow-hidden text-left w-full`}
                  >
                    {/* Imagem do Ritual */}
                    <div className="relative shrink-0">
                      <img src={service.image} className="size-20 rounded-2xl object-cover shadow-2xl" alt={service.name} />
                      <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 ring-inset"></div>
                    </div>

                    {/* Informações Centrais */}
                    <div className="flex-1 min-w-0 py-1">
                      <h4 className="text-white font-black text-sm italic font-display uppercase tracking-widest leading-snug line-clamp-2">{service.name}</h4>
                      <div className="flex items-center gap-2 mt-1.5 opacity-40">
                        <span className="text-[7px] text-white font-black uppercase tracking-widest">{service.duration_min} MIN</span>
                        <span className="text-white">•</span>
                        <span className="text-[7px] text-white font-black uppercase tracking-widest">SERVIÇO</span>
                      </div>
                      <div className="mt-3">
                        <span className="text-primary font-display font-black text-xl italic tracking-tight">R$ {service.price.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Botão de Seleção (Checkmark) */}
                    <div className={`size-10 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-primary text-background-dark' : 'bg-white/5 text-white/10 border border-white/10'
                      }`}>
                      <span className="material-symbols-outlined text-xl font-black">{isSelected ? 'check' : ''}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div className="grid grid-cols-2 gap-3">
              {salonGallery.length > 0 ? (
                salonGallery.map((url, idx) => (
                  <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-white/5 shadow-xl">
                    <img src={url} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" alt="Portfolio" />
                  </div>
                ))
              ) : (
                <div className="col-span-2 py-20 text-center opacity-20">
                  <span className="material-symbols-outlined text-6xl mb-4 text-white">grid_view</span>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">Galeria em breve</p>
                </div>
              )}
            </div>
          )
          }
          {
            activeTab === 'info' && (
              <div className="space-y-8 animate-fade-in px-1 flex flex-col items-center">
                {/* Card Único Premium Centralizado */}
                <div className="bg-surface-dark/40 border border-white/5 rounded-[40px] p-8 space-y-12 shadow-2xl backdrop-blur-sm w-full flex flex-col items-center text-center">

                  {/* Endereço Centralizado */}
                  <button
                    onClick={() => {
                      const searchquery = `${salon.nome} ${salon.endereco} ${salon.cidade}`;
                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchquery)}`, '_blank');
                    }}
                    className="w-full flex flex-col items-center group outline-none"
                  >
                    <div className="size-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-active:scale-95 transition-all mb-6 shadow-xl">
                      <span className="material-symbols-outlined text-primary text-3xl">location_on</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <h4 className="text-[11px] font-black text-white uppercase tracking-[0.4em] mb-2">Endereço</h4>
                      <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-[280px]">{salon.endereco}, {salon.cidade}</p>
                    </div>
                  </button>

                  {/* Contato com WhatsApp Centralizado */}
                  <button
                    onClick={() => {
                      const phone = salon.telefone?.replace(/\D/g, '');
                      const message = encodeURIComponent(`Olá ${salon.nome}, vi seu salão no App Aura e gostaria de tirar uma dúvida.`);
                      if (phone) window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
                    }}
                    className="w-full flex flex-col items-center group outline-none"
                  >
                    <div className="size-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-active:scale-95 transition-all mb-6 shadow-xl">
                      <WhatsAppIcon className="size-8 text-primary" />
                    </div>
                    <div className="flex flex-col items-center space-y-4">
                      <h4 className="text-[11px] font-black text-white uppercase tracking-[0.4em] mb-1">Contato WhatsApp</h4>
                      <p className="text-2xl font-display font-black text-white italic tracking-tighter">{salon.telefone || '(31) 99124-1598'}</p>
                      <div className="bg-primary/10 border border-primary/20 px-6 py-2.5 rounded-full shadow-lg animate-pulse-slow">
                        <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">
                          TOQUE AQUI PARA INICIAR UMA CONVERSA
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Horário e Grade */}
                  <div className="w-full flex flex-col items-center">
                    <div className="size-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mb-6 shadow-xl">
                      <span className="material-symbols-outlined text-primary text-3xl">schedule</span>
                    </div>
                    <div className="w-full flex flex-col items-center">
                      <h4 className="text-[11px] font-black text-white uppercase tracking-[0.4em] mb-2">Horário Comercial</h4>
                      <p className="text-sm text-slate-400 font-medium mb-8">
                        {(() => {
                          const todayIndex = new Date().getDay();
                          const enDays: { [key: number]: string } = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };
                          const schedule = (salon.horario_funcionamento as any)?.[enDays[todayIndex]];

                          if (!schedule || schedule.closed) return 'Fechado hoje';
                          return `Aberto hoje: ${schedule.open} às ${schedule.close}`;
                        })()}
                      </p>

                      <div className="space-y-4 border-t border-white/5 pt-8 w-full max-w-[300px] px-2">
                        {[
                          { key: 'monday', label: 'Segunda' },
                          { key: 'tuesday', label: 'Terça' },
                          { key: 'wednesday', label: 'Quarta' },
                          { key: 'thursday', label: 'Quinta' },
                          { key: 'friday', label: 'Sexta' },
                          { key: 'saturday', label: 'Sábado' },
                          { key: 'sunday', label: 'Domingo' }
                        ].map(day => {
                          const schedule = (salon.horario_funcionamento as any)?.[day.key];
                          const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase();
                          const isToday = today.includes(day.label.toLowerCase());

                          return (
                            <div key={day.key} className="flex justify-between items-center w-full">
                              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-white' : 'text-slate-600'}`}>
                                {day.label} {isToday && '•'}
                              </span>
                              <span className={`text-[10px] font-black tracking-wider ${!schedule || schedule.closed ? 'text-red-500/40 italic' : 'text-primary'}`}>
                                {!schedule || schedule.closed ? 'Fechado' : `${schedule.open} — ${schedule.close}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comodidades Estilo Original */}
                {salon.amenities && salon.amenities.length > 0 && (
                  <div className="space-y-4 px-2 w-full">
                    <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] text-center">Comodidades</h3>
                    <div className="flex flex-wrap gap-2.5 justify-center">
                      {salon.amenities.map((item: string, idx: number) => (
                        <span key={idx} className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl text-[9px] font-black text-slate-300 uppercase tracking-widest shadow-md">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          }
        </main >
      </div >
      {/* Footer Fixo com Botão Premium Centralizado */}
      {selectedServices.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background-dark via-background-dark/80 to-transparent z-[100] pb-safe flex justify-center animate-slide-up">
          <div className="w-full max-w-[450px]">
            <button
              onClick={startBooking}
              className="w-full gold-gradient text-background-dark p-6 rounded-[32px] shadow-[0_20px_50px_rgba(193,165,113,0.3)] flex items-center justify-between gap-4 active:scale-95 transition-all"
            >
              <div className="text-left">
                <p className="text-[8px] font-black uppercase tracking-widest opacity-60">{selectedServices.length} {selectedServices.length === 1 ? 'Ritual Selecionado' : 'Rituais Selecionados'}</p>
                <p className="text-xl font-display font-black italic tracking-tighter">R$ {selectedServices.reduce((acc, s) => acc + s.price, 0).toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-black uppercase tracking-widest text-[9px]">ESCOLHER HORÁRIO</span>
                <span className="material-symbols-outlined text-xl font-black">arrow_forward</span>
              </div>
            </button>
          </div>
        </footer>
      )}
    </div >
  );
};


export default SalonPage;
