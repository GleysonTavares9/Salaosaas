import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Professional } from '../../types';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

interface ChooseTimeProps {
  bookingDraft: any;
  setBookingDraft: React.Dispatch<React.SetStateAction<any>>;
}

const DAY_KEY_MAP: { [key: string]: string } = {
  'segunda-feira': 'segunda',
  'terça-feira': 'terca',
  'quarta-feira': 'quarta',
  'quinta-feira': 'quinta',
  'sexta-feira': 'sexta',
  'sábado': 'sabado',
  'domingo': 'domingo'
};

const setupDragScroll = (ref: React.RefObject<HTMLDivElement>) => {
  let isDown = false;
  let startX: number;
  let scrollLeft: number;

  return {
    onMouseDown: (e: React.MouseEvent) => {
      isDown = true;
      if (!ref.current) return;
      ref.current.classList.add('active');
      startX = e.pageX - ref.current.offsetLeft;
      scrollLeft = ref.current.scrollLeft;
    },
    onMouseLeave: () => {
      isDown = false;
      if (!ref.current) return;
      ref.current.classList.remove('active');
    },
    onMouseUp: () => {
      isDown = false;
      if (!ref.current) return;
      ref.current.classList.remove('active');
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!isDown || !ref.current) return;
      e.preventDefault();
      const x = e.pageX - ref.current.offsetLeft;
      const walk = (x - startX) * 2;
      ref.current.scrollLeft = scrollLeft - walk;
    }
  };
};

