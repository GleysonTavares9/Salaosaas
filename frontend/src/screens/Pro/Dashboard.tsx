
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ViewRole, Salon, Appointment, Product } from '../../types';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

interface DashboardProps {
  role: ViewRole;
  salon: Salon;
  userId: string | null;
  appointments: Appointment[];
}

interface MenuItem {
  label: string;
  icon: string;
  path: string;
  color: string;
  desc: string;
  badge?: number;
}

const Dashboard: React.FC<DashboardProps> = ({ role, salon, appointments, userId }) => {
  const navigate = useNavigate();
  const [lowStockCount, setLowStockCount] = useState(0);
  const [proProfile, setProProfile] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null); // For Admin avatar

  useEffect(() => {
    if (salon?.id && role === 'admin') {
      api.products.getBySalon(salon.id).then(products => {
        const low = products.filter(p => p.stock < 5).length;
        setLowStockCount(low);
      });
    }

    if (userId) {
      api.profiles.getById(userId).then(profile => {
        if (profile) setUserProfile(profile);
      });
    }

    if (userId && role === 'pro') {
      supabase.from('professionals').select('*').eq('user_id', userId).maybeSingle().then(({ data }) => {
        if (data) setProProfile(data);
      });
    }
  }, [salon?.id, role, userId]);

  // Cálculos de Faturamento Hoje (Admin vê total, Pro vê sua comissão/ganho)
  const stats = useMemo(() => {
    // Usar data local para evitar problemas de fuso horário na virada do dia (UTC)
    const today = new Date().toLocaleDateString('en-CA'); // Formato YYYY-MM-DD
    const filtered = appointments.filter(a => a.date === today && a.status === 'completed');

    if (role === 'admin') {
      return {
        label: 'Faturamento Unidade',
        value: filtered.reduce((acc, curr) => acc + (curr.valor || 0), 0),
        gross: filtered.reduce((acc, curr) => acc + (curr.valor || 0), 0),
        net: filtered.reduce((acc, curr) => acc + (curr.valor || 0), 0)
      };
    } else {
      const myAppts = filtered.filter(a => a.professional_id === proProfile?.id);
      const gross = myAppts.reduce((acc, curr) => acc + (curr.valor || 0), 0);
      const commission = proProfile?.comissao || 0;
      const net = (gross * commission) / 100;

      return {
        label: 'Meu Faturamento',
        value: gross, // Mostramos o faturamento bruto como principal se solicitado
        gross: gross,
        net: net
      };
    }
  }, [appointments, role, userId, proProfile]);

  // Dados do Gráfico
  const chartData = useMemo(() => {
    const dailyMap: { [key: string]: number } = {};
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      return { dayStr, weekday };
    }).reverse();

    last7Days.forEach(day => dailyMap[day.dayStr] = 0);

    appointments.forEach(a => {
      if (a.status === 'completed' && dailyMap[a.date] !== undefined) {
        if (role === 'admin') {
          dailyMap[a.date] += (a.valor || 0);
        } else if (a.professional_id === userId || a.professional_id === proProfile?.id) {
          dailyMap[a.date] += (a.valor * (proProfile?.comissao || 0)) / 100;
        }
      }
    });

    return last7Days.map(day => ({
      name: day.weekday,
      rev: dailyMap[day.dayStr]
    }));
  }, [appointments, role, userId, proProfile]);

  const adminMenu: MenuItem[] = [
    { label: 'Visão do Caixa', icon: 'payments', path: '/pro/admin-bookings', color: 'blue', desc: 'Vendas e agendamentos' },
    { label: 'Relatórios', icon: 'insights', path: '/pro/analytics', color: 'cyan', desc: 'Dados e KPIs' },
    { label: 'Gestão de Estoque', icon: 'inventory_2', path: '/pro/products', color: 'emerald', desc: 'Produtos e insumos' },
    { label: 'Agenda & Horários', icon: 'more_time', path: '/pro/operating-hours', color: 'amber', desc: 'Configurar funcionamento' },
    { label: 'Equipe', icon: 'groups', path: '/pro/team', color: 'purple', desc: 'Artistas e metas' },
    { label: 'Catálogo Serviços', icon: 'menu_book', path: '/pro/catalog', color: 'indigo', desc: 'Rituais e preços' },
    { label: 'Configurações', icon: 'settings', path: '/pro/business-setup', color: 'slate', desc: 'Branding da unidade' },
    { label: 'Mensagens', icon: 'chat_bubble', path: '/messages', color: 'slate', desc: 'SAC Cliente' },
  ];

  const proMenu: MenuItem[] = [
    { label: 'Minha Agenda', icon: 'event_note', path: '/pro/schedule', color: 'purple', desc: 'Ver atendimentos' },
    { label: 'Meus Ganhos', icon: 'monetization_on', path: '/pro/analytics', color: 'emerald', desc: 'Comissões & Relatórios' },
    { label: 'Mensagens', icon: 'chat_bubble', path: '/messages', color: 'indigo', desc: 'Falar com Clientes' },
    { label: 'Perfil Profissional', icon: 'account_circle', path: '/profile', color: 'amber', desc: 'Ver meus dados' },
  ];

  const menuItems = role === 'admin' ? adminMenu : proMenu;

  return (
    <div className="flex-1 bg-background-dark h-full overflow-y-auto">
      <header className="p-6 pt-16 flex items-center justify-between sticky top-0 bg-background-dark/95 backdrop-blur-xl z-50 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl gold-gradient flex items-center justify-center text-background-dark shadow-lg transition-transform active:scale-90 relative">
            <span className="material-symbols-outlined font-black">{role === 'admin' ? 'admin_panel_settings' : 'content_cut'}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] leading-none shrink-0">
                {role === 'admin' ? 'Painel Executivo' : 'Dashboard do Artista'}
              </p>
              {salon?.segmento && (
                <span className="text-[7px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest leading-none">
                  {salon.segmento}
                </span>
              )}
            </div>
            <h2 className="text-sm font-display font-black text-white italic tracking-tighter leading-tight truncate">
              {role === 'admin'
                ? `${proProfile?.name || userProfile?.full_name || 'Gestor'} • ${salon?.nome || 'Minha Unidade'}`
                : (proProfile?.name || userProfile?.full_name || 'Portal Aura')}
            </h2>
          </div>
        </div>
        <button onClick={() => navigate('/profile')} className="size-12 bg-surface-dark rounded-2xl flex items-center justify-center text-slate-400 border border-white/10 overflow-hidden active:scale-95 transition-transform shadow-xl shrink-0">
          <img
            src={userProfile?.avatar_url || (role === 'admin' ? (salon?.logo_url || 'https://i.pravatar.cc/150?u=admin') : (proProfile?.image || 'https://i.pravatar.cc/150?u=pro'))}
            className="size-full object-cover"
            alt="Profile"
          />
        </button>
      </header>

      <main className="p-6 space-y-8 pb-32 safe-area-bottom animate-fade-in">
        <section className="p-8 bg-surface-dark rounded-[40px] border border-white/5 shadow-2xl overflow-hidden relative group">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.4em] mb-2">{stats.label}</p>
              <h1 className="font-display text-4xl font-black text-white tracking-tighter">
                R$ {stats.gross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h1>
              {role === 'pro' && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-emerald-500 font-black">Minha Comissão:</span>
                  <span className="text-lg text-emerald-500 font-display font-black">
                    R$ {stats.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">AO VIVO</span>
              {role === 'pro' && <p className="text-[7px] text-primary font-black uppercase tracking-widest">Baseado em {proProfile?.comissao}% comissão</p>}
            </div>
          </div>

          <div className="h-28 w-full -mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <Area
                  type="monotone"
                  dataKey="rev"
                  stroke="#c1a571"
                  strokeWidth={3}
                  fillOpacity={0.15}
                  fill="#c1a571"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Controle de Unidade</h3>
            {role === 'admin' && lowStockCount > 0 && (
              <div className="flex items-center gap-2 animate-pulse">
                <div className="size-2 rounded-full bg-red-500"></div>
                <span className="text-[8px] font-black text-red-500 uppercase">{lowStockCount} produtos com baixo estoque</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="bg-surface-dark/60 p-5 rounded-[32px] border border-white/5 flex flex-col items-center gap-4 active:scale-95 transition-all shadow-lg text-center h-full relative group hover:border-primary/20"
              >
                {item.badge && (
                  <div className="absolute top-4 right-4 size-5 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-black text-white border-2 border-surface-dark">
                    {item.badge}
                  </div>
                )}
                <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white block mb-1">{item.label}</span>
                  <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest leading-none">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {role === 'admin' && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/pro/admin-bookings')}
              className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 py-6 rounded-3xl flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all shadow-lg"
            >
              <span className="material-symbols-outlined">account_balance_wallet</span>
              FECHAR CAIXA
            </button>
            <button
              onClick={() => navigate('/pro/operating-hours')}
              className="bg-primary/10 border border-primary/20 text-primary py-6 rounded-3xl flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all shadow-lg"
            >
              <span className="material-symbols-outlined">history</span>
              HORÁRIOS
            </button>
            <button
              onClick={async () => {
                if (!window.confirm('Enviar lembretes para agendamentos de AMANHÃ?')) return;
                try {
                  const { data, error } = await supabase.functions.invoke('send-reminders');
                  if (error) throw error;
                  alert(`Sucesso! ${data?.message || 'Lembretes enviados.'}`);
                } catch (err: any) {
                  alert('Erro: ' + err.message);
                }
              }}
              className="bg-purple-500/10 border border-purple-500/20 text-purple-500 py-6 rounded-3xl flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all shadow-lg col-span-2"
            >
              <span className="material-symbols-outlined">notification_important</span>
              DISPARAR LEMBRETES (AMANHÃ)
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
