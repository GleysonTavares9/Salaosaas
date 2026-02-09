
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Salon, Appointment } from '../../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const SaaSMaster: React.FC = () => {
    const navigate = useNavigate();
    const [salons, setSalons] = useState<Salon[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalSalons: 0,
        activeTrials: 0,
        activeSubscribers: 0
    });

    useEffect(() => {
        const fetchGlobalData = async () => {
            try {
                // 1. Buscar todos os salões
                const { data: salonsData, error: salonsError } = await supabase
                    .from('salons')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (salonsError) throw salonsError;
                setSalons(salonsData || []);

                // 2. Buscar todos os agendamentos completados para estatísticas
                const { data: apptsData, error: apptsError } = await supabase
                    .from('appointments')
                    .select('*')
                    .eq('status', 'completed');

                if (apptsError) throw apptsError;
                setAppointments(apptsData || []);

                // 3. Processar Stats
                const rev = (apptsData || []).reduce((acc, curr) => acc + (curr.valor || 0), 0);
                const trials = (salonsData || []).filter(s => s.subscription_status === 'trialing').length;
                const active = (salonsData || []).filter(s => s.subscription_status === 'active').length;

                setStats({
                    totalRevenue: rev,
                    totalSalons: salonsData?.length || 0,
                    activeTrials: trials,
                    activeSubscribers: active
                });

            } catch (err) {
                console.error("Master Dashboard Error:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchGlobalData();
    }, []);

    // Dados do Gráfico (Simulado ou Real baseado em datas)
    const chartData = useMemo(() => {
        const dailyMap: { [key: string]: number } = {};
        const last14Days = [...Array(14)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        last14Days.forEach(day => dailyMap[day] = 0);
        appointments.forEach(a => {
            if (dailyMap[a.date] !== undefined) {
                dailyMap[a.date] += (a.valor || 0);
            }
        });

        return last14Days.map(day => ({
            name: day.split('-').slice(1).reverse().join('/'),
            rev: dailyMap[day]
        }));
    }, [appointments]);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="size-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full overflow-y-auto no-scrollbar">
            <header className="p-8 pt-20 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-background-dark/30 backdrop-blur-xl border-b border-white/5">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary font-black">shield_person</span>
                        <p className="text-[10px] text-primary font-black uppercase tracking-[0.4em]">SaaS Command Center</p>
                    </div>
                    <h1 className="text-4xl font-display font-black text-white italic tracking-tighter">Painel <span className="text-primary">Master.</span></h1>
                </div>

                <div className="bg-surface-dark/50 backdrop-blur-xl border border-white/5 rounded-3xl p-4 flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Master Admin</p>
                        <p className="text-sm font-bold text-white">Gleyson Tavares</p>
                    </div>
                    <div className="size-12 rounded-2xl gold-gradient flex items-center justify-center text-background-dark shadow-lg">
                        <span className="material-symbols-outlined font-black">admin_panel_settings</span>
                    </div>
                </div>
            </header>

            <main className="px-6 py-10 space-y-10 pb-32 animate-fade-in lg:px-6 w-full">

                {/* Global Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Faturamento Global', val: `R$ ${stats.totalRevenue.toLocaleString()}`, icon: 'payments', color: 'text-emerald-500' },
                        { label: 'Total de Unidades', val: stats.totalSalons, icon: 'storefront', color: 'text-blue-500' },
                        { label: 'Unidades em Trial', val: stats.activeTrials, icon: 'hourglass_top', color: 'text-amber-500' },
                        { label: 'Assinantes Ativos', val: stats.activeSubscribers, icon: 'verified', color: 'text-primary' },
                    ].map((s, i) => (
                        <div key={i} className="bg-surface-dark border border-white/5 p-6 rounded-[32px] shadow-2xl space-y-4">
                            <div className={`size-10 rounded-2xl bg-white/5 flex items-center justify-center ${s.color}`}>
                                <span className="material-symbols-outlined font-black">{s.icon}</span>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{s.label}</p>
                                <p className="text-2xl font-display font-black text-white italic mt-1">{s.val}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Revenue Chart */}
                <section className="bg-surface-dark rounded-[40px] border border-white/5 p-8 shadow-2xl relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-1">Crescimento da Plataforma</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Volume de transações (14 dias)</p>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-2">
                            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[8px] font-black text-emerald-500 uppercase">Live Metrics</span>
                        </div>
                    </div>

                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#c1a571" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#c1a571" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#475569' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1E1E1E', border: 'none', borderRadius: '16px', fontSize: '12px' }}
                                    itemStyle={{ color: '#c1a571' }}
                                />
                                <Area type="monotone" dataKey="rev" stroke="#c1a571" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Salons Management List */}
                <section className="space-y-6">
                    <div className="flex justify-between items-center px-4">
                        <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Unidades Cadastradas</h3>
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest italic">Gerencie o ecossistema Aura</span>
                    </div>

                    <div className="grid gap-4">
                        {salons.map((salon) => (
                            <div key={salon.id} className="bg-surface-dark/60 border border-white/5 p-6 rounded-[32px] flex items-center justify-between group hover:border-primary/20 transition-all cursor-pointer">
                                <div className="flex items-center gap-5">
                                    <div className="size-14 rounded-2xl overflow-hidden border border-white/10 group-hover:scale-105 transition-transform">
                                        <img src={salon.logo_url} className="size-full object-cover" alt={salon.nome} />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-display font-black italic text-lg leading-tight uppercase tracking-tight">{salon.nome}</h4>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-[8px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">{salon.segmento}</span>
                                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest italic">{salon.cidade || 'Localização não definida'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Assinatura</p>
                                        <div className="flex flex-col gap-1 items-end">
                                            <select
                                                value={salon.subscription_plan || 'free'}
                                                onChange={async (e) => {
                                                    const newPlan = e.target.value;
                                                    const { error } = await supabase.from('salons').update({ subscription_plan: newPlan }).eq('id', salon.id);
                                                    if (!error) setSalons(prev => prev.map(s => s.id === salon.id ? { ...s, subscription_plan: newPlan as any } : s));
                                                }}
                                                className="bg-background-dark/50 text-[10px] font-black text-primary border border-white/10 rounded-lg px-2 py-1 outline-none"
                                            >
                                                <option value="free">FREE</option>
                                                <option value="pro">PRO</option>
                                                <option value="premium">PREMIUM</option>
                                            </select>
                                            <select
                                                value={salon.subscription_status || 'trialing'}
                                                onChange={async (e) => {
                                                    const newStatus = e.target.value;
                                                    const { error } = await supabase.from('salons').update({ subscription_status: newStatus }).eq('id', salon.id);
                                                    if (!error) setSalons(prev => prev.map(s => s.id === salon.id ? { ...s, subscription_status: newStatus as any } : s));
                                                }}
                                                className="bg-background-dark/50 text-[8px] font-black text-slate-500 border border-white/10 rounded-lg px-2 py-1 outline-none"
                                            >
                                                <option value="trialing">TRIALING</option>
                                                <option value="active">ACTIVE</option>
                                                <option value="canceled">CANCELED</option>
                                                <option value="past_due">PAST DUE</option>
                                            </select>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => navigate(`/salon/${salon.slug_publico}`)}
                                        className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:border-primary/30 transition-all"
                                    >
                                        <span className="material-symbols-outlined">visibility</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Floating Back Button */}
                <button
                    onClick={() => navigate('/pro')}
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 px-8 py-4 bg-background-dark/90 backdrop-blur-2xl border border-white/10 rounded-[28px] text-[10px] font-black uppercase tracking-[0.4em] text-white flex items-center gap-3 shadow-2xl hover:bg-white/5 active:scale-95 transition-all z-50 ring-1 ring-white/5"
                >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    Voltar para Gestão
                </button>

            </main>
        </div>
    );
};

export default SaaSMaster;