const ChooseTime: React.FC<ChooseTimeProps> = ({ bookingDraft, setBookingDraft }) => {
  const navigate = useNavigate();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [salonData, setSalonData] = useState<any>(null);

  // Drag to scroll refs
  const proScrollRef = useRef<HTMLDivElement>(null);
  const dateScrollRef = useRef<HTMLDivElement>(null);

  const proDrag = useMemo(() => setupDragScroll(proScrollRef), [proScrollRef]);
  const dateDrag = useMemo(() => setupDragScroll(dateScrollRef), [dateScrollRef]);

  // 1. Calcular Duração Total
  const totalDuration = bookingDraft.services?.reduce((acc: number, s: any) => acc + (s.duration_min || 30), 0) || 30;

  const selectedPro = useMemo(() => {
    return professionals.find(p => p.id === bookingDraft.professionalId);
  }, [professionals, bookingDraft.professionalId]);

  const nextDays = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);

      const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      const dayName = d.toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase();
      const dayShort = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
      const dayNum = d.getDate();
      const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();

      const key = DAY_KEY_MAP[dayName] || dayName;

      // Hierarquia de Fechamento: Pro > Salão
      const proClosed = selectedPro?.horario_funcionamento?.[key]?.closed;
      const salonClosed = salonData?.horario_funcionamento?.[key]?.closed;

      const isClosed = proClosed !== undefined ? proClosed : (salonClosed === undefined ? true : salonClosed);

      return {
        label: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayShort,
        date: dateStr,
        display: `${dayNum} ${monthLabel}`,
        isClosed
      };
    });
  }, [salonData, selectedPro]);

  const [selectedDay, setSelectedDay] = useState(bookingDraft.date || (nextDays[0] ? nextDays[0].date : ''));

  // Sincroniza selectedDay se o draft mudar
  useEffect(() => {
    if (bookingDraft.date && bookingDraft.date !== selectedDay) {
      setSelectedDay(bookingDraft.date);
    }
  }, [bookingDraft.date, selectedDay]);

  // Fallback: se não tiver data selecionada, pega a primeira disponível do nextDays
  useEffect(() => {
    if (!selectedDay && nextDays[0]) {
      setSelectedDay(nextDays[0].date);
    }
  }, [nextDays, selectedDay]);

  // Carregar salão e profissionais iniciais
  useEffect(() => {
    let isMounted = true;
    if (bookingDraft.salonId) {
      setIsLoading(true);
      Promise.all([
        api.salons.getById(bookingDraft.salonId),
        api.professionals.getBySalon(bookingDraft.salonId)
      ]).then(([salon, pros]) => {
        if (!isMounted) return;
        setSalonData(salon);
        setProfessionals(pros || []);
        setIsLoading(false);
      }).catch(err => {
        console.error("Erro ao carregar dados iniciais:", err);
        if (isMounted) setIsLoading(false);
      });
    }
    return () => { isMounted = false; };
  }, [bookingDraft.salonId]);

  // Gerar Slots Disponíveis
  useEffect(() => {
    if (!bookingDraft.professionalId || !salonData) {
      setAvailableSlots([]);
      return;
    }

    const generateSlots = async () => {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes() + 10;
      const { data, error } = await supabase.rpc('get_available_slots_rpc', {
        p_pro_id: bookingDraft.professionalId,
        p_date: selectedDay,
        p_duration_min: totalDuration,
        p_client_now_min: nowMin
      });

      if (error) {
        console.error("Erro ao carregar slots via RPC:", error);
        setAvailableSlots([]);
      } else {
        setAvailableSlots(data?.slots || []);
      }
    };

    generateSlots();
  }, [totalDuration, bookingDraft.professionalId, salonData, selectedDay]);

  const selectPro = (pro: Professional) => setBookingDraft({ ...bookingDraft, professionalId: pro.id, professionalName: pro.name });
  const selectTime = (time: string) => setBookingDraft({ ...bookingDraft, time, date: selectedDay });
  const canProceed = bookingDraft.professionalId && bookingDraft.time;

  return (
    <div className="flex-1 flex flex-col min-h-screen relative bg-background-dark">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-3xl px-4 lg:px-12 pt-[calc(env(safe-area-inset-top)+1rem)] lg:pt-14 pb-4 lg:pb-12 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto w-full flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="size-9 lg:size-12 rounded-xl lg:rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all hover:bg-white/5">
            <span className="material-symbols-outlined text-base lg:text-xl">arrow_back</span>
          </button>
          <div className="text-center">
            <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none text-sm lg:text-4xl lg:tracking-[0.3em]">
              Escolha o Momento
            </h1>
            <p className="text-[7px] lg:text-[11px] text-primary font-black uppercase tracking-[0.4em] mt-2 lg:mt-3 opacity-90">Sincronize sua Aura</p>
          </div>
          <div className="size-9 lg:size-12"></div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto w-full px-4 lg:px-16 py-6 lg:py-16 space-y-12 lg:space-y-24">
          <section className="animate-fade-in">
            <div className="flex justify-between items-center mb-6 lg:mb-12 px-1">
              <div className="flex items-center gap-3 lg:gap-6">
                <div className="h-[1px] w-8 lg:w-16 bg-primary"></div>
                <h3 className="text-[9px] lg:text-sm font-black text-primary uppercase tracking-[0.4em] opacity-90 leading-none">Seu Artista</h3>
              </div>
              <span className="text-[7px] lg:text-xs font-black text-slate-500 uppercase tracking-[0.2em] italic opacity-50">Inspirados por você</span>
            </div>

            <div
              ref={proScrollRef}
              {...proDrag}
              className="flex gap-4 lg:gap-14 overflow-x-auto no-scrollbar py-2 lg:py-8 px-1 cursor-grab active:cursor-grabbing select-none"
            >
              {isLoading ? (
                <div className="flex gap-6 lg:gap-12 w-full">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex flex-col items-center gap-3 lg:gap-6 shrink-0">
                      <div className="size-16 lg:size-36 rounded-[28px] lg:rounded-[56px] bg-white/5 animate-pulse border border-white/5"></div>
                      <div className="h-2 w-12 bg-white/5 rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              ) : (
                professionals.length > 0 ? (
                  professionals.map(pro => (
                    <button
                      key={pro.id}
                      onClick={() => selectPro(pro)}
                      className={`flex flex-col items-center gap-3 lg:gap-6 shrink-0 transition-all duration-500 ${bookingDraft.professionalId === pro.id ? 'scale-105 lg:scale-110' : bookingDraft.professionalId ? 'opacity-30 blur-[0.5px] scale-90 grayscale' : 'hover:scale-105'}`}
                    >
                      <div className={`size-16 lg:size-36 rounded-[28px] lg:rounded-[56px] border-2 p-1 transition-all shadow-2xl relative ${bookingDraft.professionalId === pro.id ? 'border-primary bg-primary/10 shadow-[0_0_60px_rgba(193,165,113,0.4)]' : 'border-white/5 bg-surface-dark/40 hover:border-white/20'}`}>
                        <img src={pro.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(pro.name)}&background=c1a571&color=0c0d10&bold=true`} className="size-full rounded-[24px] lg:rounded-[50px] object-cover" alt={pro.name} />
                        {bookingDraft.professionalId === pro.id && (
                          <div className="absolute -top-1 -right-1 size-6 lg:size-12 bg-primary rounded-full flex items-center justify-center border-2 border-background-dark shadow-gold animate-stamp">
                            <span className="material-symbols-outlined text-background-dark text-xs lg:text-xl font-bold">check</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <p className={`text-[10px] lg:text-sm font-black uppercase tracking-widest mb-1 transition-colors ${bookingDraft.professionalId === pro.id ? 'text-primary' : 'text-white'}`}>{pro.name}</p>
                        <p className="text-[7px] lg:text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{pro.role}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="w-full py-12 text-center border border-dashed border-white/5 rounded-[40px] bg-surface-dark/20">
                    <p className="text-[10px] lg:text-xs font-black text-slate-600 uppercase tracking-[0.5em]">Nenhum artista disponível</p>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center gap-4 lg:gap-8 mb-8 lg:mb-16 px-2">
              <div className="h-[1px] w-8 lg:w-16 bg-slate-800"></div>
              <h3 className="text-[10px] lg:text-sm font-black text-primary uppercase tracking-[0.4em] opacity-90 leading-none">Calendário Aura</h3>
            </div>

            <div
              ref={dateScrollRef}
              {...dateDrag}
              className="flex gap-3 lg:gap-10 overflow-x-auto no-scrollbar pb-6 px-1 cursor-grab active:cursor-grabbing select-none"
            >
              {nextDays.map(d => (
                <button
                  key={d.date}
                  onClick={() => !d.isClosed && setSelectedDay(d.date)}
                  disabled={d.isClosed}
                  className={`shrink-0 w-16 lg:w-40 h-20 lg:h-44 rounded-[24px] lg:rounded-[56px] border flex flex-col items-center justify-center transition-all shadow-2xl ${d.isClosed
                    ? 'bg-red-500/5 border-red-500/10 opacity-30 cursor-not-allowed'
                    : selectedDay === d.date
                      ? 'bg-primary border-primary text-background-dark shadow-[0_20px_50px_rgba(193,165,113,0.3)] scale-105'
                      : 'bg-surface-dark/40 border-white/5 text-slate-400 hover:border-white/20 hover:bg-surface-dark/60'
                    }`}
                >
                  <span className={`text-[7px] lg:text-[12px] font-black uppercase mb-0.5 lg:mb-4 tracking-[0.2em] ${d.isClosed ? 'text-red-400' : selectedDay === d.date ? 'text-background-dark/60' : ''}`}>
                    {d.isClosed ? 'FECHADO' : d.label}
                  </span>
                  <span className={`text-sm lg:text-3xl font-display font-black italic uppercase tracking-tighter ${d.isClosed ? 'text-slate-800' : ''}`}>
                    {d.display}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="animate-fade-in" style={{ animationDelay: '300ms' }}>
            <div className="flex flex-col gap-2 mb-10 px-2">
              <div className="flex items-center gap-4 lg:gap-8">
                <div className="h-[1px] w-8 lg:w-16 bg-slate-800"></div>
                <h3 className="text-[11px] lg:text-sm font-black text-primary uppercase tracking-[0.4em]">Momentos Livres</h3>
              </div>
              {selectedDay && (
                <p className="pl-12 lg:pl-24 text-[10px] lg:text-xs text-slate-500 font-bold uppercase tracking-widest italic opacity-60">
                  Ritual Aura: {totalDuration} minutos
                </p>
              )}
            </div>

            {isLoading ? (
              <div className="text-center py-32">
                <span className="size-12 lg:size-20 border-4 lg:border-8 border-primary/20 border-t-primary rounded-full animate-spin inline-block"></span>
                <p className="text-[10px] lg:text-sm font-black uppercase tracking-[0.5em] text-primary mt-10 animate-pulse">Sincronizando Disponibilidade...</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2 sm:gap-4 lg:gap-6 px-1">
                {availableSlots.length > 0 ? availableSlots.map(t => (
                  <button
                    key={t}
                    onClick={() => selectTime(t)}
                    className={`py-2.5 sm:py-5 lg:py-8 rounded-[14px] sm:rounded-[24px] lg:rounded-[40px] border transition-all shadow-xl text-[10px] sm:text-lg lg:text-3xl font-black font-display italic tracking-tighter ${bookingDraft.time === t
                      ? 'bg-primary border-primary text-background-dark shadow-[0_20px_50px_rgba(193,165,113,0.4)] scale-105 z-10'
                      : 'bg-surface-dark/40 border-white/5 text-slate-500 hover:border-primary/40 hover:text-primary active:scale-95'
                      }`}
                  >
                    {t}
                  </button>
                )) : (
                  <div className="col-span-full py-24 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-surface-dark/10">
                    <span className="material-symbols-outlined text-4xl lg:text-6xl text-slate-800 mb-6">calendar_month</span>
                    <p className="text-sm lg:text-xl text-slate-600 font-black uppercase tracking-[0.3em] max-w-md mx-auto leading-relaxed">
                      Nenhuma vaga disponível para esta data e duração selecionadas.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="relative z-10 pt-4 pb-32 flex justify-center">
        <div className="w-full max-w-[440px] px-6">
          <div className="bg-background-dark/95 backdrop-blur-3xl border border-white/10 p-3 rounded-[32px] shadow-[0_40px_120px_rgba(0,0,0,0.9)] animate-slide-up">
            <button
              disabled={!canProceed}
              onClick={() => navigate(`/checkout${window.location.search}`)}
              className={`w-full h-14 lg:h-20 rounded-[24px] font-black uppercase tracking-[0.3em] text-[10px] lg:text-sm flex items-center justify-center gap-4 transition-all group ${canProceed
                ? 'gold-gradient text-background-dark active:scale-[0.98] shadow-[0_20px_60px_rgba(193,165,113,0.4)] hover:scale-[1.02]'
                : 'bg-white/5 text-slate-800 cursor-not-allowed opacity-40'
                }`}
            >
              <span className="relative z-10">
                {canProceed ? 'CONFIRMAR AGENDAMENTO' : 'ESCOLHA UM MOMENTO'}
              </span>
              <span className="material-symbols-outlined font-black group-hover:translate-x-2 transition-transform text-lg lg:text-2xl relative z-10">arrow_forward</span>
            </button>
            {!canProceed && (
              <p className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-4 animate-pulse">
                Selecione um profissional e um horário para continuar
              </p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ChooseTime;
