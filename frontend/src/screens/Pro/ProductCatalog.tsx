
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../../types';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

interface ProductCatalogProps {
  salonId?: string;
}

const ProductCatalog: React.FC<ProductCatalogProps> = ({ salonId }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');

  const categories = ['Todos', 'Cabelo', 'Barba', 'Rosto', 'Corpo', 'Kits', 'Acessório', 'Perfumes'];

  const [formProduct, setFormProduct] = useState({
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
        setProducts(data || []);
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [salonId]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormProduct({
      name: product.name,
      description: product.description || '',
      price: product.price,
      category: product.category || 'Cabelo',
      stock: product.stock,
      image: product.image || 'https://images.unsplash.com/photo-1594465919760-441fe5908ab0?auto=format&fit=crop&q=80&w=400'
    });
    setIsAdding(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId) return;
    setIsLoading(true);
    try {
      if (editingProduct) {
        const updated = await api.products.update(editingProduct.id, {
          ...formProduct,
          salon_id: salonId
        });
        setProducts(products.map(p => p.id === editingProduct.id ? updated : p));
        showToast("✨ Produto atualizado!", 'success');
      } else {
        const created = await api.products.create({
          ...formProduct,
          salon_id: salonId
        });
        setProducts([created, ...products]);
        showToast("✨ Produto adicionado ao estoque!", 'success');
      }
      closeModal();
    } catch (error: any) {
      showToast("Erro ao processar produto: " + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingProduct) return;
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      setIsLoading(true);
      try {
        await api.products.delete(editingProduct.id);
        setProducts(products.filter(p => p.id !== editingProduct.id));
        showToast("🗑️ Produto excluído!", 'success');
        closeModal();
      } catch (error: any) {
        showToast("Erro ao excluir produto: " + error.message, 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const closeModal = () => {
    setIsAdding(false);
    setEditingProduct(null);
    setFormProduct({
      name: '',
      description: '',
      price: 0,
      category: 'Cabelo',
      stock: 10,
      image: 'https://images.unsplash.com/photo-1594465919760-441fe5908ab0?auto=format&fit=crop&q=80&w=400'
    });
  };

  return (
    <div className="flex-1 bg-background-dark overflow-y-auto h-full no-scrollbar">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-md px-6 pt-12 pb-6 border-b border-white/5 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/pro')} className="size-10 rounded-full border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-display font-black text-white italic tracking-tighter uppercase leading-none text-center">Boutique & Estoque</h1>
            <p className="text-primary text-[8px] font-black uppercase tracking-[0.2em] mt-1 text-center font-black">Gestão da Vitrine de Produtos</p>
          </div>
          <div className="size-10"></div>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors text-lg">search</span>
          <input
            type="text"
            placeholder="Buscar produto..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-surface-dark/50 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-white text-[11px] font-bold uppercase tracking-widest outline-none focus:border-primary/50 transition-all shadow-inner"
          />
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${activeCategory === cat
                ? 'bg-primary text-background-dark border-primary shadow-lg shadow-primary/20'
                : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/10'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <main className="p-6 space-y-8 pb-40 max-w-[450px] mx-auto">
        <div className="mb-2">
          <button
            onClick={() => setIsAdding(true)}
            className="w-full bg-white/5 border border-dashed border-white/10 rounded-[40px] py-10 flex flex-col items-center justify-center gap-4 group hover:border-primary/20 hover:bg-white/[0.07] transition-all active:scale-[0.98]"
          >
            <div className="size-14 rounded-full gold-gradient flex items-center justify-center text-background-dark shadow-xl shadow-primary/20 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-2xl font-black">add_shopping_cart</span>
            </div>
            <span className="text-[11px] font-black text-white uppercase tracking-[0.4em]">Adicionar Novo Produto</span>
          </button>
        </div>

        {isLoading && products.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <div className="size-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredProducts.map(product => {
              const isLowStock = product.stock < 5;
              return (
                <div key={product.id} className="bg-surface-dark/60 border border-white/5 rounded-[32px] p-5 flex gap-5 shadow-xl group hover:border-primary/20 transition-all relative overflow-hidden">
                  {isLowStock && (
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500 shadow-[2px_0_10px_rgba(239,68,68,0.5)] z-10"></div>
                  )}
                  <div className="size-24 rounded-2xl overflow-hidden border border-white/5 shadow-inner shrink-0 relative bg-background-dark">
                    <img src={product.image} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" alt={product.name} />
                    <div className="absolute inset-x-0 bottom-0 bg-black/40 backdrop-blur-md py-1">
                      <p className="text-[7px] text-white font-black text-center uppercase tracking-widest">{product.category}</p>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-center min-w-0 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${isLowStock ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-white/5 text-slate-500 border border-white/10'} border`}>
                        <span className="material-symbols-outlined text-[11px] font-black">{isLowStock ? 'warning' : 'inventory_2'}</span>
                        <span className="text-[8px] font-black uppercase tracking-tight">QTD: {product.stock}</span>
                      </div>
                    </div>
                    <h3 className="text-white font-display font-black text-base italic tracking-tight mb-3 truncate uppercase leading-tight">{product.name}</h3>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex flex-col">
                        <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Preço Sugerido</span>
                        <span className="text-xl font-display font-black text-primary italic leading-none">R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <button
                        onClick={() => handleEdit(product)}
                        className="size-11 rounded-2xl bg-primary text-background-dark flex items-center justify-center shadow-[0_5px_15px_rgba(193,165,113,0.3)] active:scale-90 transition-all"
                      >
                        <span className="material-symbols-outlined text-base font-black">edit_note</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredProducts.length === 0 && !isAdding && !isLoading && (
              <div className="py-20 text-center flex flex-col items-center opacity-30">
                <span className="material-symbols-outlined text-6xl mb-4 text-slate-700">inventory_2</span>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {searchQuery ? 'Nenhum resultado para a busca' : 'Nenhum produto nesta categoria'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Overlay de Adicionar/Editar */}
        {isAdding && (
          <div className="fixed inset-0 z-[60] bg-background-dark/95 backdrop-blur-xl animate-fade-in flex flex-col items-center overflow-hidden">
            <div className="flex-1 flex flex-col bg-background-dark max-w-[450px] w-full h-full">
              <header className="p-8 flex items-center justify-between">
                <h2 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">
                  {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                </h2>
                <button
                  onClick={closeModal}
                  className="size-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </header>
              <form onSubmit={handleSubmit} className="p-8 flex-1 overflow-y-auto space-y-6 pb-40 min-h-0 text-left">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Produto</label>
                  <input type="text" required value={formProduct.name} onChange={e => setFormProduct({ ...formProduct, name: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Preço Sugerido (R$)</label>
                    <input type="number" step="0.01" required value={formProduct.price} onChange={e => setFormProduct({ ...formProduct, price: parseFloat(e.target.value) })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Qtd em Estoque</label>
                    <input type="number" required value={formProduct.stock} onChange={e => setFormProduct({ ...formProduct, stock: parseInt(e.target.value) })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoria</label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.filter(c => c !== 'Todos').map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormProduct({ ...formProduct, category: c })}
                        className={`py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border ${formProduct.category === c
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
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Imagem do Produto</label>
                  <div className="flex items-center gap-6">
                    <div className="size-24 rounded-3xl bg-surface-dark border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                      {formProduct.image ? (
                        <img src={formProduct.image} className="size-full object-cover" alt="Preview" />
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
                              setIsLoading(true);
                              const publicUrl = await api.storage.upload(file);
                              setFormProduct({ ...formProduct, image: publicUrl });
                              showToast("Imagem enviada!", "success");
                            } catch (err: any) {
                              showToast("Erro no upload: " + err.message, "error");
                            } finally {
                              setIsLoading(false);
                            }
                          }
                        }}
                      />
                      <label htmlFor="prod-image" className="inline-block px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-white uppercase tracking-widest cursor-pointer hover:bg-white/10 active:scale-95 transition-all">
                        {formProduct.image ? 'Alterar Foto' : 'Selecionar Arquivo'}
                      </label>
                    </div>
                  </div>
                </div>
                <div className="pt-4 space-y-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? <div className="size-4 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div> : (editingProduct ? 'Salvar Alterações' : 'Adicionar à Boutique')}
                  </button>

                  {editingProduct && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isLoading}
                      className="w-full bg-red-500/10 border border-red-500/20 text-red-500 font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] active:scale-95 transition-all"
                    >
                      Excluir Produto
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default ProductCatalog;
