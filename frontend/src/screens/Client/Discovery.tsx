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
    html: `<div class="size-11 rounded-full gold-gradient border-2 border-white shadow-[0_0_20px_rgba(193,165,113,0.8)] flex items-center justify-center text-background-dark font-black text-xs">
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
    <div className="flex-1 flex flex-col h-full relative text-white">
      <header className="px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6 shrink-0 z-20 lg:pt-10 lg:px-6 w-full">
        <div className="w-full">
          <div className="flex items-center justify-between mb-8">
            <div className="flex-1">
              <h1 className="text-4xl font-display font-black italic tracking-tighter leading-none lg:text-7xl">Luxe Aura</h1>
              <div className="flex items-center gap-3 mt-3">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 lg:text-sm">{cityName}</p>
                <button
                  onClick={handleDetectLocation}
                  disabled={isLocating}
                  className="flex items-center gap-2 group"
                >
                  <div className={`size-2 lg:size-2.5 rounded-full bg-primary ${isLocating ? 'animate-ping' : 'animate-pulse shadow-[0_0_10px_rgba(193,165,113,1)]'}`}></div>
                  <span className="text-[8px] lg:text-[10px] font-black text-primary uppercase tracking-[0.2em] border-b border-primary/20 group-hover:border-primary transition-all">
                    {isLocating ? 'Sincronizando...' : 'Detectar Localização'}
                  </span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewMode(v => v === 'list' ? 'map' : 'list')}
                className="size-12 lg:size-16 rounded-[20px] lg:rounded-[28px] bg-surface-dark border border-white/5 flex items-center justify-center text-slate-400 shadow-2xl active:scale-95 transition-all hover:bg-white/5 hover:text-white"
              >
                <span className="material-symbols-outlined text-2xl lg:text-3xl">{viewMode === 'list' ? 'map' : 'list_alt'}</span>
              </button>
              {role && (
                <div onClick={() => navigate('/profile')} className="size-12 lg:size-16 rounded-[20px] lg:rounded-[28px] gold-gradient p-0.5 shadow-2xl cursor-pointer active:scale-95 transition-all hover:brightness-110">
                  {userAvatar ? (
                    <img src={userAvatar} className="w-full h-full rounded-[18px] lg:rounded-[26px] object-cover" alt="Profile" />
                  ) : (
                    <div className="w-full h-full rounded-[18px] lg:rounded-[26px] bg-background-dark flex items-center justify-center text-primary font-black text-sm lg:text-lg">
                      {(userName || 'A').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="relative group mb-10 w-full max-w-2xl">
            <input
              type="text"
              placeholder="Busque por beleza ou spas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-dark/40 border border-white/5 rounded-[24px] py-4 lg:py-5 pl-14 lg:pl-16 pr-8 text-sm lg:text-base text-white placeholder:text-slate-600 outline-none focus:border-primary/40 focus:bg-surface-dark/60 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
            />
            <span className="material-symbols-outlined absolute left-5 lg:left-6 top-1/2 -translate-y-1/2 text-slate-600 text-xl lg:text-2xl group-focus-within:text-primary transition-colors">search</span>
          </div>

          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 lg:flex-wrap">
            {segments.map(seg => (
              <button key={seg} onClick={() => setActiveSegment(seg)} className={`px-6 py-3 lg:px-10 lg:py-4 rounded-xl lg:rounded-[28px] text-[10px] lg:text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all border ${activeSegment === seg ? 'gold-gradient text-background-dark border-transparent shadow-[0_10px_30px_rgba(193,165,113,0.3)] scale-105' : 'bg-surface-dark/40 text-slate-500 border-white/5 hover:bg-surface-dark hover:text-white hover:border-white/10'}`}>
                {seg}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pt-2 pb-32 space-y-10 no-scrollbar w-full lg:px-6">
        <div className="w-full max-w-none">
          {viewMode === 'map' ? (
            <div className="h-[600px] lg:h-[calc(100vh-320px)] w-full rounded-[40px] lg:rounded-[56px] overflow-hidden border border-white/5 shadow-2xl relative">
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
                        <div className="p-4 bg-surface-dark min-w-[200px]" onClick={() => navigate(`/salon/${salon.slug_publico}`)}>
                          <h3 className="font-display font-black italic text-white mb-2">{salon.nome}</h3>
                          <p className="text-[10px] text-primary font-black uppercase tracking-widest">{salon.segmento}</p>
                        </div>
                      </Popup>
                    )
                  })).filter(m => m.position[0] !== 0)}
                  clusterIconFactory={createClusterCustomIcon}
                />
              </Suspense>
              <div className="absolute bottom-2 right-4 text-[6px] text-white/20 uppercase tracking-[0.4em] pointer-events-none z-[1000] italic">
                Aura Maps • © OSM • Carto
              </div>
              <button onClick={() => setViewMode('list')} className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-background-dark/90 border border-white/10 rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-2xl z-[1000] text-primary backdrop-blur-xl hover:bg-white/5 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-sm">list</span> Ver Lista
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-10 w-full">
              {filteredSalons.map((salon) => (
                <div key={salon.id} onClick={() => navigate(`/salon/${salon.slug_publico}`)} className="group flex flex-col bg-surface-dark/20 border border-white/5 rounded-[40px] overflow-hidden hover:border-primary/20 transition-all active:scale-[0.98]">
                  <div className="relative h-64 overflow-hidden">
                    <img
                      src={salon.banner_url || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1000&auto=format&fit=crop'}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100"
                      alt={salon.nome}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent opacity-80"></div>

                    {/* Rating Badge */}
                    <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-sm fill-1">star</span>
                      <span className="text-[10px] font-black text-white">{(Number(salon.rating) || 5.0).toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="p-8 relative -mt-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <div className="size-12 rounded-[20px] gold-gradient p-0.5 shadow-2xl shrink-0">
                            {salon.logo_url ? (
                              <img src={salon.logo_url} className="w-full h-full rounded-[18px] object-cover" alt="logo" />
                            ) : (
                              <div className="w-full h-full rounded-[18px] bg-background-dark flex items-center justify-center text-primary font-black text-sm">
                                {salon.nome.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-display font-black italic text-xl text-white tracking-tight group-hover:text-primary transition-colors leading-tight uppercase truncate">{salon.nome}</h3>
                            <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mt-1">{salon.segmento}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-slate-500 mb-6 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">{salon.distanceKm.toFixed(1)}km</span>
                      </div>
                      {Number(salon.reviews) > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-primary">verified</span>
                          <span className="text-[10px] font-black uppercase tracking-widest">{salon.reviews} Avaliações</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-white/5">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] italic">Novo no Aura Premium</span>
                      <div className="size-12 rounded-full gold-gradient flex items-center justify-center text-background-dark shadow-xl group-hover:scale-110 group-hover:rotate-12 transition-all">
                        <span className="material-symbols-outlined font-black">arrow_forward</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Discovery;
