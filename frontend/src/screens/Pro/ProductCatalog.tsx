
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, Salon } from '../../types';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [billingInfo, setBillingInfo] = useState<any>(null);

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
      }).catch(() => { });

      api.salons.getBilling(salonId).then(info => {
        if (info) setBillingInfo(info);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
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
        // Bloqueio de Plano (Limite Dinâmico do Banco)
        const maxProducts = billingInfo?.limits?.max_products || 5;
        const isTrial = billingInfo?.is_trial_active;

        if (!isTrial && products.length >= maxProducts) {
          showToast(`Limite de ${maxProducts} produtos atingido. Migre para o PRO!`, 'error');
          setIsLoading(false);
          return;
        }

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

  const confirmDelete = async () => {
    if (!editingProduct) return;
    setIsLoading(true);
    try {
      await api.products.delete(editingProduct.id);
      setProducts(products.filter(p => p.id !== editingProduct.id));
      showToast("🗑️ Produto excluído!", 'success');
      setShowDeleteConfirm(false);
      closeModal();
    } catch (error: any) {
      showToast("Erro ao excluir produto: " + error.message, 'error');
    } finally {
      setIsLoading(false);
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
    <div className="flex-1 overflow-y-auto h-full no-scrollbar bg-background-dark relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] pointer-events-none"></div>

      <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-3xl px-6 pt-12 pb-10 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto w-full">
          <div className="flex items-center justify-between mb-12">
            <button onClick={() => navigate('/pro')} className="size-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div className="text-center">
              <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none" style={{ fontSize: 'var(--step-1)' }}>
                Boutique Elite
              </h1>
              <p className="text-[7px] text-primary font-black uppercase tracking-[0.4em] mt-3">Gestão de Ativos & Estoque</p>
            </div>
            <div className="size-12 opacity-0 pointer-events-none"></div>
          </div>

          <div className="space-y-8">
            {/* Search Bar Refinada */}
            <div className="relative group max-w-2xl mx-auto">
              <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors text-xl">search</span>
              <input
                type="text"
                placeholder="BUSCAR NO ACERVO..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface-dark/40 border border-white/10 rounded-3xl py-6 pl-16 pr-8 text-white text-[11px] font-black uppercase tracking-[0.3em] outline-none focus:border-primary/40 focus:bg-surface-dark/60 transition-all shadow-inner"
              />
            </div>

            {/* Category Filters Elite */}
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border ${activeCategory === cat
                    ? 'gold-gradient text-background-dark border-transparent shadow-gold-sm scale-105 z-10'
                    : 'bg-surface-dark/40 text-slate-500 border-white/5 hover:border-white/10'
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto w-full px-6 py-12 lg:py-20 space-y-16 pb-40 animate-fade-in relative z-10">
        <div className="flex justify-center">
          <button
            onClick={() => setIsAdding(true)}
            className="w-full max-w-xl group relative p-[2px] rounded-[48px] active:scale-95 transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/40 to-primary/10 animate-pulse"></div>
            <div className="relative bg-background-dark/90 rounded-[46px] py-10 lg:py-14 flex flex-col items-center justify-center gap-6 backdrop-blur-3xl group-hover:bg-background-dark/70 transition-colors">
              <div className="size-20 rounded-[32px] gold-gradient flex items-center justify-center text-background-dark shadow-gold group-hover:scale-110 transition-all duration-500">
                <span className="material-symbols-outlined text-4xl font-black">add_shopping_cart</span>
              </div>
              <div className="text-center">
                <span className="text-[11px] font-black text-white uppercase tracking-[0.5em]">Integrar Novo Ativo</span>
                <p className="text-[7px] text-primary/60 font-black uppercase tracking-[0.3em] mt-3">Eleve o Estoque da Boutique</p>
              </div>
            </div>
          </button>
        </div>

        {isLoading && products.length === 0 ? (
          <div className="py-40 text-center flex flex-col items-center">
            <div className="size-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 lg:gap-14">
            {filteredProducts.map(product => {
              const isLowStock = product.stock < 5;
              return (
                <div key={product.id} className="group relative bg-surface-dark/40 rounded-[56px] border border-white/5 p-8 lg:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.4)] transition-all hover:border-primary/20 backdrop-blur-3xl overflow-hidden active:scale-[0.99]">
                  {isLowStock && (
                    <div className="absolute top-0 left-0 w-2 h-full bg-red-500 shadow-[10px_0_40px_rgba(239,68,68,0.3)] z-10"></div>
                  )}

                  <div className="flex flex-col gap-8">
                    <div className="relative aspect-square rounded-[40px] overflow-hidden border-2 border-white/5 shadow-2xl bg-black/20">
                      <img src={product.image} className="size-full object-cover grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt={product.name} />
                      <div className="absolute inset-0 bg-gradient-to-t from-background-dark/80 via-transparent to-transparent"></div>
                      <div className="absolute bottom-6 left-6 flex items-center gap-3">
                        <span className="bg-primary/20 backdrop-blur-md border border-primary/30 px-4 py-2 rounded-full text-[8px] font-black text-primary uppercase tracking-widest">{product.category}</span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h4 className="font-display text-2xl lg:text-3xl font-black text-white italic tracking-tighter uppercase leading-none truncate group-hover:text-primary transition-colors">{product.name}</h4>
                          <div className={`inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-xl border ${isLowStock ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-white/5 text-slate-500 border-white/10'}`}>
                            <span className="material-symbols-outlined text-[14px] font-black">{isLowStock ? 'warning' : 'inventory_2'}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">STOCK: {product.stock}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none mb-2">Valor de Venda</span>
                          <span className="text-3xl font-display font-black text-white italic tracking-tight">R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <button
                          onClick={() => handleEdit(product)}
                          className="size-14 rounded-2xl bg-primary text-background-dark flex items-center justify-center shadow-gold-sm active:scale-90 transition-all hover:brightness-110"
                        >
                          <span className="material-symbols-outlined text-xl font-black">edit_square</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredProducts.length === 0 && !isAdding && !isLoading && (
              <div className="py-40 text-center flex flex-col items-center gap-6 col-span-full">
                <div className="size-20 rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-700">
                  <span className="material-symbols-outlined text-4xl">inventory_2</span>
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-600">
                  {searchQuery ? 'Busca sem resultados no acervo' : 'Nenhum item nesta galeria'}
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de Cadastro/Edição de Ativos Refinado */}
      {isAdding && (
        <div className="fixed inset-0 z-[120] bg-background-dark/95 backdrop-blur-3xl animate-fade-in flex flex-col items-center overflow-hidden">
          <div className="flex-1 flex flex-col max-w-[600px] w-full h-full relative">
            <header className="px-10 pt-16 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-2xl lg:text-3xl font-display font-black text-white italic tracking-tighter uppercase">
                  {editingProduct ? 'Ajustar Ativo' : 'Integrar Ativo'}
                </h2>
                <p className="text-[10px] text-primary font-black uppercase tracking-[0.4em] mt-2 leading-none">Curadoria de Boutique Elite</p>
              </div>
              <button
                onClick={closeModal}
                className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all"
              >
                <span className="material-symbols-outlined font-black">close</span>
              </button>
            </header>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-12 pb-60 no-scrollbar min-h-0 text-left">
              <div className="flex flex-col items-center gap-6">
                <div className="relative group shrink-0">
                  <div className="size-44 rounded-[50px] bg-cover bg-center border-2 border-dashed border-white/10 shadow-2xl overflow-hidden bg-surface-dark flex items-center justify-center relative" style={{ backgroundImage: formProduct.image ? `url('${formProduct.image}')` : 'none' }}>
                    {!formProduct.image && <span className="material-symbols-outlined text-slate-700 text-6xl">shopping_bag</span>}
                    <label htmlFor="prod-image" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                      <span className="material-symbols-outlined text-white text-3xl font-black">add_a_photo</span>
                    </label>
                  </div>
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
                          showToast("Imagem capturada!", "success");
                        } catch (err: any) {
                          showToast("Falha no upload!", "error");
                        } finally {
                          setIsLoading(false);
                        }
                      }
                    }}
                  />
                </div>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Visualização do Ativo</p>
              </div>

              <div className="space-y-10">
                <div className="relative">
                  <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest absolute -top-5 left-0">NOME DO PRODUTO</label>
                  <input type="text" required value={formProduct.name} onChange={e => setFormProduct({ ...formProduct, name: e.target.value })} className="w-full bg-transparent border-b-2 border-white/5 p-4 text-white text-2xl font-display font-black italic outline-none focus:border-primary transition-all" placeholder="EX: ÓLEO AURA ESSENCE" />
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="bg-surface-dark border border-white/5 rounded-[32px] p-8">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Preço Boutique R$</p>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formProduct.price || ''}
                      onChange={e => setFormProduct({ ...formProduct, price: parseFloat(e.target.value) })}
                      className="text-4xl font-display font-black text-white italic bg-transparent outline-none w-full"
                    />
                  </div>
                  <div className="bg-surface-dark border border-white/5 rounded-[32px] p-8">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Qtd Disponível</p>
                    <input
                      type="number"
                      required
                      value={formProduct.stock || '0'}
                      onChange={e => setFormProduct({ ...formProduct, stock: parseInt(e.target.value) })}
                      className="text-4xl font-display font-black text-primary italic bg-transparent outline-none w-full"
                    />
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-[48px] p-10 space-y-8">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] text-center italic">Esfera de Categoria</p>
                  <div className="grid grid-cols-2 gap-3">
                    {categories.filter(c => c !== 'Todos').map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormProduct({ ...formProduct, category: c })}
                        className={`py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${formProduct.category === c
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

              <div className="absolute bottom-0 left-0 right-0 p-10 bg-gradient-to-t from-background-dark via-background-dark to-transparent space-y-4">
                <button type="submit" disabled={isLoading} className="w-full gold-gradient text-background-dark h-24 rounded-[32px] font-black shadow-[0_30px_70px_rgba(0,0,0,0.5)] uppercase tracking-[0.6em] text-[11px] lg:text-[13px] active:scale-95 transition-all hover:brightness-110 flex items-center justify-center gap-4">
                  {isLoading ? <div className="size-6 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div> : (editingProduct ? 'ATUALIZAR ACERVO' : 'CONSOLIDAR NA BOUTIQUE')}
                </button>
                {editingProduct && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isLoading}
                    className="w-full h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-red-500/20 transition-all"
                  >
                    Expurgar do Estoque
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão Refinado */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in text-center">
          <div className="bg-surface-dark border border-white/10 rounded-[48px] p-12 max-w-sm w-full shadow-3xl">
            <div className="size-20 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-8 animate-pulse">
              <span className="material-symbols-outlined text-4xl">warning</span>
            </div>
            <h3 className="text-2xl font-display font-black text-white italic mb-4 uppercase tracking-tighter">Banir Ativo?</h3>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed mb-10">Este item será expurgado do estoque permanentemente.</p>
            <div className="flex flex-col gap-4">
              <button
                onClick={confirmDelete}
                disabled={isLoading}
                className="w-full bg-red-500 text-white h-16 rounded-2xl font-black uppercase tracking-[0.4em] text-[10px] shadow-2xl active:scale-95 transition-all"
              >
                {isLoading ? 'EXPURGANDO...' : 'CONFIRMAR BANIMENTO'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
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

export default ProductCatalog;
