

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Service, Product, ViewRole } from '../../types.ts';
import { api } from '../../lib/api';

interface SelectServiceProps {
  bookingDraft: any;
  setBookingDraft: React.Dispatch<React.SetStateAction<any>>;
  role: ViewRole | null;
}

const SelectService: React.FC<SelectServiceProps> = ({ bookingDraft, setBookingDraft, role }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'services' | 'products'>('services');
  const [salonServices, setSalonServices] = useState<Service[]>([]);
  const [salonProducts, setSalonProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Defensive access
  const servicesInDraft = bookingDraft?.services || [];
  const productsInDraft = bookingDraft?.products || [];

  const selectedServiceIds = servicesInDraft.map((s: Service) => s.id);
  const selectedProductIds = productsInDraft.map((p: Product) => p.id);

  useEffect(() => {
    if (bookingDraft?.salonId) {
      setIsLoading(true);
      Promise.all([
        api.services.getBySalon(bookingDraft.salonId),
        api.products.getBySalon(bookingDraft.salonId)
      ]).then(([services, products]) => {
        setSalonServices(services);
        setSalonProducts(products);
        setIsLoading(false);
      }).catch(err => {
        console.error('Error loading services/products:', err);
        setIsLoading(false);
      });
    }
  }, [bookingDraft?.salonId]);

  const toggleService = (service: Service) => {
    const isSelected = selectedServiceIds.includes(service.id);
    let newServices = isSelected
      ? servicesInDraft.filter((s: Service) => s.id !== service.id)
      : [...servicesInDraft, service];
    setBookingDraft({ ...bookingDraft, services: newServices });
  };

  const toggleProduct = (product: Product) => {
    const isSelected = selectedProductIds.includes(product.id);
    let newProducts = isSelected
      ? productsInDraft.filter((p: Product) => p.id !== product.id)
      : [...productsInDraft, product];
    setBookingDraft({ ...bookingDraft, products: newProducts });
  };

  const handleNext = () => {
    if (!role) {
      navigate('/login-user');
      return;
    }

    if (servicesInDraft.length > 0) {
      navigate('/choose-time');
    } else {
      navigate('/checkout');
    }
  };

  const totalPrice =
    servicesInDraft.reduce((acc: number, curr: Service) => acc + curr.price, 0) +
    productsInDraft.reduce((acc: number, curr: Product) => acc + curr.price, 0);

  const itemCount = servicesInDraft.length + productsInDraft.length;

  return (
    <div className="flex-1 overflow-y-auto h-full no-scrollbar bg-background-dark relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] pointer-events-none"></div>

      <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-3xl px-6 pt-12 pb-10 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto w-full text-center">
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => navigate(-1)} className="size-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div className="text-center">
              <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none" style={{ fontSize: 'var(--step-1)' }}>
                Curadoria Elite
              </h1>
              <p className="text-[7px] text-primary font-black uppercase tracking-[0.4em] mt-3">Personalize seu Ritual de Luxo</p>
            </div>
            <div className="size-12 opacity-0 pointer-events-none"></div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto w-full px-6 py-12 lg:py-20 animate-fade-in relative z-10">
        <div className="max-w-[1000px] mx-auto w-full">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-40">
              <div className="size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-10"></div>
              <p className="text-[11px] font-black uppercase tracking-[0.5em] text-primary animate-pulse">Sincronizando Opções Elite...</p>
            </div>
          ) : (
            <div className="space-y-20">
              <section className="space-y-12">
                <div className="flex items-center gap-6 px-4">
                  <div className="h-0.5 w-12 bg-primary"></div>
                  <h2 className="text-[11px] lg:text-xs font-black uppercase tracking-[0.5em] text-primary">Rituais de Assinatura</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 animate-fade-in">
                  {salonServices.length > 0 ? salonServices.map(s => {
                    const isSelected = selectedServiceIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleService(s)}
                        className={`group relative bg-surface-dark/40 rounded-[56px] border border-white/5 p-8 lg:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.4)] transition-all active:scale-[0.98] cursor-pointer backdrop-blur-3xl overflow-hidden
                          ${isSelected ? 'border-primary/40 ring-4 ring-primary/10' : 'hover:border-white/10'}
                        `}
                      >
                        <div className="flex flex-col sm:flex-row gap-8 lg:gap-10 items-center sm:items-start text-center sm:text-left">
                          <div className="relative shrink-0">
                            <div className="size-28 lg:size-32 rounded-[40px] overflow-hidden border-2 border-white/5 shadow-2xl relative">
                              <img src={s.image} className="size-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt={s.name} />
                              <div className="absolute inset-0 bg-gradient-to-t from-background-dark/40 to-transparent"></div>
                            </div>
                            {isSelected && (
                              <div className="absolute -top-3 -right-3 size-10 rounded-2xl gold-gradient flex items-center justify-center text-background-dark shadow-gold animate-bounce">
                                <span className="material-symbols-outlined text-xl font-black">check</span>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 space-y-4">
                            <h3 className="font-display text-2xl lg:text-3xl font-black text-white italic tracking-tighter uppercase leading-none group-hover:text-primary transition-colors">{s.name}</h3>
                            <div className="flex items-center justify-center sm:justify-start gap-4">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">{s.duration_min} MINUTOS</span>
                              <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/10">{s.category}</span>
                            </div>

                            <div className="pt-6 flex items-center justify-between border-t border-white/5">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none mb-2">Valor do Ritual</span>
                                <span className="text-3xl font-display font-black text-white italic tracking-tight">R$ {s.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className={`size-14 rounded-2xl border flex items-center justify-center transition-all duration-500
                                 ${isSelected ? 'gold-gradient text-background-dark border-transparent shadow-gold' : 'bg-white/5 border-white/10 text-slate-600 group-hover:border-primary/40 group-hover:text-primary'}
                               `}>
                                <span className="material-symbols-outlined text-xl font-black">{isSelected ? 'verified' : 'add'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="col-span-full py-32 text-center bg-surface-dark/20 border border-dashed border-white/5 rounded-[56px] flex flex-col items-center gap-6">
                      <span className="material-symbols-outlined text-5xl text-slate-800">event_busy</span>
                      <p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-700">Nenhum ritual cadastrado nesta unidade.</p>
                    </div>
                  )}
                </div>
              </section>

              {salonProducts.length > 0 && (
                <section className="space-y-12">
                  <div className="flex items-center gap-6 px-4">
                    <div className="h-0.5 w-12 bg-slate-800"></div>
                    <h2 className="text-[11px] lg:text-xs font-black uppercase tracking-[0.5em] text-slate-600">Boutique Complementar</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 animate-fade-in">
                    {salonProducts.map(p => {
                      const isSelected = selectedProductIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleProduct(p)}
                          className={`group relative bg-surface-dark/40 rounded-[56px] border border-white/5 p-8 lg:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.4)] transition-all active:scale-[0.98] cursor-pointer backdrop-blur-3xl overflow-hidden
                            ${isSelected ? 'border-primary/40 ring-4 ring-primary/10' : 'hover:border-white/10'}
                          `}
                        >
                          <div className="flex flex-col sm:flex-row gap-8 lg:gap-10 items-center sm:items-start text-center sm:text-left">
                            <div className="relative shrink-0">
                              <div className="size-28 lg:size-32 rounded-[40px] overflow-hidden border-2 border-white/5 shadow-2xl relative">
                                <img src={p.image} className="size-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt={p.name} />
                                <div className="absolute inset-0 bg-gradient-to-t from-background-dark/40 to-transparent"></div>
                              </div>
                              {isSelected && (
                                <div className="absolute -top-3 -right-3 size-10 rounded-2xl gold-gradient flex items-center justify-center text-background-dark shadow-gold animate-bounce">
                                  <span className="material-symbols-outlined text-xl font-black">check</span>
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0 space-y-4">
                              <h3 className="font-display text-2xl lg:text-3xl font-black text-white italic tracking-tighter uppercase leading-none group-hover:text-primary transition-colors">{p.name}</h3>
                              <div className="flex items-center justify-center sm:justify-start gap-4">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">{p.category}</span>
                                <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/10">ESTOQUE SELECT</span>
                              </div>

                              <div className="pt-6 flex items-center justify-between border-t border-white/5">
                                <div className="flex flex-col">
                                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none mb-2">Preço de Ativo</span>
                                  <span className="text-3xl font-display font-black text-white italic tracking-tight">R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className={`size-14 rounded-2xl border flex items-center justify-center transition-all duration-500
                                   ${isSelected ? 'gold-gradient text-background-dark border-transparent shadow-gold' : 'bg-white/5 border-white/10 text-slate-600 group-hover:border-primary/40 group-hover:text-primary'}
                                 `}>
                                  <span className="material-symbols-outlined text-xl font-black">{isSelected ? 'verified' : 'add'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      {itemCount > 0 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] w-full max-w-xl px-6 animate-fade-in">
          <button
            onClick={handleNext}
            className="w-full gold-gradient text-background-dark h-24 rounded-[32px] flex items-center justify-between px-10 shadow-gold active:scale-95 transition-all group overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <div className="relative z-10 flex items-center gap-6 text-left">
              <div className="size-14 rounded-2xl bg-background-dark/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl font-black">shopping_bag</span>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.4em] font-black opacity-60 mb-1">{itemCount} {itemCount === 1 ? 'RITUAL' : 'RITUAIS'} NA SACOLA</p>
                <p className="text-2xl font-display font-black italic">R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="relative z-10 flex items-center gap-4">
              <span className="text-[10px] uppercase font-black tracking-[0.4em]">
                {!role ? 'ACESSO ELITE' : (servicesInDraft.length > 0 ? 'HORÁRIO' : 'FINALIZAR')}
              </span>
              <span className="material-symbols-outlined text-2xl font-black group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default SelectService;
