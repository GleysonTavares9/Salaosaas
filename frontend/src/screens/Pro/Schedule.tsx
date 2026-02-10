import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Appointment, Service, Professional } from '../../types';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import Calendar from '../../components/Calendar';
import { useToast } from '../../contexts/ToastContext';

interface ScheduleProps {
  appointments: Appointment[];
  salon: any;
  onUpdateStatus: (id: string, status: Appointment['status']) => void;
}

const Schedule: React.FC<ScheduleProps> = ({ appointments: initialAppointments, salon: initialSalon, onUpdateStatus }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
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

        // Filtrar profissionais baseado no papel
        if (userRole === 'pro' && proId) {
          setAllProfessionals((salonPros || []).filter(p => p.id === proId));
        } else {
          setAllProfessionals(salonPros || []);
        }

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
  const dayKeys = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const currentDayKey = dayKeys[dateObj.getDay()];

  // Pegamos o horário do profissional se houver apenas um selecionado (visão Pro)
  const isSinglePro = allProfessionals.length === 1;
  const targetSchedule = (isSinglePro && allProfessionals[0].horario_funcionamento?.[currentDayKey])
    ? allProfessionals[0].horario_funcionamento?.[currentDayKey]
    : salon?.horario_funcionamento?.[currentDayKey];

  const todayAppointments = appointments.filter(a => a.date === selectedDate && a.status !== 'canceled');

  const salonOpen = (targetSchedule?.closed === false) ? parseInt(targetSchedule.open.split(':')[0]) : 8;
  const salonClose = (targetSchedule?.closed === false) ? parseInt(targetSchedule.close.split(':')[0]) : 20;

  // Ajustar o range de horas baseado nos agendamentos reais (para não esconder nada)
  const apptHours = todayAppointments.map(a => parseInt(a.time.split(':')[0]));
  const minApptHour = apptHours.length > 0 ? Math.min(...apptHours) : 24;
  const maxApptHour = apptHours.length > 0 ? Math.max(...apptHours) : 0;

  const startHour = Math.min(salonOpen, minApptHour, 23);
  const endHour = Math.max(salonClose, maxApptHour, 0);

  const hours = Array.from({ length: Math.max(1, endHour - startHour + 1) }, (_, i) => startHour + i);

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

    console.log('🔄 Executando ação:', { id, actionType }); // LOG

    try {
      if (actionType === 'finish') {
        console.log('✅ Finalizando agendamento...', id);
        const result = await api.appointments.updateStatus(id, 'completed');
        console.log('✅ Resultado:', result);
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'completed' } : a));
        showToast('Agendamento finalizado com sucesso!', 'success');
      } else if (actionType === 'cancel') {
        console.log('❌ Cancelando agendamento...', id);
        const result = await api.appointments.updateStatus(id, 'canceled');
        console.log('❌ Resultado:', result);
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'canceled' } : a));
        showToast('Agendamento cancelado!', 'success');
      } else if (actionType === 'delete') {
        console.log('🗑️ Deletando agendamento...', id);
        await api.appointments.delete(id);
        console.log('🗑️ Deletado com sucesso!');
        setAppointments(prev => prev.filter(a => a.id !== id));
        showToast('Agendamento excluído!', 'success');
      }
    } catch (error: any) {
      console.error('❌ ERRO DETALHADO:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        full: error
      });
      showToast(`Erro ao processar ação: ${error.message || error}`, 'error');
    } finally {
      setConfirmModal({ ...confirmModal, show: false });
    }
  };

  const getPosition = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const offset = h - startHour;
    return offset * 100 + (m / 60) * 100;
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (e: React.DragEvent, targetHour: number, targetMin: number, targetProId?: string) => {
    e.preventDefault();
    const apptId = e.dataTransfer.getData('apptId');
    if (!apptId) return;

    const newTime = `${targetHour.toString().padStart(2, '0')}:${targetMin.toString().padStart(2, '0')}`;

    // Pegar o profissional (ou manter o atual se não soltou em uma coluna específica)
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;

    const finalProId = targetProId || appt.professional_id;
    const duration = appt.duration_min || 30;
    const [h, m] = newTime.split(':').map(Number);
    const newStart = h * 60 + m;
    const newEnd = newStart + duration;

    // Validar sobreposição no novo profissional/horário
    const isConflict = appointments.some(a => {
      if (a.id === apptId || a.date !== selectedDate || a.professional_id !== finalProId || a.status === 'canceled') return false;
      const [ah, am] = a.time.split(':').map(Number);
      const aStart = ah * 60 + am;
      const aEnd = aStart + (a.duration_min || 30);
      return (newStart < aEnd && newEnd > aStart);
    });

    if (isConflict) {
      setConfirmModal({
        show: true,
        title: 'Conflito de Horário',
        message: 'Este profissional já possui um agendamento neste horário.',
        actionType: null,
        id: null
      });
      return;
    }

    try {
      await api.appointments.update(apptId, {
        time: newTime,
        professional_id: finalProId
      });
      fetchData();
    } catch (error) {
      console.error("Erro ao reagendar:", error);
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
      showToast("Preencha todos os campos do agendamento.", 'info');
      return;
    }

    const selectedService = services.find(s => s.id === newAppt.serviceId);

    // Validar sobreposição antes de criar
    const duration = selectedService?.duration_min || 60;
    const [h, m] = newAppt.time.split(':').map(Number);
    const newStart = h * 60 + m;
    const newEnd = newStart + duration;

    const isConflict = appointments.some(a => {
      if (a.date !== selectedDate || a.professional_id !== newAppt.professionalId || a.status === 'canceled') return false;
      const [ah, am] = a.time.split(':').map(Number);
      const aStart = ah * 60 + am;
      const aEnd = aStart + (a.duration_min || 30);
      return (newStart < aEnd && newEnd > aStart);
    });

    if (isConflict) {
      showToast("Este profissional já possui um agendamento que sobrepõe este horário.", 'error');
      return;
    }

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
      showToast("Erro ao criar agendamento. Verifique sua conexão.", 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-background-dark min-h-screen flex items-center justify-center">
        <div className="size-10 sm:size-12 lg:size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto pb-32 relative no-scrollbar bg-background-dark">
      <header className="sticky top-0 z-[100] bg-background-dark/80 backdrop-blur-2xl px-4 lg:px-6 pt-2 lg:pt-12 pb-2 lg:pb-8 border-b border-white/5">
        <div className="max-w-full max-w-[1400px] mx-auto w-full">
          <div className="flex items-center justify-between mb-3 lg:mb-10 px-2 sm:px-2 lg:px-2">
            <div className="flex items-center gap-3 lg:gap-6">
              <button onClick={() => navigate('/pro')} className="size-9 lg:size-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
                <span className="material-symbols-outlined text-xl">arrow_back</span>
              </button>
              <div>
                <h1 className="font-display text-base lg:text-2xl font-black text-white italic tracking-[0.05em] uppercase leading-none">Agenda Elite</h1>
                <p className="text-[8px] text-primary font-black uppercase tracking-[0.3em] mt-1 lg:mt-3 opacity-80">{salon?.nome || 'Portal Aura'}</p>
              </div>
            </div>

            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className={`size-9 lg:size-12 rounded-xl flex items-center justify-center transition-all bg-surface-dark/40 text-white border border-white/10 hover:bg-white/5 ${showCalendar ? 'border-primary ring-1 ring-primary/20' : ''}`}
            >
              <span className="material-symbols-outlined text-xl">{showCalendar ? 'calendar_month' : 'calendar_today'}</span>
            </button>
          </div>

          <div className="flex bg-surface-dark/30 p-1 rounded-full border border-white/5 max-w-xs mx-auto backdrop-blur-md">
            <button onClick={() => setActiveTab('grid')} className={`flex-1 py-2 sm:py-3 lg:py-4 rounded-full text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'grid' ? 'gold-gradient text-background-dark shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Agenda</button>
            <button onClick={() => setActiveTab('list')} className={`flex-1 py-2 sm:py-3 lg:py-4 rounded-full text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'list' ? 'gold-gradient text-background-dark shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Fila</button>
          </div>

          {showCalendar && (
            <div className="mt-8 animate-fade-in px-2 sm:px-2 lg:px-2">
              <div className="max-w-md mx-auto">
                <Calendar
                  selectedDate={selectedDate}
                  bookedDates={bookedDatesCount}
                  onDateSelect={(date) => {
                    setSelectedDate(date);
                    setShowCalendar(false);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-full max-w-[1400px] mx-auto w-full px-8 sm:px-8 lg:px-8 py-6 sm:py-6 lg:py-6 flex items-center justify-between">
        <div className="flex items-center gap-4 lg:gap-4">
          <div className="size-10 sm:size-12 lg:size-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 text-slate-500">
            <span className="material-symbols-outlined text-sm">event</span>
          </div>
          <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </span>
        </div>
        <div className="flex items-center gap-6 lg:gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20">
            <span className="size-1.5 bg-primary rounded-full animate-pulse"></span>
            <span className="text-[9px] font-black text-primary uppercase tracking-widest">{todayAppointments.length} Sessões</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="size-10 sm:size-12 lg:size-12 rounded-2xl gold-gradient text-background-dark flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all active:scale-95 hover:scale-105"
          >
            <span className="material-symbols-outlined font-black">add</span>
          </button>
        </div>
      </div>

      <main className="max-w-full max-w-[1400px] mx-auto w-full px-6 sm:px-6 lg:px-6 py-6 sm:py-6 lg:py-6 animate-fade-in relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>

        {activeTab === 'grid' ? (
          <div
            className="relative bg-background-dark rounded-[32px] sm:rounded-3xl lg:rounded-[40px] border border-white/10 overflow-hidden flex flex-col shadow-[0_40px_100px_rgba(0,0,0,0.4)]"
            style={{ minHeight: `${hours.length * 80 + 60}px` }}
          >
            {/* Professional Column Headers (Sticky) */}
            {allProfessionals.length > 0 && (
              <div className="sticky top-0 left-0 right-0 h-16 lg:h-20 flex items-center border-b border-white/10 bg-background-dark/95 backdrop-blur-3xl z-[40]">
                <div className="w-14 sm:w-16 lg:w-20 shrink-0 border-r border-white/10 h-full flex items-center justify-center bg-black/60 shadow-lg relative">
                  <span className="material-symbols-outlined text-primary text-base font-black">schedule</span>
                  <div className="absolute top-0 right-0 w-[1px] h-full bg-primary/20"></div>
                </div>
                <div className="flex-1 flex h-full overflow-x-auto no-scrollbar scroll-smooth">
                  {allProfessionals.map((pro) => (
                    <div
                      key={pro.id}
                      style={{ width: allProfessionals.length > 3 ? '25%' : allProfessionals.length > 1 ? '45%' : '100%', minWidth: '140px' }}
                      className="flex-none sm:flex-1 flex items-center justify-center px-4 border-r border-white/10 last:border-r-0 relative group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-8 lg:size-10 rounded-xl border border-primary/40 p-0.5 bg-black/60 overflow-hidden shadow-2xl transition-transform group-hover:scale-105">
                          <img
                            src={pro.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(pro.name)}&background=c1a571&color=0c0d10&bold=true`}
                            className="size-full rounded-lg object-cover"
                            alt={pro.name}
                          />
                        </div>
                        <span className="text-[10px] lg:text-xs font-black text-white uppercase tracking-wider truncate max-w-[90px] drop-shadow-md">
                          {pro.name.split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="relative flex-1">
              {/* Professional Column Separators (Background) */}
              <div className="absolute inset-0 flex pointer-events-none">
                <div className="w-20 shrink-0 border-r border-white/5 h-full bg-black/5"></div>
                <div className="flex-1 flex h-full">
                  {allProfessionals.map((_, idx) => (
                    <div key={idx} style={{ width: `${100 / allProfessionals.length}%` }} className="h-full border-r border-white/5 last:border-r-0"></div>
                  ))}
                </div>
              </div>

              {/* Linhas de Horário with Drop Zones */}
              {hours.map(h => (
                <div key={h} className="relative h-auto min-h-[80px] border-b border-white/5 w-full flex flex-col group/row">
                  <div className="h-1/2 w-full flex items-stretch relative">
                    <div className="w-14 sm:w-16 shrink-0 flex items-center justify-center bg-black/60 border-r border-white/20 z-[11] relative overflow-hidden">
                      <div className="absolute inset-0 bg-primary/2"></div>
                      <span className="text-[11px] font-display font-black text-white tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] z-20">
                        {h.toString().padStart(2, '0')}:00
                      </span>
                    </div>
                    <div className="flex-1 flex group/cells">
                      {allProfessionals.map(pro => (
                        <div
                          key={pro.id}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, h, 0, pro.id)}
                          onClick={() => {
                            setNewAppt(prev => ({
                              ...prev,
                              time: `${h.toString().padStart(2, '0')}:00`,
                              professionalId: pro.id
                            }));
                            setShowAddModal(true);
                          }}
                          className="flex-1 h-full hover:bg-primary/5 transition-colors cursor-pointer relative group/item"
                        >
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/item:opacity-40 transition-opacity">
                            <span className="material-symbols-outlined text-primary text-2xl lg:text-2xl">add_circle</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Meia hora 30 */}
                  <div className="h-1/2 w-full flex items-stretch relative border-t border-dashed border-white/10">
                    <div className="w-14 sm:w-16 shrink-0 flex items-center justify-center bg-black/40 border-r border-white/10 z-[11]">
                      <span className="text-[9px] font-black text-slate-500 tracking-tighter opacity-80">{h}:30</span>
                    </div>
                    <div className="flex-1 flex group/cells">
                      {allProfessionals.map(pro => (
                        <div
                          key={pro.id}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, h, 30, pro.id)}
                          onClick={() => {
                            setNewAppt(prev => ({
                              ...prev,
                              time: `${h.toString().padStart(2, '0')}:30`,
                              professionalId: pro.id
                            }));
                            setShowAddModal(true);
                          }}
                          className="flex-1 h-full hover:bg-primary/5 transition-colors cursor-pointer relative group/item"
                        >
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/item:opacity-40 transition-opacity">
                            <span className="material-symbols-outlined text-primary text-2xl lg:text-2xl">add_circle</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Cards de Agendamento */}
              {todayAppointments.map(appt => {
                const top = getPosition(appt.time) * 0.8; // Adjusted for height 80px
                const height = Math.max(70, (appt.duration_min || 60) / 60 * 80 - 4);

                let proIndex = allProfessionals.findIndex(p => p.id === appt.professional_id);
                if (proIndex === -1) {
                  if (allProfessionals.length > 0) proIndex = 0;
                  else return null;
                }

                return (
                  <div
                    key={appt.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('apptId', appt.id);
                      setTimeout(() => (e.dataTransfer.setDragImage(new Image(), 0, 0)), 0);
                    }}
                    style={{
                      top: `${top + 2}px`,
                      height: `${height}px`,
                      left: `calc(${allProfessionals.length > 1 ? '56px' : '56px'} + ((100% - 56px) * ${proIndex} / ${allProfessionals.length}) + 2px)`,
                      width: `calc(((100% - 56px) / ${allProfessionals.length}) - 4px)`,
                      zIndex: 20
                    }}
                    className="absolute p-3 rounded-2xl border-l-[5px] border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all cursor-grab active:cursor-grabbing group overflow-hidden bg-surface-dark/95 backdrop-blur-2xl hover:scale-[1.01] active:stroke-primary border-t-white/5"
                    onClick={() => handleFinish(appt.id)}
                  >
                    <div className={`absolute inset-0 opacity-10 ${appt.status === 'confirmed' ? 'bg-primary' : 'bg-emerald-500'}`}></div>
                    <div className={`absolute inset-y-0 left-0 w-1.5 ${appt.status === 'confirmed' ? 'bg-primary shadow-[0_0_15px_rgba(193,165,113,0.8)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]'}`}></div>

                    <div className="relative h-full flex flex-col justify-between">
                      <div className="min-w-0">
                        <div className="flex justify-between items-start gap-1 mb-1">
                          <p className={`text-[7px] font-black uppercase tracking-widest shrink-0 ${appt.status === 'confirmed' ? 'text-primary' : 'text-emerald-500'}`}>{appt.time}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(appt.id); }}
                            className="size-5 rounded-md bg-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all scale-0 group-hover:scale-100 origin-right"
                          >
                            <span className="material-symbols-outlined text-[12px]">delete</span>
                          </button>
                        </div>
                        <h4 className="text-[11px] font-display font-black text-white uppercase italic tracking-tight truncate leading-tight">{appt.clientName}</h4>
                        <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest truncate mt-0.5">{appt.service_names}</p>
                      </div>

                      <div className="flex justify-between items-end mt-1">
                        <span className="text-[13px] font-display font-black text-primary italic leading-none drop-shadow-sm">R$ {appt.valor.toFixed(2)}</span>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-black/60 rounded-full border border-white/10">
                          <span className="material-symbols-outlined text-[10px] text-primary/80">schedule</span>
                          <span className="text-[8px] font-black text-slate-300 uppercase">{appt.duration_min}m</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-w-full sm:max-w-6xl mx-auto w-full space-y-6">
            {todayAppointments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
                {todayAppointments.map(appt => (
                  <div key={appt.id} className="group bg-surface-dark/40 rounded-2xl border border-white/5 p-4 lg:p-5 shadow-2xl relative overflow-hidden backdrop-blur-md hover:border-primary/20 transition-all flex flex-col justify-between h-full">
                    <div className={`absolute top-0 left-0 w-1 h-full ${appt.status === 'confirmed' ? 'bg-primary shadow-[0_0_10px_rgba(193,165,113,0.3)]' : appt.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className={`text-[7px] lg:text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${appt.status === 'confirmed' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-slate-500/10 text-slate-500 border-white/10'}`}>
                            {appt.status}
                          </span>
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-black/40 rounded-full border border-white/5">
                            <span className="material-symbols-outlined text-[11px] text-primary">schedule</span>
                            <span className="text-[9px] font-bold text-white uppercase">{appt.time}</span>
                          </div>
                        </div>
                        <p className="text-lg lg:text-xl font-display font-black text-white italic tracking-tighter leading-none">R$ {appt.valor.toFixed(2)}</p>
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-base lg:text-lg font-display font-black text-white uppercase italic tracking-tight group-hover:text-primary transition-colors truncate">{appt.clientName || 'Cliente Aura'}</h3>
                        <div className="flex items-center gap-2 text-[8px] font-black text-slate-600 uppercase tracking-widest mt-0.5">
                          <span>{appt.duration_min || 60} MIN</span>
                          <span className="size-1 rounded-full bg-white/10"></span>
                          <span className="truncate">{appt.service_names}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-black/30 rounded-xl p-2.5 border border-white/5">
                        <span className="material-symbols-outlined text-[13px] text-primary/60">person</span>
                        <span className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">
                          {allProfessionals.find(p => p.id === appt.professional_id)?.name || 'Profissional'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-auto pt-1">
                        <button
                          onClick={() => navigate(`/chat/${appt.client_id}`)}
                          className="size-8 lg:size-9 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-white hover:bg-primary hover:text-background-dark transition-all active:scale-95"
                        >
                          <span className="material-symbols-outlined text-base">chat</span>
                        </button>

                        <button
                          onClick={() => handleFinish(appt.id)}
                          className="flex-1 h-8 lg:h-9 gold-gradient text-background-dark rounded-lg flex items-center justify-center gap-2 text-[8px] lg:text-[9px] font-black uppercase tracking-[0.2em] shadow-gold-sm active:scale-95 hover:brightness-110 transition-all font-black"
                        >
                          <span className="material-symbols-outlined text-base">verified</span>
                          Finalizar
                        </button>

                        <button
                          onClick={() => handleCancel(appt.id)}
                          className="size-8 lg:size-9 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                        >
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-40 sm:py-40 lg:py-40 text-center flex flex-col items-center justify-center bg-surface-dark/10 border border-dashed border-white/10 rounded-2xl sm:rounded-3xl lg:rounded-[64px] animate-fade-in">
                <div className="size-18 sm:size-20 lg:size-24 rounded-full bg-white/5 flex items-center justify-center border border-white/10 mb-8">
                  <span className="material-symbols-outlined text-4xl sm:text-5xl lg:text-6xl lg:text-4xl sm:text-5xl lg:text-6xl text-white/10">event_busy</span>
                </div>
                <h3 className="text-[12px] font-black uppercase tracking-[0.5em] text-white/20">Silêncio na Agenda</h3>
                <p className="text-[9px] font-bold text-slate-700 uppercase tracking-[0.2em] mt-3">Nenhum agendamendo planejado para este ciclo</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-10 px-8 sm:px-8 lg:px-8 py-4 sm:py-4 lg:py-4 gold-gradient text-background-dark rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                >
                  Agendar Manualmente
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de Agendamento Manual */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-0 lg:p-0 sm:p-4 sm:p-4 lg:p-4">
          <div className="absolute inset-0 bg-background-dark/90 backdrop-blur-md" onClick={() => {
            setShowAddModal(false);
            setOpenSelectService(false);
            setOpenSelectPro(false);
            setOpenSelectTime(false);
          }}></div>
          <div className="relative w-full max-w-full sm:max-w-lg bg-surface-dark border-t sm:border border-white/10 rounded-t-[40px] sm:rounded-2xl sm:rounded-3xl lg:rounded-[40px] p-8 sm:p-8 lg:p-8 shadow-2xl animate-slide-up no-scrollbar overflow-y-auto max-h-[90vh]">
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
              }} className="size-10 sm:size-12 lg:size-10 rounded-full bg-white/5 flex items-center justify-center text-white">
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
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 sm:px-6 lg:px-6 py-4 sm:py-4 lg:py-4 text-white font-bold text-[10px] outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-4">
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
                      className={`w-full bg-white/5 border ${openSelectTime ? 'border-primary shadow-gold-sm' : 'border-white/10'} rounded-2xl px-6 sm:px-6 lg:px-6 py-4 sm:py-4 lg:py-4 flex items-center justify-between transition-all active:scale-[0.98]`}
                    >
                      <span className="text-[10px] font-bold text-white uppercase">{newAppt.time}</span>
                      <span className={`material-symbols-outlined text-primary text-sm transition-transform duration-300 ${openSelectTime ? 'rotate-180' : ''}`}>expand_more</span>
                    </button>

                    {openSelectTime && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-background-dark/95 border border-white/10 rounded-[24px] shadow-2xl z-[350] py-2 sm:py-2 lg:py-2 backdrop-blur-xl animate-fade-in overflow-hidden">
                        <div className="max-h-auto min-h-[200px] overflow-y-auto no-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/5">
                          {(() => {
                            // Validar horário específico do profissional
                            const dateObj = new Date(selectedDate);
                            const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                            // Ajuste fuso/dia (getDay retorna baseado no local, selectedDate é YYYY-MM-DD)
                            // Melhor criar date com UTC para garantir dia certo da string
                            const [y, m, d] = selectedDate.split('-').map(Number);
                            const utcDate = new Date(y, m - 1, d);
                            const currentDayKey = dayKeys[utcDate.getDay()];

                            const selectedPro = allProfessionals.find(p => p.id === newAppt.professionalId);
                            const proSchedule = selectedPro?.horario_funcionamento?.[currentDayKey];
                            const salonSchedule = salon?.horario_funcionamento?.[currentDayKey];

                            // Hierarquia: Pro > Salão
                            let dayConfig = salonSchedule;
                            if (proSchedule) {
                              dayConfig = proSchedule;
                            }

                            if (!dayConfig || dayConfig.closed) {
                              return <div className="col-span-2 p-4 sm:p-4 lg:p-4 text-center text-[10px] text-red-500 font-bold uppercase">Profissional não atende neste dia</div>;
                            }

                            const [openH] = dayConfig.open.split(':').map(Number);
                            const [closeH] = dayConfig.close.split(':').map(Number);

                            // Gerar array de horas baseado no range real
                            const availableHours = [];
                            for (let h = openH; h < closeH; h++) {
                              availableHours.push(h);
                            }

                            return availableHours.flatMap(h => [`${h.toString().padStart(2, '0')}:00`, `${h.toString().padStart(2, '0')}:30`]).map(t => {
                              const [th, tm] = t.split(':').map(Number);
                              const tStart = th * 60 + tm;
                              const tEnd = tStart + (services.find(s => s.id === newAppt.serviceId)?.duration_min || 30);

                              const isBusy = appointments.some(a => {
                                if (a.date !== selectedDate || a.professional_id !== newAppt.professionalId || a.status === 'canceled') return false;
                                const [ah, am] = a.time.split(':').map(Number);
                                const aStart = ah * 60 + am;
                                const aEnd = aStart + (a.duration_min || 30);
                                return (tStart < aEnd && tEnd > aStart);
                              });

                              return (
                                <button
                                  key={t}
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => {
                                    setNewAppt(prev => ({ ...prev, time: t }));
                                    setOpenSelectTime(false);
                                  }}
                                  className={`px-4 sm:px-4 lg:px-4 py-3 sm:py-3 lg:py-3 bg-background-dark text-[10px] font-bold uppercase transition-all hover:bg-white/5 text-center flex flex-col items-center justify-center gap-0 lg:gap-0.5 ${newAppt.time === t ? 'text-primary bg-primary/5' : 'text-white'} ${isBusy ? 'opacity-20 cursor-not-allowed grayscale' : ''}`}
                                >
                                  <span>{t}</span>
                                  {isBusy && <span className="text-[6px] text-red-500 font-black">OCUPADO</span>}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-4 mb-2 block">Data Escolhida</label>
                  <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 sm:px-6 lg:px-6 py-1 sm:py-1 lg:py-1.5 flex items-center gap-3 lg:gap-3">
                    <span className="material-symbols-outlined text-primary text-sm opacity-60">calendar_today</span>
                    <span className="text-white/50 font-black text-[10px] uppercase tracking-widest py-3 sm:py-3 lg:py-3">
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
                    className={`w-full bg-white/5 border ${openSelectService ? 'border-primary shadow-gold-sm' : 'border-white/10'} rounded-2xl px-6 sm:px-6 lg:px-6 py-4 sm:py-4 lg:py-4 flex items-center justify-between transition-all active:scale-[0.98]`}
                  >
                    <span className={`text-[10px] font-bold uppercase ${newAppt.serviceId ? 'text-white' : 'text-slate-500'}`}>
                      {services.find(s => s.id === newAppt.serviceId)?.name.toUpperCase() || 'SELECIONE UM SERVIÇO'}
                    </span>
                    <span className={`material-symbols-outlined text-primary text-sm transition-transform duration-300 ${openSelectService ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>

                  {openSelectService && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-background-dark/95 border border-white/10 rounded-[24px] shadow-2xl z-[300] py-2 sm:py-2 lg:py-2 backdrop-blur-xl animate-fade-in overflow-hidden">
                      <div className="max-h-auto min-h-[200px] overflow-y-auto no-scrollbar">
                        {services.length === 0 ? (
                          <div className="px-6 sm:px-6 lg:px-6 py-4 sm:py-4 lg:py-4 text-[9px] text-slate-600 font-bold uppercase text-center italic">Nenhum serviço disponível</div>
                        ) : (
                          services.map(s => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setNewAppt(prev => ({ ...prev, serviceId: s.id }));
                                setOpenSelectService(false);
                              }}
                              className={`px-6 sm:px-6 lg:px-6 py-4 sm:py-4 lg:py-4 hover:bg-white/5 flex items-center justify-between group/item cursor-pointer transition-colors border-l-2 ${newAppt.serviceId === s.id ? 'border-primary bg-primary/5' : 'border-transparent'}`}
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
                    className={`w-full bg-white/5 border ${openSelectPro ? 'border-primary shadow-gold-sm' : 'border-white/10'} rounded-2xl px-6 sm:px-6 lg:px-6 py-4 sm:py-4 lg:py-4 flex items-center justify-between transition-all active:scale-[0.98]`}
                  >
                    <span className={`text-[10px] font-bold uppercase ${newAppt.professionalId ? 'text-white' : 'text-slate-500'}`}>
                      {allProfessionals.find(p => p.id === newAppt.professionalId)?.name.toUpperCase() || 'SELECIONE O PROFISSIONAL'}
                    </span>
                    <span className={`material-symbols-outlined text-primary text-sm transition-transform duration-300 ${openSelectPro ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>

                  {openSelectPro && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-background-dark/95 border border-white/10 rounded-[24px] shadow-2xl z-[300] py-2 sm:py-2 lg:py-2 backdrop-blur-xl animate-fade-in overflow-hidden">
                      <div className="max-h-auto min-h-[200px] overflow-y-auto no-scrollbar">
                        {allProfessionals.map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setNewAppt(prev => ({ ...prev, professionalId: p.id }));
                              setOpenSelectPro(false);
                            }}
                            className={`px-6 sm:px-6 lg:px-6 py-4 sm:py-4 lg:py-4 hover:bg-white/5 flex items-center gap-4 lg:gap-4 group/item cursor-pointer transition-colors border-l-2 ${newAppt.professionalId === p.id ? 'border-primary bg-primary/5' : 'border-transparent'}`}
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
                className="w-full gold-gradient py-5 sm:py-5 lg:py-5 rounded-2xl text-[10px] font-black text-background-dark uppercase tracking-widest shadow-gold-lg active:scale-95 transition-all mt-4 disabled:opacity-50"
              >
                Confirmar Agendamento
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação Customizado (Aura Confirm) */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 sm:p-6 lg:p-6">
          <div className="absolute inset-0 bg-background-dark/95 backdrop-blur-xl animate-fade-in"></div>
          <div className="relative w-full max-w-xs bg-surface-dark border border-white/10 rounded-2xl sm:rounded-3xl lg:rounded-[40px] p-8 sm:p-8 lg:p-8 shadow-2xl animate-scale-in text-center">
            <div className={`size-10 sm:size-12 lg:size-16 rounded-full mx-auto mb-6 flex items-center justify-center ${confirmModal.actionType === 'delete' ? 'bg-red-500/10 text-red-500' :
              confirmModal.actionType === 'cancel' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'
              }`}>
              <span className="material-symbols-outlined text-3xl lg:text-3xl">
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

            <div className="flex flex-col gap-3 lg:gap-3">
              <button
                onClick={executeConfirmedAction}
                className={`w-full py-4 sm:py-4 lg:py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all ${confirmModal.actionType === 'delete' ? 'bg-red-500 text-white' : 'gold-gradient text-background-dark'
                  }`}
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                className="w-full py-4 sm:py-4 lg:py-4 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-white transition-colors"
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