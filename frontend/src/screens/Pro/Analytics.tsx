
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { Appointment, ViewRole, Salon, Professional } from '../../types';
import { api } from '../../lib/api';

interface AnalyticsProps {
  appointments: Appointment[];
  role: ViewRole;
  salon: Salon;
  userId: string | null;
}

type Period = 'today' | '7d' | '30d' | 'month' | 'custom';

const Analytics: React.FC<AnalyticsProps> = ({ appointments, role, salon, userId }) => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('month');
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [selectedProId, setSelectedProId] = useState<string>('all');
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  useEffect(() => {
    if (salon?.id && role === 'admin') {
      api.professionals.getBySalon(salon.id).then(setProfessionals);
    }
  }, [salon?.id, role]);

  const stats = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (period === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (period === '7d') {
      start.setDate(now.getDate() - 7);
    } else if (period === '30d') {
      start.setDate(now.getDate() - 30);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'custom' && customRange.start && customRange.end) {
      start = new Date(customRange.start);
      end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
    }

    const filtered = appointments.filter(a => {
      const d = new Date(a.date);
      const inDate = d >= start && d <= end;
      const matchesPro = selectedProId === 'all' || a.professional_id === selectedProId;
      const isMyData = role === 'admin' || a.professional_id === userId;
      return inDate && matchesPro && isMyData;
    });

    const completed = filtered.filter(a => a.status === 'completed');
    const canceled = filtered.filter(a => a.status === 'canceled');
    const confirmed = filtered.filter(a => a.status === 'confirmed');
    const pending = filtered.filter(a => a.status === 'pending');

    const grossRev = completed.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const avgTicket = completed.length > 0 ? grossRev / completed.length : 0;
    const cancelRate = (completed.length + canceled.length) > 0 ? (canceled.length / (completed.length + canceled.length)) * 100 : 0;
    const attendanceRate = (completed.length + canceled.length) > 0 ? (completed.length / (completed.length + canceled.length)) * 100 : 0;

    const statusData = [
      { name: 'Concluídos', value: completed.length, color: '#10b981' },
      { name: 'Cancelados', value: canceled.length, color: '#ef4444' },
      { name: 'Agendados', value: confirmed.length, color: '#c1a571' },
      { name: 'Pendentes', value: pending.length, color: '#f59e0b' },
    ].filter(s => s.value > 0);

    // Commission logic
    let netRev = grossRev;
    if (role === 'pro' || (role === 'admin' && selectedProId !== 'all')) {
      const proId = selectedProId !== 'all' ? selectedProId : userId;
      const pro = professionals.find(p => p.id === proId);
      const commission = pro?.comissao || 0;
      if (role === 'pro') {
        netRev = (grossRev * commission) / 100;
      } else {
        netRev = grossRev - (grossRev * commission) / 100;
      }
    }

    // Chart Data
    let chartData = [];

    if (viewMode === 'daily') {
      const dailyMap: { [key: string]: number } = {};
      const days: string[] = [];
      const tempDate = new Date(start);
      while (tempDate <= end) {
        const s = tempDate.toISOString().split('T')[0];
        dailyMap[s] = 0;
        days.push(s);
        tempDate.setDate(tempDate.getDate() + 1);
      }
      completed.forEach(a => {
        if (dailyMap[a.date] !== undefined) dailyMap[a.date] += (a.valor || 0);
      });
      chartData = days.map(d => ({
        name: d.split('-').reverse().slice(0, 2).join('/'),
        rev: dailyMap[d]
      }));
    } else {
      // Weekly grouping
      const weeklyMap: { [key: string]: number } = {};
      const weeks: string[] = [];
      const tempDate = new Date(start);
      // Ajustar para o início da semana (domingo)
      tempDate.setDate(tempDate.getDate() - tempDate.getDay());

      while (tempDate <= end || weeks.length < 4) {
        const s = tempDate.toISOString().split('T')[0];
        weeklyMap[s] = 0;
        weeks.push(s);
        tempDate.setDate(tempDate.getDate() + 7);
      }

      completed.forEach(a => {
        const apptDate = new Date(a.date);
        // Achar a qual semana pertence
        const weekStart = [...weeks].reverse().find(w => new Date(w) <= apptDate);
        if (weekStart) weeklyMap[weekStart] += (a.valor || 0);
      });

      chartData = weeks.map(w => {
        const d = new Date(w);
        return {
          name: `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`,
          rev: weeklyMap[w]
        };
      });
    }

    // Top Services
    const serviceMap: { [key: string]: number } = {};
    completed.forEach(a => {
      const names = a.service_names?.split(',') || [];
      names.forEach(n => {
        const trimName = n.trim();
        serviceMap[trimName] = (serviceMap[trimName] || 0) + 1;
      });
    });
    const serviceData = Object.entries(serviceMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Pro Ranking (if admin)
    const proMap: { [key: string]: { name: string, rev: number, id: string } } = {};
    if (role === 'admin') {
      completed.forEach(a => {
        if (a.professional_id) {
          if (!proMap[a.professional_id]) {
            const pName = professionals.find(p => p.id === a.professional_id)?.name || 'Outros';
            proMap[a.professional_id] = { name: pName, rev: 0, id: a.professional_id };
          }
          proMap[a.professional_id].rev += (a.valor || 0);
        }
      });
    }
    const proRanking = Object.values(proMap).sort((a, b) => b.rev - a.rev);

    return {
      grossRev,
      netRev,
      avgTicket,
      cancelRate,
      attendanceRate,
      total: completed.length,
      confirmed: confirmed.length,
      pending: pending.length,
      chartData,
      serviceData,
      statusData,
      proRanking
    };
  }, [appointments, period, viewMode, selectedProId, customRange, role, userId, professionals]);

  const COLORS = ['#c1a571', '#8b7a5e', '#5c503d', '#3d3428', '#c9b185'];

  return (
    <div className="flex-1 bg-background-dark overflow-y-auto h-full">
      <header className="sticky top-0 z-[60] bg-background-dark/95 backdrop-blur-md px-6 pt-12 pb-6 border-b border-white/5 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="size-10 rounded-full border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform bg-white/5">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-xl font-display font-black tracking-tight uppercase italic text-white">Analytics Elite</h1>
          <p className="text-primary text-[8px] font-black uppercase tracking-[0.2em] mt-1">Inteligência de Dados</p>
        </div>
      </header>

      <main className="px-3 sm:px-6 py-4 space-y-4 animate-fade-in w-full max-w-full mx-auto">

        {/* Filtros */}
        <div className="space-y-4">
          <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2">
            {[
              { id: 'today', label: 'HOJE' },
              { id: '7d', label: '7 DIAS' },
              { id: '30d', label: '30 DIAS' },
              { id: 'month', label: 'MÊS ATUAL' },
              { id: 'custom', label: 'FILTRO' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => p.id === 'custom' ? setShowCustomModal(true) : setPeriod(p.id as Period)}
                className={`px-6 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${(period === p.id && p.id !== 'custom') || (p.id === 'custom' && period === 'custom')
                  ? 'bg-primary border-primary text-background-dark shadow-gold-sm'
                  : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {role === 'admin' && professionals.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setSelectedProId('all')}
                className={`px-5 py-2 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${selectedProId === 'all' ? 'bg-white/10 text-white border border-primary/40' : 'text-slate-500'
                  }`}
              >Todos Artistas</button>
              {professionals.map(pro => (
                <button
                  key={pro.id}
                  onClick={() => setSelectedProId(pro.id)}
                  className={`px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedProId === pro.id ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-600'
                    }`}
                >
                  {pro.name.split(' ')[0]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cards de Métricas Principais */}
        <section className="bg-surface-dark rounded-[24px] sm:rounded-[40px] p-4 sm:p-8 border border-white/5 shadow-2xl overflow-hidden relative group">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Faturamento Bruto</p>
              <h3 className="text-4xl font-display font-black text-white italic tracking-tighter mt-1">
                R$ {stats.grossRev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <span className="material-symbols-outlined font-black">payments</span>
              </div>

              {/* Toggle Dia/Semana */}
              <div className="flex bg-black/40 rounded-full p-1 border border-white/5">
                <button
                  onClick={() => setViewMode('daily')}
                  className={`px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest transition-all ${viewMode === 'daily' ? 'bg-primary text-background-dark' : 'text-slate-500'}`}
                >DIA</button>
                <button
                  onClick={() => setViewMode('weekly')}
                  className={`px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest transition-all ${viewMode === 'weekly' ? 'bg-primary text-background-dark' : 'text-slate-500'}`}
                >SEM</button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-6 pt-6 border-t border-white/5">
            <div>
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Resultado Líquido</p>
              <p className="text-lg font-black text-emerald-500 tracking-tighter">R$ {stats.netRev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="w-px h-8 bg-white/5"></div>
            <div>
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Ticket Médio</p>
              <p className="text-lg font-black text-white tracking-tighter">R$ {stats.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div className="h-48 w-full mt-10 -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c1a571" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#c1a571" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  hide={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 8, fontWeight: 'bold' }}
                  dy={10}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0c0d10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '10px', color: '#fff' }}
                  itemStyle={{ color: '#c1a571', fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey="rev"
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

        {/* Grade de KPIs Secundários */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-surface-dark p-4 rounded-[24px] border border-white/5 shadow-xl flex flex-col justify-between">
            <div>
              <span className="material-symbols-outlined text-emerald-500 text-base mb-1">check_circle</span>
              <p className="text-slate-500 text-[7px] font-black uppercase tracking-widest">Concluídos</p>
            </div>
            <h4 className="text-white font-display font-black text-xl italic mt-1">{stats.total}</h4>
          </div>
          <div className="bg-surface-dark p-4 rounded-[24px] border border-white/5 shadow-xl flex flex-col justify-between">
            <div>
              <span className="material-symbols-outlined text-primary text-base mb-1">event_available</span>
              <p className="text-slate-500 text-[7px] font-black uppercase tracking-widest">Agendados</p>
            </div>
            <h4 className="text-white font-display font-black text-xl italic mt-1">{stats.confirmed}</h4>
          </div>
          <div className="bg-surface-dark p-4 rounded-[24px] border border-white/5 shadow-xl flex flex-col justify-between">
            <div>
              <span className="material-symbols-outlined text-amber-500 text-base mb-1">pending_actions</span>
              <p className="text-slate-500 text-[7px] font-black uppercase tracking-widest">Pendentes</p>
            </div>
            <h4 className="text-white font-display font-black text-xl italic mt-1">{stats.pending}</h4>
          </div>
          <div className="bg-surface-dark p-4 rounded-[24px] border border-white/5 shadow-xl flex flex-col justify-between">
            <div>
              <span className="material-symbols-outlined text-red-500 text-base mb-1">cancel</span>
              <p className="text-slate-500 text-[7px] font-black uppercase tracking-widest">Cancelados</p>
            </div>
            <h4 className="text-white font-display font-black text-xl italic mt-1">{stats.cancelRate.toFixed(0)}%</h4>
          </div>
        </div>

        {/* Analytics por Categoria e Distribuição */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full">
          {/* Mix de Serviços */}
          <section className="bg-surface-dark rounded-[24px] sm:rounded-[40px] p-5 border border-white/5 overflow-hidden">
            <h4 className="text-[9px] font-black text-primary uppercase tracking-[0.4em] mb-6">Mix de Serviços</h4>
            <div className="h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.serviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.serviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5 mt-4">
              {stats.serviceData.map((s, idx) => (
                <div key={`${s.name}-${idx}`} className="flex justify-between items-center text-[8px]">
                  <div className="flex items-center gap-2">
                    <div className="size-1.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                    <span className="text-slate-400 font-black uppercase truncate max-w-[100px]">{s.name}</span>
                  </div>
                  <span className="text-white font-black">{s.value}x</span>
                </div>
              ))}
            </div>
          </section>

          {/* Ranking de Artistas */}
          {role === 'admin' && stats.proRanking.length > 0 && (
            <section className="bg-surface-dark rounded-[24px] sm:rounded-[40px] p-5 border border-white/5 overflow-hidden">
              <h4 className="text-[9px] font-black text-primary uppercase tracking-[0.4em] mb-6">Top Artistas (R$)</h4>
              <div className="space-y-4">
                {stats.proRanking.slice(0, 5).map((pro, idx) => (
                  <div key={pro.id || `pro-${idx}`} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[8px] font-black tracking-widest uppercase">
                      <span className="text-white truncate max-w-[120px]">#{idx + 1} {pro.name}</span>
                      <span className="text-primary whitespace-nowrap">R$ {pro.rev.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full gold-gradient rounded-full transition-all duration-1000"
                        style={{ width: `${(pro.rev / stats.grossRev) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Distribuição de Status - Saúde da Agenda */}
          <section className="bg-surface-dark rounded-[24px] sm:rounded-[40px] p-5 border border-white/5 md:col-span-2 overflow-hidden">
            <h4 className="text-[9px] font-black text-primary uppercase tracking-[0.4em] mb-4">Saúde da Agenda</h4>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.statusData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" hide />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0c0d10', border: 'none', borderRadius: '12px', fontSize: '10px' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {stats.statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              {stats.statusData.map((s) => (
                <div key={s.name} className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                  <p className="text-[6px] text-slate-500 font-black uppercase tracking-widest">{s.name}</p>
                  <p className="text-[10px] text-white font-black mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Seção Informativa */}
        <section className="bg-surface-dark/40 rounded-[32px] p-8 border border-white/5 text-center">
          <span className="material-symbols-outlined text-primary text-4xl mb-4">auto_graph</span>
          <h4 className="text-white text-[11px] font-black uppercase tracking-widest mb-2">IA Insights Aura</h4>
          <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest leading-relaxed px-4">
            Seu faturamento médio por agendamento é de R$ {stats.avgTicket.toFixed(2)}.
            {stats.cancelRate < 10 ? ' Sua taxa de cancelamento está excelente!' : ' Analise o motivo dos cancelamentos para otimizar seus lucros.'}
          </p>
        </section>
      </main>

      {/* Modal de Filtro Personalizado */}
      {showCustomModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-background-dark/95 backdrop-blur-xl animate-fade-in">
          <div className="relative w-full max-w-sm bg-surface-dark border border-white/10 rounded-[40px] p-10 shadow-2xl animate-scale-in text-center">
            <h2 className="text-2xl font-display font-black text-white italic uppercase tracking-tighter mb-2">Filtro de Período</h2>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-8">Selecione as datas para o relatório</p>

            <div className="space-y-6 text-left">
              <div className="space-y-2">
                <label className="text-[8px] font-black text-primary uppercase tracking-widest ml-4">Data Inicial</label>
                <input
                  type="date"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-[10px] outline-none focus:border-primary transition-all"
                  value={customRange.start}
                  onChange={e => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[8px] font-black text-primary uppercase tracking-widest ml-4">Data Final</label>
                <input
                  type="date"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-[10px] outline-none focus:border-primary transition-all"
                  value={customRange.end}
                  onChange={e => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button
                onClick={() => setShowCustomModal(false)}
                className="flex-1 py-4 rounded-2xl border border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest active:bg-white/5 transition-all"
              >Cancelar</button>
              <button
                onClick={() => {
                  setPeriod('custom');
                  setShowCustomModal(false);
                }}
                className="flex-1 gold-gradient py-4 rounded-2xl text-[9px] font-black text-background-dark uppercase tracking-widest shadow-gold-sm active:scale-95 transition-all"
              >Gerar Relatório</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
