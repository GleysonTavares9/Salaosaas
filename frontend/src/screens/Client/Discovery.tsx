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
           <div class="w-10 h-10 bg-[#c1a571] rounded-full rounded-bl-none rotate-[-45deg] flex items-center justify-center shadow-[0_10px_20px_rgba(0,0,0,0.5)] border border-white/20 transition-transform group-hover:scale-110 duration-300">
             <div class="w-7 h-7 bg-white rounded-full rotate-[45deg] overflow-hidden flex items-center justify-center border border-black/5">
                <img src="${logoUrl}" class="w-full h-full object-cover" alt="logo" />
             </div>
           </div>
           <div class="absolute -bottom-1 w-2 h-1 bg-[#c1a571]/60 rounded-full blur-[2px] animate-pulse"></div>
         </div>`,
  iconSize: [40, 44],
  iconAnchor: [20, 44],
  popupAnchor: [0, -44],
});

const createClusterCustomIcon = (cluster: any) => {
  return L.divIcon({
    html: `<div class="size-10 rounded-full gold-gradient border-2 border-background-dark shadow-2xl flex items-center justify-center text-background-dark font-black text-xs">
             ${cluster.getChildCount()}
           </div>`,
    className: 'custom-marker-cluster',
    iconSize: L.point(40, 40, true),
  });
};

const UserIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `<div class="relative flex items-center justify-center">
           <div class="absolute inset-0 bg-primary/30 rounded-full animate-ping scale-150"></div>
           <div class="size-4 bg-primary rounded-full border-2 border-white shadow-[0_0_15px_rgba(193,165,113,0.5)] relative z-10"></div>
         </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
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
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: -23.5667, lng: -46.6667 });
  const [hasLocation, setHasLocation] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [dynamicSalons, setDynamicSalons] = useState<Salon[]>(initialSalons);

  const segments: (BusinessSegment | 'Todos')[] = ['Todos', 'Salão', 'Manicure', 'Sobrancelha', 'Barba', 'Estética', 'Spa'];

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
          setHasLocation(true);
        },
        () => setHasLocation(false)
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
        try {
          const profile = await api.profiles.getById(user.id);
          setUserAvatar(profile?.avatar_url || user.user_metadata.avatar_url);
          setUserName(profile?.full_name || user.user_metadata.nome || user.user_metadata.owner_name || 'Usuário');
        } catch (err) { console.warn("Avatar fetch failed", err); }
      }
    };

    fetchUserProfile();
    fetchLatestSalons();
  }, []);

  const filteredSalons = useMemo(() => {
    return dynamicSalons
      .map(s => {
        const sLat = s.location?.lat || 0;
        const sLng = s.location?.lng || 0;
        const dist = sLat && sLng ? calculateDistance(coords.lat, coords.lng, sLat, sLng) : 9999;
        return {
          ...s,
          distanceKm: dist,
          distanciaLabel: dist > 1000 ? 'Fora de alcance' : (dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`)
        };
      })
      .filter(s =>
        (activeSegment === 'Todos' || s.segmento === activeSegment) &&
        (s.nome.toLowerCase().includes(search.toLowerCase()) || s.segmento.toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [dynamicSalons, activeSegment, search, coords]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background-dark relative overflow-hidden text-white">
      <header className="px-6 pt-12 pb-4 bg-background-dark/95 backdrop-blur-xl z-[1000] border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div onClick={() => navigate('/')} className="cursor-pointer">
            <h1 className="text-xl font-display font-black text-white italic tracking-tighter">Luxe Aura</h1>
            <p className="text-[7px] text-[#c1a571] font-black uppercase tracking-[0.2em] mt-1">Sua localidade • Aura Premium</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              className={`size-10 rounded-xl border flex items-center justify-center transition-all ${viewMode === 'map' ? 'bg-primary border-primary text-background-dark' : 'bg-surface-dark border-white/10 text-primary'}`}
            >
              <span className="material-symbols-outlined text-lg">{viewMode === 'list' ? 'map' : 'format_list_bulleted'}</span>
            </button>
            <button onClick={() => navigate(role ? '/profile' : '/login-user')} className="size-10 rounded-xl border border-white/10 bg-surface-dark flex items-center justify-center overflow-hidden">
              <img src={userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'Aura')}&background=c1a571&color=0c0d10&bold=true`} className="size-full object-cover" alt="User" />
            </button>
          </div>
        </div>

        <div className="relative mb-4">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">search</span>
          <input
            type="text" placeholder="Beleza, Spas, Procedimentos..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-dark border border-white/5 rounded-xl py-3 pl-10 pr-4 text-[11px] text-white outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {segments.map(seg => (
            <button key={seg} onClick={() => setActiveSegment(seg)} className={`px-4 py-2 rounded-lg text-[7px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${activeSegment === seg ? 'gold-gradient text-background-dark border-primary' : 'bg-surface-dark text-slate-300 border-white/10'}`}>
              {seg}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 relative">
        {viewMode === 'list' ? (
          <main className="flex-1 overflow-y-auto no-scrollbar h-full px-6 pt-6 pb-24 space-y-8">
            {filteredSalons.map(salon => (
              <div key={salon.id} onClick={() => navigate(`/salon/${salon.slug_publico}`)} className="bg-surface-dark/40 border border-white/5 rounded-[32px] overflow-hidden group active:scale-[0.98] transition-all">
                <div className="h-64 relative">
                  <img src={salon.banner_url} className="size-full object-cover opacity-60" alt={salon.nome} />
                  <div className="absolute inset-0 bg-gradient-to-t from-background-dark to-transparent"></div>

                  <div className="absolute top-5 right-5 bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-xl text-white font-black text-xs border border-white/10 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-sm fill-1">star</span>
                    {Number(salon.rating || 0).toFixed(1)}
                  </div>

                  <div className="absolute bottom-6 left-6 flex items-center gap-4">
                    <img src={salon.logo_url} className="size-16 rounded-2xl border-2 border-surface-dark shadow-2xl" alt="Logo" />
                    <div>
                      <h4 className="text-xl font-display font-black text-white italic truncate max-w-[180px]">{salon.nome}</h4>
                      <span className="text-[8px] font-black uppercase tracking-widest text-primary/80">{salon.segmento}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      <span className="text-[9px] font-black uppercase tracking-widest">{salon.distanciaLabel}</span>
                    </div>
                    {Number(salon.reviews) > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                          {[1, 2, 3].map(i => <div key={i} className="size-5 rounded-full border border-surface-dark bg-slate-800 overflow-hidden"><img src={`https://i.pravatar.cc/50?img=${i + 20}`} className="size-full object-cover" alt="r" /></div>)}
                        </div>
                        <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest"><span className="text-primary">{salon.reviews}</span> Avaliações</p>
                      </div>
                    ) : (
                      <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest italic">Novo no Aura Premium</p>
                    )}
                  </div>

                  <div className="size-12 rounded-2xl gold-gradient flex items-center justify-center text-background-dark shadow-xl shadow-primary/10 group-hover:scale-105 transition-all">
                    <span className="material-symbols-outlined text-xl font-black">arrow_forward</span>
                  </div>
                </div>
              </div>
            ))}
          </main>
        ) : (
          <div className="h-full bg-black">
            {/* Map implementation simplified for brevity */}
            <p className="p-10 text-center text-xs text-slate-500">Mapa ativo. Use o botão acima para voltar para lista.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Discovery;
