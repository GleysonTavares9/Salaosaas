
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getBeautyAdvice } from '../lib/ai.ts';

const AIConcierge: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  const hiddenPaths = ['/checkout', '/select-service', '/choose-time', '/evaluate', '/pro', '/login', '/register'];

  const isSalonPage = location.pathname.includes('/salon/');
  const isChatPage = location.pathname.includes('/chat/') || location.pathname.includes('/messages');
  const shouldHide = hiddenPaths.some(path => location.pathname.includes(path));

  if (shouldHide) return null;

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setResponse(null);
    const result = await getBeautyAdvice(input);
    setResponse(result || null);
    setLoading(false);
  };

  return (
    <>


      {/* Wrapper to constrain position to the "mobile" app frame on desktop */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[450px] mx-auto z-[9999] pointer-events-none h-0 overflow-visible">
        <button
          onClick={() => setIsOpen(true)}
          className={`absolute right-4 size-12 gold-gradient rounded-full shadow-[0_8px_30px_rgba(193,165,113,0.4)] flex items-center justify-center text-background-dark active:scale-90 transition-all border border-white/20 pointer-events-auto ${isSalonPage ? 'bottom-32' : isChatPage ? 'bottom-28' : 'bottom-24'
            }`}
          aria-label="Aura IA"
        >
          <span className="material-symbols-outlined text-lg font-black">auto_awesome</span>
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-2xl flex items-end justify-center p-4 animate-fade-in">
          <div className="w-full max-w-[420px] bg-background-dark border border-white/10 rounded-[40px] shadow-[0_0_100px_rgba(193,165,113,0.1)] p-6 md:p-8 space-y-6 animate-fade-in-up">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl gold-gradient flex items-center justify-center text-background-dark shadow-lg">
                  <span className="material-symbols-outlined text-xl font-black">psychology_alt</span>
                </div>
                <div>
                  <h3 className="text-white font-display font-black italic text-base tracking-tight leading-none">Aura Concierge</h3>
                  <p className="text-[7px] text-primary uppercase font-black tracking-[0.3em] mt-1">Intelligence</p>
                </div>
              </div>
              <button
                onClick={() => { setIsOpen(false); setResponse(null); setInput(''); }}
                className="size-8 rounded-full bg-white/5 text-slate-500 flex items-center justify-center hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="min-h-[160px] bg-surface-dark/60 rounded-[28px] p-6 border border-white/5 flex flex-col justify-center text-center">
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="size-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-[7px] text-slate-600 font-black uppercase tracking-[0.4em] animate-pulse">Processando...</p>
                </div>
              ) : response ? (
                <p className="text-white text-xs leading-relaxed italic px-2">"{response}"</p>
              ) : (
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] leading-relaxed opacity-80">
                  Como posso ajudar a planejar sua próxima experiência de beleza?
                </p>
              )}
            </div>

            <form onSubmit={handleAsk} className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex: Qual o melhor ritual para brilho?"
                className="flex-1 bg-surface-dark border border-white/5 rounded-xl py-3.5 px-5 text-white text-[11px] outline-none focus:border-primary/40 transition-all placeholder:text-slate-700 shadow-inner"
              />
              <button type="submit" className="size-11 gold-gradient rounded-xl flex items-center justify-center text-background-dark shadow-2xl active:scale-90 transition-transform disabled:opacity-50">
                <span className="material-symbols-outlined font-black text-xl">send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AIConcierge;
