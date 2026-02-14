
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, Cell, PieChart, Pie, LabelList, Legend } from 'recharts';
import { Appointment, ViewRole, Salon, Professional, Expense } from '../../types';
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

  const [billingInfo, setBillingInfo] = useState<any>(null);

  useEffect(() => {
    if (salon?.id) {
      if (role === 'admin') {
        api.professionals.getBySalon(salon.id).then(setProfessionals);

        api.salons.getBilling(salon.id).then(info => {
          if (info) setBillingInfo(info);
        }).catch(() => { });
      }
    }
  }, [salon?.id, role]);

  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (salon?.id && role === 'admin') {
      api.expenses.getBySalon(salon.id).then(setExpenses).catch(() => { });
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
      start.setHours(0, 0, 0, 0);
    } else if (period === '30d') {
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
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

    const filteredExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      const inDate = d >= start && d <= end;
      return inDate && e.status === 'paid' && role === 'admin' && selectedProId === 'all';
    });

    const completed = filtered.filter(a => a.status === 'completed');
    const canceled = filtered.filter(a => a.status === 'canceled');
    const confirmed = filtered.filter(a => a.status === 'confirmed');
    const pending = filtered.filter(a => a.status === 'pending');

    const grossRev = completed.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const totalOut = filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

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
    } else if (role === 'admin' && selectedProId === 'all') {
      netRev = grossRev - totalOut; // Profit after expenses
    }

    // Chart Data
    let chartData = [];

    if (viewMode === 'daily') {
      const dailyMap: { [key: string]: { rev: number, exp: number } } = {};
      const days: string[] = [];
      const tempDate = new Date(start);
      while (tempDate <= end) {
        const s = tempDate.toISOString().split('T')[0];
        dailyMap[s] = { rev: 0, exp: 0 };
        days.push(s);
        tempDate.setDate(tempDate.getDate() + 1);
      }
      completed.forEach(a => {
        if (dailyMap[a.date] !== undefined) dailyMap[a.date].rev += (a.valor || 0);
      });
      filteredExpenses.forEach(e => {
        if (dailyMap[e.date] !== undefined) dailyMap[e.date].exp += (e.amount || 0);
      });

      chartData = days.map(d => ({
        name: d.split('-').reverse().slice(0, 2).join('/'),
        rev: dailyMap[d].rev,
        exp: dailyMap[d].exp
      }));
    } else {
      // Weekly grouping
      const weeklyMap: { [key: string]: { rev: number, exp: number } } = {};
      const weeks: string[] = [];
      const tempDate = new Date(start);
      tempDate.setDate(tempDate.getDate() - tempDate.getDay());

      while (tempDate <= end || weeks.length < 4) {
        const s = tempDate.toISOString().split('T')[0];
        weeklyMap[s] = { rev: 0, exp: 0 };
        weeks.push(s);
        tempDate.setDate(tempDate.getDate() + 7);
      }

      completed.forEach(a => {
        const apptDate = new Date(a.date);
        const weekStart = [...weeks].reverse().find(w => new Date(w) <= apptDate);
        if (weekStart) weeklyMap[weekStart].rev += (a.valor || 0);
      });

      filteredExpenses.forEach(e => {
        const expDate = new Date(e.date);
        const weekStart = [...weeks].reverse().find(w => new Date(w) <= expDate);
        if (weekStart) weeklyMap[weekStart].exp += (e.amount || 0);
      });

      chartData = weeks.map(w => {
        const d = new Date(w);
        return {
          name: `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`,
          rev: weeklyMap[w].rev,
          exp: weeklyMap[w].exp
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
      totalOut,
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
  }, [appointments, expenses, period, viewMode, selectedProId, customRange, role, userId, professionals]);

  const COLORS = ['#c1a571', '#8b7a5e', '#5c503d', '#3d3428', '#c9b185'];

  return (
    <div className="flex-1 overflow-y-auto h-full no-scrollbar bg-background-dark relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] pointer-events-none"></div>

      <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-3xl px-4 lg:px-6 pt-2 lg:pt-12 pb-2 lg:pb-10 border-b border-white/5">
        <div className="max-w-full max-w-[1400px] mx-auto w-full">
          <div className="flex items-center justify-between mb-2 lg:mb-12">
            <button onClick={() => navigate(-1)} className="size-9 lg:size-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div className="text-center">
              <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none text-base lg:text-2xl">
                Inteligência Aura
              </h1>
              <p className="text-[7px] text-primary font-black uppercase tracking-[0.4em] mt-1 lg:mt-3">Análise de Performance de Luxo</p>
            </div>
            <div className="size-9 lg:size-12 opacity-0 pointer-events-none"></div>
          </div>

          <div className="space-y-4 lg:space-y-8">
            <div className="flex overflow-x-auto no-scrollbar gap-2 lg:gap-4 pb-1">
              {[
                { id: 'today', label: 'HOJE' },
                { id: '7d', label: '7 DIAS' },
                { id: '30d', label: '30 DIAS' },
                { id: 'month', label: 'MÊS ATUAL' },
                { id: 'custom', label: 'PERSON.' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => p.id === 'custom' ? setShowCustomModal(true) : setPeriod(p.id as Period)}
                  className={`px-5 lg:px-8 py-2.5 lg:py-4 rounded-xl text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border ${(period === p.id && p.id !== 'custom') || (p.id === 'custom' && period === 'custom')
                    ? 'gold-gradient text-background-dark border-transparent shadow-gold-sm'
                    : 'bg-surface-dark/40 text-slate-500 border-white/5 hover:border-white/10'
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {role === 'admin' && professionals.length > 0 && (
              <div className="flex items-center gap-2 lg:gap-3 overflow-x-auto no-scrollbar py-2 border-t border-white/5">
                <button
                  onClick={() => setSelectedProId('all')}
                  className={`px-4 lg:px-6 py-2 lg:py-3 rounded-full text-[8px] lg:text-[9px] font-black uppercase tracking-[0.2em] transition-all ${selectedProId === 'all'
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-slate-600 hover:text-slate-400'
                    }`}
                >TODOS</button>
                {professionals.map(pro => (
                  <button
                    key={pro.id}
                    onClick={() => setSelectedProId(pro.id)}
                    className={`px-4 lg:px-6 py-2 lg:py-3 rounded-full text-[8px] lg:text-[9px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${selectedProId === pro.id
                      ? 'bg-primary text-background-dark'
                      : 'bg-white/5 text-slate-600 border border-white/5'
                      }`}
                  >
                    {pro.name.split(' ')[0].toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-full max-w-[1400px] mx-auto w-full px-6 sm:px-6 lg:px-6 py-12 sm:py-12 lg:py-12 lg:py-20 sm:py-20 lg:py-20 space-y-12 pb-40 animate-fade-in relative z-10">
        {/* Card de Faturamento Elite */}
        <section className="bg-surface-dark/40 rounded-2xl sm:rounded-3xl lg:rounded-[40px] border border-white/5 p-6 sm:p-8 lg:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-3xl overflow-hidden relative group">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-8 lg:gap-12 mb-8 lg:mb-10">
            <div className="space-y-2 lg:space-y-3">
              <p className="text-[10px] lg:text-[11px] font-black text-primary uppercase tracking-[0.5em]">Patrimônio Bruto</p>
              <h3 className="text-4xl sm:text-5xl lg:text-6xl font-display font-black text-white italic tracking-tighter leading-none">
                R$ {stats.grossRev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
            </div>

            <div className="flex flex-col items-end gap-6 lg:gap-6 w-full lg:w-auto">
              <div className="flex bg-black/40 rounded-[20px] p-1 border border-white/10 backdrop-blur-md">
                <button
                  onClick={() => setViewMode('daily')}
                  className={`px-4 sm:px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'daily' ? 'gold-gradient text-background-dark shadow-gold-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >DIÁRIO</button>
                <button
                  onClick={() => setViewMode('weekly')}
                  className={`px-4 sm:px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'weekly' ? 'gold-gradient text-background-dark shadow-gold-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >SEMANAL</button>
              </div>

              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 sm:gap-6 w-full lg:w-auto justify-end">
                {role === 'admin' && selectedProId === 'all' && stats.totalOut > 0 && (
                  <div className="text-right border-r border-white/10 pr-6 mr-2 hidden sm:block">
                    <p className="text-[9px] font-black text-rose-500/60 uppercase tracking-widest mb-1">Total Saídas</p>
                    <p className="text-xl sm:text-2xl font-display font-black text-rose-500 italic">- R$ {stats.totalOut.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Pura Margem</p>
                  <p className={`text-xl sm:text-2xl font-display font-black italic ${stats.netRev >= 0 ? 'text-emerald-500' : 'text-rose-500 underline decoration-rose-500/30'}`}>
                    R$ {stats.netRev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`size-10 sm:size-12 rounded-2xl border flex items-center justify-center transition-all ${stats.netRev >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                  <span className="material-symbols-outlined text-2xl">
                    {stats.netRev >= 0 ? 'payments' : 'trending_down'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-[250px] sm:h-[300px] lg:h-[400px] w-full relative">
            {billingInfo && !billingInfo.limits.financial_enabled && !billingInfo.is_trial_active && (
              <div className="absolute inset-0 z-20 bg-background-dark/90 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-primary/20">
                <div className="size-14 rounded-2xl gold-gradient flex items-center justify-center text-background-dark shadow-gold mb-4">
                  <span className="material-symbols-outlined text-2xl font-black">lock</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-black text-white italic tracking-tighter uppercase mb-3">Métricas Restritas</h3>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed mb-6 max-w-sm">
                  Desbloqueie o potencial máximo com o <span className="text-primary italic">Painel de Inteligência Financeira</span> do seu plano.
                </p>
                <button onClick={() => navigate('/pro/billing')} className="gold-gradient text-background-dark px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] shadow-gold active:scale-95 transition-all hover:brightness-110">
                  Evoluir Plano
                </button>
              </div>
            )}

            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c1a571" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c1a571" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  hide={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 9, fontWeight: '800' }}
                  dy={10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0c0d10',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '20px',
                    fontSize: '10px',
                    color: '#fff',
                    padding: '16px',
                    backdropBlur: '10px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                  }}
                  itemStyle={{ fontWeight: '900', textTransform: 'uppercase', marginBottom: '4px' }}
                  cursor={{ stroke: '#ffffff10', strokeWidth: 2 }}
                  formatter={(value: any, name: string) => {
                    const label = name === 'rev' ? 'Entradas' : 'Saídas';
                    const color = name === 'rev' ? '#c1a571' : '#ef4444';
                    return [<span style={{ color }}>R$ {Number(value).toFixed(2)}</span>, label];
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingTop: '0px', paddingBottom: '20px' }}
                  formatter={(value) => {
                    const label = value === 'rev' ? 'ENTRADAS' : 'SAÍDAS';
                    return <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">{label}</span>;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rev"
                  name="rev"
                  stroke="#c1a571"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                  animationDuration={1500}
                />
                {role === 'admin' && selectedProId === 'all' && (
                  <Area
                    type="monotone"
                    dataKey="exp"
                    name="exp"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fillOpacity={0.1}
                    fill="#ef4444"
                    animationDuration={1500}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Grade de KPIs Magnéticos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {[
            { label: 'Rituais Concluídos', val: stats.total, icon: 'task_alt', color: 'text-emerald-500', dot: 'bg-emerald-500' },
            { label: 'Ticket Médio', val: `R$ ${stats.avgTicket.toFixed(0)}`, icon: 'payments', color: 'text-primary', dot: 'bg-primary' },
            { label: 'Fluxo Agendado', val: stats.confirmed, icon: 'event', color: 'text-blue-400', dot: 'bg-blue-400' },
            { label: 'Taxa Dissidência', val: `${stats.cancelRate.toFixed(0)}%`, icon: 'trending_down', color: 'text-red-500', dot: 'bg-red-500' },
          ].map((kpi, i) => (
            <div key={i} className="bg-surface-dark/40 rounded-2xl sm:rounded-3xl lg:rounded-[32px] border border-white/5 p-6 lg:p-6 shadow-xl flex flex-col justify-between group hover:border-primary/20 transition-all relative overflow-hidden">
              <div className={`absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity ${kpi.color}`}>
                <span className="material-symbols-outlined text-[40px] opacity-10 rotate-12">{kpi.icon}</span>
              </div>

              <div className="flex items-center justify-between mb-6 lg:mb-8 relative z-10">
                <span className={`material-symbols-outlined text-2xl lg:text-3xl ${kpi.color}`}>{kpi.icon}</span>
                <div className="flex items-center gap-2">
                  <div className={`size-1.5 lg:size-2 rounded-full ${kpi.dot} animate-pulse shadow-[0_0_8px_currentColor] text-${kpi.dot.replace('bg-', '')}`}></div>
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] mb-1 lg:mb-2">{kpi.label}</p>
                <h4 className="text-white font-display font-black text-2xl lg:text-3xl italic">{kpi.val}</h4>
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico de Eficiência Operacional (Status) */}
        <section className="bg-surface-dark/40 rounded-2xl sm:rounded-3xl lg:rounded-[40px] border border-white/5 p-6 lg:p-8 shadow-2xl backdrop-blur-3xl overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] lg:text-[11px] font-black text-primary uppercase tracking-[0.5em]">Eficiência Operacional</h4>

          </div>

          <div className="h-[200px] lg:h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.statusData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }} barSize={32}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                />
                <Tooltip
                  cursor={{ fill: '#ffffff05' }}
                  contentStyle={{ backgroundColor: '#0c0d10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '11px', color: '#fff', padding: '12px' }}
                  itemStyle={{ fontWeight: '900', textTransform: 'uppercase' }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} animationDuration={1500}>
                  {stats.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList dataKey="value" position="right" fill="#fff" fontSize={11} fontWeight={900} formatter={(val: number) => `${val}x`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Distribuição & Rankings Elite */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Mix de Rituais */}
          <section className="bg-surface-dark/40 rounded-2xl sm:rounded-3xl lg:rounded-[40px] border border-white/5 p-6 lg:p-8 shadow-2xl backdrop-blur-3xl overflow-hidden">
            <h4 className="text-[10px] lg:text-[11px] font-black text-primary uppercase tracking-[0.5em] mb-6 lg:mb-8">Alquimia de Rituais</h4>
            <div className="h-[250px] lg:h-[280px] w-full flex items-center justify-center relative">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Destaque</p>
                <p className="text-2xl lg:text-3xl font-display font-black text-white italic">{stats.serviceData[0]?.value || 0}x</p>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.serviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.serviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0c0d10', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 mt-6 bg-black/20 p-5 rounded-2xl border border-white/5">
              {stats.serviceData.map((s, idx) => (
                <div key={`${s.name}-${idx}`} className="flex justify-between items-center text-[10px]">
                  <div className="flex items-center gap-3">
                    <div className="size-2 rounded-full shadow-lg" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                    <span className="text-slate-400 font-black uppercase tracking-widest truncate max-w-[120px] sm:max-w-[180px]">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-1 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                      <div className="h-full bg-primary" style={{ width: `${(s.value / stats.total) * 100}%` }}></div>
                    </div>
                    <span className="text-white font-black">{s.value}x</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Ranking Maestros */}
          {role === 'admin' && stats.proRanking.length > 0 && (
            <section className="bg-surface-dark/40 rounded-2xl sm:rounded-3xl lg:rounded-[40px] border border-white/5 p-6 lg:p-8 shadow-2xl backdrop-blur-3xl flex flex-col h-full">
              <h4 className="text-[10px] lg:text-[11px] font-black text-primary uppercase tracking-[0.5em] mb-6 lg:mb-8">Maestria em Resultados</h4>
              <div className="space-y-6 flex-1">
                {stats.proRanking.slice(0, 5).map((pro, idx) => (
                  <div key={pro.id || `pro-${idx}`} className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black tracking-[0.2em] uppercase">
                      <div className="flex items-center gap-3">
                        <span className="size-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary font-display italic">0{idx + 1}</span>
                        <span className="text-white truncate max-w-[140px] sm:max-w-[180px]">{pro.name}</span>
                      </div>
                      <span className="text-primary tracking-tighter text-sm">R$ {pro.rev.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full gold-gradient rounded-full shadow-gold-sm transition-all duration-1000"
                        style={{ width: `${(pro.rev / stats.grossRev) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-5 bg-primary/5 border border-primary/20 rounded-2xl sm:rounded-3xl text-center">
                <p className="text-[9px] font-black text-primary uppercase tracking-widest">Maestro em Destaque</p>
                <h5 className="text-lg sm:text-xl font-display font-black text-white italic mt-1 uppercase">{stats.proRanking[0]?.name}</h5>
              </div>
            </section>
          )}
        </div>

        {/* IA Aura Insights */}
        <section className="bg-surface-dark/40 rounded-2xl sm:rounded-3xl lg:rounded-[40px] p-8 lg:p-10 border border-white/5 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] h-auto min-h-[200px] bg-primary/10 blur-[120px] rounded-full"></div>
          <div className="relative z-10 space-y-6">
            <div className="size-16 sm:size-18 mx-auto rounded-2xl sm:rounded-3xl gold-gradient flex items-center justify-center text-background-dark shadow-gold">
              <span className="material-symbols-outlined text-3xl font-black">insights</span>
            </div>
            <div className="space-y-3">
              <h4 className="text-white text-xl sm:text-2xl font-display font-black italic uppercase tracking-tighter">Insights do Oráculo Aura</h4>
              <p className="text-slate-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] leading-loose max-w-2xl mx-auto italic">
                Sua curadoria atinge um ticket médio de R$ {stats.avgTicket.toFixed(2)}.
                {stats.cancelRate < 10 ? ' O alinhamento da agenda está impecável, mantendo a elite engajada.' : ' Há uma oscilação na fidelidade. Sugerimos recalibrar os rituais de confirmação.'}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Modal de Filtro Cronológico */}
      {showCustomModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-8 sm:p-8 lg:p-8 bg-background-dark/95 backdrop-blur-3xl animate-fade-in">
          <div className="relative w-full max-w-full max-w-[500px] bg-surface-dark border border-white/10 rounded-2xl sm:rounded-3xl lg:rounded-[56px] p-12 sm:p-14 lg:p-16 sm:p-12 sm:p-14 lg:p-16 lg:p-12 sm:p-14 lg:p-16 shadow-3xl animate-scale-in text-center">
            <button
              onClick={() => setShowCustomModal(false)}
              className="absolute top-8 right-8 size-10 sm:size-12 lg:size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all"
            >
              <span className="material-symbols-outlined font-black">close</span>
            </button>

            <h2 className="text-3xl lg:text-3xl font-display font-black text-white italic uppercase tracking-tighter mb-4">Lapidar Período</h2>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mb-12">Selecione o espectro temporal para análise</p>

            <div className="space-y-10 text-left">
              <div className="space-y-4">
                <label className="text-[9px] font-black text-primary uppercase tracking-[0.4em] ml-6 italic">Gênese do Relatório</label>
                <input
                  type="date"
                  className="w-full bg-background-dark border-2 border-white/5 rounded-[24px] px-8 sm:px-8 lg:px-8 py-6 sm:py-6 lg:py-6 text-white font-black text-[13px] outline-none focus:border-primary transition-all shadow-inner uppercase tracking-widest"
                  value={customRange.start}
                  onChange={e => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div className="space-y-4">
                <label className="text-[9px] font-black text-primary uppercase tracking-[0.4em] ml-6 italic">Zênite do Relatório</label>
                <input
                  type="date"
                  className="w-full bg-background-dark border-2 border-white/5 rounded-[24px] px-8 sm:px-8 lg:px-8 py-6 sm:py-6 lg:py-6 text-white font-black text-[13px] outline-none focus:border-primary transition-all shadow-inner uppercase tracking-widest"
                  value={customRange.end}
                  onChange={e => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-6 mt-16">
              <button
                onClick={() => setShowCustomModal(false)}
                className="h-20 rounded-[24px] border border-white/10 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] hover:bg-white/5 transition-all"
              >VOLTAR</button>
              <button
                onClick={() => {
                  setPeriod('custom');
                  setShowCustomModal(false);
                }}
                className="h-20 gold-gradient rounded-[24px] text-[10px] font-black text-background-dark uppercase tracking-[0.4em] shadow-gold-sm active:scale-95 transition-all hover:brightness-110"
              >CONSOLIDAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
