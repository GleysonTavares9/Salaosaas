import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getBeautyAdvice } from '../lib/ai.ts';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { Service } from '../types';

interface AIConciergeProps {
  setBookingDraft?: React.Dispatch<React.SetStateAction<any>>;
}

const AIConcierge: React.FC<AIConciergeProps> = ({ setBookingDraft }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const hiddenPaths = ['/checkout', '/select-service', '/choose-time', '/evaluate', '/pro', '/login', '/register'];

  const isSalonPage = location.pathname.includes('/salon/');
  const isChatPage = location.pathname.includes('/chat/') || location.pathname.includes('/messages');
  const shouldHide = hiddenPaths.some(path => location.pathname.includes(path));

  // 1. Verificação de permissão da IA baseada no plano do salão
  const [isVisible, setIsVisible] = useState(false);
  const [salonContext, setSalonContext] = useState<{ id: string, name: string, slug: string } | null>(null);
  const [suggestedServices, setSuggestedServices] = useState<{ label: string, icon: string }[]>([]);
  const [hasSession, setHasSession] = useState(false);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
  }, []);

  React.useEffect(() => {
    const checkAvailability = async () => {
      setIsVisible(false); // Força esconder antes de checar permissões
      setSalonContext(null); // Reset context on nav
      if (location.pathname.includes('/salon/')) {
        // Limpa o slug de parâmetros de busca (?promo=true etc)
        const pathAfterSalon = location.pathname.split('/salon/')[1];
        const slug = pathAfterSalon?.split('?')[0];

        if (slug) {
          try {
            const salon = await api.salons.getBySlug(slug);
            if (salon?.id) {
              const billing = await api.salons.getBilling(salon.id);
              // Lógica de permissão: Se o dono ligou no painel (ai_enabled === true), 
              // nós mostramos, mesmo que o billing diga que não (para facilitar testes e upgrades)
              const aiEnabledByOwner = salon.ai_enabled === true;
              const aiEnabledByPlan = billing?.limits?.ai_enabled === true;

              // Correção: Precisa estar habilitado no plano E ligado pelo dono
              if (aiEnabledByOwner && aiEnabledByPlan) {
                setIsVisible(true);
                setSalonContext({ id: salon.id, name: salon.nome, slug: salon.slug_publico });

                // Buscar serviços reais para os botões
                const services = await api.services.getBySalon(salon.id);
                if (services && services.length > 0) {
                  const keywordToIcon: { [key: string]: string } = {
                    'corte': 'content_cut', 'barba': 'face', 'unha': 'back_hand',
                    'manicure': 'back_hand', 'pedicure': 'back_hand', 'sobrancelha': 'visibility',
                    'estética': 'auto_fix_high', 'massagem': 'spa', 'spa': 'spa', 'limpeza': 'face_retouching_natural'
                  };

                  const dynamic = services.slice(0, 6).map(s => {
                    const lower = s.name.toLowerCase();
                    const entry = Object.entries(keywordToIcon).find(([key]) => lower.includes(key));
                    return { label: s.name, icon: entry ? entry[1] : 'event_available' };
                  });
                  setSuggestedServices(dynamic);
                }
              } else {
                setIsVisible(false);
              }
            }
          } catch (e) {
            console.error("Erro Aura Perms:", e);
            setIsVisible(false);
          }
        }
      } else if (location.pathname.startsWith('/pro')) {
        // Se estiver no painel Pro, busca o salão do usuário logado
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: pro } = await supabase.from('professionals').select('salon_id').eq('user_id', user.id).maybeSingle();
            if (pro?.salon_id) {
              const salon = await api.salons.getById(pro.salon_id);
              if (salon) {
                setIsVisible(true);
                setSalonContext({ id: salon.id, name: salon.nome });

                // No Dashboard Pro também mostramos os serviços do dono
                const services = await api.services.getBySalon(salon.id);
                if (services && services.length > 0) {
                  const dynamic = services.slice(0, 6).map(s => ({
                    label: s.name,
                    icon: 'event_available'
                  }));
                  setSuggestedServices(dynamic);
                }
              }
            }
          }
        } catch (e) { console.error(e); }
      } else {
        setIsVisible(false);
      }
    };
    checkAvailability();
  }, [location.pathname]);

  if (shouldHide || !isVisible) return null;

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Liberado para todos: Eliminamos a checagem obrigatória de sessão
      // Chamamos a biblioteca de IA passando a mensagem atual e o histórico
      // E agora o Contexto do Salão se existir
      const result = await getBeautyAdvice(userMessage, messages, salonContext ? { salonId: salonContext.id, salonName: salonContext.name } : undefined);
      const aiResponse = result || "Não consegui processar sua dúvida agora. Tente novamente.";

      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
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
      <div className="fixed bottom-0 left-0 right-0 max-w-full max-w-[450px] mx-auto z-[999] pointer-events-none h-0 overflow-visible">
        <button
          onClick={() => setIsOpen(true)}
          className={`absolute left-4 size-10 sm:size-12 lg:size-10 sm:size-11 lg:size-12 lg:size-10 sm:size-12 lg:size-14 gold-gradient rounded-full shadow-[0_15px_40px_rgba(193,165,113,0.3)] flex flex-col items-center justify-center text-background-dark active:scale-90 transition-all border-2 border-white/20 pointer-events-auto ${isSalonPage ? 'bottom-32' : isChatPage ? 'bottom-28' : 'bottom-24'
            }`}
          aria-label="Aura IA"
        >
          <span className="material-symbols-outlined text-lg lg:text-[20px] font-black leading-none">auto_awesome</span>
          <span className="text-[5px] lg:text-[6px] font-black uppercase tracking-widest mt-0.5 leading-none">Aura AI</span>
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-2xl flex items-end justify-center p-4 sm:p-4 lg:p-4 animate-fade-in">
          <div className="w-full max-w-full max-w-[420px] bg-background-dark border border-white/10 rounded-2xl sm:rounded-3xl lg:rounded-[40px] shadow-[0_0_100px_rgba(193,165,113,0.1)] p-6 sm:p-6 lg:p-6 md:p-8 sm:p-8 lg:p-8 space-y-6 animate-fade-in-up">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3 lg:gap-3">
                <div className="size-10 sm:size-12 lg:size-10 sm:size-11 lg:size-12 rounded-2xl gold-gradient flex items-center justify-center text-background-dark shadow-[0_10px_20px_rgba(193,165,113,0.3)] relative">
                  <span className="material-symbols-outlined text-xl font-black">psychology_alt</span>
                  <div className="absolute -top-1 -right-1 size-3 bg-emerald-500 border-2 border-background-dark rounded-full"></div>
                </div>
                <div>
                  <h3 className="text-white font-display font-black italic text-lg tracking-tight leading-none uppercase">Aura Concierge</h3>
                  <div className="flex items-center gap-2 lg:gap-2 mt-1">
                    <span className="text-[7px] text-primary uppercase font-black tracking-[0.3em] leading-none">Active Intelligence</span>
                    <span className="text-[7px] text-emerald-500 font-black uppercase leading-none opacity-80 animate-pulse">• Online</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setIsOpen(false); setMessages([]); setInput(''); }}
                className="size-10 sm:size-12 lg:size-10 rounded-xl bg-white/5 text-slate-500 flex items-center justify-center hover:text-white transition-all active:scale-90 border border-white/5"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="flex-1 min-h-auto min-h-[250px] max-h-auto min-h-[350px] overflow-y-auto bg-surface-dark/60 rounded-[28px] p-6 sm:p-6 lg:p-6 border border-white/5 space-y-4 scrollbar-hide">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                  <div className="space-y-2">
                    <p className="text-white font-bold text-xs">Olá! Eu sou a Aura.</p>
                    <p className="text-slate-500 text-[10px] leading-relaxed max-w-full max-w-[200px] mx-auto">
                      Posso te ajudar a encontrar e agendar o serviço ideal agora mesmo.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-2 w-full">
                    {suggestedServices.length > 0 ? (
                      suggestedServices.map((btn, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setInput(`Quero agendar ${btn.label}`);
                            setTimeout(() => {
                              document.getElementById('aura-submit-btn')?.click();
                            }, 50);
                          }}
                          className="flex flex-col items-center justify-center gap-2 lg:gap-2 p-4 sm:p-4 lg:p-4 bg-white/5 border border-white/10 rounded-[24px] hover:bg-white/10 transition-all active:scale-95 group text-center"
                        >
                          <span className="material-symbols-outlined text-primary text-xl group-hover:scale-110 transition-transform">{btn.icon}</span>
                          <span className="text-[9px] text-white/80 font-black uppercase tracking-widest line-clamp-1">{btn.label}</span>
                        </button>
                      ))
                    ) : (
                      <div className="col-span-2 py-4 sm:py-4 lg:py-4 bg-white/5 border border-white/10 rounded-2xl">
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Diga o que você deseja agendar ✨</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                      <div className={`max-w-[85%] p-4 sm:p-4 lg:p-4 rounded-2xl whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary/10 border border-primary/20 text-white' : 'bg-white/5 border border-white/10 text-white/90'}`}>
                        <p className="text-[11px] leading-relaxed">
                          {msg.content
                            .replace(/\/choose-time\?\S+/g, '')
                            .replace(/\(ID:.*?\)/g, '')
                            .trim()}
                        </p>

                        {/* Botão de Agendamento Inteligente apenas na resposta da IA */}
                        {msg.role === 'assistant' && (msg.content.includes('/q/') || msg.content.includes('/salon/') || msg.content.includes('/choose-time')) && (
                          <button
                            onClick={async () => {
                              const chooseTime = msg.content.includes('/choose-time');
                              if (chooseTime && salonContext) {
                                // Extrai os parâmetros do link sugerido pela IA
                                const linkMatch = msg.content.match(/\/choose-time\?(\S+)/);
                                const searchParams = linkMatch ? `?${linkMatch[1]}` : '?promo=true';

                                // Marca na sessão que a promo é legítima (vindo da IA)
                                sessionStorage.setItem('aura_promo_verified', 'true');

                                // Redireciona para o bot (QuickSchedule) com os parâmetros preservados
                                navigate(`/q/${salonContext.slug}${searchParams.replace(/\.$/, '')}`);
                                setIsOpen(false);
                                return;
                              }

                              const qSlug = msg.content.match(/\/q\/[a-zA-Z0-9-]+/)?.[0];
                              const normSlug = msg.content.match(/\/salon\/[a-zA-Z0-9-]+/)?.[0];
                              const slugPattern = qSlug || normSlug;

                              if (slugPattern) {
                                navigate(slugPattern);
                                setIsOpen(false);
                              }
                            }}
                            className="w-full mt-3 py-2 sm:py-2 lg:py-2.5 gold-gradient border border-white/20 rounded-xl text-background-dark text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2 lg:gap-2 shadow-[0_10px_20px_rgba(193,165,113,0.2)]"
                          >
                            <span className="material-symbols-outlined text-[14px]">{hasSession ? 'confirmation_number' : 'login'}</span>
                            {msg.content.includes('/choose-time')
                              ? (hasSession ? 'Finalizar Reserva ✨' : 'Entrar e Reservar ✨')
                              : 'Agendar Agora ✨'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="bg-white/5 border border-white/10 p-4 sm:p-4 lg:p-4 rounded-2xl flex items-center gap-3 lg:gap-3">
                        <div className="size-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Aura está pensando...</span>
                      </div>
                    </div>
                  )}
                </>
              )}
              {/* Fake div for scroll to bottom */}
              <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
            </div>

            <form onSubmit={handleAsk} className="flex gap-2 lg:gap-2">
              <input
                autoFocus
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Dúvida?"
                className="flex-1 bg-surface-dark border border-white/5 rounded-xl py-3 sm:py-3 lg:py-3.5 px-5 sm:px-5 lg:px-5 text-white text-[11px] outline-none focus:border-primary/40 transition-all placeholder:text-slate-700 shadow-inner"
              />
              <button id="aura-submit-btn" type="submit" className="size-10 sm:size-12 lg:size-10 sm:size-11 lg:size-12 gold-gradient rounded-xl flex items-center justify-center text-background-dark shadow-2xl active:scale-90 transition-transform disabled:opacity-50">
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
