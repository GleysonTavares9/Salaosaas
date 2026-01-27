
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Salon, BusinessSegment } from '../../types.ts';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

interface LandingProps {
  salons: Salon[];
}

// Helper to recenter map
const RecenterMap: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 13);
  }, [lat, lng, map]);
  return null;
};

// Custom salon marker factory with Luxe Aura branding
const createSalonIcon = (logoUrl: string) => L.divIcon({
  className: 'custom-salon-marker',
  html: `<div class="relative flex flex-col items-center group">
           <!-- Pin Body (Teardrop Shape) -->
           <div class="w-8 h-8 bg-[#c1a571] rounded-full rounded-bl-none rotate-[-45deg] flex items-center justify-center shadow-lg border border-white/20 transition-transform group-hover:scale-110 duration-300">
             <!-- Inner Circle for Logo -->
             <div class="w-6 h-6 bg-white rounded-full rotate-[45deg] overflow-hidden flex items-center justify-center border border-black/5">
               <img src="${logoUrl}" class="w-full h-full object-cover" alt="logo" />
             </div>
           </div>
           <!-- Small Glow -->
           <div class="absolute -bottom-0.5 w-1.5 h-0.5 bg-[#c1a571]/40 rounded-full blur-[1px]"></div>
         </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// Custom Cluster Icon Factory
const createClusterCustomIcon = (cluster: any) => {
  return L.divIcon({
    html: `<div class="size-8 rounded-full gold-gradient border border-background-dark shadow-xl flex items-center justify-center text-background-dark font-black text-[10px]">
             ${cluster.getChildCount()}
           </div>`,
    className: 'custom-marker-cluster',
    iconSize: L.point(32, 32, true),
  });
};

const Landing: React.FC<LandingProps> = ({ salons }) => {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<string>("Buscando...");
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: -19.9167, lng: -43.9345 }); // Default BH
  const [activeSegment, setActiveSegment] = useState<BusinessSegment | 'Todos'>('Todos');
  const [selectedSalonId, setSelectedSalonId] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  const filteredSalons = useMemo(() => {
    return salons.filter(s => activeSegment === 'Todos' || s.segmento === activeSegment);
  }, [salons, activeSegment]);

  const selectedSalon = useMemo(() =>
    salons.find(s => s.id === selectedSalonId),
    [salons, selectedSalonId]);

  return (
    <div className="h-full bg-background-dark flex flex-col relative overflow-hidden animate-fade-in">

      {/* MAPA REAL (Leaflet) DE FUNDO */}
      <div className="absolute inset-0 z-0 bg-[#0c0d10]">
        <div className="h-full w-full">
          <MapContainer
            center={[coords.lat, coords.lng]}
            zoom={13}
            zoomControl={false}
            attributionControl={false}
            style={{ height: '100%', width: '100%', background: '#0c0d10' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <RecenterMap lat={coords.lat} lng={coords.lng} />

            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={createClusterCustomIcon}
              maxClusterRadius={40}
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
            >
              {filteredSalons.map((salon) => {
                const lat = salon.location?.lat || -19.91;
                const lng = salon.location?.lng || -43.93;

                if (!lat && !lng) return null;

                return (
                  <Marker
                    key={salon.id}
                    position={[lat, lng]}
                    icon={createSalonIcon(salon.logo_url)}
                    eventHandlers={{
                      click: () => setSelectedSalonId(salon.id),
                    }}
                  />
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>

      {/* OVERLAY DE INTERFACE */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        <header className="p-6 pt-12 flex items-center justify-between bg-gradient-to-b from-background-dark via-background-dark/40 to-transparent pointer-events-auto">
          <div>
            <h1 className="text-xl font-display font-black text-white italic tracking-tighter leading-none mb-1">Luxe Aura</h1>
            <p className="text-[7px] text-slate-500 font-black uppercase tracking-[0.2em]">{userLocation}</p>
          </div>
          <button onClick={() => navigate('/login')} className="size-10 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-primary pointer-events-auto active:scale-95 transition-all shadow-xl">
            <span className="material-symbols-outlined text-xl">storefront</span>
          </button>
        </header>

        <div className="px-6 flex gap-2 overflow-x-auto no-scrollbar py-2 pointer-events-auto shrink-0 mt-2">
          {['Todos', 'Salão', 'Spa', 'Barba', 'Estética'].map(seg => (
            <button key={seg} onClick={() => { setActiveSegment(seg as any); setSelectedSalonId(null); }} className={`px-4 py-2 rounded-lg text-[7px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${activeSegment === seg ? 'gold-gradient text-background-dark border-primary shadow-lg' : 'bg-surface-dark/60 backdrop-blur-sm text-slate-500 border-white/5'}`}>
              {seg}
            </button>
          ))}
        </div>

        <div className="flex-1"></div>

        {/* RODAPÉ DE AÇÃO FIXO NA BASE */}
        <div className="p-6 pb-12 flex flex-col gap-4 bg-gradient-to-t from-background-dark via-background-dark/80 to-transparent pointer-events-auto">
          {selectedSalon ? (
            <div onClick={() => navigate(`/salon/${selectedSalon.slug_publico}`)} className="bg-surface-dark/95 backdrop-blur-xl border border-primary/30 rounded-[28px] p-4 shadow-2xl flex gap-4 items-center animate-fade-in pointer-events-auto cursor-pointer active:scale-95 transition-all">
              <img src={selectedSalon.logo_url} className="size-14 rounded-xl object-cover border border-white/10 shadow-lg" alt="Salon" />
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-display font-black text-sm italic truncate">{selectedSalon.nome}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-primary font-black text-[8px] tracking-widest">{selectedSalon.rating} ★</span>
                  <span className="text-slate-500 text-[7px] font-black uppercase tracking-widest truncate">{selectedSalon.distancia || 'Disponível'}</span>
                </div>
              </div>
              <div className="size-10 rounded-full gold-gradient flex items-center justify-center text-background-dark shadow-xl">
                <span className="material-symbols-outlined text-lg font-black">arrow_forward</span>
              </div>
            </div>
          ) : (
            <button onClick={() => navigate('/explore')} className="w-full bg-surface-dark/90 backdrop-blur-xl text-white py-5 rounded-[24px] border border-white/10 flex items-center justify-between px-6 shadow-2xl pointer-events-auto active:scale-95 transition-all">
              <div className="text-left">
                <p className="text-[7px] font-black text-primary uppercase tracking-[0.4em] mb-1">Catálogo Elite</p>
                <h3 className="text-[12px] font-display font-black italic">Explorar Lista Completa</h3>
              </div>
              <div className="size-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl text-primary">format_list_bulleted</span>
              </div>
            </button>
          )}
          <footer className="text-center opacity-30 mt-2">
            <p className="text-[6px] font-black text-white uppercase tracking-[0.6em]">Luxe Aura Ecosystem &copy; 2026</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Landing;
