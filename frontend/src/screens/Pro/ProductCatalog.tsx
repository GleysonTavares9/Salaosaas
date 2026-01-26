
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../../types';
import { api } from '../../lib/api';

interface ProductCatalogProps {
  salonId?: string;
}

const ProductCatalog: React.FC<ProductCatalogProps> = ({ salonId }) => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'Cabelo',
    stock: 10,
    image: 'https://images.unsplash.com/photo-1594465919760-441fe5908ab0?auto=format&fit=crop&q=80&w=400'
  });

  useEffect(() => {
    if (salonId) {
      api.products.getBySalon(salonId).then(data => {
        setProducts(data);
        setIsLoading(false);
      });
    }
  }, [salonId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId) return;
    try {
      const created = await api.products.create({
        ...newProduct,
        salon_id: salonId
      });
      setProducts([created, ...products]);
      setIsAdding(false);
      setNewProduct({
        name: '',
        description: '',
        price: 0,
        category: 'Cabelo',
        stock: 10,
        image: 'https://images.unsplash.com/photo-1594465919760-441fe5908ab0?auto=format&fit=crop&q=80&w=400'
      });
    } catch (error: any) {
      alert("Erro ao criar produto: " + error.message);
    }
  };

  return (
    <div className="flex-1 bg-background-dark min-h-screen">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-md px-6 pt-12 pb-6 border-b border-white/5 flex items-center justify-between">
        <button onClick={() => navigate('/pro')} className="size-10 rounded-full border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-xl font-display font-black text-white italic tracking-tighter uppercase leading-none text-center">Boutique & Estoque</h1>
          <p className="text-primary text-[8px] font-black uppercase tracking-[0.2em] mt-1 text-center">Gestão de Itens</p>
        </div>
        <div className="size-10"></div>
      </header>

      <main className="p-6 space-y-8 safe-area-bottom pb-40 no-scrollbar overflow-y-auto max-w-[450px] mx-auto">
        {isLoading ? (
          <div className="py-20 text-center flex flex-col items-center">
            <div className="size-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {products.map(product => {
              const isLowStock = product.stock < 5;
              return (
                <div key={product.id} className="bg-surface-dark border border-white/5 rounded-[40px] p-5 flex gap-5 shadow-xl group active:scale-[0.98] transition-all">
                  <div className="size-24 rounded-2xl overflow-hidden border border-white/5 shadow-inner shrink-0 relative">
                    <img src={product.image} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all" alt={product.name} />
                    {isLowStock && (
                      <div className="absolute top-2 right-2 size-2 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]"></div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] font-black text-primary uppercase tracking-widest">{product.category}</span>
                      <span className={`text-[7px] font-black px-2 py-0.5 rounded-full ${isLowStock ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'text-slate-600'}`}>QTD: {product.stock}</span>
                    </div>
                    <h3 className="text-white font-bold leading-tight mb-2 truncate italic font-display">{product.name}</h3>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-white font-display font-black text-lg italic">R$ {product.price.toFixed(2)}</span>
                      <button className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 group-hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {products.length === 0 && !isAdding && (
              <div className="py-20 text-center flex flex-col items-center opacity-30">
                <span className="material-symbols-outlined text-6xl mb-4">inventory_2</span>
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhum produto em estoque</p>
              </div>
            )}
          </div>
        )}

        {/* Overlay de Adicionar */}
        {isAdding && (
          <div className="fixed inset-0 z-[60] bg-background-dark/95 backdrop-blur-xl animate-fade-in flex flex-col">
            <header className="p-8 flex items-center justify-between">
              <h2 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">Novo Produto</h2>
              <button onClick={() => setIsAdding(false)} className="text-slate-500"><span className="material-symbols-outlined">close</span></button>
            </header>
            <form onSubmit={handleCreate} className="p-8 flex-1 overflow-y-auto space-y-6 no-scrollbar pb-32">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Produto</label>
                <input type="text" required value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Preço Sugerido (R$)</label>
                  <input type="number" step="0.01" required value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Qtd em Estoque</label>
                  <input type="number" required value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoria</label>
                <select value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none">
                  <option>Cabelo</option>
                  <option>Rosto</option>
                  <option>Corpo</option>
                  <option>Acessório</option>
                </select>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Imagem do Produto</label>
                <div className="flex items-center gap-6">
                  <div className="size-24 rounded-3xl bg-surface-dark border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {newProduct.image ? (
                      <img src={newProduct.image} className="size-full object-cover" alt="Preview" />
                    ) : (
                      <span className="material-symbols-outlined text-slate-700 text-3xl">add_a_photo</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      id="prod-image"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const publicUrl = await api.storage.upload(file);
                            setNewProduct({ ...newProduct, image: publicUrl });
                          } catch (err: any) {
                            alert("Erro no upload: " + err.message);
                          }
                        }
                      }}
                    />
                    <label htmlFor="prod-image" className="inline-block px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-white uppercase tracking-widest cursor-pointer hover:bg-white/10 active:scale-95 transition-all">
                      {newProduct.image ? 'Alterar Foto' : 'Selecionar Arquivo'}
                    </label>
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs">Adicionar à Boutique</button>
            </form>
          </div>
        )}

        <div className="fixed bottom-[120px] left-8 right-8 z-40 max-w-[450px] mx-auto pointer-events-none">
          <button onClick={() => setIsAdding(true)} className="w-full gold-gradient text-background-dark font-black py-6 rounded-3xl shadow-2xl uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all pointer-events-auto">
            <span className="material-symbols-outlined text-xl font-black">add_shopping_cart</span>
            Novo Produto
          </button>
        </div>
      </main>
    </div>
  );
};

export default ProductCatalog;
