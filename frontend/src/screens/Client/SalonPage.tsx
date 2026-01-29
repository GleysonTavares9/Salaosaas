import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Salon, Service, Product, Professional, GalleryItem, ViewRole } from '../../types.ts';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

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
  const [activeTab, setActiveTab] = useState<TabType>('services');
  const [currentSalon, setCurrentSalon] = useState<Salon | null>(null);
  const [salonServices, setSalonServices] = useState<Service[]>([]);
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

          const [services, reviews] = await Promise.all([
            api.services.getBySalon(freshSalon.id),
            api.reviews.getBySalon(freshSalon.id)
          ]);

          setSalonServices(services);
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

  const startBooking = () => {
    setBookingDraft({ salonId: salon.id, salonName: salon.nome, services: [], products: [] });
    navigate(role ? '/select-service' : '/login-user');
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

          <header className="relative z-10 p-6 pt-12 flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="size-10 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
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

        <nav className="sticky top-0 z-[60] bg-background-dark/95 backdrop-blur-xl px-6 pt-4 border-b border-white/5 flex gap-8 overflow-x-auto no-scrollbar">
          {['services', 'portfolio', 'reviews', 'info'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as TabType)} className={`pb-4 text-[9px] font-black uppercase tracking-[0.2em] relative whitespace-nowrap ${activeTab === tab ? 'text-primary' : 'text-slate-500'}`}>
              {tab === 'services' ? 'Rituais' : tab === 'portfolio' ? 'Portfólio' : tab === 'reviews' ? 'Avaliações' : 'Local'}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 gold-gradient rounded-full"></div>}
            </button>
          ))}
        </nav>

        <main className="px-6 py-6 pb-32">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {salonServices.map(service => (
                <div key={service.id} className="bg-surface-dark/40 border border-white/5 rounded-3xl p-4 flex gap-4">
                  <img src={service.image} className="size-16 rounded-xl object-cover" alt={service.name} />
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <h4 className="text-white font-bold text-xs italic font-display truncate">{service.name}</h4>
                    <p className="text-[7px] text-slate-500 uppercase font-black mt-1">{service.duration_min} MIN</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-white font-display font-black text-sm">R$ {service.price.toFixed(2)}</span>
                      <button onClick={startBooking} className="text-[7px] font-black uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 text-primary">RESERVAR</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      <footer className="fixed bottom-6 left-6 right-6 z-[100]">
        <button onClick={startBooking} className="w-full gold-gradient text-background-dark py-5 rounded-2xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
          <span className="font-black uppercase tracking-[0.3em] text-[10px]">RESERVAR AGORA</span>
          <span className="material-symbols-outlined text-lg font-black">calendar_today</span>
        </button>
      </footer>
    </div>
  );
};

export default SalonPage;
