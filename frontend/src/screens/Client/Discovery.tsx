
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

L.Marker.prototype.options.icon = DefaultIcon;

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
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: -23.5667, lng: -46.6667 });

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
          setUserLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
        },
        () => setUserLocation("Brasil")
      );
    }

    // 2. Fetch User Avatar if logged in
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Set default name from metadata first for fast render
        const metaName = user.user_metadata.nome || user.user_metadata.owner_name;
        if (metaName) setUserName(metaName);

        try {
          const profile = await api.profiles.get(user.id);
          // Prioritize profile avatar, fall back to metadata, then to placeholder
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
    return salons.filter(s =>
      (activeSegment === 'Todos' || s.segmento === activeSegment) &&
      (s.nome.toLowerCase().includes(search.toLowerCase()) ||
        s.segmento.toLowerCase().includes(search.toLowerCase()))
    );
  }, [salons, activeSegment, search]);

  const selectedSalon = useMemo(() =>
    salons.find(s => s.id === selectedSalonId),
    [salons, selectedSalonId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background-dark relative overflow-hidden text-white">
      <header className="px-6 pt-12 pb-4 bg-background-dark/95 backdrop-blur-xl z-[1000] border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div onClick={() => navigate('/')} className="cursor-pointer">
            <h1 className="text-xl font-display font-black text-white italic tracking-tighter leading-none">Luxe Aura</h1>
            <p className="text-[7px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">{userLocation || "Buscando localização..."}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setViewMode(viewMode === 'list' ? 'map' : 'list'); setSelectedSalonId(null); }}
              className={`size-10 rounded-xl border flex items-center justify-center transition-all ${viewMode === 'map' ? 'bg-primary border-primary text-background-dark' : 'bg-surface-dark border-white/10 text-primary'}`}
            >
              <span className="material-symbols-outlined text-lg">{viewMode === 'list' ? 'map' : 'format_list_bulleted'}</span>
            </button>

            {role ? (


              <button onClick={() => navigate('/profile')} className="size-10 rounded-xl border border-white/10 bg-surface-dark flex items-center justify-center overflow-hidden active:scale-95 transition-transform mr-2">
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
                <div key={salon.id} onClick={() => navigate(`/salon/${salon.slug_publico}`)} className="bg-surface-dark border border-white/5 rounded-[32px] overflow-hidden shadow-xl active:scale-[0.98] transition-all">
                  <div className="h-40 w-full relative">
                    <img src={salon.banner_url} className="size-full object-cover grayscale opacity-40" alt={salon.nome} />
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-white font-black text-[9px] border border-white/10">{salon.rating} ★</div>
                  </div>
                  <div className="p-5 flex items-center gap-4">
                    <img src={salon.logo_url} className="size-10 rounded-xl object-cover border border-white/5" alt="Logo" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-display font-black text-sm italic truncate">{salon.nome}</h4>
                      <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest">{salon.segmento} • {salon.distancia || 'Próximo'}</p>
                    </div>
                    <span className="material-symbols-outlined text-primary">arrow_forward</span>
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
            {/* Force a specific height for Leaflet container to render */}
            <div className="h-full w-full absolute inset-0">
              <MapContainer
                center={[coords.lat, coords.lng]}
                zoom={13}
                style={{ height: '100%', width: '100%', background: '#0c0d10' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  className="map-tiles"
                />
                <RecenterMap lat={coords.lat} lng={coords.lng} />

                {filteredSalons.map((salon) => (
                  <Marker
                    key={salon.id}
                    position={[salon.location.lat, salon.location.lng]}
                    eventHandlers={{
                      click: () => setSelectedSalonId(salon.id),
                    }}
                  >
                    <Popup className="premium-popup">
                      <div className="text-background-dark p-2 min-w-[120px]">
                        <h4 className="font-black text-[10px] uppercase tracking-tighter leading-tight mb-1">{salon.nome}</h4>
                        <p className="text-[8px] text-slate-600 mb-2 font-bold uppercase">{salon.segmento}</p>
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
                    <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest mt-0.5">{selectedSalon.segmento} • {selectedSalon.distancia || 'Próximo'}</p>
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
