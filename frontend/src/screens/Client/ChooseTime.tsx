
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Professional } from '../../types';
import { api } from '../../lib/api';

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

  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const dayAfter = new Date(Date.now() + 172800000);

  const days = [
    {
      label: 'Hoje',
      date: today.toISOString().split('T')[0],
      display: today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    },
    {
      label: 'Amanhã',
      date: tomorrow.toISOString().split('T')[0],
      display: tomorrow.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    },
    {
      label: 'Próximo',
      date: dayAfter.toISOString().split('T')[0],
      display: dayAfter.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    },
  ];

  const [selectedDay, setSelectedDay] = useState(bookingDraft.date || days[0].date);
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

        // Comparação robusta de datas (YYYY-MM-DD)
        const filteredAppts = Array.isArray(appts)
          ? appts.filter((a: any) => {
            const apptDate = a.date?.split('T')[0];
            return apptDate === selectedDay && a.status !== 'canceled';
          })
          : [];
        setExistingAppointments(filteredAppts);
        setIsLoading(false);
      }).catch(err => {
        console.error("Erro ao carregar dados de agendamento:", err);
        if (isMounted) setIsLoading(false);
      });
    }
    return () => { isMounted = false; };
  }, [bookingDraft.salonId, bookingDraft.professionalId, selectedDay]);

  // Gerar Slots Disponíveis
  useEffect(() => {
    if (!bookingDraft.professionalId || !salonData) {
      setAvailableSlots([]);
      return;
    }

    const generateSlots = () => {
      const slots = [];

      // Mapeamento de dia JS (0-6)
      const dateParts = selectedDay.split('-').map(Number);
      const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDayKey = dayKeys[dateObj.getDay()];
      const daySchedule = salonData?.horario_funcionamento?.[currentDayKey];

      if (!daySchedule || !daySchedule.enabled) {
        setAvailableSlots([]);
        return;
      }

      const [startHour, startMin] = daySchedule.open.split(':').map(Number);
      const [endHour, endMin] = daySchedule.close.split(':').map(Number);
      const startLimit = startHour * 60 + startMin;
      const endLimit = endHour * 60 + endMin;

      // Horário atual em minutos para o caso de ser "Hoje"
      const now = new Date();
      const isToday = selectedDay === now.toISOString().split('T')[0];
      const nowInMinutes = now.getHours() * 60 + now.getMinutes() + 15; // +15min de tolerância

      // Converter horários existentes em minutos
      const busyIntervals = existingAppointments.map(a => {
        const [h, m] = a.time.split(':').map(Number);
        const start = h * 60 + m;
        const duration = a.duration_min || 30;
        return { start, end: start + duration };
      });

      // Gerar slots de 30 em 30 minutos
      for (let timeMin = startLimit; timeMin < endLimit; timeMin += 30) {
        // Ignorar horários passados se for hoje
        if (isToday && timeMin < nowInMinutes) continue;

        const currentTimeMin = timeMin;
        const endTimeMin = currentTimeMin + totalDuration;

        // Validar limite de fechamento
        if (endTimeMin > endLimit) continue;

        // Verificar conflitos com agendamentos existentes
        const isConflict = busyIntervals.some(busy => {
          // Sobreposição: (Início1 < Fim2) && (Fim1 > Início2)
          return (currentTimeMin < busy.end && endTimeMin > busy.start);
        });

        if (!isConflict) {
          const h = Math.floor(currentTimeMin / 60);
          const m = currentTimeMin % 60;
          slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
      }
      setAvailableSlots(slots);
    };

    generateSlots();
  }, [existingAppointments, totalDuration, bookingDraft.professionalId, salonData, selectedDay]);

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
          <div className="flex gap-4">
            {days.map(d => (
              <button key={d.date} onClick={() => setSelectedDay(d.date)} className={`flex-1 py-5 rounded-[24px] border flex flex-col items-center transition-all shadow-xl ${selectedDay === d.date ? 'gold-gradient text-background-dark border-primary' : 'bg-surface-dark border-white/5 text-slate-500'}`}>
                <span className="text-[8px] font-black uppercase mb-1.5 tracking-widest">{d.label}</span>
                <span className="text-sm font-black italic font-display">{d.display.toUpperCase()}</span>
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
            <div className="grid grid-cols-3 gap-3">
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

      <footer className="fixed bottom-0 left-0 right-0 p-8 bg-background-dark/95 backdrop-blur-xl border-t border-white/5 max-w-[450px] mx-auto z-50">
        <button
          disabled={!canProceed}
          onClick={() => navigate('/checkout')}
          className={`w-full py-6 rounded-3xl font-black uppercase tracking-[0.4em] text-[11px] flex items-center justify-center gap-3 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${canProceed ? 'gold-gradient text-background-dark active:scale-95' : 'bg-white/5 text-slate-800 cursor-not-allowed opacity-50'}`}
        >
          AVANÇAR PARA CHECKOUT
          <span className="material-symbols-outlined font-black">arrow_forward</span>
        </button>
      </footer>
    </div>
  );
};

export default ChooseTime;
