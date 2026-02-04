
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Service, Salon } from '../../types';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface ServiceCatalogProps {
  salon?: Salon;
}

const ServiceCatalog: React.FC<ServiceCatalogProps> = ({ salon }) => {
  const salonId = salon?.id;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [activeCategory, setActiveCategory] = useState('Todos');
  const categories = ['Todos', 'Cabelo', 'Barba', 'Unhas', 'Estética', 'Sobrancelha', 'Estilo', 'Outros'];

  const initialServiceState = {
    name: '',
    duration_min: 30,
    price: 0,
    category: 'Cabelo',
    description: '',
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=400'
  };

  const [newService, setNewService] = useState(initialServiceState);

  const [billingInfo, setBillingInfo] = useState<any>(null);

  useEffect(() => {
    if (salonId) {
      api.services.getBySalon(salonId).then(data => {
        setServices(data || []);
      }).catch(() => { });

      api.salons.getBilling(salonId).then(info => {
        if (info) setBillingInfo(info);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [salonId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId) {
      showToast("Erro: ID do salão não encontrado.", "error");
      return;
    }
    try {
      setIsLoading(true);
      if (editingService) {
        const updated = await api.services.update(editingService.id, newService);
        setServices(services.map(s => s.id === updated.id ? updated : s));
        showToast("✨ Ritual atualizado!", 'success');
      } else {
        // Bloqueio de Plano (Limite Dinâmico do Banco)
        const maxServices = billingInfo?.limits?.max_services || 10;
        const isTrial = billingInfo?.is_trial_active;

        if (!isTrial && services.length >= maxServices) {
          showToast(`Limite de ${maxServices} rituais atingido no seu plano atual. Faça upgrade!`, 'error');
          setIsLoading(false);
          return;
        }

        const created = await api.services.create({
          ...newService,
          salon_id: salonId
        });
        setServices([created, ...services]);
        showToast("✨ Ritual criado!", 'success');
      }
      setIsAdding(false);
      setEditingService(null);
      setNewService(initialServiceState);
    } catch (error: any) {
      showToast("Erro ao processar ritual: " + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este ritual? Esta ação é permanente.")) return;
    try {
      await api.services.delete(id);
      setServices(services.filter(s => s.id !== id));
      showToast("🗑️ Ritual removido.", 'success');
    } catch (error: any) {
      showToast("Erro ao excluir: " + error.message, 'error');
    }
  };

  const openEdit = (s: Service) => {
    setEditingService(s);
    setNewService({
      name: s.name,
      duration_min: s.duration_min,
      price: s.price,
      category: s.category || 'Outros',
      description: s.description || '',
      image: s.image || initialServiceState.image
    });
    setIsAdding(true);
  };

  return (
    <div className="flex-1 bg-background-dark overflow-y-auto h-full no-scrollbar">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-md px-6 pt-12 pb-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight text-white italic uppercase tracking-tighter">Rituais & Estética</h1>
            <p className="text-primary text-[8px] font-black uppercase tracking-[0.2em] mt-1">Gestão de Catálogo de Serviços</p>
          </div>
          <button onClick={() => navigate('/pro')} className="size-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white active:scale-95 transition-all shadow-xl">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        </div>

        {/* Category Filters for uniformity with ProductCatalog */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-6">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${activeCategory === cat
                ? 'bg-primary text-background-dark border-primary shadow-lg shadow-primary/20'
                : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/10'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <main className="px-6 py-8 pb-40 max-w-[450px] mx-auto">
        <div className="mb-8">
          <button
            onClick={() => setIsAdding(true)}
            className="w-full bg-white/5 border border-dashed border-white/10 rounded-[32px] py-8 flex flex-col items-center justify-center gap-3 group hover:border-primary/20 hover:bg-white/[0.07] transition-all active:scale-[0.98]"
          >
            <div className="size-12 rounded-full gold-gradient flex items-center justify-center text-background-dark shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined font-black">add</span>
            </div>
            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Adicionar Novo Ritual</span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-20 text-center flex flex-col items-center">
            <div className="size-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {services.filter(s => activeCategory === 'Todos' || s.category === activeCategory).map((s) => (
              <div key={s.id} className="group relative bg-surface-dark/60 p-5 rounded-[32px] border border-white/5 shadow-xl hover:border-primary/20 transition-all">
                <div className="flex items-center gap-5">
                  <div className="size-20 rounded-2xl overflow-hidden shrink-0 border border-white/5 shadow-inner relative">
                    <img src={s.image} className="size-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500" alt={s.name} />
                    <div className="absolute inset-x-0 bottom-0 bg-black/40 backdrop-blur-md py-1">
                      <p className="text-[7px] text-white font-black text-center uppercase tracking-widest">{s.category}</p>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-display text-base font-black text-white italic tracking-tight truncate uppercase leading-tight">{s.name}</h4>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg border border-white/10">
                        <span className="material-symbols-outlined text-[10px] text-primary">schedule</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{s.duration_min} min</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-3">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none text-right">Ritual</p>
                      <p className="text-xl font-display font-black text-primary tracking-tight italic leading-none text-right">R$ {s.price.toFixed(2)}</p>
                    </div>
                    {/* Botões de Ação */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(s)}
                        className="size-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-white/5"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="size-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all border border-white/5"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {services.filter(s => activeCategory === 'Todos' || s.category === activeCategory).length === 0 && !isAdding && (
              <div className="py-20 text-center flex flex-col items-center opacity-30">
                <span className="material-symbols-outlined text-6xl mb-4 text-slate-600">content_paste_off</span>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nenhum ritual cadastrado</p>
              </div>
            )}
          </div>
        )}
      </main>

      {isAdding && (
        <div className="fixed inset-0 z-[60] bg-background-dark/95 backdrop-blur-xl animate-fade-in flex flex-col items-center overflow-hidden">
          <div className="flex-1 flex flex-col bg-background-dark max-w-[450px] w-full h-full">
            <header className="p-8 flex items-center justify-between">
              <h2 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">
                {editingService ? 'Ajustar Ritual' : 'Novo Ritual'}
              </h2>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingService(null);
                  setNewService(initialServiceState);
                }}
                className="text-slate-500"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            <form onSubmit={handleCreate} className="p-8 flex-1 overflow-y-auto space-y-6 pb-40 min-h-0">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome</label>
                <input type="text" required value={newService.name} onChange={e => setNewService({ ...newService, name: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newService.price || ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setNewService({ ...newService, price: isNaN(val) ? 0 : val });
                    }}
                    className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tempo (min)</label>
                  <input
                    type="number"
                    required
                    value={newService.duration_min || ''}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      setNewService({ ...newService, duration_min: isNaN(val) ? 0 : val });
                    }}
                    className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoria de Ritual</label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.filter(c => c !== 'Todos').map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewService({ ...newService, category: c })}
                      className={`py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border ${newService.category === c
                        ? 'bg-primary/20 text-primary border-primary shadow-inner'
                        : 'bg-surface-dark border-white/5 text-slate-500'
                        }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Imagem do Ritual</label>
                <div className="flex items-center gap-6">
                  <div className="size-24 rounded-3xl bg-surface-dark border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {newService.image ? (
                      <img src={newService.image} className="size-full object-cover" alt="Preview" />
                    ) : (
                      <span className="material-symbols-outlined text-slate-700 text-3xl">add_a_photo</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      id="service-image"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            setIsLoading(true);
                            const publicUrl = await api.storage.upload(file);
                            setNewService({ ...newService, image: publicUrl });
                            showToast("Imagem enviada!", "success");
                          } catch (err: any) {
                            showToast("Erro no upload: " + err.message, "error");
                          } finally {
                            setIsLoading(false);
                          }
                        }
                      }}
                    />
                    <label htmlFor="service-image" className="inline-block px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-white uppercase tracking-widest cursor-pointer hover:bg-white/10 active:scale-95 transition-all">
                      {newService.image ? 'Alterar Foto' : 'Selecionar Arquivo'}
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" disabled={isLoading} className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                  {isLoading ? <div className="size-4 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div> : 'Criar Ritual'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ServiceCatalog;
