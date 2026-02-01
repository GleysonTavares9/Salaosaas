
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Professional } from '../../types';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

interface ChooseTimeProps {
  bookingDraft: any;
  setBookingDraft: React.Dispatch<React.SetStateAction<any>>;
}

const ChooseTime: React.FC<ChooseTimeProps> = ({ bookingDraft, setBookingDraft }) => {
  const navigate = useNavigate();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // 1. Calcular Duração Total
  const totalDuration = bookingDraft.services?.reduce((acc: number, s: any) => acc + (s.duration_min || 30), 0) || 30;

  const nextDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);

    // YYYY-MM-DD
    const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    const dayName = d.toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase();
    const dayShort = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
    const dayNum = d.getDate();
    const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();

    const dayKeyMap: { [key: string]: string } = {
      'segunda-feira': 'segunda',
      'terça-feira': 'terca',
      'quarta-feira': 'quarta',
      'quinta-feira': 'quinta',
      'sexta-feira': 'sexta',
      'sábado': 'sabado',
      'domingo': 'domingo'
    };

    const key = dayKeyMap[dayName] || dayName;
    const isClosed = salonData?.horario_funcionamento?.[key]?.closed;

    return {
      label: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayShort,
      date: dateStr,
      display: `${dayNum} ${monthLabel}`,
      isClosed
    };
  });

  const [selectedDay, setSelectedDay] = useState(bookingDraft.date || nextDays[0].date);
  const [salonData, setSalonData] = useState<any>(null);

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
    <div className="flex-1 flex flex-col h-full bg-background-dark relative overflow-hidden">
      <header className="px-6 pt-12 pb-4 bg-background-dark/95 backdrop-blur-xl border-b border-white/5 z-50 shrink-0 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="size-10 rounded-xl border border-white/10 flex items-center justify-center text-white active:scale-90 transition-all">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-display text-lg font-black text-white italic tracking-tighter uppercase">Escolha o Momento</h1>
        <div className="size-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pt-8 space-y-12 no-scrollbar pb-40">
        <section className="animate-fade-in">
          <div className="flex justify-between items-center mb-6 px-1">
            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Seu Artista</h3>
            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Inspirados por você</span>
          </div>
          <div className="flex gap-6 overflow-x-auto no-scrollbar py-4 px-1">
            {isLoading ? (
              <div className="flex gap-6 w-full">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex flex-col items-center gap-3 shrink-0">
                    <div className="size-20 rounded-[28px] bg-white/5 animate-pulse border border-white/5"></div>
                    <div className="h-2 w-10 bg-white/5 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : (
              professionals.length > 0 ? (
                professionals.map(pro => (
                  <button
                    key={pro.id}
                    onClick={() => selectPro(pro)}
                    className={`flex flex-col items-center gap-3 shrink-0 transition-all duration-500 ${bookingDraft.professionalId === pro.id ? 'opacity-100 scale-105' : bookingDraft.professionalId ? 'opacity-30 grayscale blur-[1px]' : 'opacity-100'}`}
                  >
                    <div className={`size-20 rounded-[28px] border-2 p-1.5 transition-all shadow-2xl ${bookingDraft.professionalId === pro.id ? 'border-primary bg-primary/5' : 'border-white/5 bg-surface-dark'}`}>
                      <img src={pro.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(pro.name)}&background=c1a571&color=0c0d10&bold=true`} className="size-full rounded-[20px] object-cover" alt={pro.name} />
                    </div>
                    <div className="text-center">
                      <p className={`text-[9px] font-black uppercase tracking-tighter leading-none mb-1 transition-colors ${bookingDraft.professionalId === pro.id ? 'text-primary' : 'text-white'}`}>{pro.name.split(' ')[0]}</p>
                      <p className="text-[7px] font-bold text-slate-500 uppercase tracking-[0.1em]">{pro.role}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="w-full py-4 text-center border border-white/5 rounded-2xl bg-surface-dark/40">
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Nenhum artista disponível nesta unidade</p>
                </div>
              )
            )}
          </div>
        </section>

        <section className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-6 ml-1">Data Aura</h3>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 px-1">
            {nextDays.map(d => (
              <button
                key={d.date}
                onClick={() => !d.isClosed && setSelectedDay(d.date)}
                disabled={d.isClosed}
                className={`shrink-0 w-24 py-6 rounded-[24px] border flex flex-col items-center transition-all shadow-xl ${d.isClosed
                    ? 'bg-red-500/5 border-red-500/10 opacity-30 cursor-not-allowed'
                    : selectedDay === d.date
                      ? 'gold-gradient text-background-dark border-primary'
                      : 'bg-surface-dark border-white/5 text-slate-500'
                  }`}
              >
                <span className={`text-[8px] font-black uppercase mb-1.5 tracking-widest ${d.isClosed ? 'text-red-400' : ''}`}>
                  {d.isClosed ? 'FECHADO' : d.label}
                </span>
                <span className={`text-sm font-black italic font-display ${d.isClosed ? 'text-slate-700' : ''}`}>
                  {d.display.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-6 ml-1">Horário Disponível</h3>

          {isLoading ? (
            <div className="text-center py-10">
              <span className="size-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin inline-block"></span>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {availableSlots.length > 0 ? availableSlots.map(t => (
                <button key={t} onClick={() => selectTime(t)} className={`py-4 rounded-2xl border text-xs font-black font-display italic transition-all shadow-md ${bookingDraft.time === t ? 'bg-primary text-background-dark border-primary' : 'bg-surface-dark border-white/5 text-slate-600 hover:border-primary/50'}`}>
                  {t}
                </button>
              )) : (
                <p className="col-span-3 text-center text-[10px] text-slate-500 font-bold uppercase py-8 border border-white/5 rounded-2xl bg-surface-dark">
                  Nenhum horário livre para essa duração ({totalDuration} min) nesta data.
                </p>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none p-4 md:p-8 pb-[calc(1rem+var(--sab))]">
        <div className="w-full max-w-md bg-background-dark/95 backdrop-blur-2xl border border-white/10 p-6 rounded-[32px] shadow-2xl pointer-events-auto">
          <button
            disabled={!canProceed}
            onClick={() => navigate('/checkout')}
            className={`w-full py-6 rounded-3xl font-black uppercase tracking-[0.4em] text-[11px] flex items-center justify-center gap-3 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${canProceed ? 'gold-gradient text-background-dark active:scale-95' : 'bg-white/5 text-slate-800 cursor-not-allowed opacity-50'}`}
          >
            AVANÇAR PARA CHECKOUT
            <span className="material-symbols-outlined font-black">arrow_forward</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ChooseTime;
