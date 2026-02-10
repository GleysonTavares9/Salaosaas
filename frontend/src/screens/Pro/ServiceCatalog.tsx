
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);

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

  const confirmDelete = async () => {
    if (!serviceToDelete) return;
    try {
      setIsLoading(true);
      await api.services.delete(serviceToDelete);
      setServices(services.filter(s => s.id !== serviceToDelete));
      showToast("🗑️ Ritual removido.", 'success');
      setShowDeleteConfirm(false);
      setServiceToDelete(null);
    } catch (error: any) {
      showToast("Erro ao excluir: " + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setServiceToDelete(id);
    setShowDeleteConfirm(true);
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
    <div className="flex-1 overflow-y-auto h-full no-scrollbar bg-background-dark relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] pointer-events-none"></div>

      <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-3xl px-4 lg:px-6 pt-2 lg:pt-12 pb-2 lg:pb-10 border-b border-white/5">
        <div className="max-w-full max-w-[1400px] mx-auto w-full">
          <div className="flex items-center justify-between mb-3 lg:mb-12 px-2">
            <button onClick={() => navigate('/pro')} className="size-9 lg:size-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div className="text-center">
              <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none text-base lg:text-2xl">
                Curadoria de Rituais
              </h1>
              <p className="text-[7px] text-primary font-black uppercase tracking-[0.4em] mt-1 lg:mt-3">Catálogo de Alta Estética</p>
            </div>
            <div className="size-9 lg:size-12 opacity-0 pointer-events-none"></div>
          </div>

          <div className="flex gap-2 lg:gap-4 overflow-x-auto no-scrollbar pb-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 lg:px-8 py-2.5 lg:py-4 rounded-xl text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border ${activeCategory === cat
                  ? 'gold-gradient text-background-dark border-transparent shadow-gold-sm'
                  : 'bg-surface-dark/40 text-slate-500 border-white/5 hover:border-white/10'
                  }`}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-full max-w-[1400px] mx-auto w-full px-6 sm:px-6 lg:px-6 py-12 sm:py-12 lg:py-12 lg:py-20 sm:py-20 lg:py-20 space-y-16 pb-40 animate-fade-in relative z-10">
        <div className="flex justify-center">
          <button
            onClick={() => setIsAdding(true)}
            className="w-full max-w-full sm:max-w-xl group relative p-[2px] rounded-2xl sm:rounded-3xl lg:rounded-[48px] active:scale-95 transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/40 to-primary/10 animate-pulse"></div>
            <div className="relative bg-background-dark/90 rounded-2xl sm:rounded-3xl lg:rounded-[46px] py-10 sm:py-10 lg:py-10 lg:py-14 sm:py-14 lg:py-14 flex flex-col items-center justify-center gap-6 lg:gap-6 backdrop-blur-3xl group-hover:bg-background-dark/70 transition-colors">
              <div className="size-14 sm:size-16 lg:size-20 rounded-2xl sm:rounded-3xl lg:rounded-[32px] gold-gradient flex items-center justify-center text-background-dark shadow-gold group-hover:scale-110 transition-all duration-500">
                <span className="material-symbols-outlined text-4xl lg:text-4xl font-black">spa</span>
              </div>
              <div className="text-center">
                <span className="text-[11px] font-black text-white uppercase tracking-[0.5em]">Consagrar Novo Ritual</span>
                <p className="text-[7px] text-primary/60 font-black uppercase tracking-[0.3em] mt-3">Expanda o Portfólio de Luxo</p>
              </div>
            </div>
          </button>
        </div>

        {isLoading ? (
          <div className="py-40 sm:py-40 lg:py-40 text-center flex flex-col items-center">
            <div className="size-10 sm:size-12 lg:size-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 lg:gap-8">
            {services.filter(s => activeCategory === 'Todos' || s.category === activeCategory).map((s) => (
              <div key={s.id} className="group relative bg-surface-dark/40 rounded-2xl lg:rounded-[40px] border border-white/5 p-6 lg:p-8 shadow-2xl transition-all hover:border-primary/20 backdrop-blur-xl overflow-hidden active:scale-[0.99]">
                <div className="flex flex-col gap-8 lg:gap-8">
                  <div className="relative aspect-[4/3] rounded-2xl sm:rounded-3xl lg:rounded-[40px] overflow-hidden border-2 border-white/5 shadow-2xl">
                    <img src={s.image} className="size-full object-cover grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt={s.name} />
                    <div className="absolute inset-0 bg-gradient-to-t from-background-dark/80 via-transparent to-transparent"></div>
                    <div className="absolute bottom-6 left-6 flex items-center gap-3 lg:gap-3">
                      <span className="bg-primary/20 backdrop-blur-md border border-primary/30 px-4 sm:px-4 lg:px-4 py-2 sm:py-2 lg:py-2 rounded-full text-[8px] font-black text-primary uppercase tracking-widest">{s.category}</span>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="font-display text-xl lg:text-2xl font-black text-white italic tracking-tighter uppercase leading-none truncate group-hover:text-primary transition-colors">{s.name}</h4>
                      <div className="flex items-center gap-4 mt-4">
                        <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded-xl border border-white/10">
                          <span className="material-symbols-outlined text-[12px] text-primary">schedule</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.duration_min} min</span>
                        </div>
                        <div className="h-4 w-px bg-white/10"></div>
                        <p className="text-xl lg:text-2xl font-display font-black text-white italic tracking-tight">R$ {s.price.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex gap-3 lg:gap-4 pt-4 lg:pt-6 border-t border-white/5 mt-auto">
                      <button
                        onClick={() => openEdit(s)}
                        className="flex-1 bg-white/[0.03] border border-white/5 rounded-xl lg:rounded-2xl py-3 lg:py-4 flex items-center justify-center gap-2 text-[9px] lg:text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/[0.08] active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-base">edit_note</span>
                        Ajustar
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="flex-1 bg-red-500/[0.02] border border-red-500/10 rounded-xl lg:rounded-2xl py-3 lg:py-4 flex items-center justify-center gap-2 text-[9px] lg:text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-500/[0.06] active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-base">delete_sweep</span>
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {services.filter(s => activeCategory === 'Todos' || s.category === activeCategory).length === 0 && !isAdding && (
              <div className="py-40 sm:py-40 lg:py-40 text-center flex flex-col items-center gap-6 lg:gap-6 col-span-full">
                <div className="size-14 sm:size-16 lg:size-20 rounded-2xl sm:rounded-3xl lg:rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-700">
                  <span className="material-symbols-outlined text-4xl lg:text-4xl">inventory_2</span>
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-600">Nenhum ritual consagrado nesta dimensão</p>
              </div>
            )}
          </div>
        )}
      </main>

      {isAdding && (
        <div className="fixed inset-0 z-[120] bg-background-dark/95 backdrop-blur-3xl animate-fade-in flex flex-col items-center overflow-hidden">
          <div className="flex-1 flex flex-col max-w-full max-w-[600px] w-full h-full relative">
            <header className="px-10 sm:px-10 lg:px-10 pt-16 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-2xl lg:text-2xl lg:text-3xl lg:text-3xl font-display font-black text-white italic tracking-tighter uppercase">
                  {editingService ? 'Refinar Ritual' : 'Consagrar Ritual'}
                </h2>
                <p className="text-[10px] text-primary font-black uppercase tracking-[0.4em] mt-2 leading-none">Alquimia de Serviços Aura</p>
              </div>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingService(null);
                  setNewService(initialServiceState);
                }}
                className="size-10 sm:size-12 lg:size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all"
              >
                <span className="material-symbols-outlined font-black">close</span>
              </button>
            </header>

            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-10 sm:p-10 lg:p-10 space-y-12 pb-60 no-scrollbar min-h-0">
              <div className="flex flex-col items-center gap-6 lg:gap-6">
                <div className="relative group shrink-0">
                  <div className="size-38 sm:size-40 lg:size-44 rounded-2xl sm:rounded-3xl lg:rounded-[50px] bg-cover bg-center border-2 border-dashed border-white/10 shadow-2xl overflow-hidden bg-surface-dark flex items-center justify-center relative" style={{ backgroundImage: newService.image ? `url('${newService.image}')` : 'none' }}>
                    {!newService.image && <span className="material-symbols-outlined text-slate-700 text-4xl sm:text-5xl lg:text-6xl lg:text-4xl sm:text-5xl lg:text-6xl">spa</span>}
                    <label htmlFor="service-image" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                      <span className="material-symbols-outlined text-white text-3xl lg:text-3xl font-black">add_a_photo</span>
                    </label>
                  </div>
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
                          showToast("Imagem integrada!", "success");
                        } catch (err: any) {
                          showToast("Falha no upload!", "error");
                        } finally {
                          setIsLoading(false);
                        }
                      }
                    }}
                  />
                </div>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Estética Visual</p>
              </div>

              <div className="space-y-10">
                <div className="relative">
                  <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest absolute -top-5 left-0">IDENTIDADE DO RITUAL</label>
                  <input type="text" required value={newService.name} onChange={e => setNewService({ ...newService, name: e.target.value })} className="w-full bg-transparent border-b-2 border-white/5 p-4 sm:p-4 lg:p-4 text-white text-2xl lg:text-2xl font-display font-black italic outline-none focus:border-primary transition-all" placeholder="EX: CORTE MAGNÉTICO" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-8">
                  <div className="bg-surface-dark border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[32px] p-8 sm:p-8 lg:p-8">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Investimento R$</p>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newService.price || ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setNewService({ ...newService, price: isNaN(val) ? 0 : val });
                      }}
                      className="text-4xl lg:text-4xl font-display font-black text-white italic bg-transparent outline-none w-full"
                    />
                  </div>
                  <div className="bg-surface-dark border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[32px] p-8 sm:p-8 lg:p-8">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Tempo Minutos</p>
                    <input
                      type="number"
                      required
                      value={newService.duration_min || ''}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        setNewService({ ...newService, duration_min: isNaN(val) ? 0 : val });
                      }}
                      className="text-4xl lg:text-4xl font-display font-black text-primary italic bg-transparent outline-none w-full"
                    />
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-2xl sm:rounded-3xl lg:rounded-[48px] p-10 sm:p-10 lg:p-10 space-y-8">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] text-center italic">Esfera de Especialidade</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-3">
                    {categories.filter(c => c !== 'Todos').map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewService({ ...newService, category: c })}
                        className={`py-5 sm:py-5 lg:py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${newService.category === c
                          ? 'gold-gradient text-background-dark border-transparent shadow-gold-sm'
                          : 'bg-background-dark/60 border-white/5 text-slate-500'
                          }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-10 sm:p-10 lg:p-10 bg-gradient-to-t from-background-dark via-background-dark to-transparent">
                <button type="submit" disabled={isLoading} className="w-full gold-gradient text-background-dark h-24 rounded-2xl sm:rounded-3xl lg:rounded-[32px] font-black shadow-[0_30px_70px_rgba(0,0,0,0.5)] uppercase tracking-[0.6em] text-[11px] lg:text-[13px] active:scale-95 transition-all hover:brightness-110 flex items-center justify-center gap-4 lg:gap-4">
                  {isLoading ? <div className="size-6 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div> : (editingService ? 'ATUALIZAR RITUAL' : 'CONSAGRAR RITUAL')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão Refinado */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-8 sm:p-8 lg:p-8 animate-fade-in text-center">
          <div className="bg-surface-dark border border-white/10 rounded-2xl sm:rounded-3xl lg:rounded-[48px] p-12 sm:p-14 lg:p-16 sm:p-12 sm:p-14 lg:p-16 lg:p-12 sm:p-14 lg:p-16 max-w-sm w-full shadow-3xl">
            <div className="size-14 sm:size-16 lg:size-20 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-8 animate-pulse">
              <span className="material-symbols-outlined text-4xl lg:text-4xl">warning</span>
            </div>
            <h3 className="text-2xl lg:text-2xl font-display font-black text-white italic mb-4 uppercase tracking-tighter">Banir Ritual?</h3>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed mb-10">Este ritual será expurgado do catálogo permanentemente.</p>
            <div className="flex flex-col gap-4 lg:gap-4">
              <button
                onClick={confirmDelete}
                disabled={isLoading}
                className="w-full bg-red-500 text-white h-16 rounded-2xl font-black uppercase tracking-[0.4em] text-[10px] shadow-2xl active:scale-95 transition-all"
              >
                {isLoading ? 'EXPURGANDO...' : 'CONFIRMAR EXCLUSÃO'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setServiceToDelete(null);
                }}
                disabled={isLoading}
                className="w-full bg-white/5 border border-white/10 text-white h-16 rounded-2xl font-black uppercase tracking-[0.4em] text-[10px]"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ServiceCatalog;
