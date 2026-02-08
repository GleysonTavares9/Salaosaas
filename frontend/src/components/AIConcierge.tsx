
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getBeautyAdvice } from '../lib/ai.ts';

import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

const AIConcierge: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const hiddenPaths = ['/checkout', '/select-service', '/choose-time', '/evaluate', '/pro', '/login', '/register'];

  const isSalonPage = location.pathname.includes('/salon/');
  const isChatPage = location.pathname.includes('/chat/') || location.pathname.includes('/messages');
  const shouldHide = hiddenPaths.some(path => location.pathname.includes(path));

  // 1. Verificação de permissão da IA baseada no plano do salão
  const [isVisible, setIsVisible] = useState(true);

  React.useEffect(() => {
    const checkAvailability = async () => {
      if (location.pathname.includes('/salon/')) {
        const slug = location.pathname.split('/salon/')[1];
        if (slug) {
          try {
            const salon = await api.salons.getBySlug(slug);
            if (salon?.id) {
              const billing = await api.salons.getBilling(salon.id);
              if (billing && !billing.limits.ai_enabled) {
                setIsVisible(false);
              } else {
                setIsVisible(true);
              }
            }
          } catch (e) {
            console.error("Erro ao verificar permissão da IA:", e);
          }
        }
      }
    };
    checkAvailability();
  }, [location.pathname]);


  if (shouldHide || !isVisible) return null;

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setResponse(null);

    // Chamada à IA com Verificação de Sessão Robusta
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const currentSession = data?.session;

      if (sessionError || !currentSession) {
        console.warn("Sessão não encontrada:", sessionError);
        showToast("Sessão expirada ou não encontrada. Por favor, faça login novamente.", "error");
        setLoading(false);
        return;
      }

      // Se temos sessão, chamamos a IA
      const result = await getBeautyAdvice(input);
      setResponse(result || "Não consegui processar sua dúvida agora. Tente novamente.");
    } catch (err) {
      console.error("Erro ao validar acesso à IA:", err);
      showToast("Erro ao conectar com a Aura. Verifique sua conexão.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>


      {/* Wrapper to constrain position to the "mobile" app frame on desktop */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[450px] mx-auto z-[9999] pointer-events-none h-0 overflow-visible">
        <button
          onClick={() => setIsOpen(true)}
          className={`absolute left-4 size-14 gold-gradient rounded-full shadow-[0_15px_40px_rgba(193,165,113,0.4)] flex flex-col items-center justify-center text-background-dark active:scale-90 transition-all border-2 border-white/20 pointer-events-auto ${isSalonPage ? 'bottom-32' : isChatPage ? 'bottom-28' : 'bottom-24'
            }`}
          aria-label="Aura IA"
        >
          <span className="material-symbols-outlined text-[20px] font-black leading-none">auto_awesome</span>
          <span className="text-[6px] font-black uppercase tracking-widest mt-0.5 leading-none">Aura AI</span>
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-2xl flex items-end justify-center p-4 animate-fade-in">
          <div className="w-full max-w-[420px] bg-background-dark border border-white/10 rounded-[40px] shadow-[0_0_100px_rgba(193,165,113,0.1)] p-6 md:p-8 space-y-6 animate-fade-in-up">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl gold-gradient flex items-center justify-center text-background-dark shadow-[0_10px_20px_rgba(193,165,113,0.3)] relative">
                  <span className="material-symbols-outlined text-xl font-black">psychology_alt</span>
                  <div className="absolute -top-1 -right-1 size-3 bg-emerald-500 border-2 border-background-dark rounded-full"></div>
                </div>
                <div>
                  <h3 className="text-white font-display font-black italic text-lg tracking-tight leading-none uppercase">Aura Concierge</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[7px] text-primary uppercase font-black tracking-[0.3em] leading-none">Active Intelligence</span>
                    <span className="text-[7px] text-emerald-500 font-black uppercase leading-none opacity-80 animate-pulse">• Online</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setIsOpen(false); setResponse(null); setInput(''); }}
                className="size-10 rounded-xl bg-white/5 text-slate-500 flex items-center justify-center hover:text-white transition-all active:scale-90 border border-white/5"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="min-h-[160px] bg-surface-dark/60 rounded-[28px] p-6 border border-white/5 flex flex-col justify-center text-center">
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="size-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-[7px] text-slate-600 font-black uppercase tracking-[0.4em] animate-pulse">Aura IA</p>
                </div>
              ) : response ? (
                <div className="space-y-4">
                  <p className="text-white text-xs leading-relaxed italic px-2">{response}</p>
                  {/* Detecção de Link de Agendamento Rápido ou Normal */}
                  {(response.includes('/q/') || response.includes('/salon/')) && (
                    <button
                      onClick={() => {
                        const qSlug = response.match(/\/q\/[a-zA-Z0-9-]+/)?.[0];
                        const normSlug = response.match(/\/salon\/[a-zA-Z0-9-]+/)?.[0];
                        const slug = qSlug || normSlug;
                        if (slug) {
                          navigate(slug);
                          setIsOpen(false);
                        }
                      }}
                      className="w-full py-3 bg-primary/20 border border-primary/40 rounded-xl text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/30 transition-all active:scale-95 shadow-lg shadow-primary/10 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">bolt</span>
                      Agendamento Rápido ✨
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] leading-relaxed opacity-80">
                  Como posso ajudar?
                </p>
              )}
            </div>

            <form onSubmit={handleAsk} className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Dúvida?"
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
