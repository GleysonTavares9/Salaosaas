
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Appointment, ViewRole } from '../../types';

interface AdminBookingsProps {
  appointments: Appointment[];
  role: ViewRole;
  userId: string | null;
  onUpdateStatus: (id: string, status: Appointment['status']) => void;
}

const AdminBookings: React.FC<AdminBookingsProps> = ({ appointments, role, userId, onUpdateStatus }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  // No App.tsx já filtramos os agendamentos na origem para cada perfil.
  // Admin recebe todos do salão, Pro recebe apenas os seus.
  const userAppointments = appointments;

  const filteredAppts = filter === 'all'
    ? userAppointments
    : userAppointments.filter(a => a.status === filter);

  const openWhatsApp = (appt: Appointment) => {
    const text = `Olá ${appt.clientName}! Aqui é o ${appt.professionalName} do Luxe Aura. Estou entrando em contato sobre seu agendamento de ${appt.serviceName} no dia ${appt.date} às ${appt.time}.`;
    window.open(`https://wa.me/5511999999999?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleAction = (id: string, action: 'remarcar' | 'cancelar') => {
    if (action === 'cancelar') {
      if (window.confirm("Deseja cancelar este agendamento? O cliente será notificado.")) {
        onUpdateStatus(id, 'canceled');
      }
    } else {
      alert("Interface de remarcação: Selecione nova data.");
    }
  };

  return (
    <div className="flex-1 bg-background-dark min-h-screen">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-xl px-6 pt-12 pb-6 border-b border-white/5">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/pro')} className="size-10 rounded-full border border-white/10 flex items-center justify-center text-white">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-display font-black text-white italic tracking-tight">{role === 'admin' ? 'Faturamento & Agenda' : 'Meus Atendimentos'}</h1>
            <p className="text-primary text-[8px] font-black uppercase tracking-[0.2em] mt-1">Gestão de Sessões em Tempo Real</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
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

      <main className="px-6 py-8 space-y-6 pb-40 animate-fade-in">
        {filteredAppts.map(appt => (
          <div key={appt.id} className={`bg-surface-dark/60 rounded-[32px] border border-white/5 p-6 shadow-xl relative overflow-hidden transition-all ${appt.status === 'canceled' ? 'opacity-40 grayscale' : ''}`}>

            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${appt.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                    {appt.status}
                  </span>
                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">ID: {appt.id}</span>
                </div>
                <h3 className="text-lg font-display font-black text-white italic tracking-tight">{appt.clientName || "Cliente Aura"}</h3>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">{appt.serviceName}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-display font-black text-white">R$ {appt.valor}</p>
                <p className="text-[9px] font-black text-slate-500 uppercase mt-1">{appt.date} • {appt.time}</p>
              </div>
            </div>

            {/* Ações de Comunicação */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => navigate('/chat/c1')}
                className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-2xl py-3 text-[9px] font-black text-white uppercase tracking-widest active:bg-primary/20"
              >
                <span className="material-symbols-outlined text-sm">chat</span>
                Chat Interno
              </button>
              <button
                onClick={() => openWhatsApp(appt)}
                className="flex items-center justify-center gap-2 bg-emerald-600/10 border border-emerald-600/20 rounded-2xl py-3 text-[9px] font-black text-emerald-500 uppercase tracking-widest active:bg-emerald-600/30"
              >
                <span className="material-symbols-outlined text-sm">send</span>
                WhatsApp
              </button>
            </div>

            {/* Ações de Gestão de Agenda */}
            {appt.status !== 'completed' && appt.status !== 'canceled' && (
              <div className="flex gap-2 pt-4 border-t border-white/5">
                <button
                  onClick={() => handleAction(appt.id, 'remarcar')}
                  className="flex-1 bg-surface-dark border border-white/10 text-slate-300 py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">event_repeat</span>
                  Remarcar
                </button>
                <button
                  onClick={() => handleAction(appt.id, 'cancelar')}
                  className="flex-1 bg-danger/10 border border-danger/20 text-danger py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ))}

        {filteredAppts.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center opacity-30">
            <span className="material-symbols-outlined text-6xl mb-4">event_busy</span>
            <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma sessão encontrada</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminBookings;
