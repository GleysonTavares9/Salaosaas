
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Salon, BusinessSegment, ViewRole } from '../../types.ts';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';

// Leaflet assets from standard paths
const iconUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Custom salon marker with gold theme
const SalonIcon = L.divIcon({
  className: 'custom-salon-marker',
  html: `<div class="w-8 h-8 rounded-full border-2 border-[#c1a571] bg-[#1a1c22] flex items-center justify-center shadow-2xl">
           <span class="material-symbols-outlined text-[#c1a571] text-lg">home_hair</span>
         </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// User location marker with pulse effect
const UserIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `<div class="relative">
           <div class="absolute -inset-2 bg-blue-500/30 rounded-full animate-ping"></div>
           <div class="size-4 bg-blue-500 rounded-full border-2 border-white shadow-lg relative z-10"></div>
         </div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

L.Marker.prototype.options.icon = DefaultIcon;

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

interface DiscoveryProps {
  salons: Salon[];
  role: ViewRole | null;
}

const RecenterMap: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 13);
  }, [lat, lng, map]);
  return null;
};

const Discovery: React.FC<DiscoveryProps> = ({ salons, role }) => {
  const navigate = useNavigate();
  const [activeSegment, setActiveSegment] = useState<BusinessSegment | 'Todos'>('Todos');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [userLocationLabel, setUserLocationLabel] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: -23.5667, lng: -46.6667 });
  const [hasLocation, setHasLocation] = useState(false);

  const [selectedSalonId, setSelectedSalonId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  const segments: (BusinessSegment | 'Todos')[] = ['Todos', 'Salão', 'Manicure', 'Sobrancelha', 'Barba', 'Estética', 'Spa'];

  useEffect(() => {
    // 1. Get Location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCoords({ lat: latitude, lng: longitude });
          setUserLocationLabel(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
          setHasLocation(true);
        },
        () => {
          setUserLocationLabel("São Paulo, BR");
          setHasLocation(false);
        }
      );
    }

    // 2. Fetch User Profile if logged in
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const metaName = user.user_metadata.nome || user.user_metadata.owner_name;
        if (metaName) setUserName(metaName);

        try {
          const profile = await api.profiles.get(user.id);
          const avatar = profile?.avatar_url || user.user_metadata.avatar_url;
          const name = profile?.full_name || metaName;

          if (avatar) setUserAvatar(avatar);
          if (name) setUserName(name);
        } catch (err) {
          console.warn("Could not fetch profile for avatar in Discovery", err);
        }
      }
    };
    fetchUserProfile();

  }, []);

  const filteredSalons = useMemo(() => {
    const list = salons
      .map(s => {
        const dist = calculateDistance(coords.lat, coords.lng, s.location.lat, s.location.lng);
        return { 
          ...s, 
          distanceKm: dist,
          distancia: dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`
        };
      })
      .filter(s =>
        (activeSegment === 'Todos' || s.segmento === activeSegment) &&
        (s.nome.toLowerCase().includes(search.toLowerCase()) ||
          s.segmento.toLowerCase().includes(search.toLowerCase()))
      );
    
    // Sort by proximity
    return list.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [salons, activeSegment, search, coords]);

  const selectedSalon = useMemo(() =>
    filteredSalons.find(s => s.id === selectedSalonId),
    [filteredSalons, selectedSalonId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background-dark relative overflow-hidden text-white">
      <header className="px-6 pt-12 pb-4 bg-background-dark/95 backdrop-blur-xl z-[1000] border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div onClick={() => navigate('/')} className="cursor-pointer">
            <h1 className="text-xl font-display font-black text-white italic tracking-tighter leading-none">Luxe Aura</h1>
            <p className="text-[7px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">{userLocationLabel || "Buscando localização..."}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setViewMode(viewMode === 'list' ? 'map' : 'list'); setSelectedSalonId(null); }}
              className={`size-10 rounded-xl border flex items-center justify-center transition-all ${viewMode === 'map' ? 'bg-primary border-primary text-background-dark shadow-xl shadow-primary/20' : 'bg-surface-dark border-white/10 text-primary'}`}
            >
              <span className="material-symbols-outlined text-lg">{viewMode === 'list' ? 'map' : 'format_list_bulleted'}</span>
            </button>

            {role ? (
              <button onClick={() => navigate('/profile')} className="size-10 rounded-xl border border-white/10 bg-surface-dark flex items-center justify-center overflow-hidden active:scale-95 transition-transform">
                <img
                  src={userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'Aura')}&background=c1a571&color=0c0d10&bold=true`}
                  className="size-full object-cover"
                  alt="User"
                />
              </button>
            ) : (
              <button onClick={() => navigate('/login-user')} className="h-10 px-4 rounded-xl border border-primary/40 bg-primary/10 text-primary flex items-center justify-center text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all">
                Entrar
              </button>
            )}
          </div>
        </div>

        <div className="relative mb-4">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">search</span>
          <input
            type="text"
            placeholder="Salões, Spas, Procedimentos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-dark border border-white/5 rounded-xl py-3 pl-10 pr-4 text-[11px] text-white outline-none focus:border-primary/40"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {segments.map(seg => (
            <button key={seg} onClick={() => setActiveSegment(seg)} className={`px-4 py-2 rounded-lg text-[7px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${activeSegment === seg ? 'gold-gradient text-background-dark border-primary' : 'bg-surface-dark text-slate-500 border-white/5'}`}>
              {seg}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 relative">
        {viewMode === 'list' ? (
          <main className="scroll-container px-6 pt-6">
            <div className="space-y-6">
              {filteredSalons.length > 0 ? filteredSalons.map(salon => (
                <div key={salon.id} onClick={() => navigate(`/salon/${salon.slug_publico}`)} className="bg-surface-dark border border-white/5 rounded-[32px] overflow-hidden shadow-xl active:scale-[0.98] transition-all group">
                  <div className="h-40 w-full relative">
                    <img src={salon.banner_url} className="size-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-60 transition-all duration-500" alt={salon.nome} />
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-white font-black text-[9px] border border-white/10">{salon.rating} ★</div>
                  </div>
                  <div className="p-5 flex items-center gap-4">
                    <img src={salon.logo_url} className="size-10 rounded-xl object-cover border border-white/5" alt="Logo" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-display font-black text-sm italic truncate">{salon.nome}</h4>
                      <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest">
                        {salon.segmento} • <span className="text-primary">{salon.distancia}</span>
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center opacity-30 flex flex-col items-center">
                  <span className="material-symbols-outlined text-6xl mb-4">search_off</span>
                  <p className="text-[10px] font-black uppercase tracking-widest">Nenhum salão encontrado</p>
                </div>
              )}
              <div className="h-20"></div>
            </div>
          </main>
        ) : (
          <main className="absolute inset-0 bg-[#0c0d10] z-0 overflow-hidden">
            <div className="h-full w-full absolute inset-0">
              <MapContainer
                center={[coords.lat, coords.lng]}
                zoom={13}
                style={{ height: '100%', width: '100%', background: '#0c0d10' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  className="map-tiles grayscale contrast-[1.2] brightness-[0.8]"
                />
                
                <RecenterMap lat={coords.lat} lng={coords.lng} />

                {/* User pulsing marker */}
                {hasLocation && (
                  <Marker position={[coords.lat, coords.lng]} icon={UserIcon}>
                    <Popup pixelOffset={[0, -10]}>
                      <div className="p-2 text-center">
                        <p className="text-[8px] font-black uppercase tracking-widest text-primary">Você está aqui</p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {filteredSalons.map((salon) => (
                  <Marker
                    key={salon.id}
                    position={[salon.location.lat, salon.location.lng]}
                    icon={SalonIcon}
                    eventHandlers={{
                      click: () => setSelectedSalonId(salon.id),
                    }}
                  >
                    <Popup className="premium-popup">
                      <div className="text-background-dark p-2 min-w-[120px]">
                        <h4 className="font-black text-[10px] uppercase tracking-tighter leading-tight mb-1">{salon.nome}</h4>
                        <p className="text-[8px] text-slate-600 mb-2 font-bold uppercase">{salon.segmento} • {salon.distancia}</p>
                        <button
                          onClick={() => navigate(`/salon/${salon.slug_publico}`)}
                          className="w-full bg-primary text-[8px] font-black py-2 rounded-lg text-background-dark uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                        >
                          Ir ao Salão
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {selectedSalon && (
              <div className="absolute bottom-6 left-6 right-6 z-[1000] animate-fade-in">
                <div onClick={() => navigate(`/salon/${selectedSalon.slug_publico}`)} className="bg-surface-dark/95 backdrop-blur-xl border border-primary/30 rounded-[28px] p-4 shadow-2xl flex gap-4 items-center cursor-pointer active:scale-95 transition-all">
                  <img src={selectedSalon.logo_url} className="size-14 rounded-xl object-cover border border-white/10 shadow-lg" alt="Salon" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-display font-black text-sm italic truncate">{selectedSalon.nome}</h3>
                    <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest mt-0.5">{selectedSalon.segmento} • <span className="text-primary">{selectedSalon.distancia}</span></p>
                  </div>
                  <div className="size-10 rounded-full gold-gradient flex items-center justify-center text-background-dark shadow-xl">
                    <span className="material-symbols-outlined text-lg font-black">arrow_forward</span>
                  </div>
                </div>
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  );
};

export default Discovery;
