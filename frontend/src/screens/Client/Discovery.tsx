import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Salon, BusinessSegment, ViewRole } from '../../types.ts';
import L from 'leaflet';
import { Popup } from 'react-leaflet';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';

const AuraMap = lazy(() => import('../../components/AuraMap'));

const createSalonIcon = (logoUrl: string) => L.divIcon({
  className: 'custom-salon-marker',
  html: `<div class="relative flex flex-col items-center group">
           <!-- Marcador Gold Vibrante -->
           <div class="w-11 h-11 bg-[#ecd3a5] rounded-full rounded-bl-none rotate-[-45deg] flex items-center justify-center shadow-[0_5px_25px_rgba(193,165,113,0.6)] border-2 border-white transition-transform group-hover:scale-110 duration-300">
             <div class="w-8 h-8 bg-white rounded-full rotate-[45deg] overflow-hidden flex items-center justify-center border border-black/10">
                <img src="${logoUrl}" class="w-full h-full object-cover" alt="logo" />
             </div>
           </div>
           <!-- Glow de Destaque -->
           <div class="absolute -bottom-1 w-4 h-2 bg-[#ecd3a5]/60 rounded-full blur-[4px] animate-pulse"></div>
         </div>`,
  iconSize: [44, 48],
  iconAnchor: [22, 48],
  popupAnchor: [0, -48],
});

const createClusterCustomIcon = (cluster: any) => {
  return L.divIcon({
    html: `<div class="size-10 sm:size-12 lg:size-10 sm:size-11 lg:size-12 rounded-full gold-gradient border-2 border-white shadow-[0_0_20px_rgba(193,165,113,0.8)] flex items-center justify-center text-background-dark font-black text-xs">
             ${cluster.getChildCount()}
           </div>`,
    className: 'custom-marker-cluster',
    iconSize: L.point(44, 44, true),
  });
};

const UserIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `<div class="relative flex items-center justify-center">
           <div class="absolute inset-0 bg-white/40 rounded-full animate-ping scale-[2.8] opacity-60"></div>
           <div class="absolute inset-0 bg-[#ecd3a5]/30 rounded-full animate-pulse scale-[2.0]"></div>
           <div class="size-6 bg-white rounded-full border-2 border-[#ecd3a5] shadow-[0_0_25px_rgba(255,255,255,1)] relative z-10"></div>
         </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

interface DiscoveryProps {
  salons: Salon[];
  role: ViewRole | null;
}

const Discovery: React.FC<DiscoveryProps> = ({ salons: initialSalons, role }) => {
  const navigate = useNavigate();
  const [activeSegment, setActiveSegment] = useState<BusinessSegment | 'Todos'>('Todos');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: -15.7942, lng: -47.8822 }); // Default Brasília
  const [hasLocation, setHasLocation] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [cityName, setCityName] = useState('BRASIL');
  const [dynamicSalons, setDynamicSalons] = useState<Salon[]>(initialSalons);
  const [isLocating, setIsLocating] = useState(false);

  const segments: (BusinessSegment | 'Todos')[] = ['Todos', 'Salão', 'Manicure', 'Sobrancelha', 'Barba', 'Estética', 'Spa'];

  const handleDetectLocation = React.useCallback(() => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCoords({ lat: latitude, lng: longitude });
          setHasLocation(true);

          fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`)
            .then(res => res.json())
            .then(data => {
              const city = data.city || data.locality || data.principalSubdivision || 'Sua localidade';
              setCityName(city.toUpperCase());
            })
            .catch(() => setCityName('SUA LOCALIDADE'))
            .finally(() => setIsLocating(false));
        },
        async (error) => {
          console.warn("Localização negada ou falhou:", error);
          setHasLocation(false);
          setIsLocating(false);
          // Fallback: Tenta centrar no primeiro salão da lista se houver
          if (initialSalons.length > 0 && initialSalons[0].location) {
            setCoords({ lat: initialSalons[0].location.lat, lng: initialSalons[0].location.lng });
          }
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    }
  }, [initialSalons]);

  useEffect(() => {
    const fetchLatestSalons = async () => {
      try {
        const data = await api.salons.getAll();
        setDynamicSalons(data);
      } catch (err) { }
    };

    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.user_metadata?.full_name?.split(' ')[0] || 'Aura');
        const { data: profile } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single();
        if (profile?.avatar_url) setUserAvatar(profile.avatar_url);
      }
    };

    fetchLatestSalons();
    fetchUserProfile();
    handleDetectLocation();
  }, [handleDetectLocation]);

  // Forçar detecção se mudar para o mapa e não tiver localização
  useEffect(() => {
    if (viewMode === 'map' && !hasLocation) {
      handleDetectLocation();
    }
  }, [viewMode, hasLocation, handleDetectLocation]);

  const filteredSalons = useMemo(() => {
    let list = (dynamicSalons.length > 0 ? dynamicSalons : initialSalons).map(s => ({
      ...s,
      distanceKm: s.location ? calculateDistance(coords.lat, coords.lng, s.location.lat, s.location.lng) : 999
    }));

    if (activeSegment !== 'Todos') {
      list = list.filter(s => s.segmento === activeSegment);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        (s.nome?.toLowerCase().includes(q)) ||
        (s.descricao?.toLowerCase().includes(q)) ||
        (s.cidade?.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [dynamicSalons, initialSalons, activeSegment, search, coords]);

  return (
    <div className="flex-1 flex flex-col h-full relative text-white bg-background-dark overflow-hidden">
      <header className="px-5 lg:px-12 pt-6 lg:pt-14 pb-6 shrink-0 z-20 w-full bg-gradient-to-b from-background-dark via-background-dark/95 to-transparent">
        <div className="max-w-[1400px] mx-auto w-full space-y-6 lg:space-y-12">
          {/* Top Bar: Title & User */}
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-display font-black italic tracking-tighter leading-none text-3xl lg:text-5xl">Luxe Aura</h1>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode(v => v === 'list' ? 'map' : 'list')}
                className="size-11 lg:size-14 rounded-2xl lg:rounded-3xl bg-surface-dark/40 backdrop-blur-md border border-white/5 flex items-center justify-center text-slate-400 active:scale-95 transition-all hover:bg-white/5 hover:text-white group"
              >
                <span className="material-symbols-outlined text-lg group-hover:scale-110 transition-transform">{viewMode === 'list' ? 'map' : 'list_alt'}</span>
              </button>
              {role && (
                <div onClick={() => navigate('/profile')} className="size-11 lg:size-14 rounded-2xl lg:rounded-3xl gold-gradient p-0.5 shadow-2xl cursor-pointer active:scale-95 transition-all hover:brightness-110 group relative">
                  <div className="absolute inset-0 rounded-2xl lg:rounded-3xl border-2 border-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  {userAvatar ? (
                    <img src={userAvatar} className="w-full h-full rounded-[18px] lg:rounded-[22px] object-cover" alt="Profile" />
                  ) : (
                    <div className="w-full h-full rounded-[18px] lg:rounded-[22px] bg-background-dark flex items-center justify-center text-primary font-black text-[10px] lg:text-xs">
                      {(userName || 'A').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Location Bar */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-4 py-2 rounded-full backdrop-blur-md shrink-0">
              <span className="material-symbols-outlined text-primary text-[10px]">location_on</span>
              <p className="font-black uppercase tracking-[0.2em] text-slate-400 text-[8px] lg:text-[9px]">{cityName}</p>
            </div>
            <button
              onClick={handleDetectLocation}
              disabled={isLocating}
              className="flex items-center gap-2.5 group bg-white/5 border border-white/10 px-4 py-2 rounded-full hover:bg-white/10 transition-all active:scale-95 shrink-0"
            >
              <div className={`size-1.5 rounded-full bg-primary ${isLocating ? 'animate-ping' : 'animate-pulse shadow-[0_0_8px_rgba(193,165,113,1)]'}`}></div>
              <span className="font-black text-primary uppercase tracking-widest text-[8px] lg:text-[9px]">
                {isLocating ? 'Sincronizando...' : 'Auto-Detectar'}
              </span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-center w-full lg:justify-between">
            <div className="relative group w-full lg:max-w-[500px] shrink-0">
              <input
                type="text"
                placeholder="Busque por beleza ou spas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-dark/40 border border-white/5 rounded-2xl lg:rounded-3xl py-4 lg:py-6 pl-12 lg:pl-16 pr-10 text-xs lg:text-sm text-white placeholder:text-slate-600 outline-none focus:border-primary/40 focus:bg-surface-dark/60 transition-all shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)]"
              />
              <span className="material-symbols-outlined absolute left-4 lg:left-6 top-1/2 -translate-y-1/2 text-slate-600 text-lg lg:text-2xl group-focus-within:text-primary transition-colors">search</span>
            </div>

            <div className="relative w-full lg:flex-1 flex lg:justify-end overflow-hidden">
              <div className="flex gap-2 lg:gap-3 overflow-x-auto no-scrollbar pb-1 px-1 lg:pb-0 scroll-smooth mask-fade-right pr-10 lg:pr-4">
                {segments.map(seg => (
                  <button
                    key={seg}
                    onClick={() => setActiveSegment(seg)}
                    className={`px-5 py-3 rounded-full font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all border text-[9px] lg:text-[10px] ${activeSegment === seg ? 'gold-gradient text-background-dark border-transparent shadow-[0_10px_30px_rgba(193,165,113,0.3)]' : 'bg-surface-dark/40 text-slate-500 border-white/5 hover:bg-white/5 hover:text-white'}`}
                  >
                    {seg}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 lg:px-12 pt-2 pb-40 space-y-10 no-scrollbar w-full">
        <div className="max-w-[1400px] mx-auto w-full">
          {viewMode === 'map' ? (
            <div className="h-auto min-h-[500px] lg:h-[calc(100vh-350px)] w-full rounded-[32px] lg:rounded-[40px] overflow-hidden border border-white/5 shadow-2xl relative">
              <Suspense fallback={<div className="h-full w-full bg-[#0c0d10] animate-pulse" />}>
                <AuraMap
                  center={[coords.lat, coords.lng]}
                  zoom={13}
                  userMarker={{
                    position: [coords.lat, coords.lng],
                    icon: UserIcon,
                    popupContent: "Você está aqui"
                  }}
                  markers={filteredSalons.map(salon => ({
                    id: salon.id,
                    position: [salon.location?.lat || 0, salon.location?.lng || 0] as [number, number],
                    icon: createSalonIcon(salon.logo_url),
                    popup: (
                      <Popup className="custom-popup">
                        <div className="p-4 bg-surface-dark min-w-[180px]" onClick={() => navigate(`/salon/${salon.slug_publico}`)}>
                          <h3 className="font-display font-black italic text-white mb-1">{salon.nome}</h3>
                          <p className="text-[9px] text-primary font-black uppercase tracking-widest">{salon.segmento}</p>
                        </div>
                      </Popup>
                    )
                  })).filter(m => m.position[0] !== 0)}
                  clusterIconFactory={createClusterCustomIcon}
                />
              </Suspense>
              <div className="absolute bottom-4 right-6 text-[8px] text-white/30 uppercase tracking-[0.4em] pointer-events-none z-[1000] italic">
                Aura Maps • © OSM • Carto
              </div>
              <button
                onClick={() => setViewMode('list')}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3.5 bg-background-dark/95 border border-white/10 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-2xl z-[1000] text-primary backdrop-blur-3xl hover:bg-white/5 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-lg">list</span> Ver Lista
              </button>
            </div>
          ) : (
            <div className="space-y-10">
              {/* DESTAQUE PRINCIPAL - Primeiríssimo Salon */}
              {filteredSalons.length > 0 && activeSegment === 'Todos' && !search && (
                <div
                  onClick={() => navigate(`/salon/${filteredSalons[0].slug_publico}`)}
                  className="group relative w-full h-[320px] lg:h-[550px] rounded-[32px] lg:rounded-[48px] overflow-hidden border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] cursor-pointer active:scale-[0.99] transition-all duration-700"
                >
                  <img
                    src={filteredSalons[0].banner_url || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1000&auto=format&fit=crop'}
                    className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000"
                    alt="featured"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/20 to-transparent"></div>

                  <div className="absolute top-6 right-6 lg:top-8 lg:right-8 px-4 py-1.5 lg:px-5 lg:py-2 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 flex items-center gap-2 shadow-2xl">
                    <span className="material-symbols-outlined text-primary text-xs lg:text-base fill-1">star</span>
                    <span className="text-xs lg:text-sm font-black text-white">{(Number(filteredSalons[0].rating) || 5.0).toFixed(1)}</span>
                  </div>

                  <div className="absolute bottom-6 left-6 right-6 lg:bottom-12 lg:left-12 lg:right-12 flex flex-col lg:flex-row lg:items-end justify-between gap-5 lg:gap-8">
                    <div className="space-y-4 lg:space-y-6">
                      <div className="flex items-center gap-4 lg:gap-5">
                        <div className="size-12 lg:size-16 rounded-2xl lg:rounded-[24px] gold-gradient p-0.5 shadow-2xl shrink-0">
                          <img src={filteredSalons[0].logo_url} className="size-full rounded-[14px] lg:rounded-[22px] object-cover" alt="logo" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-display font-black italic text-lg lg:text-6xl text-white tracking-tighter uppercase leading-[1.1] drop-shadow-2xl line-clamp-2">{filteredSalons[0].nome}</h2>
                          <p className="text-[8px] lg:text-sm text-primary font-black uppercase tracking-[0.4em] mt-1 lg:mt-3">{filteredSalons[0].segmento}</p>
                        </div>
                      </div>
                      <div className="flex items-center flex-wrap gap-3 lg:gap-6">
                        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                          <span className="material-symbols-outlined text-[10px] lg:text-sm text-primary">location_on</span>
                          <span className="text-[8px] lg:text-[10px] font-black text-slate-300 uppercase tracking-widest">{filteredSalons[0].distanceKm.toFixed(1)}km</span>
                        </div>
                        <span className="text-[8px] lg:text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] lg:tracking-[0.4em] italic leading-tight">Nova no Aura Premium</span>
                      </div>
                    </div>

                    <div className="hidden lg:flex size-16 lg:size-20 rounded-full gold-gradient shadow-gold items-center justify-center text-background-dark group-hover:scale-110 group-hover:rotate-12 transition-all shrink-0">
                      <span className="material-symbols-outlined text-3xl lg:text-4xl font-black">chevron_right</span>
                    </div>
                  </div>
                </div>
              )}

              {/* GRID DOS DEMAIS SALÕES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {(filteredSalons.length > 0 && activeSegment === 'Todos' && !search ? filteredSalons.slice(1) : filteredSalons).map((salon) => (
                  <div key={salon.id} onClick={() => navigate(`/salon/${salon.slug_publico}`)} className="group flex flex-col bg-surface-dark/30 border border-white/5 rounded-[32px] overflow-hidden hover:border-primary/30 transition-all duration-500 shadow-2xl active:scale-[0.98] cursor-pointer">
                    <div className="relative h-64 overflow-hidden">
                      <img
                        src={salon.banner_url || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1000&auto=format&fit=crop'}
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100"
                        alt={salon.nome}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent opacity-90"></div>

                      <div className="absolute top-5 right-5 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-1.5 shadow-xl">
                        <span className="material-symbols-outlined text-primary text-sm fill-1">star</span>
                        <span className="text-[11px] font-black text-white italic">{(Number(salon.rating) || 5.0).toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="p-8 relative -mt-8">
                      <div className="flex items-center gap-4 mb-5">
                        <div className="size-12 rounded-2xl gold-gradient p-0.5 shadow-2xl shrink-0 group-hover:scale-110 transition-transform">
                          {salon.logo_url ? (
                            <img src={salon.logo_url} className="w-full h-full rounded-[14px] object-cover" alt="logo" />
                          ) : (
                            <div className="w-full h-full rounded-[14px] bg-background-dark flex items-center justify-center text-primary font-black text-sm">
                              {salon.nome.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display font-black italic text-xl text-white tracking-tight group-hover:text-primary transition-colors leading-none uppercase truncate">{salon.nome}</h3>
                          <p className="text-[10px] text-primary/70 font-black uppercase tracking-[0.2em] mt-2">{salon.segmento}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-slate-500 mb-8">
                        <div className="flex items-center gap-2">
                          <div className="size-5 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-xs text-primary">location_on</span>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{salon.distanceKm.toFixed(1)}km</span>
                        </div>
                        {Number(salon.reviews) > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="size-5 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                              <span className="material-symbols-outlined text-xs text-emerald-500">verified</span>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{salon.reviews} Avaliações</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] leading-none mb-1">Status Aura</span>
                          <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] italic">Disponível Agora</span>
                        </div>
                        <div className="size-11 rounded-full gold-gradient shadow-gold-sm flex items-center justify-center text-background-dark group-hover:scale-110 group-hover:rotate-12 transition-all">
                          <span className="material-symbols-outlined font-black text-lg">arrow_forward</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Discovery;
