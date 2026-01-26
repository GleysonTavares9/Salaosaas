import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Salon, Service, Product, Professional, GalleryItem, ViewRole } from '../../types.ts';
import { api } from '../../lib/api';

interface SalonPageProps {
  salons: Salon[];
  role: ViewRole | null;
  setBookingDraft: React.Dispatch<React.SetStateAction<any>>;
}

type TabType = 'services' | 'portfolio' | 'info';

const SalonPage: React.FC<SalonPageProps> = ({ salons, role, setBookingDraft }) => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('services');
  const [salonServices, setSalonServices] = useState<Service[]>([]);
  const [salonGallery, setSalonGallery] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const salon = useMemo(() => salons.find(s => s.slug_publico === slug), [salons, slug]);

  if (!salon) return <div className="p-10 text-center text-white">Salão não encontrado.</div>;

  useEffect(() => {
    if (salon?.id) {
      setIsLoading(true);
      Promise.all([
        api.services.getBySalon(salon.id),
        // Gallery comes from salon.gallery_urls
      ]).then(([services]) => {
        setSalonServices(services);
        setSalonGallery(salon.gallery_urls || []);
        setIsLoading(false);
      }).catch(err => {
        console.error('Error loading salon data:', err);
        setIsLoading(false);
      });
    }
  }, [salon?.id]);

  const startBooking = () => {
    // Fixed: Initializing both services and products as empty arrays
    setBookingDraft({ salonId: salon.id, salonName: salon.nome, services: [], products: [] });
    navigate(role ? '/select-service' : '/login-user');
  };

  const openImageLink = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background-dark relative overflow-hidden">
      <div className="scroll-container">
        <div className="relative h-[300px] w-full shrink-0">
          <img
            src={salon.banner_url}
            className="absolute inset-0 w-full h-full object-cover grayscale opacity-30 direct-image-link"
            alt="Banner"
            onClick={() => openImageLink(salon.banner_url)}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-background-dark pointer-events-none"></div>

          <header className="relative z-10 p-6 pt-12 flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="size-10 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          </header>

          <div className="absolute bottom-6 left-6 right-6 z-10">
            <div className="flex items-center gap-4 mb-3">
              <img
                src={salon.logo_url}
                className="size-14 rounded-2xl border-2 border-background-dark shadow-xl object-cover direct-image-link"
                alt="Logo"
                onClick={() => openImageLink(salon.logo_url)}
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-white text-xl font-display font-black leading-tight italic truncate">{salon.nome}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-primary font-black text-[8px] uppercase tracking-widest">{salon.segmento}</span>
                  <span className="text-white text-[8px] font-black tracking-widest border-l border-white/20 pl-2">{salon.rating} ★</span>
                </div>
              </div>
            </div>
            <p className="text-slate-400 text-[10px] italic opacity-60 line-clamp-2">"{salon.descricao}"</p>
          </div>
        </div>

        <nav className="sticky top-0 z-[60] bg-background-dark/95 backdrop-blur-xl px-6 pt-4 border-b border-white/5 flex gap-8">
          {['services', 'portfolio', 'info'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as TabType)} className={`pb-4 text-[9px] font-black uppercase tracking-[0.2em] relative ${activeTab === tab ? 'text-primary' : 'text-slate-500'}`}>
              {tab === 'services' ? 'Rituais' : tab === 'portfolio' ? 'Portfólio' : 'Local'}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 gold-gradient rounded-full"></div>}
            </button>
          ))}
        </nav>

        <main className="px-6 py-6">
          {activeTab === 'services' && (
            <div className="space-y-4">
              {salonServices.map(service => (
                <div key={service.id} className="bg-surface-dark/40 border border-white/5 rounded-3xl p-4 flex gap-4">
                  <img src={service.image} className="size-16 rounded-xl object-cover direct-image-link" alt={service.name} onClick={() => openImageLink(service.image)} />
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
          {activeTab === 'portfolio' && (
            <div className="grid grid-cols-2 gap-3">
              {salonGallery.length > 0 ? (
                salonGallery.map((url, idx) => (
                  <img key={idx} src={url} className="aspect-square rounded-2xl object-cover border border-white/5 direct-image-link" alt="Gallery" onClick={() => openImageLink(url)} />
                ))
              ) : (
                <div className="col-span-2 py-20 text-center opacity-30">
                  <span className="material-symbols-outlined text-6xl mb-4">photo_library</span>
                  <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma foto no portfólio</p>
                </div>
              )}
            </div>
          )}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Endereço com botão de mapa */}
              <div className="bg-surface-dark p-5 rounded-3xl border border-white/5">
                <h4 className="text-[8px] font-black text-primary uppercase tracking-[0.3em] mb-3">Endereço</h4>
                <p className="text-xs text-white leading-relaxed mb-4">{salon.endereco}, {salon.cidade}</p>
                {salon.location && salon.location.lat !== 0 && salon.location.lng !== 0 && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${salon.location.lat},${salon.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 gold-gradient text-background-dark px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                  >
                    <span className="material-symbols-outlined text-sm">map</span>
                    Abrir no Google Maps
                  </a>
                )}
              </div>

              {/* WhatsApp */}
              {salon.telefone && (
                <div className="bg-surface-dark p-5 rounded-3xl border border-white/5">
                  <h4 className="text-[8px] font-black text-primary uppercase tracking-[0.3em] mb-3">Contato WhatsApp</h4>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-12 rounded-full bg-[#25D366]/20 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#25D366] text-xl">chat</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Número</p>
                      <p className="text-sm text-white font-mono font-bold">{salon.telefone}</p>
                    </div>
                  </div>
                  <a
                    href={`https://wa.me/${salon.telefone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-[#25D366] text-white px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg w-full"
                  >
                    <span className="material-symbols-outlined text-sm">chat</span>
                    Chamar no WhatsApp
                  </a>
                </div>
              )}

              {/* Horários de Funcionamento */}
              {salon.horario_funcionamento && Object.keys(salon.horario_funcionamento).length > 0 && (
                <div className="bg-surface-dark p-5 rounded-3xl border border-white/5">
                  <h4 className="text-[8px] font-black text-primary uppercase tracking-[0.3em] mb-4">Horário de Funcionamento</h4>
                  <div className="space-y-2">
                    {Object.entries(salon.horario_funcionamento).map(([day, hours]: [string, any]) => {
                      const dayLabels: { [key: string]: string } = {
                        monday: 'Segunda',
                        tuesday: 'Terça',
                        wednesday: 'Quarta',
                        thursday: 'Quinta',
                        friday: 'Sexta',
                        saturday: 'Sábado',
                        sunday: 'Domingo'
                      };

                      return (
                        <div key={day} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                          <span className="text-xs text-slate-400 font-bold">{dayLabels[day]}</span>
                          {hours?.enabled ? (
                            <span className="text-xs text-white font-mono">{hours.open} - {hours.close}</span>
                          ) : (
                            <span className="text-xs text-red-500 font-bold">Fechado</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Comodidades */}
              {salon.amenities && salon.amenities.length > 0 && (
                <div className="bg-surface-dark p-5 rounded-3xl border border-white/5">
                  <h4 className="text-[8px] font-black text-primary uppercase tracking-[0.3em] mb-3">Comodidades</h4>
                  <div className="flex flex-wrap gap-2">
                    {salon.amenities.map((amenity, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-[8px] font-black text-primary uppercase tracking-widest">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Espaço extra final */}
          <div className="h-10"></div>
        </main>
      </div>

      <footer className="fixed-floating-footer">
        <button
          onClick={startBooking}
          className="w-full gold-gradient text-background-dark py-5 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex items-center justify-center gap-3 active:scale-95 transition-all"
        >
          <span className="font-black uppercase tracking-[0.3em] text-[10px]">RESERVAR AGORA</span>
          <span className="material-symbols-outlined text-lg font-black">calendar_today</span>
        </button>
      </footer>

      {/* Floating WhatsApp Button */}
      {salon.telefone && (
        <a
          href={`https://wa.me/${salon.telefone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-32 right-6 z-50 size-14 rounded-full bg-[#25D366] shadow-[0_8px_30px_rgba(37,211,102,0.4)] flex items-center justify-center active:scale-90 transition-all animate-bounce-slow"
          style={{ animationDuration: '3s' }}
        >
          <span className="material-symbols-outlined text-white text-2xl">chat</span>
        </a>
      )}
    </div>
  );
};

export default SalonPage;
