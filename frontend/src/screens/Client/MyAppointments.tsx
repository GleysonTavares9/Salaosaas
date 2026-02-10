
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Appointment } from '../../types';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface MyAppointmentsProps {
  appointments: Appointment[];
  onCancelAppointment: (id: string) => void;
}

const MyAppointments: React.FC<MyAppointmentsProps> = ({ appointments, onCancelAppointment }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const upcoming = appointments.filter(a => a.status === 'confirmed' || a.status === 'pending');
  const history = appointments.filter(a => a.status === 'completed' || a.status === 'canceled');

  // State para o Modal de Confirmação Customizado
  const [confirmModal, setConfirmModal] = React.useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    isDanger: false,
    onConfirm: () => { },
  });

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleCancel = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancelar Agendamento',
      message: 'Deseja realmente cancelar este agendamento? Essa ação não pode ser desfeita.',
      confirmText: 'Sim, Cancelar',
      cancelText: 'Voltar',
      isDanger: true,
      onConfirm: () => {
        onCancelAppointment(id);
        closeConfirmModal();
      }
    });
  };

  const handleChat = async (appt: Appointment) => {
    if (!appt.professional_id) {
      showToast("Este agendamento não tem um profissional específico.", 'error');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Buscar dados do profissional (precisamos do user_id dele)
      const { data: pro, error } = await supabase
        .from('professionals')
        .select('user_id, name, image')
        .eq('id', appt.professional_id)
        .single();

      if (error || !pro || !pro.user_id) {
        const { data: salon } = await supabase.from('salons').select('telefone').eq('id', appt.salon_id).single();
        const phone = salon?.telefone?.replace(/\D/g, '');

        if (phone) {
          setConfirmModal({
            isOpen: true,
            title: 'Chat Indisponível',
            message: `O chat direto com ${pro?.name || 'este profissional'} está indisponível no momento. Deseja contatar o salão via WhatsApp?`,
            confirmText: 'Abrir WhatsApp',
            cancelText: 'Cancelar',
            isDanger: false,
            onConfirm: () => {
              const text = encodeURIComponent(`Olá, gostaria de falar sobre meu agendamento com ${pro?.name || 'o profissional'}.`);
              window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
              closeConfirmModal();
            }
          });
        } else {
          showToast("Chat indisponível para este profissional no momento.", 'error');
        }
        return;
      }

      // 2. Iniciar conversa
      const conversation = await api.chat.startConversation(
        user.id,
        pro.user_id
      );

      navigate(`/chat/${conversation.id}`);
    } catch (e) {
      console.error(e);
      showToast("Erro ao abrir chat.", 'error');
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto pb-32 relative no-scrollbar bg-background-dark">
      <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-2xl px-6 sm:px-6 lg:px-6 py-8 sm:py-8 lg:py-8 border-b border-white/5">
        <div className="max-w-full max-w-[1200px] mx-auto w-full flex items-center justify-between">
          <button onClick={() => navigate('/explore')} className="size-10 sm:size-12 lg:size-12 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-center text-primary hover:bg-white/5 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-xl">arrow_back_ios</span>
          </button>
          <div className="text-center">
            <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none" style={{ fontSize: 'var(--step-1)' }}>Minha Agenda</h1>
            <p className="text-[7px] text-primary font-black uppercase tracking-[0.4em] mt-2">Sincronia de Estilo</p>
          </div>
          <button onClick={() => navigate('/messages')} className="size-10 sm:size-12 lg:size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group active:scale-95 transition-all">
            <span className="material-symbols-outlined text-2xl lg:text-2xl group-hover:scale-110 transition-transform">chat</span>
            <span className="absolute top-3 right-3 size-2.5 bg-red-500 rounded-full border-2 border-background-dark animate-pulse"></span>
          </button>
        </div>
      </header>

      {/* MODAL DE CONFIRMAÇÃO CUSTOMIZADO */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-6 lg:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1A1B25] border border-white/10 rounded-2xl sm:rounded-3xl lg:rounded-[48px] p-10 sm:p-10 lg:p-10 w-full max-w-md shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1.5 gold-gradient blur-[20px] opacity-40"></div>

            <div className="flex flex-col items-center text-center space-y-8">
              <div className={`size-14 sm:size-16 lg:size-20 rounded-2xl sm:rounded-3xl lg:rounded-[32px] flex items-center justify-center ${confirmModal.isDanger ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                <span className="material-symbols-outlined text-4xl lg:text-4xl">{confirmModal.isDanger ? 'warning' : 'info'}</span>
              </div>

              <div className="space-y-4">
                <h3 className="text-2xl lg:text-2xl font-display font-black text-white italic tracking-tight">{confirmModal.title}</h3>
                <p className="text-slate-400 text-sm font-bold leading-relaxed max-w-full max-w-[280px] mx-auto">{confirmModal.message}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-4 w-full pt-6">
                <button
                  onClick={closeConfirmModal}
                  className="bg-white/5 border border-white/10 text-white py-5 rounded-[24px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 active:scale-95 transition-all relative z-[110] cursor-pointer pointer-events-auto"
                >
                  {confirmModal.cancelText}
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className={`${confirmModal.isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-900/20' : 'gold-gradient text-background-dark shadow-primary/20'} py-5 rounded-[24px] text-[10px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all relative z-[110] cursor-pointer pointer-events-auto`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto w-full px-6 py-12 animate-fade-in">
        <section className="space-y-10 w-full">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-0.5 w-8 bg-primary"></div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Próximas Sessões</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
            {upcoming.map(appt => {
              const formattedDate = appt.date ? new Date(appt.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              }) : appt.date;

              return (
                <div key={appt.id} className="bg-surface-dark/40 rounded-2xl lg:rounded-[28px] border border-white/5 p-4 lg:p-5 shadow-2xl space-y-3.5 backdrop-blur-md group hover:border-primary/20 transition-all active:scale-[0.99] flex flex-col">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-[0.2em] bg-primary/10 text-primary border border-primary/20">
                          {appt.status === 'confirmed' ? 'Ritual Confirmado' : 'Aguardando Sincronia'}
                        </span>
                      </div>
                      <h3 className="text-base lg:text-lg font-display font-black text-white italic tracking-tight mb-0.5 uppercase group-hover:text-primary transition-colors truncate">{appt.service_names || appt.serviceName || 'Ritual Premium'}</h3>
                      {appt.salonName && (
                        <div className="flex items-baseline gap-1 text-slate-500">
                          <span className="material-symbols-outlined text-[9px]">location_on</span>
                          <p className="text-[9px] font-black uppercase tracking-widest truncate">{appt.salonName}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-black/40 rounded-xl p-3 lg:p-4 space-y-3 flex-1">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/5">
                        <span className="material-symbols-outlined text-primary text-sm">calendar_today</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[6px] uppercase text-slate-600 font-black tracking-widest mb-0">Data Agendada</p>
                        <p className="text-[11px] font-bold text-white capitalize">{formattedDate}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/5">
                        <span className="material-symbols-outlined text-primary text-sm">schedule</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[6px] uppercase text-slate-600 font-black tracking-widest mb-0">Horário Marcado</p>
                        <p className="text-[11px] font-bold text-white tracking-widest">{appt.time}</p>
                      </div>
                    </div>

                    {appt.valor && (
                      <div className="flex items-center gap-2.5 pt-2.5 border-t border-white/5">
                        <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/5">
                          <span className="material-symbols-outlined text-primary text-sm">payments</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[6px] uppercase text-slate-600 font-black tracking-widest mb-0">Valor do Ritual</p>
                          <p className="text-base font-display font-black text-primary italic">R$ {appt.valor.toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button onClick={() => handleChat(appt)} className="bg-white/5 border border-white/5 text-white py-2.5 rounded-lg text-[8px] font-black uppercase tracking-[0.1em] hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[14px]">chat</span>
                      Concierge
                    </button>
                    <button onClick={() => handleCancel(appt.id)} className="bg-red-500/5 text-red-500 border border-red-500/10 py-2.5 rounded-lg text-[8px] font-black uppercase tracking-[0.1em] hover:bg-red-500 hover:text-white active:scale-95 transition-all flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {upcoming.length === 0 && (
            <div className="py-32 sm:py-32 lg:py-32 text-center flex flex-col items-center justify-center space-y-8 bg-surface-dark/20 border border-dashed border-white/10 rounded-2xl sm:rounded-3xl lg:rounded-[48px]">
              <div className="size-18 sm:size-20 lg:size-24 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <span className="material-symbols-outlined text-4xl sm:text-5xl lg:text-6xl lg:text-4xl sm:text-5xl lg:text-6xl text-white/10">calendar_month</span>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/20">Agenda em Branco</p>
                <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">Sua próxima experiência está a um toque</p>
              </div>
              <button
                onClick={() => navigate('/explore')}
                className="gold-gradient text-background-dark px-10 sm:px-10 lg:px-10 py-4 sm:py-4 lg:py-4 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
              >
                Descobrir Rituais
              </button>
            </div>
          )}
        </section>

        {/* Histórico e Avaliações */}
        <section className="space-y-10 mt-24 w-full">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-0.5 w-8 bg-slate-800"></div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Histórico de Experiências</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {history.length > 0 ? history.map(appt => {
              const formattedDate = appt.date ? new Date(appt.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long'
              }) : appt.date;

              return (
                <div key={appt.id} className="bg-surface-dark/20 rounded-2xl sm:rounded-3xl lg:rounded-[40px] border border-white/5 p-8 sm:p-8 lg:p-8 flex flex-col justify-between space-y-6 opacity-60 hover:opacity-100 transition-all group">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="px-3 sm:px-3 lg:px-3 py-1 sm:py-1 lg:py-1 rounded-lg text-[7px] font-black uppercase tracking-[0.2em] bg-white/5 border border-white/5">
                        {appt.status === 'completed' ? 'CONCLUÍDO' : 'CANCELADO'}
                      </div>
                      <span className="text-[10px] text-slate-700 font-black italic tracking-widest">{appt.time}</span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-display font-black text-white italic tracking-tight uppercase group-hover:text-primary transition-colors">{appt.service_names || 'Ritual de Estilo'}</h3>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{formattedDate}</p>
                    </div>
                  </div>

                  {appt.status === 'completed' && (
                    <button
                      onClick={() => navigate(`/evaluate/${appt.id}`)}
                      className="w-full bg-primary/10 border border-primary/20 text-primary py-4 sm:py-4 lg:py-4 rounded-[20px] text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-background-dark active:scale-95 transition-all flex items-center justify-center gap-2 lg:gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">star</span>
                      Avaliar Aura
                    </button>
                  )}
                </div>
              );
            }) : (
              <div className="col-span-full py-20 sm:py-20 lg:py-20 text-center opacity-20 flex flex-col items-center border border-dashed border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[40px]">
                <p className="text-[9px] font-black uppercase tracking-[0.4em]">Seu legado ainda não começou</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default MyAppointments;
