
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, Salon, ViewRole } from '../../types';
import { api } from '../../lib/api';

interface ProductShowcaseProps {
  bookingDraft: any;
  setBookingDraft: React.Dispatch<React.SetStateAction<any>>;
  salons: Salon[];
  role: ViewRole | null;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const ProductShowcase: React.FC<ProductShowcaseProps> = ({ bookingDraft, setBookingDraft, salons, role }) => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: -23.5667, lng: -46.6667 });

  // Safe access to products
  const productsInDraft = bookingDraft?.products || [];
  const selectedProductIds = productsInDraft.map((p: Product) => p.id);

  useEffect(() => {
    // Fetch products
    const fetchProducts = async () => {
      try {
        const data = await api.products.getAll();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        () => {
          // Mantém localização padrão
        }
      );
    }
  };

  // Enrich products with salon distance
  const enrichedProducts = useMemo(() => {
    return products.map(product => {
      const salon = salons.find(s => s.id === product.salon_id);
      if (salon && salon.location) {
        const parseCoord = (val: any) => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return parseFloat(val.replace(',', '.'));
          return 0;
        };
        const sLat = parseCoord(salon.location.lat);
        const sLng = parseCoord(salon.location.lng);
        const dist = calculateDistance(coords.lat, coords.lng, sLat, sLng);
        return {
          ...product,
          salon: {
            ...salon,
            distancia: dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`
          }
        };
      }
      return { ...product, salon };
    });
  }, [products, salons, coords]);

  const toggleProduct = (product: Product) => {
    if (product.stock <= 0) return; // Bloqueio de estoque esgotado

    const isSelected = selectedProductIds.includes(product.id);
    let newProducts = isSelected
      ? productsInDraft.filter((p: Product) => p.id !== product.id)
      : [...productsInDraft, product];

    let updates: any = { products: newProducts };

    // Vincula ao salão se for o primeiro item
    if (!bookingDraft?.salonId && !isSelected) {
      const salon = salons.find(s => s.id === product.salon_id);
      if (salon) {
        updates.salonId = salon.id;
        updates.salonName = salon.nome;
      }
    }

    setBookingDraft({ ...bookingDraft, ...updates });
  };

  const handleCheckout = () => {
    // Se não estiver logado, vai para login, caso contrário checkout
    if (!role) {
      navigate('/login-user');
    } else {
      navigate('/checkout');
    }
  };

  const totalPrice =
    (bookingDraft?.services || []).reduce((acc: number, curr: any) => acc + curr.price, 0) +
    (bookingDraft?.products || []).reduce((acc: number, curr: any) => acc + curr.price, 0);

  const itemCount = (bookingDraft?.services?.length || 0) + (bookingDraft?.products?.length || 0);

  return (
    <div className="flex-1 overflow-y-auto h-full no-scrollbar bg-background-dark relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] pointer-events-none"></div>

      <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-3xl px-6 sm:px-6 lg:px-6 pt-12 lg:pt-6 pb-6 border-b border-white/5">
        <div className="max-w-full max-w-[1400px] mx-auto w-full">
          <div className="flex items-center justify-between mb-12">
            <button onClick={() => navigate(-1)} className="size-10 sm:size-12 lg:size-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div className="text-center">
              <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none" style={{ fontSize: 'var(--step-1)' }}>
                Boutique Elite
              </h1>
              <p className="text-[7px] text-primary font-black uppercase tracking-[0.4em] mt-3">Curadoria de Ativos de Luxo</p>
            </div>
            <div className="size-10 sm:size-12 lg:size-12 opacity-0 pointer-events-none"></div>
          </div>

          <div className="flex flex-col items-center gap-6 lg:gap-6">
            <div className="relative group w-full max-w-full sm:max-w-2xl">
              <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors text-xl">search</span>
              <input
                type="text"
                placeholder="PROCURAR POR ITEM..."
                className="w-full bg-surface-dark/40 border border-white/10 rounded-3xl py-6 sm:py-6 lg:py-6 pl-16 pr-8 text-white text-[11px] font-black uppercase tracking-[0.3em] outline-none focus:border-primary/40 focus:bg-surface-dark/60 transition-all shadow-inner"
              />
            </div>

            <button
              onClick={handleGetLocation}
              className="flex items-center gap-3 lg:gap-3 px-6 sm:px-6 lg:px-6 py-3 sm:py-3 lg:py-3 rounded-full bg-primary/10 border border-primary/20 text-primary active:scale-95 transition-all group"
            >
              {itemCount > 0 && <span className="absolute -top-1 -right-1 size-5 bg-primary text-background-dark text-[10px] font-black rounded-full flex items-center justify-center shadow-2xl animate-bounce">{itemCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-full max-w-[1400px] mx-auto w-full px-6 sm:px-6 lg:px-6 py-6 lg:py-10 animate-fade-in relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 sm:py-40 lg:py-40">
            <div className="size-10 sm:size-12 lg:size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-10"></div>
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-primary animate-pulse">Consultando Acervo Elite...</p>
          </div>
        ) : enrichedProducts.length === 0 ? (
          <div className="py-40 sm:py-40 lg:py-40 text-center flex flex-col items-center gap-8 lg:gap-8">
            <div className="size-18 sm:size-20 lg:size-24 rounded-2xl sm:rounded-3xl lg:rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-700">
              <span className="material-symbols-outlined text-3xl sm:text-4xl lg:text-5xl lg:text-3xl sm:text-4xl lg:text-5xl">shopping_bag</span>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-600">Boutique temporariamente fechada</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6 pb-40">
            {enrichedProducts.map(product => {
              const isSelected = selectedProductIds.includes(product.id);
              const isOutOfStock = product.stock <= 0;
              const salon = product.salon;

              return (
                <div
                  key={product.id}
                  className={`group relative bg-surface-dark/40 rounded-xl lg:rounded-2xl border border-white/5 p-3 lg:p-4 shadow-lg transition-all backdrop-blur-3xl overflow-hidden active:scale-[0.99]
                    ${isOutOfStock ? 'opacity-40 grayscale pointer-events-none' : 'hover:border-primary/20'}
                    ${isSelected ? 'ring-1 ring-primary ring-offset-2 ring-offset-background-dark' : ''}
                  `}
                  onClick={() => !isOutOfStock && toggleProduct(product)}
                >
                  <div className="relative aspect-[4/5] rounded-lg lg:rounded-xl overflow-hidden border border-white/5 shadow-lg bg-black/20 mb-3 cursor-pointer">
                    <img src={product.image} className="size-full object-cover grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt={product.name} />
                    <div className="absolute inset-0 bg-gradient-to-t from-background-dark/80 via-transparent to-transparent"></div>

                    {salon && (
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        <span className="bg-black/60 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-full text-[6px] font-black text-white uppercase tracking-widest truncate max-w-[80px]">{salon.nome}</span>
                        <span className="bg-primary/20 backdrop-blur-md border border-primary/30 px-2 py-0.5 rounded-full text-[6px] font-black text-primary uppercase tracking-widest self-start">{salon.distancia}</span>
                      </div>
                    )}

                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-background-dark/80 flex items-center justify-center">
                        <span className="text-[8px] font-black text-white uppercase tracking-[0.2em] border border-white/20 px-3 py-1.5 rounded-full">Indisponível</span>
                      </div>
                    )}

                    <div className={`absolute bottom-3 right-3 size-8 lg:size-10 rounded-full flex items-center justify-center shadow-gold transition-all duration-500
                      ${isSelected ? 'gold-gradient text-background-dark scale-110' : 'bg-white/10 text-white backdrop-blur-md border border-white/10 group-hover:gold-gradient group-hover:text-background-dark group-hover:scale-110'}
                    `}>
                      <span className="material-symbols-outlined text-lg font-black">{isSelected ? 'check' : 'shopping_bag'}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <h4 className="font-display text-sm lg:text-base font-black text-white italic tracking-tighter uppercase leading-none truncate group-hover:text-primary transition-colors">{product.name}</h4>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[6px] font-black text-slate-600 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">{product.stock} UNIDADES</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[6px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Valor</span>
                        <span className="text-lg lg:text-xl font-display font-black text-white italic tracking-tight">R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {itemCount > 0 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] w-full max-w-full sm:max-w-xl px-6 sm:px-6 lg:px-6 animate-fade-in">
          <button
            onClick={() => setShowCart(true)}
            className="w-full gold-gradient text-background-dark h-24 rounded-2xl sm:rounded-3xl lg:rounded-[32px] flex items-center justify-between px-10 sm:px-10 lg:px-10 shadow-gold active:scale-95 transition-all group overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <div className="relative z-10 flex items-center gap-6 lg:gap-6 text-left">
              <div className="size-10 sm:size-12 lg:size-14 rounded-2xl bg-background-dark/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl lg:text-3xl font-black">shopping_cart</span>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.4em] font-black opacity-60 mb-1">{itemCount} ATIVOS SELECIONADOS</p>
                <p className="text-2xl lg:text-2xl font-display font-black italic">R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="relative z-10 flex items-center gap-4 lg:gap-4">
              <span className="text-[10px] uppercase font-black tracking-[0.4em]">RESGATAR</span>
              <span className="material-symbols-outlined text-2xl lg:text-2xl font-black">arrow_forward</span>
            </div>
          </button>
        </div>
      )}

      {/* Cart Summary Modal Refinado */}
      {showCart && (
        <div className="fixed inset-0 z-[120] bg-background-dark/95 backdrop-blur-3xl animate-fade-in flex flex-col items-center overflow-hidden">
          <div className="flex-1 flex flex-col max-w-full max-w-[600px] w-full h-full relative">
            <header className="px-10 sm:px-10 lg:px-10 pt-16 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-2xl lg:text-2xl lg:text-3xl lg:text-3xl font-display font-black text-white italic tracking-tighter uppercase">Sua Sacola</h2>
                <p className="text-[10px] text-primary font-black uppercase tracking-[0.4em] mt-2 leading-none">Revisão Curada do Ritual</p>
              </div>
              <button
                onClick={() => setShowCart(false)}
                className="size-10 sm:size-12 lg:size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all"
              >
                <span className="material-symbols-outlined font-black">close</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-10 sm:p-10 lg:p-10 space-y-10 pb-60 no-scrollbar min-h-0">
              {/* Serviços */}
              {(bookingDraft?.services || []).map((svc: any) => (
                <div key={svc.id} className="flex items-center justify-between p-6 sm:p-6 lg:p-6 bg-surface-dark/40 border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[32px] shadow-2xl backdrop-blur-xl group">
                  <div className="flex items-center gap-6 lg:gap-6">
                    <div className="size-10 sm:size-12 lg:size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-3xl lg:text-3xl font-black">content_cut</span>
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-white uppercase tracking-[0.4em] mb-1">{svc.name}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Ritual de Estética</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-display font-black text-primary italic">R$ {svc.price.toFixed(2)}</p>
                  </div>
                </div>
              ))}

              {/* Produtos */}
              {productsInDraft.map((prod: Product) => (
                <div key={prod.id} className="flex items-center justify-between p-6 sm:p-6 lg:p-6 bg-surface-dark/40 border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[32px] shadow-2xl backdrop-blur-xl group">
                  <div className="flex items-center gap-6 lg:gap-6">
                    <div className="size-10 sm:size-12 lg:size-16 rounded-2xl overflow-hidden border border-white/10">
                      <img src={prod.image} className="size-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-white uppercase tracking-[0.4em] mb-1">{prod.name}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Aura Boutique</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 lg:gap-6">
                    <div className="text-right">
                      <p className="text-xl font-display font-black text-primary italic">R$ {prod.price.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => toggleProduct(prod)}
                      className="size-10 sm:size-12 lg:size-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center active:scale-90 transition-all"
                    >
                      <span className="material-symbols-outlined text-xl font-black">delete</span>
                    </button>
                  </div>
                </div>
              ))}

              {itemCount === 0 && (
                <div className="py-20 sm:py-20 lg:py-20 text-center flex flex-col items-center gap-6 lg:gap-6">
                  <div className="size-14 sm:size-16 lg:size-20 rounded-2xl sm:rounded-3xl lg:rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-700">
                    <span className="material-symbols-outlined text-4xl lg:text-4xl">shopping_cart</span>
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-600">Sua sacola está vazia</p>
                </div>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-10 sm:p-10 lg:p-10 bg-gradient-to-t from-background-dark via-background-dark to-transparent">
              <div className="bg-surface-dark border border-white/10 rounded-2xl sm:rounded-3xl lg:rounded-[40px] p-8 sm:p-8 lg:p-8 shadow-3xl space-y-8">
                <div className="flex items-center justify-between px-2 sm:px-2 lg:px-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">Consolidado Geral</p>
                  <p className="text-3xl lg:text-3xl font-display font-black text-white italic tracking-tighter">R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full gold-gradient text-background-dark h-20 rounded-[28px] flex items-center justify-center gap-6 lg:gap-6 text-[11px] font-black uppercase tracking-[0.4em] shadow-gold active:scale-95 transition-all hover:brightness-110"
                >
                  <span>{role ? 'EFETIVAR RITUAL' : 'ACESSO PARA RESERVAR'}</span>
                  <span className="material-symbols-outlined font-black">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductShowcase;
