import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Salon, BusinessSegment } from '../../types.ts';
import L from 'leaflet';

const AuraMap = lazy(() => import('../../components/AuraMap'));

interface LandingProps {
  salons: Salon[];
}

// Custom salon marker factory with Luxe Aura branding
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

// Custom Cluster Icon Factory
const createClusterCustomIcon = (cluster: any) => {
  return L.divIcon({
    html: `<div class="size-11 rounded-full gold-gradient border-2 border-white shadow-[0_0_20px_rgba(193,165,113,0.8)] flex items-center justify-center text-background-dark font-black text-xs">
             ${cluster.getChildCount()}
           </div>`,
    className: 'custom-marker-cluster',
    iconSize: L.point(44, 44, true),
  });
};

const Landing: React.FC<LandingProps> = ({ salons }) => {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<string>("Brasil");
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: -19.9167, lng: -43.9345 }); // Default BH
  const [activeSegment, setActiveSegment] = useState<BusinessSegment | 'Todos'>('Todos');
  const [selectedSalonId, setSelectedSalonId] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Auto-detect and auto-center
  React.useEffect(() => {
    handleGetLocation();
  }, []);

  // Auto-center on salons if no location yet or detection failed
  React.useEffect(() => {
    if (salons.length > 0 && (userLocation === "Brasil" || userLocation === "Localização Padrão")) {
      const firstSalon = salons.find(s => s.location);
      if (firstSalon && firstSalon.location) {
        setCoords({ lat: firstSalon.location.lat, lng: firstSalon.location.lng });
      }
    }
  }, [salons, userLocation]);

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCoords({ lat: latitude, lng: longitude });
          setUserLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
          setIsLocating(false);
        },
        async (error) => {
          setUserLocation("Localização Padrão");
          setIsLocating(false);
          // Fallback: Center on first salon if available
          if (salons.length > 0 && salons[0].location) {
            setCoords({ lat: salons[0].location.lat, lng: salons[0].location.lng });
          }
        }
      );
    }
  };

  const filteredSalons = useMemo(() => {
    return salons.filter(s => activeSegment === 'Todos' || s.segmento === activeSegment);
  }, [salons, activeSegment]);

  const mapMarkers = useMemo(() => {
    return filteredSalons
      .filter(s => s.location && s.location.lat !== 0)
      .map(salon => ({
        id: salon.id,
        position: [salon.location!.lat, salon.location!.lng] as [number, number],
        icon: createSalonIcon(salon.logo_url),
        onClick: () => {
          setSelectedSalonId(salon.id);
          setCoords({ lat: salon.location!.lat, lng: salon.location!.lng });
        }
      }));
  }, [filteredSalons]);

  const selectedSalon = useMemo(() =>
    salons.find(s => s.id === selectedSalonId),
    [salons, selectedSalonId]);

  return (
    <div className="h-full bg-background-dark flex flex-col relative overflow-hidden animate-fade-in">

      {/* MAPA REAL (Leaflet) DE FUNDO */}
      <div className="absolute inset-0 z-0 bg-[#0c0d10]">
        <Suspense fallback={<div className="h-full w-full bg-[#0c0d10] animate-pulse" />}>
          <AuraMap
            center={[coords.lat, coords.lng]}
            zoom={13}
            markers={mapMarkers}
            clusterIconFactory={createClusterCustomIcon}
          />
        </Suspense>
      </div>

      {/* OVERLAY DE INTERFACE */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        <header className="p-6 pt-[calc(env(safe-area-inset-top)+1rem)] flex items-center justify-between bg-gradient-to-b from-background-dark via-background-dark/40 to-transparent pointer-events-auto lg:px-12 lg:pt-10">
          <div className="flex-1">
            <h1 className="font-display font-black text-white italic tracking-[0.1em] leading-none mb-2 uppercase" style={{ fontSize: 'var(--step-4)' }}>Luxe Aura</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={handleGetLocation}
                disabled={isLocating}
                className="flex items-center gap-2 group pointer-events-auto"
              >
                <div className={`size-2.5 rounded-full bg-primary ${isLocating ? 'animate-ping' : 'animate-pulse shadow-[0_0_10px_rgba(193,165,113,1)]'}`}></div>
                <p className="text-slate-500 font-black uppercase tracking-[0.3em]" style={{ fontSize: 'var(--step-0)', opacity: 0.8 }}>
                  {isLocating ? 'Sincronizando...' : userLocation}
                </p>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 lg:gap-6">
            <button onClick={() => navigate('/explore')} className="size-12 lg:size-20 rounded-2xl lg:rounded-[28px] bg-surface-dark border border-white/5 flex items-center justify-center text-slate-400 shadow-2xl active:scale-95 transition-all hover:bg-white/5 hover:text-white pointer-events-auto" title="Explorar Lista">
              <span className="material-symbols-outlined text-xl lg:text-4xl">explore</span>
            </button>
            <button onClick={() => navigate('/login')} className="size-12 lg:size-20 rounded-2xl lg:rounded-[28px] gold-gradient p-0.5 shadow-2xl cursor-pointer active:scale-95 transition-all hover:brightness-110 pointer-events-auto" title="Portal do Parceiro">
              <div className="w-full h-full rounded-[14px] lg:rounded-[26px] bg-background-dark flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-xl lg:text-4xl">storefront</span>
              </div>
            </button>
          </div>
        </header>

        <div className="px-6 lg:px-12 flex gap-2 lg:gap-3 overflow-x-auto no-scrollbar py-4 pointer-events-auto shrink-0 mt-2 lg:mt-4">
          {['Todos', 'Salão', 'Spa', 'Barba', 'Estética', 'Manicure', 'Sobrancelha'].map(seg => (
            <button key={seg} onClick={() => { setActiveSegment(seg as any); setSelectedSalonId(null); }} className={`px-4 py-2.5 lg:px-10 lg:py-4 rounded-xl lg:rounded-[24px] text-[9px] lg:text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all border ${activeSegment === seg ? 'gold-gradient text-background-dark border-transparent shadow-[0_10px_30px_rgba(193,165,113,0.3)] scale-105' : 'bg-surface-dark/40 text-slate-500 border-white/5 hover:bg-surface-dark hover:text-white hover:border-white/10'}`}>
              {seg}
            </button>
          ))}
        </div>

        <div className="flex-1"></div>

        {/* RODAPÉ DE AÇÃO FIXO NA BASE */}
        <div className="p-6 lg:p-12 pb-[calc(3rem+var(--sab))] flex flex-col gap-6 bg-gradient-to-t from-background-dark via-background-dark/80 to-transparent pointer-events-auto w-full">
          {selectedSalon ? (
            <div onClick={() => navigate(`/salon/${selectedSalon.slug_publico}`)} className="w-full max-w-xl mx-auto bg-surface-dark/95 backdrop-blur-3xl border border-primary/30 rounded-[32px] p-5 lg:p-6 shadow-2xl flex gap-4 lg:gap-6 items-center animate-fade-in pointer-events-auto cursor-pointer active:scale-95 transition-all hover:border-primary/50">
              <img src={selectedSalon.logo_url} className="size-16 lg:size-20 rounded-2xl lg:rounded-[24px] object-cover border-2 border-primary/20 shadow-2xl" alt="Salon" />
              <div className="flex-1 min-w-0">
                <p className="text-primary font-black uppercase tracking-widest mb-1" style={{ fontSize: 'var(--step-0)', transform: 'scale(0.8)', transformOrigin: 'left' }}>{selectedSalon.segmento}</p>
                <h3 className="text-white font-display font-black italic truncate lowercase" style={{ fontSize: 'var(--step-2)' }}>{selectedSalon.nome}</h3>
                <div className="flex items-center gap-3 mt-1 lg:mt-2">
                  <span className="px-2 py-0.5 bg-primary/20 text-primary rounded-md text-[8px] lg:text-[10px] font-black uppercase tracking-widest">★ 5.0</span>
                  <span className="text-slate-500 text-[8px] lg:text-[10px] font-black uppercase tracking-widest truncate">{selectedSalon.distancia || 'Elite Member'}</span>
                </div>
              </div>
              <div className="size-12 lg:size-16 rounded-full gold-gradient flex items-center justify-center text-background-dark shadow-2xl shrink-0">
                <span className="material-symbols-outlined text-xl lg:text-2xl font-black">arrow_forward</span>
              </div>
            </div>
          ) : (
            <button onClick={() => navigate('/explore')} className="w-full max-w-2xl mx-auto bg-surface-dark/90 backdrop-blur-3xl text-white py-6 lg:py-8 rounded-[32px] lg:rounded-[40px] border border-white/10 flex items-center justify-between px-8 lg:px-10 shadow-2xl pointer-events-auto active:scale-95 transition-all hover:bg-white/5 hover:border-primary/20">
              <div className="text-left">
                <p className="font-black text-primary uppercase tracking-[0.4em] mb-1" style={{ fontSize: 'var(--step-0)', transform: 'scale(0.8)', transformOrigin: 'left' }}>Ecossistema Luxe Aura</p>
                <h3 className="font-display font-black italic tracking-tight" style={{ fontSize: 'var(--step-2)' }}>Ver Todos os Estabelecimentos</h3>
              </div>
              <div className="size-12 lg:size-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-2xl lg:text-3xl text-primary">format_list_bulleted</span>
              </div>
            </button>
          )}
          <footer className="text-center opacity-40 mt-4">
            <p className="text-[8px] font-black text-white uppercase tracking-[0.6em] italic">Luxe Aura Premium Ecosystem &copy; 2026</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Landing;
