import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Appointment, ViewRole, Salon } from '../../types';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

interface AdminBookingsProps {
  appointments: Appointment[];
  role: ViewRole;
  salon: Salon | undefined;
  userId: string | null;
  onUpdateStatus: (id: string, status: Appointment['status']) => void;
  onUpdateAppointment?: (id: string, updates: Partial<Appointment>) => void;
  onDeleteAppointment?: (id: string) => void;
}

const AdminBookings: React.FC<AdminBookingsProps> = ({ appointments, role, salon, userId, onUpdateStatus, onUpdateAppointment, onDeleteAppointment }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [filter, setFilter] = useState('all');
  const [enrichedAppointments, setEnrichedAppointments] = useState<Appointment[]>([]);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ show: false, title: '', message: '', onConfirm: () => { } });

  // Estado para drag-to-scroll
  const filterScrollRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Handlers para drag-to-scroll
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!filterScrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - filterScrollRef.current.offsetLeft);
    setScrollLeft(filterScrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !filterScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - filterScrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Multiplicador para velocidade do scroll
    filterScrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Buscar dados completos dos clientes (OTIMIZADO - uma única query)
  useEffect(() => {
    const fetchClientData = async () => {
      if (appointments.length === 0) {
        setEnrichedAppointments([]);
        return;
      }

      try {
        // Buscar todos os client_ids e professional_ids únicos
        const clientIds = [...new Set(appointments.map(a => a.client_id))];
        const professionalIds = [...new Set(appointments.map(a => a.professional_id).filter(Boolean))];

        // Buscar todos os profiles de uma vez (1 query)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .in('id', clientIds);

        // Buscar todos os profissionais de uma vez (1 query)
        const { data: professionals } = professionalIds.length > 0 ? await supabase
          .from('professionals')
          .select('id, name')
          .in('id', professionalIds) : { data: [] };

        // Criar mapas para acesso rápido O(1)
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        const professionalMap = new Map((professionals || []).map(p => [p.id, p]));

        // Enriquecer appointments
        const enriched = appointments.map(appt => {
          const profile = profileMap.get(appt.client_id);
          const professional = appt.professional_id ? professionalMap.get(appt.professional_id) : null;

          return {
            ...appt,
            clientName: profile?.full_name || 'Cliente Aura',
            clientPhone: profile?.phone || '',
            professionalName: professional?.name || appt.professionalName || 'Profissional',
          };
        });

        setEnrichedAppointments(enriched);
      } catch (error) {
        setEnrichedAppointments(appointments);
      }
    };

    fetchClientData();
  }, [appointments]);

  const userAppointments = enrichedAppointments.length > 0 ? enrichedAppointments : appointments;

  const filteredAppts = filter === 'all'
    ? userAppointments
    : userAppointments.filter(a => a.status === filter);

  // Gerar datas para os próximos 14 dias
  const availableDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      value: d.toISOString().split('T')[0],
      display: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      weekday: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
    };
  });

  // Atualizar horários quando a data mudar
  useEffect(() => {
    if (showRescheduleModal && selectedAppt && newDate && salon) {
      setIsLoadingSlots(true);

      const generateSlots = () => {
        const slots = [];
        const dateParts = newDate.split('-').map(Number);
        const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDayKey = dayKeys[dateObj.getDay()];
        const daySchedule = salon.horario_funcionamento?.[currentDayKey];

        if (!daySchedule || daySchedule.closed) {
          setAvailableSlots([]);
          setIsLoadingSlots(false);
          return;
        }

        const [startHour, startMin] = daySchedule.open.split(':').map(Number);
        const [endHour, endMin] = daySchedule.close.split(':').map(Number);
        const startLimit = startHour * 60 + startMin;
        const endLimit = endHour * 60 + endMin;

        const now = new Date();
        const isToday = newDate === now.toISOString().split('T')[0];
        const nowInMinutes = now.getHours() * 60 + now.getMinutes() + 15;

        // Buscar agendamentos do dia para o profissional
        const busyIntervals = appointments
          .filter(a => a.date === newDate && a.professional_id === selectedAppt.professional_id && a.status !== 'canceled' && a.id !== selectedAppt.id)
          .map(a => {
            const [h, m] = a.time.split(':').map(Number);
            const start = h * 60 + m;
            const duration = a.duration_min || 30;
            return { start, end: start + duration };
          });

        const duration = selectedAppt.duration_min || 30;

        for (let timeMin = startLimit; timeMin < endLimit; timeMin += 30) {
          if (isToday && timeMin < nowInMinutes) continue;

          const endTimeMin = timeMin + duration;
          if (endTimeMin > endLimit) continue;

          const isConflict = busyIntervals.some(busy => (timeMin < busy.end && endTimeMin > busy.start));

          if (!isConflict) {
            const h = Math.floor(timeMin / 60);
            const m = timeMin % 60;
            slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
          }
        }
        setAvailableSlots(slots);
        setIsLoadingSlots(false);
      };

      generateSlots();
    }
  }, [newDate, showRescheduleModal, selectedAppt, salon, appointments]);

  const openWhatsApp = (appt: Appointment) => {
    const phone = appt.clientPhone?.replace(/\D/g, '') || '5511999999999';
    const text = `Olá ${appt.clientName}! Aqui é o ${appt.professionalName || 'Profissional'} do Luxe Aura. Estou entrando em contato sobre seu agendamento de ${appt.service_names || appt.serviceName || 'Serviço'} no dia ${appt.date} às ${appt.time}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleReschedule = async () => {
    if (!selectedAppt || !newDate || !newTime) return;
    try {
      if (onUpdateAppointment) {
        await onUpdateAppointment(selectedAppt.id, {
          date: newDate,
          time: newTime,
          status: 'confirmed'
        });
      } else {
        await api.appointments.update(selectedAppt.id, {
          date: newDate,
          time: newTime,
          status: 'confirmed'
        });
      }
      showToast('Agendamento remarcado com sucesso!', 'success');
      setShowRescheduleModal(false);
    } catch (error: any) {
      showToast('Erro ao remarcar agendamento.', 'error');
    }
  };

  const handleAction = async (id: string, action: 'remarcar' | 'cancelar' | 'deletar') => {
    const appt = userAppointments.find(a => a.id === id);
    if (!appt) return;

    if (action === 'cancelar') {
      setConfirmDialog({
        show: true,
        title: 'Cancelar Agendamento',
        message: `Deseja cancelar o agendamento de ${appt.clientName}?`,
        onConfirm: async () => {
          console.log('📋 AdminBookings: Cancelando agendamento...', id);
          onUpdateStatus(id, 'canceled');
          showToast('Agendamento cancelado.', 'success');
          setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { } });
        }
      });
    } else if (action === 'deletar') {
      setConfirmDialog({
        show: true,
        title: 'Excluir Permanente',
        message: 'Esta ação não pode ser desfeita. Excluir agora?',
        onConfirm: () => {
          console.log('🗑️ AdminBookings: Deletando agendamento...', id);
          onDeleteAppointment?.(id);
          console.log('🗑️ AdminBookings: Callback onDeleteAppointment chamado!');
          showToast('Agendamento removido permanentemente.', 'success');
          setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { } });
        }
      });
    } else if (action === 'remarcar') {
      setSelectedAppt(appt);
      setNewDate(appt.date);
      setNewTime(appt.time);
      setShowRescheduleModal(true);
    }
  };

  const handleCloseAppointment = (id: string) => {
    const appt = userAppointments.find(a => a.id === id);
    if (!appt) return;

    setConfirmDialog({
      show: true,
      title: 'Fechar Atendimento',
      message: 'Deseja marcar este serviço como concluído?',
      onConfirm: async () => {
        onUpdateStatus(id, 'completed');
        showToast('Atendimento finalizado com sucesso!', 'success');
        setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { } });
      }
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
                {role === 'admin' ? 'Visão do Caixa' : 'Minha Agenda'}
              </h1>
              <p className="text-[7px] text-primary font-black uppercase tracking-[0.4em] mt-3">Sessões & Fluxo Aura</p>
            </div>
            <button
              onClick={() => navigate('/pro/analytics')}
              className="size-12 rounded-2xl gold-gradient flex items-center justify-center text-background-dark shadow-gold active:scale-95 transition-all">
              <span className="material-symbols-outlined text-xl">insights</span>
            </button>
          </div>

          <div
            ref={filterScrollRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            className={`flex gap-4 overflow-x-auto no-scrollbar select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            {[
              { id: 'all', label: 'Todos' },
              { id: 'confirmed', label: 'Confirmados' },
              { id: 'pending', label: 'Pendentes' },
              { id: 'completed', label: 'Concluídos' },
              { id: 'canceled', label: 'Cancelados' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border ${filter === f.id
                  ? 'gold-gradient text-background-dark border-transparent shadow-gold-sm scale-105 z-10'
                  : 'bg-surface-dark/40 text-slate-500 border-white/5 hover:border-white/10'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>


      <main className="max-w-[1400px] mx-auto w-full px-6 py-12 lg:py-20 space-y-12 pb-40 animate-fade-in relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
          {filteredAppts.map(appt => (
            <div key={appt.id} className={`bg-surface-dark/40 rounded-[48px] border p-8 lg:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.4)] relative overflow-hidden transition-all backdrop-blur-3xl group ${appt.status === 'canceled' ? 'opacity-40 grayscale border-white/5' :
              appt.status === 'completed' ? 'border-emerald-500/20 shadow-emerald-900/10' :
                'border-white/5 hover:border-primary/20'
              }`}>

              {/* Status Badge Overlays */}
              <div className="absolute top-0 right-0 p-6">
                <span className={`px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-[0.3em] border ${appt.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                  appt.status === 'confirmed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    appt.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      'bg-red-500/10 text-red-500 border-red-500/20'
                  }`}>
                  {appt.status}
                </span>
              </div>

              {/* Header Info */}
              <div className="mb-10 space-y-4">
                <div>
                  <h3 className="text-2xl lg:text-3xl font-display font-black text-white italic tracking-tighter uppercase leading-none truncate pr-16">{appt.clientName || "Cliente Aura"}</h3>
                  <div className="flex items-center gap-3 mt-4">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">{appt.service_names || appt.serviceName}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[14px] text-slate-500">person</span>
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[120px]">
                      {appt.professionalName || "Sem Atribuir"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-display font-black text-white italic">R$ {appt.valor}</p>
                  </div>
                </div>
              </div>

              {/* Date & Time Ribbon */}
              <div className="flex items-center justify-between bg-black/40 rounded-3xl p-5 mb-8 border border-white/5">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-lg">calendar_today</span>
                  <p className="text-[10px] font-black text-white uppercase tracking-widest">{appt.date}</p>
                </div>
                <div className="h-4 w-px bg-white/10"></div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-lg">schedule</span>
                  <p className="text-[10px] font-black text-white uppercase tracking-widest">{appt.time}</p>
                </div>
              </div>

              {/* Ações de Comunicação */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={async () => {
                    try {
                      if (!userId) {
                        showToast("Erro: Usuário não identificado.", 'error');
                        return;
                      }
                      const conv = await api.chat.startConversation(userId, appt.client_id);
                      navigate(`/chat/${conv.id}`);
                    } catch (error: any) {
                      showToast('Falha ao iniciar chat.', 'error');
                    }
                  }}
                  className="flex items-center justify-center gap-3 bg-white/[0.03] border border-white/5 rounded-2xl py-4 lg:py-5 text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/[0.07] active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-base">chat</span>
                  Aura Chat
                </button>
                <button
                  onClick={() => openWhatsApp(appt)}
                  className="flex items-center justify-center gap-3 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-2xl py-4 lg:py-5 text-[10px] font-black text-emerald-400 uppercase tracking-widest hover:bg-emerald-500/[0.06] active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-base">mail</span>
                  WhatsApp
                </button>
              </div>

              {/* Ações de Gestão de Agenda */}
              {appt.status === 'completed' ? (
                <div className="pt-6 border-t border-white/5">
                  <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                    <span className="material-symbols-outlined text-base font-black">verified</span>
                    Sessão Finalizada
                  </div>
                </div>
              ) : appt.status === 'canceled' ? (
                <div className="pt-6 border-t border-white/5">
                  <button
                    onClick={() => handleAction(appt.id, 'deletar')}
                    className="w-full bg-red-500/10 border border-red-500/20 text-red-500 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-base">delete_forever</span>
                    Expurgar Registro
                  </button>
                </div>
              ) : (
                <div className="space-y-4 pt-6 border-t border-white/5">
                  {/* Botão Principal: Finalizar */}
                  <button
                    onClick={() => handleCloseAppointment(appt.id)}
                    className="w-full gold-gradient text-background-dark py-6 rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-gold-sm active:scale-95 transition-all hover:brightness-110"
                  >
                    <span className="material-symbols-outlined text-xl font-black">lock_open</span>
                    Fechar Comanda
                  </button>

                  {/* Botões Secundários: Remarcar/Cancelar */}
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleAction(appt.id, 'remarcar')}
                      className="flex-1 bg-white/[0.03] border border-white/5 text-slate-400 py-4 lg:py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:text-white"
                    >
                      <span className="material-symbols-outlined text-base">update</span>
                      Mudar Data
                    </button>
                    <button
                      onClick={() => handleAction(appt.id, 'cancelar')}
                      className="flex-1 bg-red-500/[0.02] border border-red-500/10 text-red-500/60 py-4 lg:py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:text-red-500"
                    >
                      <span className="material-symbols-outlined text-base">block</span>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredAppts.length === 0 && (
          <div className="py-40 text-center flex flex-col items-center gap-6">
            <div className="size-20 rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-700">
              <span className="material-symbols-outlined text-4xl">event_busy</span>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-600">Nenhuma sessão encontrada na galeria</p>
          </div>
        )}
      </main>

      {/* Modal de Remarcação Refinado */}
      {showRescheduleModal && selectedAppt && (
        <div className="fixed inset-0 z-[120] bg-background-dark/95 backdrop-blur-3xl animate-fade-in flex flex-col items-center overflow-hidden">
          <div className="flex-1 flex flex-col max-w-[600px] w-full h-full relative">
            <header className="px-10 pt-16 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-2xl lg:text-3xl font-display font-black text-white italic tracking-tighter uppercase">Remarcar Fluxo</h2>
                <p className="text-[10px] text-primary font-black uppercase tracking-[0.4em] mt-2 leading-none">{selectedAppt.clientName}</p>
              </div>
              <button onClick={() => setShowRescheduleModal(false)} className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                <span className="material-symbols-outlined font-black">close</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-10 space-y-12 no-scrollbar min-h-0">
              <div className="space-y-10">
                {/* Calendário Horizontal Elite */}
                <div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-6 text-center">Calendário de Disponibilidade</p>
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 select-none">
                    {availableDates.map(d => (
                      <button
                        key={d.value}
                        onClick={() => {
                          setNewDate(d.value);
                          setNewTime('');
                        }}
                        className={`shrink-0 flex flex-col items-center justify-center size-24 rounded-[32px] border transition-all duration-500 ${newDate === d.value
                          ? 'gold-gradient text-background-dark border-transparent shadow-gold scale-110 z-10'
                          : 'bg-surface-dark/40 border-white/10 text-slate-500 hover:border-white/30'}`}
                      >
                        <span className="text-[9px] font-black uppercase tracking-tighter mb-1">{d.weekday}</span>
                        <span className="text-xl font-black italic font-display leading-tight">{d.display.split('/')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Horários Grid Luxe */}
                <div className="bg-primary/5 border border-primary/20 rounded-[48px] p-8 lg:p-10 space-y-8">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] text-center">Slots Magnéticos</p>
                  {isLoadingSlots ? (
                    <div className="flex justify-center py-12">
                      <div className="size-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                      {availableSlots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => setNewTime(slot)}
                          className={`py-5 rounded-2xl border text-[13px] font-black font-display italic transition-all duration-300 ${newTime === slot
                            ? 'bg-primary text-background-dark border-primary shadow-gold-sm'
                            : 'bg-background-dark/60 border-white/5 text-slate-500 hover:border-white/20'}`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.02]">
                      <span className="material-symbols-outlined text-4xl text-slate-700 mb-4">block</span>
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Sem brechas para esta data</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-10 bg-gradient-to-t from-background-dark via-background-dark to-transparent">
              <button
                disabled={!newDate || !newTime}
                onClick={handleReschedule}
                className={`w-full h-24 rounded-[32px] text-[13px] font-black uppercase tracking-[0.5em] transition-all duration-500 shadow-[0_30px_70px_rgba(0,0,0,0.5)] ${newDate && newTime
                  ? 'gold-gradient text-background-dark active:scale-95 hover:brightness-110'
                  : 'bg-white/5 text-white/10 cursor-not-allowed opacity-50'}`}
              >
                PROJETAR NOVA SESSÃO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de Confirmação Refinado */}
      {confirmDialog.show && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in text-center">
          <div className="bg-surface-dark border border-white/10 rounded-[48px] p-12 max-w-sm w-full shadow-3xl">
            <div className={`size-20 rounded-3xl mx-auto mb-8 flex items-center justify-center animate-pulse ${confirmDialog.title.includes('Excluir') || confirmDialog.title.includes('Cancelar') ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
              <span className="material-symbols-outlined text-4xl">
                {confirmDialog.title.includes('Excluir') || confirmDialog.title.includes('Cancelar') ? 'warning' : 'task_alt'}
              </span>
            </div>
            <h3 className="text-2xl font-display font-black text-white italic mb-4 uppercase tracking-tighter">{confirmDialog.title}</h3>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed mb-10">{confirmDialog.message}</p>
            <div className="flex flex-col gap-4">
              <button onClick={confirmDialog.onConfirm} className={`w-full h-16 rounded-2xl font-black uppercase tracking-[0.4em] text-[10px] shadow-2xl active:scale-95 transition-all ${confirmDialog.title.includes('Excluir') || confirmDialog.title.includes('Cancelar') ? 'bg-red-500 text-white shadow-red-500/20' : 'gold-gradient text-background-dark'}`}>Confirmar Ação</button>
              <button onClick={() => setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { } })} className="w-full bg-white/5 border border-white/10 text-white h-16 rounded-2xl font-black uppercase tracking-[0.4em] text-[10px]">Voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBookings;
