import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Salon, BusinessSegment, ViewRole } from '../../types.ts';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';

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

const RecenterMap: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], 13); }, [lat, lng, map]);
  return null;
};

const Discovery: React.FC<DiscoveryProps> = ({ salons: initialSalons, role }) => {
  const navigate = useNavigate();
  const [activeSegment, setActiveSegment] = useState<BusinessSegment | 'Todos'>('Todos');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: -15.7942, lng: -47.8822 }); // Default Brasília (Centro do BR)
  const [hasLocation, setHasLocation] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [cityName, setCityName] = useState('SUA LOCALIDADE');
  const [dynamicSalons, setDynamicSalons] = useState<Salon[]>(initialSalons);

  const segments: (BusinessSegment | 'Todos')[] = ['Todos', 'Salão', 'Manicure', 'Sobrancelha', 'Barba', 'Estética', 'Spa'];

  useEffect(() => {
    // Tenta obter posição com timeout
    if (navigator.geolocation) {
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
            .catch(() => setCityName('SUA LOCALIDADE'));
        },
        async (error) => {
          console.warn("Geolocation failed, trying to center on first salon...", error);
          setHasLocation(false);
          // Fallback: Tenta centrar no primeiro salão da lista se houver
          if (initialSalons.length > 0 && initialSalons[0].location) {
            setCoords({ lat: initialSalons[0].location.lat, lng: initialSalons[0].location.lng });
          }
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    }

    const fetchLatestSalons = async () => {
      try {
        const data = await api.salons.getAll();
        setDynamicSalons(data);
      } catch (err) { console.error("Error updating salons list:", err); }
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
  }, []);

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
      list = list.filter(s => s.nome.toLowerCase().includes(q) || s.descricao.toLowerCase().includes(q) || s.cidade.toLowerCase().includes(q));
    }

    return list.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [dynamicSalons, initialSalons, activeSegment, search, coords]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background-dark relative text-white">
      <header className="px-6 pt-[calc(env(safe-area-inset-top)+2rem)] pb-6 shrink-0 z-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-black italic tracking-tighter leading-none">Luxe Aura</h1>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500">{cityName}</p>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-1 group"
              >
                <span className="material-symbols-outlined text-[10px] text-primary animate-pulse group-active:rotate-180 transition-transform">location_on</span>
                <span className="text-[7px] font-black text-primary/60 uppercase tracking-widest border-b border-primary/20">Detectar</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setViewMode(v => v === 'list' ? 'map' : 'list')} className="size-10 rounded-xl bg-surface-dark border border-white/5 flex items-center justify-center text-slate-400 shadow-xl active:scale-95 transition-all">
              <span className="material-symbols-outlined text-xl">{viewMode === 'list' ? 'map' : 'list_alt'}</span>
            </button>
            {role && (
              <div onClick={() => navigate('/profile')} className="size-10 rounded-xl gold-gradient p-0.5 shadow-xl cursor-pointer active:scale-95 transition-all">
                {userAvatar ? (
                  <img src={userAvatar} className="w-full h-full rounded-[10px] object-cover" alt="Profile" />
                ) : (
                  <div className="w-full h-full rounded-[10px] bg-background-dark flex items-center justify-center text-primary font-black text-xs">
                    {(userName || 'A').substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="relative group mb-6">
          <input
            type="text"
            placeholder="Beleza, Spas, Procedimentos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-dark/50 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-xs text-white placeholder:text-slate-600 outline-none focus:border-primary/30 transition-all shadow-inner"
          />
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 text-xl group-focus-within:text-primary transition-colors">search</span>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {segments.map(seg => (
            <button key={seg} onClick={() => setActiveSegment(seg)} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${activeSegment === seg ? 'gold-gradient text-background-dark border-transparent shadow-lg shadow-primary/20 scale-105' : 'bg-surface-dark/40 text-slate-500 border-white/5'}`}>
              {seg}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pt-2 pb-32 space-y-8 no-scrollbar">
        {viewMode === 'map' ? (
          <div className="h-[520px] w-full rounded-[40px] overflow-hidden border border-white/5 shadow-2xl relative">
            <MapContainer
              center={[coords.lat, coords.lng]}
              zoom={13}
              className="h-full w-full"
              style={{ background: '#0c0d10' }}
              attributionControl={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <RecenterMap lat={coords.lat} lng={coords.lng} />

              <Marker position={[coords.lat, coords.lng]} icon={UserIcon}>
                <Popup className="custom-popup">
                  <div className="px-4 py-2 font-black text-[10px] uppercase tracking-widest text-primary">Você está aqui</div>
                </Popup>
              </Marker>
              <MarkerClusterGroup iconCreateFunction={createClusterCustomIcon}>
                {filteredSalons.map(salon => salon.location && (
                  <Marker key={salon.id} position={[salon.location.lat, salon.location.lng]} icon={createSalonIcon(salon.logo_url)}>
                    <Popup className="custom-popup">
                      <div className="p-4 bg-surface-dark min-w-[200px]" onClick={() => navigate(`/salon/${salon.slug_publico}`)}>
                        <h3 className="font-display font-black italic text-white mb-2">{salon.nome}</h3>
                        <p className="text-[10px] text-primary font-black uppercase tracking-widest">{salon.segmento}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
            <div className="absolute bottom-2 right-4 text-[6px] text-white/20 uppercase tracking-[0.4em] pointer-events-none z-[1000] italic">
              Aura Maps • © OSM • Carto
            </div>
            <button onClick={() => setViewMode('list')} className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-background-dark/90 border border-white/10 rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-2xl z-[1000] text-primary backdrop-blur-xl hover:bg-white/5 active:scale-95 transition-all">
              <span className="material-symbols-outlined text-sm">list</span> Ver Lista
            </button>
          </div>
        ) : (
          filteredSalons.map((salon) => (
            <div key={salon.id} onClick={() => navigate(`/salon/${salon.slug_publico}`)} className="group flex flex-col bg-surface-dark/20 border border-white/5 rounded-[40px] overflow-hidden hover:border-primary/20 transition-all active:scale-[0.98]">
              <div className="relative h-64">
                <img src={salon.banner_url} className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-70 transition-all duration-700" alt={salon.nome} />
                <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-black/20" />

                <div className="absolute top-6 right-6 px-3 py-1.5 bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-xs fill-1">star</span>
                  <span className="text-[10px] font-black text-white">{(Number(salon.rating) || 0).toFixed(1)}</span>
                </div>

                <div className="absolute bottom-6 left-6 flex items-end gap-4 pr-12">
                  <img src={salon.logo_url} className="size-16 rounded-[24px] border-2 border-background-dark shadow-2xl object-cover" alt="logo" />
                  <div className="flex-1 pb-1 min-w-0">
                    <h2 className="text-xl font-display font-black italic text-white leading-[1.1] tracking-tighter drop-shadow-lg line-clamp-2 uppercase">
                      {salon.nome}
                    </h2>
                    <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mt-1.5">{salon.segmento}</p>
                  </div>
                </div>
              </div>

              <div className="p-7 flex items-center justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-sm">location_on</span>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">{salon.distanceKm.toFixed(1)}km</span>
                  </div>
                  {Number(salon.reviews) > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center size-5 rounded-full gold-gradient shadow-lg">
                        <span className="material-symbols-outlined text-[10px] text-background-dark font-black">verified</span>
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none">
                        <span className="text-primary">{salon.reviews}</span> Avaliações Reais
                      </p>
                    </div>
                  ) : (
                    <p className="text-[9px] text-primary/40 font-black uppercase tracking-widest italic">Novo no Aura Premium</p>
                  )}
                </div>

                <div className="size-14 rounded-3xl gold-gradient flex items-center justify-center text-background-dark shadow-[0_10px_30px_rgba(193,165,113,0.3)] group-hover:scale-110 transition-transform duration-500">
                  <span className="material-symbols-outlined text-2xl font-black">arrow_forward</span>
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default Discovery;
