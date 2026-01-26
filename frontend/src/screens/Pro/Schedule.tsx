import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Appointment } from '../../types';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import Calendar from '../../components/Calendar';

interface ScheduleProps {
  appointments: Appointment[];
  salon: any;
  onUpdateStatus: (id: string, status: Appointment['status']) => void;
}

const Schedule: React.FC<ScheduleProps> = ({ appointments: initialAppointments, salon: initialSalon, onUpdateStatus }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'grid' | 'list'>('grid');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [salon, setSalon] = useState<any>(initialSalon);
  const [isLoading, setIsLoading] = useState(!initialSalon);

  // Efeito para garantir que os dados REAIS do salão e agendamentos sejam carregados
  useEffect(() => {
    const fetchRealData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // 1. Buscar vínculo do profissional para saber qual o salão dele
        const { data: proData } = await supabase
          .from('professionals')
          .select('id, salon_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (proData) {
          // 2. Buscar dados REAIS do salão (para pegar horários)
          const realSalon = await api.salons.getById(proData.salon_id);
          setSalon(realSalon);

          // 3. Buscar agendamentos REAIS do dia
          const realAppts = await api.appointments.getByProfessional(proData.id);
          setAppointments(realAppts);
        }
      } catch (err) {
        console.error("Erro ao sincronizar agenda real:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRealData();
  }, [initialSalon, initialAppointments]);

  // Identificar o dia da semana da data selecionada e as horas de funcionamento
  const dateParts = selectedDate.split('-').map(Number);
  const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayKey = dayKeys[dateObj.getDay()];
  const daySchedule = salon?.horario_funcionamento?.[currentDayKey];

  // Definir Horários Dinâmicos baseados no Salão REAL
  const salonOpen = daySchedule?.enabled ? parseInt(daySchedule.open.split(':')[0]) : 8;
  const salonClose = daySchedule?.enabled ? parseInt(daySchedule.close.split(':')[0]) : 20;

  const startHour = Math.max(0, salonOpen);
  const endHour = Math.min(23, salonClose);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  // Filtra agendamentos da data selecionada
  const todayAppointments = appointments.filter(a => a.date === selectedDate && a.status !== 'canceled');

  const handleFinish = (id: string) => {
    if (window.confirm("Deseja marcar este atendimento como FINALIZADO?")) {
      onUpdateStatus(id, 'completed');
    }
  };

  const getPosition = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const offset = Math.max(0, h - startHour);
    const top = offset * 100 + (m / 60) * 100;
    return top;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetHour: number, targetMin: number) => {
    e.preventDefault();
    const apptId = e.dataTransfer.getData('apptId');
    if (!apptId) return;

    const newTime = `${targetHour.toString().padStart(2, '0')}:${targetMin.toString().padStart(2, '0')}`;

    try {
      await api.appointments.update(apptId, { time: newTime });
      // Recarregar agendamentos para ver a mudança
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: pro } = await supabase.from('professionals').select('id').eq('user_id', session.user.id).single();
        if (pro) {
          const updated = await api.appointments.getByProfessional(pro.id);
          setAppointments(updated);
        }
      }
    } catch (error) {
      alert("Erro ao reagendar: " + error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-background-dark min-h-screen flex items-center justify-center">
        <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background-dark min-h-screen pb-32">
      <header className="sticky top-0 z-[100] bg-background-dark/95 backdrop-blur-xl px-6 pt-12 pb-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/pro')} className="size-10 rounded-full border border-white/10 flex items-center justify-center text-white">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="font-display text-xl font-bold text-white italic tracking-tighter uppercase">Agenda Profissional</h1>
              <p className="text-[8px] text-primary font-black uppercase tracking-widest">{salon?.nome || 'Carregando unidade...'}</p>
            </div>
          </div>

          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className={`size-12 rounded-2xl flex items-center justify-center transition-all ${showCalendar ? 'bg-primary text-background-dark shadow-gold' : 'bg-surface-dark text-white border border-white/5'}`}
          >
            <span className="material-symbols-outlined">{showCalendar ? 'calendar_month' : 'calendar_today'}</span>
          </button>
        </div>

        {showCalendar && (
          <div className="mb-6 animate-fade-in">
            <Calendar
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                setSelectedDate(date);
                setShowCalendar(false);
              }}
            />
          </div>
        )}

        <div className="flex bg-surface-dark p-1 rounded-2xl border border-white/5">
          <button onClick={() => setActiveTab('grid')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'grid' ? 'bg-primary text-background-dark shadow-lg' : 'text-slate-500'}`}>Visualização Grade</button>
          <button onClick={() => setActiveTab('list')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'list' ? 'bg-primary text-background-dark shadow-lg' : 'text-slate-500'}`}>Lista Linear</button>
        </div>
      </header>

      <div className="px-6 py-4 bg-surface-dark/40 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-sm">event</span>
          <span className="text-[10px] font-black text-white uppercase tracking-widest">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </span>
        </div>
      </div>

      <main className="px-4 py-8 animate-fade-in no-scrollbar">
        {activeTab === 'grid' ? (
          <div
            className="relative bg-surface-dark/30 rounded-[40px] border border-white/5 p-4 overflow-hidden"
            style={{ minHeight: `${hours.length * 100 + 80}px` }}
          >
            {/* Linhas de Horário with Drop Zones */}
            {hours.map(h => (
              <div key={h} className="relative h-[100px] border-t border-white/5 w-full flex flex-col">
                <div
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, h, 0)}
                  className="h-1/2 w-full flex items-start pt-2 group/zone relative"
                >
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter w-12">{h.toString().padStart(2, '0')}:00</span>
                  <div className="flex-1 h-px bg-white/[0.02] mt-2 ml-2 group-hover/zone:bg-primary/20 transition-colors"></div>
                </div>
                <div
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, h, 30)}
                  className="h-1/2 w-full flex items-start pt-2 group/zone relative"
                >
                  <span className="text-[8px] font-black text-slate-800 uppercase tracking-tighter w-12 opacity-0 group-hover/zone:opacity-60 transition-opacity">{h}:30</span>
                  <div className="flex-1 h-px bg-white/[0.01] mt-2 ml-2 border-t border-dashed border-white/5 group-hover/zone:bg-primary/10 transition-colors"></div>
                </div>
              </div>
            ))}

            {daySchedule?.enabled === false && (
              <div className="absolute inset-x-8 top-12 bg-red-500/10 border border-red-500/20 p-6 rounded-[32px] text-center backdrop-blur-md z-50 animate-fade-in">
                <span className="material-symbols-outlined text-red-500 mb-2">lock_clock</span>
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Estabelecimento Fechado Hoje</p>
                <p className="text-[8px] text-slate-400 mt-1">Sua janela de atendimento está desativada para hoje.</p>
              </div>
            )}

            {/* Cards de Agendamento */}
            {todayAppointments.map(appt => {
              const top = getPosition(appt.time);
              const height = Math.max(80, (appt.duration_min || 60) / 60 * 100 - 10);

              return (
                <div
                  key={appt.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('apptId', appt.id);
                    setTimeout(() => (e.target as HTMLElement).style.opacity = '0.3', 0);
                  }}
                  onDragEnd={(e) => {
                    (e.target as HTMLElement).style.opacity = '1';
                  }}
                  style={{ top: `${top + 8}px`, height: `${height}px`, left: '60px', width: 'calc(100% - 75px)' }}
                  className="absolute z-10 p-4 rounded-3xl border-l-[6px] border border-white/10 shadow-2xl transition-all cursor-grab active:cursor-grabbing group overflow-hidden bg-surface-dark/90 backdrop-blur-md"
                  onClick={() => handleFinish(appt.id)}
                >
                  <div className={`absolute inset-0 opacity-10 ${appt.status === 'confirmed' ? 'bg-primary' : 'bg-emerald-500'}`}></div>
                  <div className={`absolute inset-y-0 left-0 w-1 ${appt.status === 'confirmed' ? 'bg-primary' : 'bg-emerald-500'}`}></div>

                  <div className="relative h-full flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <p className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1 ${appt.status === 'confirmed' ? 'text-primary' : 'text-emerald-500'}`}>{appt.time} ({appt.duration_min || 60}m)</p>
                        <span className="material-symbols-outlined text-[10px] text-slate-600 opacity-50">drag_indicator</span>
                      </div>
                      <h4 className="text-[12px] font-black text-white uppercase italic truncate tracking-tight">{appt.clientName}</h4>
                      <p className="text-[9px] font-bold text-slate-500 uppercase truncate mt-0.5">{appt.service_names}</p>
                    </div>

                    <div className="flex justify-between items-center mt-2 group-hover:translate-y-0 translate-y-1 opacity-0 group-hover:opacity-100 transition-all">
                      <span className="text-[10px] font-black text-white/50">R$ {appt.valor}</span>
                      <span className="material-symbols-outlined text-sm text-primary">check_circle</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {todayAppointments.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20 pointer-events-none">
                <span className="material-symbols-outlined text-6xl">event_busy</span>
                <p className="text-[10px] font-black uppercase tracking-widest mt-4">Nenhum agendamendo hoje</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map(appt => (
              <div key={appt.id} className="bg-surface-dark/60 rounded-3xl border border-white/5 p-6 flex justify-between items-center shadow-lg">
                <div>
                  <p className="text-[8px] font-black text-primary uppercase mb-1 tracking-widest">{appt.date} • {appt.time}</p>
                  <h3 className="text-white font-black text-sm uppercase italic tracking-tight">{appt.clientName}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">{appt.service_names}</p>
                </div>
                <button onClick={() => navigate(`/chat/${appt.client_id}`)} className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:bg-white/10 transition-colors shadow-inner">
                  <span className="material-symbols-outlined text-lg">chat</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Schedule;