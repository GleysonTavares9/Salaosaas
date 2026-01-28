
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Service } from '../../types';
import { api } from '../../lib/api';

interface ServiceCatalogProps {
  salonId?: string;
}

const ServiceCatalog: React.FC<ServiceCatalogProps> = ({ salonId }) => {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const [newService, setNewService] = useState({
    name: '',
    duration_min: 30,
    price: 0,
    category: 'Cabelo',
    description: '',
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=400'
  });

  useEffect(() => {
    if (salonId) {
      api.services.getBySalon(salonId).then(data => {
        setServices(data || []);
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [salonId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId) return;
    try {
      const created = await api.services.create({
        ...newService,
        salon_id: salonId
      });
      setServices([created, ...services]);
      setIsAdding(false);
      setNewService({
        name: '',
        duration_min: 30,
        price: 0,
        category: 'Cabelo',
        description: '',
        image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=400'
      });
    } catch (error: any) {
      alert("Erro ao criar serviço: " + error.message);
    }
  };

  return (
    <div className="flex-1 bg-background-dark min-h-screen">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-md px-6 pt-12 pb-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight text-white italic">Rituais & Estética</h1>
            <p className="text-primary text-[8px] font-black uppercase tracking-[0.2em] mt-1">Gestão de Catálogo</p>
          </div>
          <button onClick={() => navigate('/pro')} className="size-10 rounded-full border border-white/5 bg-surface-dark flex items-center justify-center text-slate-400 active:scale-95 transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </header>

      <main className="px-6 py-8 pb-40 no-scrollbar overflow-y-auto max-w-[450px] mx-auto">
        {isLoading ? (
          <div className="py-20 text-center flex flex-col items-center">
            <div className="size-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {services.map((s) => (
              <div key={s.id} className="group flex items-center gap-5 bg-surface-dark p-6 rounded-[32px] border border-white/5 shadow-xl active:scale-[0.98] transition-all">
                <div className="size-16 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-inner">
                  <img src={s.image} className="size-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all" alt={s.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display text-base font-black text-white italic tracking-tight truncate">{s.name}</h4>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">schedule</span> {s.duration_min} min</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-display font-black text-primary tracking-tight italic">R$ {s.price.toFixed(2)}</p>
                </div>
              </div>
            ))}

            {services.length === 0 && !isAdding && (
              <div className="py-20 text-center flex flex-col items-center opacity-30">
                <span className="material-symbols-outlined text-6xl mb-4">menu_book</span>
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhum serviço cadastrado</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Overlay de Adicionar */}
      {isAdding && (
        <div className="fixed inset-0 z-[60] bg-background-dark/95 backdrop-blur-xl animate-fade-in flex flex-col">
          <header className="p-8 flex items-center justify-between">
            <h2 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">Novo Serviço</h2>
            <button onClick={() => setIsAdding(false)} className="text-slate-500"><span className="material-symbols-outlined">close</span></button>
          </header>
          <form onSubmit={handleCreate} className="p-8 flex-1 overflow-y-auto space-y-6 no-scrollbar pb-32">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome</label>
              <input type="text" required value={newService.name} onChange={e => setNewService({ ...newService, name: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Preço (R$)</label>
                <input type="number" step="0.01" required value={newService.price} onChange={e => setNewService({ ...newService, price: parseFloat(e.target.value) })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tempo (min)</label>
                <input type="number" required value={newService.duration_min} onChange={e => setNewService({ ...newService, duration_min: parseInt(e.target.value) })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoria</label>
              <select value={newService.category} onChange={e => setNewService({ ...newService, category: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none">
                <option>Cabelo</option>
                <option>Barba</option>
                <option>Unhas</option>
                <option>Estética</option>
                <option>Sobrancelha</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Foto URL (Unsplash)</label>
              <input type="text" value={newService.image} onChange={e => setNewService({ ...newService, image: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-[10px] outline-none" />
            </div>
            <button type="submit" className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs">Criar Ritual</button>
          </form>
        </div>
      )}

      <div className="fixed bottom-[110px] right-6 z-40">
        <button onClick={() => setIsAdding(true)} className="flex items-center gap-3 gold-gradient text-background-dark px-8 py-5 rounded-full shadow-[0_15px_40px_rgba(193,165,113,0.4)] active:scale-95 transition-all">
          <span className="material-symbols-outlined text-xl font-black">add</span>
          <span className="text-[10px] font-black uppercase tracking-[0.25em]">Novo Serviço</span>
        </button>
      </div>
    </div>
  );
};

export default ServiceCatalog;
