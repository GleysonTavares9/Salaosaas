
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
    <div className="flex-1 bg-background-dark h-full overflow-y-auto pb-32 relative no-scrollbar">
      <header className="sticky top-0 z-50 bg-background-dark/90 backdrop-blur-md p-5 flex items-center justify-between border-b border-primary/10">
        <button onClick={() => navigate('/explore')} className="text-primary">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <h1 className="text-xl font-display font-bold tracking-tight text-white">Minha Agenda</h1>
        <button onClick={() => navigate('/messages')} className="text-primary relative">
          <span className="material-symbols-outlined">chat</span>
          <span className="absolute -top-1 -right-1 size-2 bg-red-500 rounded-full"></span>
        </button>
      </header>

      {/* MODAL DE CONFIRMAÇÃO CUSTOMIZADO */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1A1B25] border border-white/10 rounded-[32px] p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
            {/* Efeito de brilho de fundo */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-primary blur-[20px] opacity-40"></div>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`size-14 rounded-full flex items-center justify-center mb-2 ${confirmModal.isDanger ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
                <span className="material-symbols-outlined text-3xl">{confirmModal.isDanger ? 'warning' : 'info'}</span>
              </div>

              <h3 className="text-lg font-display font-black text-white italic tracking-tight">{confirmModal.title}</h3>
              <p className="text-slate-400 text-xs font-bold leading-relaxed">{confirmModal.message}</p>

              <div className="grid grid-cols-2 gap-3 w-full pt-4">
                <button
                  onClick={closeConfirmModal}
                  className="bg-white/5 border border-white/10 text-white py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all"
                >
                  {confirmModal.cancelText}
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className={`${confirmModal.isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-900/20' : 'gold-gradient text-background-dark shadow-primary/20'} py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 py-8 animate-fade-in">
        <section className="space-y-8">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-primary px-1">Próximas Sessões</h2>
          {upcoming.map(appt => {
            // Format date to Brazilian format
            const formattedDate = appt.date ? new Date(appt.date + 'T00:00:00').toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            }) : appt.date;

            return (
              <div key={appt.id} className="bg-surface-dark rounded-[32px] border border-white/5 p-6 shadow-2xl space-y-5">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                        {appt.status === 'confirmed' ? 'CONFIRMADO' : 'PENDENTE'}
                      </span>
                    </div>
                    <h3 className="text-lg font-display font-black text-white tracking-tight mb-1 break-words">{appt.service_names || appt.serviceName || 'Serviço'}</h3>
                    {appt.salonName && (
                      <p className="text-xs text-slate-400 font-bold">{appt.salonName}</p>
                    )}
                  </div>
                </div>

                <div className="bg-background-dark rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-sm">calendar_today</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] uppercase text-slate-500 font-black mb-0.5">Data</p>
                      <p className="text-sm font-bold text-white capitalize">{formattedDate}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-sm">schedule</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] uppercase text-slate-500 font-black mb-0.5">Horário</p>
                      <p className="text-sm font-bold text-white">{appt.time}</p>
                    </div>
                  </div>

                  {appt.valor && (
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-sm">payments</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] uppercase text-slate-500 font-black mb-0.5">Valor</p>
                        <p className="text-lg font-display font-black text-primary italic">R$ {appt.valor.toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleChat(appt)} className="bg-white/5 border border-white/10 text-white py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">chat</span>
                      Chat
                    </span>
                  </button>
                  <button onClick={() => handleCancel(appt.id)} className="bg-red-500/10 text-red-500 border border-red-500/20 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">close</span>
                      Cancelar
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
          {upcoming.length === 0 && (
            <div className="py-20 text-center opacity-30 flex flex-col items-center">
              <span className="material-symbols-outlined text-6xl mb-4">calendar_month</span>
              <p className="text-[10px] font-black uppercase tracking-widest">Sem agendamentos próximos</p>
            </div>
          )}
        </section>

        {/* Histórico e Avaliações */}
        <section className="space-y-8 mt-12">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 px-1">Histórico & Avaliações</h2>
          {history.length > 0 ? history.map(appt => {
            const formattedDate = appt.date ? new Date(appt.date + 'T00:00:00').toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long'
            }) : appt.date;

            return (
              <div key={appt.id} className="bg-surface-dark/40 rounded-[32px] border border-white/5 p-6 space-y-4 opacity-80">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-display font-black text-white tracking-tight leading-none mb-1">{appt.service_names || 'Serviço'}</h3>
                    <p className="text-[8px] text-slate-500 font-bold uppercase">{formattedDate} • {appt.time}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[6px] font-black uppercase tracking-widest ${appt.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {appt.status === 'completed' ? 'CONCLUÍDO' : 'CANCELADO'}
                  </span>
                </div>

                {appt.status === 'completed' && (
                  <button
                    onClick={() => navigate(`/evaluate/${appt.id}`)}
                    className="w-full bg-primary/10 border border-primary/20 text-primary py-3 rounded-xl text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-xs">star</span>
                    AVALIAR EXPERIÊNCIA
                  </button>
                )}
              </div>
            );
          }) : (
            <div className="py-10 text-center opacity-20 flex flex-col items-center border border-dashed border-white/10 rounded-[32px]">
              <p className="text-[8px] font-black uppercase tracking-widest">Nenhum histórico</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MyAppointments;
