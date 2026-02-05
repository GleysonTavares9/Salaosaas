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
    <div className="flex-1 bg-background-dark overflow-y-auto h-full no-scrollbar">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-xl px-6 pt-12 pb-6 border-b border-white/5">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/pro')} className="size-10 rounded-full border border-white/10 flex items-center justify-center text-white">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-display font-black text-white italic tracking-tighter uppercase leading-none">{role === 'admin' ? 'Faturamento & Agenda' : 'Meus Atendimentos'}</h1>
            <p className="text-primary text-[8px] font-black uppercase tracking-[0.2em] mt-1">Gestão de Sessões em Tempo Real</p>
          </div>
          <button
            onClick={() => navigate('/pro/analytics')}
            className="size-10 rounded-full gold-gradient flex items-center justify-center text-background-dark shadow-lg">
            <span className="material-symbols-outlined">assessment</span>
          </button>
        </div>

        <div
          ref={filterScrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className={`flex gap-2 overflow-x-auto no-scrollbar select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          {['all', 'confirmed', 'pending', 'completed', 'canceled'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${filter === f ? 'gold-gradient text-background-dark border-primary shadow-lg' : 'bg-surface-dark text-slate-500 border-white/5'
                }`}
            >
              {f === 'all' ? 'Ver Todos' : f.toUpperCase()}
            </button>
          ))}
        </div>
      </header>


      <main className="px-6 py-8 space-y-6 pb-40 animate-fade-in mx-auto">
        {filteredAppts.map(appt => (
          <div key={appt.id} className={`bg-surface-dark/60 rounded-[32px] border p-5 shadow-2xl relative overflow-hidden transition-all ${appt.status === 'canceled' ? 'opacity-50 grayscale border-white/5' :
            appt.status === 'completed' ? 'border-emerald-500/20' :
              'border-white/10 hover:border-primary/20'
            }`}>

            {/* Header com Status e Valor */}
            <div className="flex justify-between items-start mb-5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${appt.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    appt.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                      appt.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                    {appt.status}
                  </span>
                </div>
                <h3 className="text-xl font-display font-black text-white italic tracking-tighter mb-1 uppercase leading-tight">{appt.clientName || "Cliente Aura"}</h3>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">{appt.service_names || appt.serviceName}</p>
                  <span className="text-slate-700">•</span>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    {appt.professionalName || "Sem Profissional"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-display font-black text-primary mb-1 italic">R$ {appt.valor}</p>
                <div className="flex flex-col items-end gap-0.5 opacity-60">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{appt.date}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{appt.time}</p>
                </div>
              </div>
            </div>

            {/* ID do Agendamento */}
            <div className="mb-4 pb-4 border-b border-white/5">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">ID: {appt.id}</p>
            </div>

            {/* Ações de Comunicação */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={async () => {
                  try {
                    if (!userId) {
                      showToast("Erro: Usuário não identificado para chat.", 'error');
                      return;
                    }
                    // Buscar ou criar conversa real (ajustado para o novo schema)
                    const conv = await api.chat.startConversation(userId, appt.client_id);
                    navigate(`/chat/${conv.id}`);
                  } catch (error: any) {
                    showToast('Falha ao iniciar chat.', 'error');
                  }
                }}
                className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-2xl py-3.5 text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                Chat Interno
              </button>
              <button
                onClick={() => openWhatsApp(appt)}
                className="flex items-center justify-center gap-2 bg-emerald-600/10 border border-emerald-600/30 rounded-2xl py-3.5 text-[10px] font-black text-emerald-400 uppercase tracking-widest hover:bg-emerald-600/20 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-base">send</span>
                WhatsApp
              </button>
            </div>

            {/* Ações de Gestão de Agenda */}
            {appt.status === 'completed' ? (
              <div className="pt-4 border-t border-white/5">
                <div className="w-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-base">verified</span>
                  Atendimento Concluído
                </div>
              </div>
            ) : appt.status === 'canceled' ? (
              <div className="pt-4 border-t border-white/5">
                <button
                  onClick={() => handleAction(appt.id, 'deletar')}
                  className="w-full bg-red-500/10 border border-red-500/20 text-red-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  Apagar Permanente
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-4 border-t border-white/5">
                {/* Botão Principal: Finalizar */}
                <button
                  onClick={() => handleCloseAppointment(appt.id)}
                  className="w-full gold-gradient text-background-dark py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-primary/10 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-base font-black">check_circle</span>
                  Finalizar Atendimento
                </button>

                {/* Botões Secundários: Remarcar/Cancelar */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAction(appt.id, 'remarcar')}
                    className="flex-1 bg-white/5 border border-white/10 text-slate-400 py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-base">event_repeat</span>
                    Remarcar
                  </button>
                  <button
                    onClick={() => handleAction(appt.id, 'cancelar')}
                    className="flex-1 bg-white/5 border border-white/10 text-red-500/60 py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredAppts.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center opacity-30">
            <span className="material-symbols-outlined text-6xl mb-4 text-slate-600">event_busy</span>
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Nenhuma sessão encontrada</p>
          </div>
        )}
      </main>

      {/* Modal de Remarcação */}
      {showRescheduleModal && selectedAppt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md px-4 sm:px-6 animate-fade-in">
          <div className="bg-surface-dark border border-white/10 rounded-[40px] p-6 sm:p-8 w-full max-w-sm shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-display font-black text-white italic tracking-tighter mb-1">Remarcar Sessão</h2>
              <p className="text-[10px] text-primary uppercase font-black tracking-widest">{selectedAppt.clientName}</p>
            </div>

            <div className="space-y-8 mb-8">
              {/* Seleção de Data */}
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">Selecione a Data</label>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {availableDates.map(d => (
                    <button
                      key={d.value}
                      onClick={() => {
                        setNewDate(d.value);
                        setNewTime('');
                      }}
                      className={`shrink-0 flex flex-col items-center justify-center size-16 rounded-[20px] border transition-all ${newDate === d.value ? 'gold-gradient text-background-dark border-primary shadow-lg' : 'bg-background-dark border-white/5 text-slate-500'}`}
                    >
                      <span className="text-[7px] font-black uppercase tracking-tighter mb-0.5">{d.weekday}</span>
                      <span className="text-sm font-black italic font-display leading-tight">{d.display.split('/')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seleção de Horário */}
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">Horários Livres</label>
                {isLoadingSlots ? (
                  <div className="flex justify-center py-10">
                    <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map(slot => (
                      <button
                        key={slot}
                        onClick={() => setNewTime(slot)}
                        className={`py-3 rounded-xl border text-[11px] font-black font-display italic transition-all ${newTime === slot ? 'bg-primary text-background-dark border-primary shadow-lg' : 'bg-background-dark border-white/5 text-slate-500'}`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center border border-dashed border-white/5 rounded-2xl bg-white/5">
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Sem horários para esta data</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                disabled={!newDate || !newTime}
                onClick={handleReschedule}
                className={`w-full py-5 rounded-2xl text-[11px] font-extrabold uppercase tracking-[0.2em] shadow-xl transition-all ${newDate && newTime ? 'gold-gradient text-background-dark active:scale-95' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
              >
                confirmar Remarcação
              </button>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="w-full text-slate-500 py-3 text-[9px] font-black uppercase tracking-[0.3em] active:scale-95 transition-all"
              >
                Manter Agendamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de Confirmação */}
      {confirmDialog.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md px-6 animate-fade-in">
          <div className="bg-surface-dark border border-white/10 rounded-[40px] p-8 w-full max-w-sm shadow-2xl animate-scale-in">
            <h3 className="text-2xl font-display font-black text-white italic tracking-tighter mb-2">{confirmDialog.title}</h3>
            <p className="text-xs text-slate-400 mb-8 leading-relaxed font-medium">{confirmDialog.message}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { } })}
                className="bg-white/5 border border-white/10 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                Voltar
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all ${confirmDialog.title === 'Excluir Permanente' || confirmDialog.title === 'Cancelar Agendamento' ? 'bg-red-500 text-white shadow-red-500/20' : 'gold-gradient text-background-dark'}`}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBookings;
