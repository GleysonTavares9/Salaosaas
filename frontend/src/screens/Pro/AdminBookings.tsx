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

      <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-3xl px-4 lg:px-6 pt-2 lg:pt-12 pb-2 lg:pb-10 border-b border-white/5">
        <div className="max-w-full max-w-[1400px] mx-auto w-full">
          <div className="flex items-center justify-between mb-4 lg:mb-12">
            <button onClick={() => navigate('/pro')} className="size-9 lg:size-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div className="text-center">
              <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none text-base lg:text-2xl">
                {role === 'admin' ? 'Visão do Caixa' : 'Minha Agenda'}
              </h1>
              <p className="text-[7px] text-primary font-black uppercase tracking-[0.4em] mt-1 lg:mt-3">Sessões & Fluxo Aura</p>
            </div>
            <button
              onClick={() => navigate('/pro/analytics')}
              className="size-9 lg:size-12 rounded-xl gold-gradient flex items-center justify-center text-background-dark shadow-gold active:scale-95 transition-all">
              <span className="material-symbols-outlined text-xl">insights</span>
            </button>
          </div>

          <div
            ref={filterScrollRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            className={`flex gap-3 lg:gap-4 overflow-x-auto no-scrollbar select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} pb-1`}
          >
            {[
              { id: 'all', label: 'TODOS' },
              { id: 'confirmed', label: 'CONFIRM.' },
              { id: 'pending', label: 'PENDENT.' },
              { id: 'completed', label: 'CONCLUÍD.' },
              { id: 'canceled', label: 'CANCEL.' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-5 lg:px-8 py-2.5 lg:py-4 rounded-xl text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border ${filter === f.id
                  ? 'gold-gradient text-background-dark border-transparent shadow-gold-sm'
                  : 'bg-surface-dark/40 text-slate-500 border-white/5 hover:border-white/10'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>


      <main className="max-w-none w-full px-4 lg:px-8 py-8 lg:py-12 space-y-10 pb-40 animate-fade-in relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xxl:grid-cols-5 gap-6 lg:gap-8">
          {filteredAppts.map(appt => (
            <div key={appt.id} className="bg-surface-dark/40 rounded-xl lg:rounded-3xl border border-white/5 shadow-lg relative overflow-hidden transition-all backdrop-blur-3xl group mb-2 lg:mb-0 hover:border-primary/20 hover:shadow-primary/5 hover:-translate-y-1 lg:hover:-translate-y-2">

              {/* Vertical Status Stripe (Left) - Thicker on Desktop */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 lg:w-1.5 ${appt.status === 'completed' ? 'bg-emerald-500' :
                appt.status === 'confirmed' ? 'bg-blue-500' :
                  appt.status === 'pending' ? 'bg-amber-500' :
                    'bg-red-500'
                }`}></div>

              <div className="pl-4 pr-3 py-3 lg:p-6 lg:pl-10 flex flex-col gap-2 lg:gap-5 h-full justify-between">
                {/* Header: Name & Price */}
                <div className="flex justify-between items-start">
                  <div className="overflow-hidden mr-2">
                    <h3 className="text-sm lg:text-2xl font-display font-black text-white italic uppercase leading-none truncate mb-1 lg:mb-2">{appt.clientName || "Cliente Aura"}</h3>
                    <div className="flex items-center gap-2 lg:gap-3">
                      <div className="flex items-center gap-1 lg:gap-2">
                        <span className={`size-1.5 lg:size-2.5 rounded-full ${appt.status === 'completed' ? 'bg-emerald-500' : appt.status === 'confirmed' ? 'bg-blue-500' : appt.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                        <span className="text-[7px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                          {appt.status === 'confirmed' ? 'CONFIRM.' : appt.status === 'pending' ? 'PENDENT.' : appt.status === 'completed' ? 'CONCLUÍD.' : 'CANCEL.'}
                        </span>
                      </div>
                      <span className="text-slate-700 text-[8px] lg:text-xs">•</span>
                      <p className="text-[8px] lg:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate max-w-[80px] lg:max-w-full">{appt.professionalName || "Sem Atrib."}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base lg:text-3xl font-display font-black text-white italic leading-none">
                      R$ {Number(appt.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Info Bar: Service & Date */}
                <div className="flex items-center justify-between bg-black/20 lg:bg-black/40 rounded-lg lg:rounded-xl p-1.5 lg:p-3 border border-white/5">
                  <div className="max-w-[100px] lg:max-w-none truncate">
                    <span className="bg-primary/10 text-primary border border-primary/10 px-1.5 lg:px-3 py-0.5 lg:py-1 rounded lg:rounded-md text-[7px] lg:text-[11px] font-black uppercase tracking-widest truncate block">
                      {appt.service_names || appt.serviceName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 lg:gap-4 text-[8px] lg:text-[12px] font-black text-white uppercase tracking-wider shrink-0">
                    <div className="flex items-center gap-1 lg:gap-2">
                      <span className="material-symbols-outlined text-[10px] lg:text-sm text-primary">calendar_today</span>
                      {appt.date ? new Date(appt.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--'}
                    </div>
                    <div className="flex items-center gap-1 lg:gap-2">
                      <span className="material-symbols-outlined text-[10px] lg:text-sm text-primary">schedule</span>
                      {appt.time ? appt.time.substring(0, 5) : '--:--'}
                    </div>
                  </div>
                </div>

                {/* Action Toolbar */}
                <div className="flex items-center gap-2 lg:gap-3 pt-1 lg:pt-2 border-t border-white/5 mt-auto">
                  {/* Comm Icons */}
                  <div className="flex gap-1.5 lg:gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        try {
                          if (!userId) return;
                          const conv = await api.chat.startConversation(userId, appt.client_id);
                          navigate(`/chat/${conv.id}`);
                        } catch (e) { showToast('Erro', 'error'); }
                      }}
                      className="size-8 lg:size-11 lg:w-auto lg:px-5 rounded-lg lg:rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-white active:scale-95 transition-all hover:bg-white/10 font-bold uppercase tracking-wider text-[10px]"
                    >
                      <span className="material-symbols-outlined text-[14px] lg:text-[18px]">chat</span>
                      <span className="hidden lg:inline">Chat</span>
                    </button>
                    <button
                      onClick={() => openWhatsApp(appt)}
                      className="size-8 lg:size-11 lg:w-auto lg:px-5 rounded-lg lg:rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center gap-2 text-emerald-500 active:scale-95 transition-all hover:bg-emerald-500/10 font-bold uppercase tracking-wider text-[10px]"
                    >
                      <span className="material-symbols-outlined text-[14px] lg:text-[18px]">mail</span>
                      <span className="hidden lg:inline">Whats</span>
                    </button>
                  </div>

                  {/* Main Actions */}
                  {appt.status === 'completed' ? (
                    <div className="flex-1 h-8 lg:h-11 rounded-lg lg:rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-1.5 lg:gap-2 text-emerald-500">
                      <span className="material-symbols-outlined text-xs lg:text-base">verified</span>
                      <span className="text-[8px] lg:text-[11px] font-black uppercase tracking-widest text-center truncate">Finalizado</span>
                    </div>
                  ) : appt.status === 'canceled' ? (
                    <button
                      onClick={() => handleAction(appt.id, 'deletar')}
                      className="flex-1 h-8 lg:h-11 rounded-lg lg:rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center gap-1.5 lg:gap-2 active:scale-95 transition-all hover:bg-red-500/20"
                    >
                      <span className="material-symbols-outlined text-xs lg:text-base">delete</span>
                      <span className="text-[8px] lg:text-[11px] font-black uppercase tracking-widest text-center truncate">Expurgar</span>
                    </button>
                  ) : (
                    <div className="flex-1 flex gap-1.5 lg:gap-2">
                      <button
                        onClick={() => handleCloseAppointment(appt.id)}
                        className="flex-1 h-8 lg:h-11 gold-gradient text-background-dark rounded-lg lg:rounded-xl flex items-center justify-center gap-1.5 lg:gap-2 font-black uppercase tracking-widest text-[8px] lg:text-[11px] shadow-gold-sm active:scale-95 transition-all hover:brightness-110"
                      >
                        <span className="material-symbols-outlined text-xs lg:text-base font-black">lock_open</span>
                        <span className="truncate hidden lg:inline">Fechar Comanda</span>
                        <span className="truncate lg:hidden">Fechar</span>
                      </button>
                      <button
                        onClick={() => handleAction(appt.id, 'remarcar')}
                        className="size-8 lg:size-11 rounded-lg lg:rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 active:scale-95 transition-all hover:text-white"
                        title="Remarcar"
                      >
                        <span className="material-symbols-outlined text-[14px] lg:text-[20px]">edit_calendar</span>
                      </button>
                      <button
                        onClick={() => handleAction(appt.id, 'cancelar')}
                        className="size-8 lg:size-11 rounded-lg lg:rounded-xl bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-500 active:scale-95 transition-all hover:bg-red-500/10"
                        title="Cancelar"
                      >
                        <span className="material-symbols-outlined text-[14px] lg:text-[20px]">block</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAppts.length === 0 && (
          <div className="py-40 sm:py-40 lg:py-40 text-center flex flex-col items-center gap-6 lg:gap-6">
            <div className="size-14 sm:size-16 lg:size-20 rounded-2xl sm:rounded-3xl lg:rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-700">
              <span className="material-symbols-outlined text-4xl lg:text-4xl">event_busy</span>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-600">Nenhuma sessão encontrada na galeria</p>
          </div>
        )}
      </main>

      {/* Modal de Remarcação Refinado */}
      {showRescheduleModal && selectedAppt && (
        <div className="fixed inset-0 z-[120] bg-background-dark/95 backdrop-blur-3xl animate-fade-in flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col w-full max-w-md md:max-w-2xl lg:max-w-4xl bg-surface-dark border border-white/10 rounded-[32px] md:rounded-[48px] shadow-2xl overflow-hidden max-h-full">
            <header className="px-6 py-6 md:px-10 md:py-8 flex items-center justify-between shrink-0 border-b border-white/5 bg-background-dark/50">
              <div>
                <h2 className="text-xl md:text-3xl font-display font-black text-white italic tracking-tighter uppercase">Remarcar Fluxo</h2>
                <p className="text-[9px] md:text-[10px] text-primary font-black uppercase tracking-[0.3em] mt-1 md:mt-2 leading-none">{selectedAppt.clientName}</p>
              </div>
              <button onClick={() => setShowRescheduleModal(false)} className="size-10 md:size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all active:scale-95">
                <span className="material-symbols-outlined font-black">close</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 md:space-y-12 no-scrollbar">
              {/* Calendário Horizontal Elite */}
              <div>
                <p className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-4 md:mb-6 text-center">Calendário de Disponibilidade</p>
                <div className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar pb-4 select-none px-1">
                  {availableDates.map(d => (
                    <button
                      key={d.value}
                      onClick={() => {
                        setNewDate(d.value);
                        setNewTime('');
                      }}
                      className={`shrink-0 flex flex-col items-center justify-center size-20 md:size-24 rounded-2xl md:rounded-[32px] border transition-all duration-300 ${newDate === d.value
                        ? 'gold-gradient text-background-dark border-transparent shadow-gold scale-105 z-10'
                        : 'bg-surface-dark/40 border-white/10 text-slate-500 hover:border-white/30'}`}
                    >
                      <span className="text-[8px] md:text-[9px] font-black uppercase tracking-tighter mb-0.5 md:mb-1">{d.weekday}</span>
                      <span className="text-lg md:text-2xl font-black italic font-display leading-tight">{d.display.split('/')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Horários Grid Luxe */}
              <div className="bg-primary/5 border border-primary/20 rounded-3xl md:rounded-[48px] p-6 md:p-10 space-y-6 md:space-y-8">
                <p className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-[0.4em] text-center">Slots Magnéticos</p>
                {isLoadingSlots ? (
                  <div className="flex justify-center py-8 md:py-12">
                    <div className="size-8 md:size-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                    {availableSlots.map(slot => (
                      <button
                        key={slot}
                        onClick={() => setNewTime(slot)}
                        className={`py-3 md:py-4 rounded-xl md:rounded-2xl border text-[11px] md:text-[13px] font-black font-display italic transition-all duration-200 ${newTime === slot
                          ? 'bg-primary text-background-dark border-primary shadow-gold-sm scale-105'
                          : 'bg-background-dark/60 border-white/5 text-slate-500 hover:border-white/20 hover:text-white'}`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 md:py-20 text-center border-2 border-dashed border-white/5 rounded-3xl md:rounded-[40px] bg-white/[0.02]">
                    <span className="material-symbols-outlined text-3xl md:text-4xl text-slate-700 mb-2 md:mb-4">block</span>
                    <p className="text-[9px] md:text-[10px] font-black text-slate-600 uppercase tracking-widest">Sem brechas para esta data</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 md:p-10 bg-background-dark/50 border-t border-white/5 shrink-0">
              <button
                disabled={!newDate || !newTime}
                onClick={handleReschedule}
                className={`w-full h-16 md:h-20 rounded-2xl md:rounded-[32px] text-[11px] md:text-[13px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] transition-all duration-500 shadow-xl ${newDate && newTime
                  ? 'gold-gradient text-background-dark active:scale-95 hover:brightness-110 shadow-gold/20'
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
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/95 backdrop-blur-md animate-fade-in">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <div className="relative w-full max-w-sm bg-surface-dark border border-white/10 rounded-2xl sm:rounded-3xl lg:rounded-[48px] p-8 sm:p-10 lg:p-12 shadow-3xl animate-scale-in">
              <div className={`size-14 sm:size-16 lg:size-20 rounded-3xl mx-auto mb-8 flex items-center justify-center animate-pulse ${confirmDialog.title.includes('Excluir') || confirmDialog.title.includes('Cancelar') ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
                <span className="material-symbols-outlined text-4xl lg:text-4xl">
                  {confirmDialog.title.includes('Excluir') || confirmDialog.title.includes('Cancelar') ? 'warning' : 'task_alt'}
                </span>
              </div>
              <h3 className="text-2xl lg:text-2xl font-display font-black text-white italic mb-4 uppercase tracking-tighter">{confirmDialog.title}</h3>
              <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed mb-10">{confirmDialog.message}</p>
              <div className="flex flex-col gap-4 lg:gap-4">
                <button onClick={confirmDialog.onConfirm} className={`w-full h-16 rounded-2xl font-black uppercase tracking-[0.4em] text-[10px] shadow-2xl active:scale-95 transition-all ${confirmDialog.title.includes('Excluir') || confirmDialog.title.includes('Cancelar') ? 'bg-red-500 text-white shadow-red-500/20' : 'gold-gradient text-background-dark'}`}>Confirmar Ação</button>
                <button onClick={() => setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { } })} className="w-full bg-white/5 border border-white/10 text-white h-16 rounded-2xl font-black uppercase tracking-[0.4em] text-[10px]">Voltar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBookings;
