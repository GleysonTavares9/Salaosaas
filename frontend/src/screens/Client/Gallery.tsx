
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GALLERY_ITEMS } from '../../constants';

const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');

  const categories = ['All', ...new Set(GALLERY_ITEMS.map(i => i.category))];
  const filteredItems = filter === 'All' ? GALLERY_ITEMS : GALLERY_ITEMS.filter(item => item.category === filter);

  const openImage = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="flex-1 bg-background-dark min-h-screen">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-md p-6 flex flex-col gap-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.3em] mb-1">Portfólio</p>
            <h1 className="text-2xl font-display font-black text-white italic tracking-tighter leading-none">Inspiração Aura</h1>
          </div>
          <button onClick={() => navigate(-1)} className="size-10 border border-white/10 rounded-2xl flex items-center justify-center text-slate-400 active:text-primary">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map(cat => (
            <button 
              key={cat} 
              onClick={() => setFilter(cat)}
              className={`px-5 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-[0.15em] transition-all border whitespace-nowrap ${
                filter === cat ? 'gold-gradient text-background-dark border-primary shadow-lg shadow-primary/20' : 'bg-surface-dark text-slate-500 border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <main className="p-4 grid grid-cols-2 gap-4 pb-32 animate-fade-in">
        {filteredItems.map(item => (
          <div key={item.id} className="group relative aspect-[3/4] rounded-[28px] overflow-hidden shadow-2xl transition-all active:scale-[0.97]">
            <img 
              src={item.url} 
              alt={item.title} 
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
            />
            
            {/* BOTÃO LINK DIRETO */}
            <button 
              onClick={(e) => { e.stopPropagation(); openImage(item.url); }}
              className="absolute top-3 right-3 size-8 bg-black/60 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/10 z-20 active:scale-90 transition-transform shadow-lg"
              title="Ver Original"
            >
              <span className="material-symbols-outlined text-sm font-black">open_in_new</span>
            </button>

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-4">
              <span className="text-[7px] font-black text-primary uppercase tracking-[0.2em] mb-1">{item.category}</span>
              <h3 className="text-white font-display font-bold text-xs leading-tight line-clamp-2">{item.title}</h3>
              <div className="mt-3 flex gap-2">
                <button 
                   onClick={() => navigate(`/salon/luxe-aura-jardins`)}
                   className="flex-1 py-2 bg-primary text-background-dark rounded-lg text-[7px] font-black uppercase tracking-widest shadow-xl"
                >
                  Agendar
                </button>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
};

export default Gallery;
