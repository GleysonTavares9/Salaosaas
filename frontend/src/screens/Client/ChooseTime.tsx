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

const ChooseTime: React.FC<ChooseTimeProps> = ({ bookingDraft, setBookingDraft }) => {
  const navigate = useNavigate();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // Drag to scroll refs
  const proScrollRef = useRef<HTMLDivElement>(null);
  const dateScrollRef = useRef<HTMLDivElement>(null);

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

  const proDrag = setupDragScroll(proScrollRef);
  const dateDrag = setupDragScroll(dateScrollRef);

  // 1. Calcular Duração Total
  const totalDuration = bookingDraft.services?.reduce((acc: number, s: any) => acc + (s.duration_min || 30), 0) || 30;

  const [salonData, setSalonData] = useState<any>(null);

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

  // Carregar salão, profissionais e agendamentos existentes
  useEffect(() => {
    let isMounted = true;
    if (bookingDraft.salonId) {
      setIsLoading(true);
      Promise.all([
        api.salons.getById(bookingDraft.salonId),
        api.professionals.getBySalon(bookingDraft.salonId),
        bookingDraft.professionalId ? api.appointments.getByProfessional(bookingDraft.professionalId) : Promise.resolve([])
      ]).then(([salon, pros, appts]) => {
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

  // Novo Effect: Recarrega agendamentos SEMPRE que mudar o profissional ou a data
  useEffect(() => {
    let isMounted = true;
    if (bookingDraft.professionalId) {
      // Pequeno loading local opcional ou apenas atualiza estado
      api.appointments.getByProfessional(bookingDraft.professionalId)
        .then(appts => {
          if (!isMounted) return;

          // Comparação robusta de datas (YYYY-MM-DD)
          const filteredAppts = Array.isArray(appts)
            ? appts.filter((a: any) => {
              const apptDate = a.date?.split('T')[0];
              return apptDate === selectedDay && a.status !== 'canceled'; // Garante que cancelados não ocupem vaga
            })
            : [];

          setExistingAppointments(filteredAppts);
        })
        .catch(err => console.error("Erro ao atualizar agenda do profissional:", err));
    } else {
      setExistingAppointments([]);
    }
    return () => { isMounted = false; };
  }, [bookingDraft.professionalId, selectedDay]);

  // Gerar Slots Disponíveis
  useEffect(() => {
    if (!bookingDraft.professionalId || !salonData) {
      setAvailableSlots([]);
      return;
    }

    const generateSlots = async () => {
      if (!bookingDraft.professionalId || !salonData) {
        setAvailableSlots([]);
        return;
      }

      // Cálculo do horário local em minutos para sincronia de fuso
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
    <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-background-dark">
      <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-2xl px-6 pt-12 pb-8 border-b border-white/5">
        <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="size-12 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="text-center">
            <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none" style={{ fontSize: 'var(--step-1)' }}>Escolha o Momento</h1>
            <p className="text-[7px] text-primary font-black uppercase tracking-[0.4em] mt-2">Sincronize sua Aura</p>
          </div>
          <div className="size-12"></div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        <div className="max-w-[1200px] mx-auto w-full px-6 py-10 pb-48 space-y-16">
          <section className="animate-fade-in">
            <div className="flex justify-between items-center mb-8 px-2">
              <div className="flex items-center gap-4">
                <div className="h-0.5 w-8 bg-primary"></div>
                <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Seu Artista</h3>
              </div>
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] italic">Inspirados por você</span>
            </div>
            <div
              ref={proScrollRef}
              {...proDrag}
              className="flex gap-8 overflow-x-auto no-scrollbar py-6 px-2 cursor-grab active:cursor-grabbing select-none"
            >
              {isLoading ? (
                <div className="flex gap-8 w-full">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex flex-col items-center gap-4 shrink-0">
                      <div className="size-24 rounded-[32px] bg-white/5 animate-pulse border border-white/5"></div>
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
                      className={`flex flex-col items-center gap-4 shrink-0 transition-all duration-500 ${bookingDraft.professionalId === pro.id ? 'opacity-100 scale-110' : bookingDraft.professionalId ? 'opacity-20 grayscale blur-[2px] scale-90' : 'opacity-100 hover:scale-105'}`}
                    >
                      <div className={`size-24 lg:size-28 rounded-[36px] border-2 p-1.5 transition-all shadow-2xl relative ${bookingDraft.professionalId === pro.id ? 'border-primary bg-primary/10 shadow-[0_0_30px_rgba(193,165,113,0.3)]' : 'border-white/5 bg-surface-dark/40 hover:border-white/20'}`}>
                        <img src={pro.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(pro.name)}&background=c1a571&color=0c0d10&bold=true`} className="size-full rounded-[28px] object-cover" alt={pro.name} />
                        {bookingDraft.professionalId === pro.id && (
                          <div className="absolute -top-2 -right-2 size-8 bg-primary rounded-full flex items-center justify-center border-4 border-background-dark shadow-gold">
                            <span className="material-symbols-outlined text-background-dark text-sm font-black">check</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1.5 transition-colors ${bookingDraft.professionalId === pro.id ? 'text-primary' : 'text-white'}`}>{pro.name.split(' ')[0]}</p>
                        <p className="text-[7px] font-black text-slate-600 uppercase tracking-[0.2em]">{pro.role}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="w-full py-12 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-surface-dark/20">
                    <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em]">Nenhum artista disponível nesta unidade</p>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-4 mb-8 px-2">
              <div className="h-0.5 w-8 bg-slate-800"></div>
              <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Calendário Aura</h3>
            </div>
            <div
              ref={dateScrollRef}
              {...dateDrag}
              className="flex gap-6 overflow-x-auto no-scrollbar pb-6 px-2 cursor-grab active:cursor-grabbing select-none"
            >
              {nextDays.map(d => (
                <button
                  key={d.date}
                  onClick={() => !d.isClosed && setSelectedDay(d.date)}
                  disabled={d.isClosed}
                  className={`shrink-0 w-28 py-8 rounded-[32px] border-2 flex flex-col items-center transition-all shadow-2xl ${d.isClosed
                    ? 'bg-red-500/5 border-red-500/10 opacity-20 cursor-not-allowed'
                    : selectedDay === d.date
                      ? 'bg-primary border-primary text-background-dark shadow-[0_15px_40px_rgba(193,165,113,0.3)]'
                      : 'bg-surface-dark/40 border-white/5 text-slate-500 hover:border-white/10 hover:bg-surface-dark/60'
                    }`}
                >
                  <span className={`text-[9px] font-black uppercase mb-3 tracking-[0.2em] ${d.isClosed ? 'text-red-400' : selectedDay === d.date ? 'text-background-dark/60' : ''}`}>
                    {d.isClosed ? 'FECHADO' : d.label}
                  </span>
                  <span className={`text-base font-display font-black italic uppercase tracking-tighter ${d.isClosed ? 'text-slate-800' : ''}`}>
                    {d.display}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-4 mb-8 px-2">
              <div className="h-0.5 w-8 bg-slate-800"></div>
              <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Momentos Livres</h3>
            </div>

            {isLoading ? (
              <div className="text-center py-20">
                <span className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin inline-block"></span>
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-primary mt-6 animate-pulse">Consultando disponibilidade...</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 px-2">
                {availableSlots.length > 0 ? availableSlots.map(t => (
                  <button
                    key={t}
                    onClick={() => selectTime(t)}
                    className={`py-5 rounded-[24px] border-2 text-sm font-black font-display italic tracking-tight transition-all shadow-xl ${bookingDraft.time === t
                      ? 'bg-primary border-primary text-background-dark shadow-[0_10px_30px_rgba(193,165,113,0.3)]'
                      : 'bg-surface-dark/40 border-white/5 text-slate-600 hover:border-primary/40 hover:text-primary active:scale-95'
                      }`}
                  >
                    {t}
                  </button>
                )) : (
                  <div className="col-span-full py-16 text-center border border-dashed border-white/5 rounded-[40px] bg-surface-dark/10">
                    <p className="text-[10px] text-slate-700 font-black uppercase tracking-[0.3em]">
                      Nenhuma vaga para esta duração na data selecionada.
                    </p>
                    <p className="text-[8px] text-slate-800 font-bold uppercase tracking-widest mt-2 italic">Duração do Ritual: {totalDuration} min</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-6 lg:p-10 pointer-events-none pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="w-full max-w-[450px] bg-background-dark/80 backdrop-blur-3xl border border-white/10 p-5 rounded-[40px] shadow-[0_30px_100px_rgba(0,0,0,0.8)] pointer-events-auto animate-slide-up">
          <button
            disabled={!canProceed}
            onClick={() => navigate(`/checkout${window.location.search}`)}
            className={`w-full py-6 lg:py-8 rounded-[32px] font-black uppercase tracking-[0.4em] text-[10px] lg:text-[11px] flex items-center justify-center gap-4 transition-all group ${canProceed
              ? 'gold-gradient text-background-dark active:scale-95 shadow-[0_15px_40px_rgba(193,165,113,0.3)]'
              : 'bg-white/5 text-slate-800 cursor-not-allowed opacity-40'
              }`}
          >
            CONFIRMAR AGENDAMENTO
            <span className="material-symbols-outlined font-black group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ChooseTime;
