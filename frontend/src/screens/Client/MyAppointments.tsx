
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Appointment } from '../../types';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

interface MyAppointmentsProps {
  appointments: Appointment[];
  onCancelAppointment: (id: string) => void;
}

const MyAppointments: React.FC<MyAppointmentsProps> = ({ appointments, onCancelAppointment }) => {
  const navigate = useNavigate();
  const upcoming = appointments.filter(a => a.status === 'confirmed' || a.status === 'pending');
  const history = appointments.filter(a => a.status === 'completed' || a.status === 'canceled');

  const handleCancel = (id: string) => {
    if (window.confirm("Deseja realmente cancelar este agendamento?")) {
      onCancelAppointment(id);
    }
  };

  const handleChat = async (appt: Appointment) => {
    if (!appt.professional_id) {
      alert("Este agendamento não tem um profissional específico.");
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
          if (window.confirm(`O chat direto com ${pro?.name || 'este profissional'} está indisponível. Deseja contatar o salão via WhatsApp?`)) {
            const text = encodeURIComponent(`Olá, gostaria de falar sobre meu agendamento com ${pro?.name || 'o profissional'}.`);
            window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
          }
        } else {
          alert("Chat indisponível para este profissional no momento.");
        }
        return;
      }

      // 2. Iniciar conversa
      const conversation = await api.chat.startConversation(
        user.id,
        pro.user_id,
        pro.name,
        pro.image
      );

      navigate(`/chat/${conversation.id}`);
    } catch (e) {
      console.error(e);
      alert("Erro ao abrir chat.");
    }
  };

  return (
    <div className="flex-1 bg-background-dark min-h-screen pb-32">
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
              <p className="text-[10px] font-black uppercase tracking-widest">Vazio por enquanto</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MyAppointments;
