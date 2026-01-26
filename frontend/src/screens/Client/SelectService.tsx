

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
    <div className="flex-1 flex flex-col h-full bg-background-dark relative overflow-hidden">
      <header className="px-6 pt-12 pb-4 bg-background-dark/95 backdrop-blur-xl border-b border-white/5 z-50 shrink-0 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="size-10 rounded-xl border border-white/10 flex items-center justify-center text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-display text-base font-black text-white italic tracking-tighter uppercase">Itens da Reserva</h1>
        <div className="size-10"></div>
      </header>

      {/* TABS DE SELEÇÃO */}
      <nav className="bg-background-dark/95 px-6 pt-4 flex gap-8 border-b border-white/5 shrink-0 z-40">
        <button
          onClick={() => setActiveTab('services')}
          className={`pb-4 text-[9px] font-black uppercase tracking-[0.2em] relative transition-all ${activeTab === 'services' ? 'text-primary' : 'text-slate-500'}`}
        >
          Rituais & Serviços
          {activeTab === 'services' && <div className="absolute bottom-0 left-0 right-0 h-0.5 gold-gradient rounded-full"></div>}
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`pb-4 text-[9px] font-black uppercase tracking-[0.2em] relative transition-all ${activeTab === 'products' ? 'text-primary' : 'text-slate-500'}`}
        >
          Home Care & Produtos
          {activeTab === 'products' && <div className="absolute bottom-0 left-0 right-0 h-0.5 gold-gradient rounded-full"></div>}
        </button>
      </nav>

      <main className="scroll-container px-6 pt-6">
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="size-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Carregando...</p>
          </div>
        ) : activeTab === 'services' ? (
          <div className="space-y-4 animate-fade-in">
            {salonServices.length > 0 ? salonServices.map(s => {
              const isSelected = selectedServiceIds.includes(s.id);
              return (
                <div key={s.id} onClick={() => toggleService(s)} className={`rounded-[24px] p-4 border transition-all active:scale-[0.98] ${isSelected ? 'bg-primary/10 border-primary shadow-lg' : 'bg-surface-dark border-white/5'}`}>
                  <div className="flex gap-4">
                    <img src={s.image} className="size-16 rounded-xl object-cover" alt={s.name} />
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h3 className="font-display text-xs font-black text-white truncate">{s.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-[7px] font-black text-slate-500 uppercase">
                        <span>{s.duration_min} MIN</span>
                        <span>•</span>
                        <span>{s.category}</span>
                      </div>
                      <p className="text-primary font-black text-xs mt-1">R$ {s.price.toFixed(2)}</p>
                    </div>
                    <div className={`size-6 rounded-full border flex items-center justify-center self-center shrink-0 ${isSelected ? 'bg-primary border-primary text-background-dark' : 'border-white/10 text-transparent'}`}>
                      <span className="material-symbols-outlined text-xs font-black">check</span>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <p className="text-center text-slate-500 py-10 text-[9px] uppercase font-black tracking-widest">Nenhum ritual cadastrado nesta unidade.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {salonProducts.length > 0 ? salonProducts.map(p => {
              const isSelected = selectedProductIds.includes(p.id);
              return (
                <div key={p.id} onClick={() => toggleProduct(p)} className={`rounded-[24px] p-4 border transition-all active:scale-[0.98] ${isSelected ? 'bg-primary/10 border-primary shadow-lg' : 'bg-surface-dark border-white/5'}`}>
                  <div className="flex gap-4">
                    <img src={p.image} className="size-16 rounded-xl object-cover" alt={p.name} />
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h3 className="font-display text-xs font-black text-white truncate">{p.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-[7px] font-black text-slate-500 uppercase">
                        <span>ESTOQUE DISPONÍVEL</span>
                        <span>•</span>
                        <span>{p.category}</span>
                      </div>
                      <p className="text-primary font-black text-xs mt-1">R$ {p.price.toFixed(2)}</p>
                    </div>
                    <div className={`size-6 rounded-full border flex items-center justify-center self-center shrink-0 ${isSelected ? 'bg-primary border-primary text-background-dark' : 'border-white/10 text-transparent'}`}>
                      <span className="material-symbols-outlined text-xs font-black">add_shopping_cart</span>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <p className="text-center text-slate-500 py-10 text-[9px] uppercase font-black tracking-widest">Nenhum produto cadastrado nesta unidade.</p>
            )}
          </div>
        )}
      </main>

      {itemCount > 0 && (
        <footer className="fixed-floating-footer">
          <button
            onClick={handleNext}
            className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl flex items-center justify-between px-7 shadow-2xl active:scale-95 transition-all"
          >
            <div className="text-left">
              <p className="text-[7px] uppercase tracking-widest opacity-60 font-black">{itemCount} Itens Selecionados</p>
              <p className="text-base font-display font-black">R$ {totalPrice.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] uppercase font-black tracking-widest">
                {!role ? 'Entrar para Finalizar' : (servicesInDraft.length > 0 ? 'Escolher Horário' : 'Finalizar Compra')}
              </span>
              <span className="material-symbols-outlined text-lg font-black">arrow_forward</span>
            </div>
          </button>
        </footer>
      )}
    </div>
  );
};

export default SelectService;
