import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Appointment, Service, Professional } from '../../types';
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

  // States para novo agendamento manual
  const [showAddModal, setShowAddModal] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [allProfessionals, setAllProfessionals] = useState<Professional[]>([]);
  const [newAppt, setNewAppt] = useState({
    serviceId: '',
    professionalId: '',
    time: '10:00',
    clientName: ''
  });

  // States para os selects customizados (Premium UX)
  const [openSelectService, setOpenSelectService] = useState(false);
  const [openSelectPro, setOpenSelectPro] = useState(false);
  const [openSelectTime, setOpenSelectTime] = useState(false);

  // State para confirmações customizadas (Aura Confirm)
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    actionType: 'finish' | 'cancel' | 'delete' | null;
    id: string | null;
  }>({ show: false, title: '', message: '', actionType: null, id: null });

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userRole = session.user.user_metadata.role;
      const userId = session.user.id;

      let salonId = salon?.id;
      let proId = null;

      // 1. Tentar pegar salon_id via vínculo de profissional
      const { data: proData } = await supabase
        .from('professionals')
        .select('id, salon_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (proData) {
        salonId = proData.salon_id;
        proId = proData.id;
      } else if (userRole === 'admin') {
        // Se for admin e não tiver proData, buscar do perfil ou primeiro salão associado
        const { data: adminSalon } = await supabase
          .from('salons')
          .select('id')
          .limit(1)
          .maybeSingle(); // Fallback simples ou ajustar conforme sua lógica de owner_id

        if (adminSalon) salonId = adminSalon.id;
      }

      if (salonId) {
        // 2. Buscar dados em paralelo
        const [realSalon, salonServices, salonPros] = await Promise.all([
          api.salons.getById(salonId),
          api.services.getBySalon(salonId),
          api.professionals.getBySalon(salonId)
        ]);

        // 3. Buscar agendamentos
        let realAppts = [];
        if (userRole === 'admin') {
          realAppts = await api.appointments.getBySalon(salonId);
        } else if (proId) {
          realAppts = await api.appointments.getByProfessional(proId);
        }

        setSalon(realSalon);
        setAppointments(realAppts);
        setServices(salonServices || []);
        setAllProfessionals(salonPros || []);

        if (proId) {
          setNewAppt(prev => ({ ...prev, professionalId: proId }));
        }
      }
    } catch (err) {
      console.error("Erro ao sincronizar agenda real:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [initialSalon, initialAppointments]);

  const bookedDatesCount = appointments.reduce((acc, appt) => {
    if (appt.status !== 'canceled') {
      acc[appt.date] = (acc[appt.date] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const dateParts = selectedDate.split('-').map(Number);
  const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayKey = dayKeys[dateObj.getDay()];
  const daySchedule = salon?.horario_funcionamento?.[currentDayKey];

  const salonOpen = daySchedule?.enabled ? parseInt(daySchedule.open.split(':')[0]) : 8;
  const salonClose = daySchedule?.enabled ? parseInt(daySchedule.close.split(':')[0]) : 20;

  const startHour = Math.max(0, salonOpen);
  const endHour = Math.min(23, salonClose);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const todayAppointments = appointments.filter(a => a.date === selectedDate && a.status !== 'canceled');

  const handleFinish = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Finalizar Atendimento',
      message: 'Deseja marcar este agendamento como concluído?',
      actionType: 'finish',
      id
    });
  };

  const handleCancelAction = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Cancelar Agendamento',
      message: 'Tem certeza que deseja cancelar esta sessão?',
      actionType: 'cancel',
      id
    });
  };

  const handleDeleteAction = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Excluir Definitivamente',
      message: 'Esta ação não pode ser desfeita. Excluir agendamento?',
      actionType: 'delete',
      id
    });
  };

  const executeConfirmedAction = async () => {
    const { id, actionType } = confirmModal;
    if (!id || !actionType) return;

    try {
      if (actionType === 'finish') {
        await api.appointments.updateStatus(id, 'completed');
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'completed' } : a));
      } else if (actionType === 'cancel') {
        await api.appointments.updateStatus(id, 'canceled');
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'canceled' } : a));
      } else if (actionType === 'delete') {
        await api.appointments.delete(id);
        setAppointments(prev => prev.filter(a => a.id !== id));
      }
    } catch (error) {
      alert("Erro ao processar ação: " + error);
    } finally {
      setConfirmModal({ ...confirmModal, show: false });
    }
  };

  const getPosition = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const offset = Math.max(0, h - startHour);
    const top = offset * 100 + (m / 60) * 100;
    return top;
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (e: React.DragEvent, targetHour: number, targetMin: number) => {
    e.preventDefault();
    const apptId = e.dataTransfer.getData('apptId');
    if (!apptId) return;

    const newTime = `${targetHour.toString().padStart(2, '0')}:${targetMin.toString().padStart(2, '0')}`;

    try {
      await api.appointments.update(apptId, { time: newTime });
      fetchData();
    } catch (error) {
      alert("Erro ao reagendar: " + error);
    }
  };

  const handleCancel = async (id: string) => {
    handleCancelAction(id);
  };

  const handleDelete = async (id: string) => {
    handleDeleteAction(id);
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppt.serviceId || !newAppt.professionalId || !newAppt.clientName) {
      alert("Preencha todos os campos");
      return;
    }

    const selectedService = services.find(s => s.id === newAppt.serviceId);

    // Pegar o ID do usuário atual para o agendamento manual
    const { data: { user } } = await supabase.auth.getUser();

    try {
      await api.appointments.create({
        client_id: user?.id || '00000000-0000-0000-0000-000000000000', // UUID neutro para agendamento manual se não houver user
        salon_id: salon.id,
        professional_id: newAppt.professionalId,
        date: selectedDate,
        time: newAppt.time,
        status: 'confirmed',
        valor: selectedService?.price || 0,
        service_names: selectedService?.name || '',
        duration_min: selectedService?.duration_min || 60
        // Removidos clientName e professionalName (são virtuais/legacy)
      });

      setShowAddModal(false);
      setOpenSelectService(false);
      setOpenSelectPro(false);
      setOpenSelectTime(false);
      setNewAppt(prev => ({ ...prev, clientName: '', serviceId: '' }));
      fetchData();
    } catch (error) {
      console.error("Erro completo:", error);
      alert("Erro ao criar agendamento: Verifique se a tabela 'appointments' existe no seu Supabase.");
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
    <div className="flex-1 bg-background-dark min-h-screen pb-32 relative">
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
              bookedDates={bookedDatesCount}
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20">
            <span className="size-1.5 bg-primary rounded-full animate-pulse"></span>
            <span className="text-[9px] font-black text-primary uppercase">{todayAppointments.length} Sessões</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="size-8 rounded-xl bg-primary text-background-dark flex items-center justify-center shadow-gold transition-all active:scale-90"
          >
            <span className="material-symbols-outlined text-sm font-bold">add</span>
          </button>
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
                  onClick={() => {
                    setNewAppt(prev => ({ ...prev, time: `${h.toString().padStart(2, '0')}:00` }));
                    setShowAddModal(true);
                  }}
                  className="h-1/2 w-full flex items-start pt-2 group/zone relative cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter w-12">{h.toString().padStart(2, '0')}:00</span>
                  <div className="flex-1 h-px bg-white/[0.02] mt-2 ml-2 group-hover/zone:bg-primary/20 transition-colors"></div>
                  <div className="absolute right-4 top-2 opacity-0 group-hover/zone:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-primary text-sm">add_circle</span>
                  </div>
                </div>
                <div
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, h, 30)}
                  onClick={() => {
                    setNewAppt(prev => ({ ...prev, time: `${h.toString().padStart(2, '0')}:30` }));
                    setShowAddModal(true);
                  }}
                  className="h-1/2 w-full flex items-start pt-2 group/zone relative cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-[8px] font-black text-slate-800 uppercase tracking-tighter w-12 opacity-0 group-hover/zone:opacity-60 transition-opacity">{h}:30</span>
                  <div className="flex-1 h-px bg-white/[0.01] mt-2 ml-2 border-t border-dashed border-white/5 group-hover/zone:bg-primary/10 transition-colors"></div>
                  <div className="absolute right-4 top-2 opacity-0 group-hover/zone:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-primary text-sm">add_circle</span>
                  </div>
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(appt.id); }}
                            className="size-6 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-xs">delete</span>
                          </button>
                          <span className="material-symbols-outlined text-[10px] text-slate-600 opacity-50">drag_indicator</span>
                        </div>
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
            {todayAppointments.length > 0 ? (
              todayAppointments.map(appt => (
                <div key={appt.id} className="bg-surface-dark/60 rounded-[32px] border border-white/5 p-6 shadow-xl relative overflow-hidden animate-fade-in group">
                  <div className={`absolute top-0 left-0 w-1 h-full ${appt.status === 'confirmed' ? 'bg-primary' : appt.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[7px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-md ${appt.status === 'confirmed' ? 'bg-primary/10 text-primary' :
                          appt.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                            'bg-amber-500/10 text-amber-500'
                          }`}>
                          {appt.status}
                        </span>
                        <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{appt.time}</span>
                      </div>
                      <h3 className="text-white font-black text-base uppercase italic tracking-tight leading-tight">{appt.clientName}</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wide">{appt.service_names}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-black text-sm tracking-tighter">R$ {appt.valor}</p>
                      <p className="text-[8px] font-bold text-slate-600 uppercase mt-1">{appt.duration_min || 60} MIN</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => navigate(`/chat/${appt.client_id}`)}
                      className="size-10 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white active:bg-white/10 transition-all shrink-0"
                    >
                      <span className="material-symbols-outlined text-base">chat</span>
                    </button>

                    {appt.status === 'confirmed' && (
                      <button
                        onClick={() => handleCancel(appt.id)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest active:bg-red-500/10 transition-all"
                      >
                        Cancelar
                      </button>
                    )}

                    {appt.status !== 'completed' && (
                      <button
                        onClick={() => handleFinish(appt.id)}
                        className="flex-1 bg-primary/10 border border-primary/20 rounded-2xl py-3 flex items-center justify-center gap-2 text-[9px] font-black text-primary uppercase tracking-widest active:bg-primary/30 transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">done_all</span>
                        Finalizar
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(appt.id)}
                      className="size-10 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 active:bg-red-500/30 transition-all shrink-0"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center flex flex-col items-center opacity-20 pointer-events-none">
                <span className="material-symbols-outlined text-6xl">event_busy</span>
                <p className="text-[10px] font-black uppercase tracking-widest mt-4">Nenhum agendamento para este dia</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de Agendamento Manual */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-background-dark/90 backdrop-blur-md" onClick={() => {
            setShowAddModal(false);
            setOpenSelectService(false);
            setOpenSelectPro(false);
            setOpenSelectTime(false);
          }}></div>
          <div className="relative w-full max-w-lg bg-surface-dark border-t sm:border border-white/10 rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl animate-slide-up no-scrollbar overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-xl font-display font-black text-white italic uppercase tracking-tighter">Novo Agendamento</h2>
                <p className="text-[8px] text-primary font-black uppercase tracking-widest mt-1">Lançamento Manual na Agenda</p>
              </div>
              <button onClick={() => {
                setShowAddModal(false);
                setOpenSelectService(false);
                setOpenSelectPro(false);
                setOpenSelectTime(false);
              }} className="size-10 rounded-full bg-white/5 flex items-center justify-center text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-4">Nome do Cliente</label>
                <input
                  required
                  type="text"
                  placeholder="EX: JOÃO DA SILVA"
                  value={newAppt.clientName}
                  onChange={e => setNewAppt(prev => ({ ...prev, clientName: e.target.value.toUpperCase() }))}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-[10px] outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-4 mb-2 block">Horário</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenSelectTime(!openSelectTime);
                        setOpenSelectService(false);
                        setOpenSelectPro(false);
                      }}
                      className={`w-full bg-white/5 border ${openSelectTime ? 'border-primary shadow-gold-sm' : 'border-white/10'} rounded-2xl px-6 py-4 flex items-center justify-between transition-all active:scale-[0.98]`}
                    >
                      <span className="text-[10px] font-bold text-white uppercase">{newAppt.time}</span>
                      <span className={`material-symbols-outlined text-primary text-sm transition-transform duration-300 ${openSelectTime ? 'rotate-180' : ''}`}>expand_more</span>
                    </button>

                    {openSelectTime && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-background-dark/95 border border-white/10 rounded-[24px] shadow-2xl z-[350] py-2 backdrop-blur-xl animate-fade-in overflow-hidden">
                        <div className="max-h-[200px] overflow-y-auto no-scrollbar grid grid-cols-2 gap-px bg-white/5">
                          {hours.flatMap(h => [`${h.toString().padStart(2, '0')}:00`, `${h.toString().padStart(2, '0')}:30`]).map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                setNewAppt(prev => ({ ...prev, time: t }));
                                setOpenSelectTime(false);
                              }}
                              className={`px-4 py-3 bg-background-dark text-[10px] font-bold uppercase transition-all hover:bg-white/5 text-center ${newAppt.time === t ? 'text-primary bg-primary/5' : 'text-white'}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-4 mb-2 block">Data Escolhida</label>
                  <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-1.5 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-sm opacity-60">calendar_today</span>
                    <span className="text-white/50 font-black text-[10px] uppercase tracking-widest py-3">
                      {selectedDate.split('-').reverse().join(' / ')}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-4 mb-2 block">Serviço / Ritual</label>
                <div className="relative group">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenSelectService(!openSelectService);
                      setOpenSelectPro(false);
                    }}
                    className={`w-full bg-white/5 border ${openSelectService ? 'border-primary shadow-gold-sm' : 'border-white/10'} rounded-2xl px-6 py-4 flex items-center justify-between transition-all active:scale-[0.98]`}
                  >
                    <span className={`text-[10px] font-bold uppercase ${newAppt.serviceId ? 'text-white' : 'text-slate-500'}`}>
                      {services.find(s => s.id === newAppt.serviceId)?.name.toUpperCase() || 'SELECIONE UM SERVIÇO'}
                    </span>
                    <span className={`material-symbols-outlined text-primary text-sm transition-transform duration-300 ${openSelectService ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>

                  {openSelectService && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-background-dark/95 border border-white/10 rounded-[24px] shadow-2xl z-[300] py-2 backdrop-blur-xl animate-fade-in overflow-hidden">
                      <div className="max-h-[200px] overflow-y-auto no-scrollbar">
                        {services.length === 0 ? (
                          <div className="px-6 py-4 text-[9px] text-slate-600 font-bold uppercase text-center italic">Nenhum serviço disponível</div>
                        ) : (
                          services.map(s => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setNewAppt(prev => ({ ...prev, serviceId: s.id }));
                                setOpenSelectService(false);
                              }}
                              className={`px-6 py-4 hover:bg-white/5 flex items-center justify-between group/item cursor-pointer transition-colors border-l-2 ${newAppt.serviceId === s.id ? 'border-primary bg-primary/5' : 'border-transparent'}`}
                            >
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-white group-hover/item:text-primary transition-colors">{s.name.toUpperCase()}</span>
                                <span className="text-[8px] text-slate-500 font-black tracking-widest uppercase">{s.duration_min} MIN</span>
                              </div>
                              <span className="text-[10px] font-black text-primary">R$ {s.price}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-4 mb-2 block">Profissional Responsável</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenSelectPro(!openSelectPro);
                      setOpenSelectService(false);
                    }}
                    className={`w-full bg-white/5 border ${openSelectPro ? 'border-primary shadow-gold-sm' : 'border-white/10'} rounded-2xl px-6 py-4 flex items-center justify-between transition-all active:scale-[0.98]`}
                  >
                    <span className={`text-[10px] font-bold uppercase ${newAppt.professionalId ? 'text-white' : 'text-slate-500'}`}>
                      {allProfessionals.find(p => p.id === newAppt.professionalId)?.name.toUpperCase() || 'SELECIONE O PROFISSIONAL'}
                    </span>
                    <span className={`material-symbols-outlined text-primary text-sm transition-transform duration-300 ${openSelectPro ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>

                  {openSelectPro && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-background-dark/95 border border-white/10 rounded-[24px] shadow-2xl z-[300] py-2 backdrop-blur-xl animate-fade-in overflow-hidden">
                      <div className="max-h-[200px] overflow-y-auto no-scrollbar">
                        {allProfessionals.map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setNewAppt(prev => ({ ...prev, professionalId: p.id }));
                              setOpenSelectPro(false);
                            }}
                            className={`px-6 py-4 hover:bg-white/5 flex items-center gap-4 group/item cursor-pointer transition-colors border-l-2 ${newAppt.professionalId === p.id ? 'border-primary bg-primary/5' : 'border-transparent'}`}
                          >
                            <div className="size-8 rounded-full border border-white/10 overflow-hidden shrink-0">
                              <img src={p.image} className="size-full object-cover grayscale group-hover/item:grayscale-0 transition-all" alt={p.name} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-white group-hover/item:text-primary transition-colors">{p.name.toUpperCase()}</span>
                              <span className="text-[8px] text-slate-500 font-black tracking-widest uppercase">{p.role}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={openSelectPro || openSelectService || openSelectTime}
                className="w-full gold-gradient py-5 rounded-2xl text-[10px] font-black text-background-dark uppercase tracking-widest shadow-gold-lg active:scale-95 transition-all mt-4 disabled:opacity-50"
              >
                Confirmar Agendamento
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação Customizado (Aura Confirm) */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-background-dark/95 backdrop-blur-xl animate-fade-in"></div>
          <div className="relative w-full max-w-xs bg-surface-dark border border-white/10 rounded-[40px] p-8 shadow-2xl animate-scale-in text-center">
            <div className={`size-16 rounded-full mx-auto mb-6 flex items-center justify-center ${confirmModal.actionType === 'delete' ? 'bg-red-500/10 text-red-500' :
              confirmModal.actionType === 'cancel' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'
              }`}>
              <span className="material-symbols-outlined text-3xl">
                {confirmModal.actionType === 'delete' ? 'delete_forever' :
                  confirmModal.actionType === 'cancel' ? 'cancel' : 'check_circle'}
              </span>
            </div>

            <h3 className="text-lg font-display font-black text-white italic uppercase tracking-tighter mb-2">
              {confirmModal.title}
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed mb-8">
              {confirmModal.message}
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={executeConfirmedAction}
                className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all ${confirmModal.actionType === 'delete' ? 'bg-red-500 text-white' : 'gold-gradient text-background-dark'
                  }`}
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                className="w-full py-4 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-white transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;