
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Appointment } from '../../types';

interface AnalyticsProps {
  appointments: Appointment[];
}

const Analytics: React.FC<AnalyticsProps> = ({ appointments }) => {
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const completed = appointments.filter(a => a.status === 'completed');
    const totalRev = completed.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const avgTicket = completed.length > 0 ? totalRev / completed.length : 0;

    // Agrupar por mês para o gráfico
    const monthlyMap: { [key: string]: number } = {};
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // Inicializar os últimos 6 meses
    const last6Months = [...Array(6)].map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return {
        key: `${d.getFullYear()}-${d.getMonth() + 1}`,
        name: monthNames[d.getMonth()]
      };
    }).reverse();

    last6Months.forEach(m => monthlyMap[m.key] = 0);

    completed.forEach(a => {
      const d = new Date(a.date);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (monthlyMap[key] !== undefined) {
        monthlyMap[key] += (a.valor || 0);
      }
    });

    const chartData = last6Months.map(m => ({
      name: m.name,
      revenue: monthlyMap[m.key]
    }));

    return { totalRev, avgTicket, chartData, totalAppointments: completed.length };
  }, [appointments]);

  return (
    <div className="flex-1 bg-background-dark min-h-screen pb-32">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-md px-6 pt-12 pb-6 border-b border-white/5 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="size-10 rounded-full border border-white/10 flex items-center justify-center text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-xl font-display font-black tracking-tight uppercase italic text-white">Analytics Elite</h1>
          <p className="text-primary text-[8px] font-black uppercase tracking-[0.2em] mt-1">Desempenho da Unidade</p>
        </div>
      </header>

      <main className="px-6 py-10 space-y-8 animate-fade-in no-scrollbar overflow-y-auto">
        <section className="bg-surface-dark rounded-[40px] p-8 border border-white/5 shadow-2xl overflow-hidden relative group">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Faturamento Total (6 meses)</p>
          <h3 className="text-4xl font-display font-black text-white italic">
            R$ {stats.totalRev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h3>

          <div className="h-48 w-full mt-10 -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c1a571" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c1a571" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#c1a571"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-dark p-6 rounded-[32px] border border-white/5 shadow-xl">
            <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Ticket Médio</p>
            <h4 className="text-white font-display font-black text-xl italic">R$ {stats.avgTicket.toFixed(2)}</h4>
          </div>
          <div className="bg-surface-dark p-6 rounded-[32px] border border-white/5 shadow-xl">
            <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Finalizados</p>
            <h4 className="text-white font-display font-black text-xl italic">{stats.totalAppointments}</h4>
          </div>
        </div>

        <section className="bg-surface-dark/40 rounded-[32px] p-8 border border-white/5 text-center">
          <span className="material-symbols-outlined text-primary text-4xl mb-4">workspace_premium</span>
          <h4 className="text-white text-[11px] font-black uppercase tracking-widest mb-2">Meta de Crescimento</h4>
          <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest leading-relaxed px-4">
            Continue finalizando seus atendimentos no app para gerar métricas de precisão elite.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Analytics;
