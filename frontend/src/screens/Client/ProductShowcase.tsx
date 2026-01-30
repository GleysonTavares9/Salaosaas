
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
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: -23.5667, lng: -46.6667 });

  // Safe access to products
  const productsInDraft = bookingDraft?.products || [];
  const selectedProductIds = productsInDraft.map((p: Product) => p.id);

  useEffect(() => {
    // Get user location
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
    <div className="flex-1 flex flex-col h-full bg-background-dark relative overflow-hidden">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-md px-6 pt-12 pb-6 border-b border-white/5 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="size-10 rounded-full border border-white/10 flex items-center justify-center text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="text-center">
          <h1 className="text-xl font-display font-black text-white italic tracking-tighter uppercase leading-none">Aura Boutique</h1>
          <p className="text-[7px] text-primary font-black uppercase tracking-[0.3em] mt-1">Produtos Próximos a Você</p>
        </div>
        <div className="size-10 flex items-center justify-center text-primary relative">
          <span className="material-symbols-outlined">shopping_bag</span>
          {itemCount > 0 && <span className="absolute -top-1 -right-1 size-4 bg-primary text-background-dark text-[8px] font-black rounded-full flex items-center justify-center shadow-lg">{itemCount}</span>}
        </div>
      </header>

      <main className="scroll-container p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-40">
            <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carregando produtos...</p>
          </div>
        ) : enrichedProducts.length === 0 ? (
          <div className="py-20 text-center opacity-30 flex flex-col items-center">
            <span className="material-symbols-outlined text-6xl mb-4">shopping_bag</span>
            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum produto disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 pb-20">
            {enrichedProducts.map(product => {
              const isSelected = selectedProductIds.includes(product.id);
              const isOutOfStock = product.stock <= 0;
              const salon = product.salon;

              return (
                <div key={product.id} className={`space-y-3 transition-opacity ${isOutOfStock ? 'opacity-60' : ''}`}>
                  <div
                    onClick={() => toggleProduct(product)}
                    className={`aspect-[4/5] rounded-[40px] overflow-hidden bg-surface-dark border transition-all relative cursor-pointer shadow-xl ${isSelected ? 'border-primary' : 'border-white/5'}`}
                  >
                    <img src={product.image} className="w-full h-full object-cover grayscale-[0.3] opacity-80" alt={product.name} />

                    {/* Badge de Salão/Distância */}
                    {salon && (
                      <div className="absolute top-4 left-4 right-4 flex flex-col gap-1">
                        <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 self-start">
                          <p className="text-[6px] font-black text-white uppercase truncate max-w-[80px]">{salon.nome}</p>
                          <p className="text-[5px] text-primary font-black uppercase tracking-tighter">{salon.distancia} de você</p>
                        </div>
                      </div>
                    )}

                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                        <span className="text-[8px] font-black text-white uppercase tracking-[0.2em] border border-white/20 px-3 py-1.5 rounded-full">Esgotado</span>
                      </div>
                    )}

                    <div className={`absolute bottom-4 right-4 size-9 rounded-2xl flex items-center justify-center shadow-2xl transition-all ${isSelected ? 'bg-primary text-background-dark' : 'bg-white/10 text-white backdrop-blur-md border border-white/20'}`}>
                      <span className="material-symbols-outlined text-base font-black">{isSelected ? 'check' : 'add'}</span>
                    </div>
                  </div>
                  <div className="px-2">
                    <h3 className={`font-bold text-[11px] leading-tight line-clamp-2 ${isSelected ? 'text-primary' : 'text-white'}`}>{product.name}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-primary font-black text-xs">R$ {product.price.toFixed(2)}</p>
                      <span className="text-[6px] font-black text-slate-500 uppercase">{product.stock} em estoque</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {itemCount > 0 && (
        <footer className="fixed-floating-footer">
          <button
            onClick={handleCheckout}
            className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl flex items-center justify-between px-7 shadow-2xl active:scale-95 transition-all"
          >
            <div className="text-left">
              <p className="text-[7px] uppercase tracking-widest opacity-60 font-black">{itemCount} Itens na Sacola</p>
              <p className="text-base font-display font-black">R$ {totalPrice.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] uppercase font-black tracking-widest">
                {role ? 'Finalizar Agora' : 'Entrar para Comprar'}
              </span>
              <span className="material-symbols-outlined text-lg font-black">arrow_forward</span>
            </div>
          </button>
        </footer>
      )}
    </div>
  );
};

export default ProductShowcase;
