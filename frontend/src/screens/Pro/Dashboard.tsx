
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ViewRole, Salon, Appointment, Product } from '../../types';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface DashboardProps {
  role: ViewRole;
  salon: Salon;
  userId: string | null;
  appointments: Appointment[];
  isMaster?: boolean;
}

interface MenuItem {
  label: string;
  icon: string;
  path: string;
  color: string;
  desc: string;
  badge?: number;
}

const Dashboard: React.FC<DashboardProps> = ({ role, salon, appointments, userId, isMaster }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [lowStockCount, setLowStockCount] = useState(0);
  const [proProfile, setProProfile] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null); // For Admin avatar
  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);

  useEffect(() => {
    if (salon?.id) {
      // Buscar billing info centralizado do banco (Necessário para Admin e Pro verem o que está bloqueado)
      api.salons.getBilling(salon.id).then(info => {
        setBillingInfo({
          ...info,
          plan: info.plan || info.plan_id
        });
      }).catch(err => console.error("Erro billing rpc:", err));

      if (role === 'admin') {
        api.products.getBySalon(salon.id).then(products => {
          const low = products.filter(p => p.stock < 5).length;
          setLowStockCount(low);
        });
      }
    }

    if (userId) {
      api.profiles.getById(userId).then(profile => {
        if (profile) setUserProfile(profile);
      });

      // Buscar total de mensagens não lidas para o Badge do Dashboard
      const fetchUnread = () => {
        api.chat.getConversations(userId).then(convs => {
          const total = convs.reduce((acc, curr) => acc + (curr.unread_count || 0), 0);
          setTotalUnreadMessages(total);
        }).catch(err => console.warn("Erro ao buscar contador de mensagens:", err));
      };

      fetchUnread();

      const channel = supabase
        .channel(`dashboard:messages:${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `user1_id=eq.${userId}`
        }, () => fetchUnread())
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `user2_id=eq.${userId}`
        }, () => fetchUnread())
        .subscribe();

      // Professional profile fetch (Moved inside to avoid early return conflict)
      if (role === 'pro') {
        supabase.from('professionals').select('*').eq('user_id', userId).maybeSingle().then(({ data }) => {
          if (data) setProProfile(data);
        });
      }

      return () => {
        channel.unsubscribe();
      };
    }
  }, [salon?.id, role, userId]);

  // Cálculos de Faturamento Hoje (Admin vê total, Pro vê sua comissão/ganho)
  const stats = useMemo(() => {
    // Usar data local para evitar problemas de fuso horário na virada do dia (UTC)
    const today = new Date().toLocaleDateString('en-CA'); // Formato YYYY-MM-DD
    const filtered = appointments.filter(a => a.date === today && a.status !== 'canceled');

    if (role === 'admin') {
      return {
        label: 'Volume de Reservas Hoje',
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
        label: 'Meus Ganhos Projetados',
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
      const dayStr = d.toLocaleDateString('en-CA');
      const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      return { dayStr, weekday };
    }).reverse();

    last7Days.forEach(day => dailyMap[day.dayStr] = 0);

    appointments.forEach(a => {
      if (a.status !== 'canceled' && dailyMap[a.date] !== undefined) {
        if (role === 'admin') {
          dailyMap[a.date] += (a.valor || 0);
        } else if (a.professional_id === proProfile?.id) {
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
    { label: 'Agenda Geral', icon: 'calendar_month', path: '/pro/schedule', color: 'purple', desc: 'Visualizar grade de agendamentos' },
    { label: 'Relatórios', icon: 'insights', path: '/pro/analytics', color: 'cyan', desc: 'Dados e KPIs' },
    { label: 'Gestão de Estoque', icon: 'inventory_2', path: '/pro/products', color: 'emerald', desc: 'Produtos e insumos' },
    { label: 'Minha Assinatura', icon: 'stars', path: '/pro/billing', color: 'amber', desc: 'Planos e faturamento' },
    { label: 'Horários Funcionamento', icon: 'more_time', path: '/pro/operating-hours', color: 'orange', desc: 'Configurar abertura/fechamento' },
    { label: 'Equipe', icon: 'groups', path: '/pro/team', color: 'purple', desc: 'Artistas e metas' },
    { label: 'Aura Concierge', icon: 'auto_awesome', path: '/pro/aura', color: 'amber', desc: 'Sua recepcionista virtual' },
    { label: 'Catálogo Serviços', icon: 'menu_book', path: '/pro/catalog', color: 'indigo', desc: 'Rituais e preços' },
    { label: 'Configurações', icon: 'settings', path: '/pro/business-setup', color: 'slate', desc: 'Branding da unidade' },
    { label: 'Mensagens', icon: 'chat_bubble', path: '/messages', color: 'slate', desc: 'SAC Cliente', badge: totalUnreadMessages },
    ...(isMaster ? [{ label: '🛡️ SaaSMaster', icon: 'dashboard_customize', path: '/pro/master', color: 'amber', desc: 'Controle Global SaaS' }] : []),
  ];

  const proMenu: MenuItem[] = [
    { label: 'Minha Agenda', icon: 'event_note', path: '/pro/schedule', color: 'purple', desc: 'Ver atendimentos' },
    { label: 'Meus Ganhos', icon: 'monetization_on', path: '/pro/analytics', color: 'emerald', desc: 'Comissões & Relatórios' },
    { label: 'Mensagens', icon: 'chat_bubble', path: '/messages', color: 'indigo', desc: 'Falar com Clientes', badge: totalUnreadMessages },
    { label: 'Perfil Profissional', icon: 'account_circle', path: '/profile', color: 'amber', desc: 'Ver meus dados' },
  ];

  const menuItems = role === 'admin' ? adminMenu : proMenu;

  return (
    <div className="flex-1 h-full overflow-y-auto no-scrollbar bg-background-dark relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] pointer-events-none"></div>

      <header className="sticky top-0 bg-background-dark/90 backdrop-blur-3xl z-50 border-b border-white/5 pt-2 pb-1 lg:py-10">
        <div className="max-w-[1400px] mx-auto w-full px-4 lg:px-12 flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-10">
            <div className="relative group">
              <div className="size-10 lg:size-24 rounded-[14px] lg:rounded-[40px] gold-gradient flex items-center justify-center text-background-dark shadow-[0_0_50px_rgba(193,165,113,0.2)] transition-all group-hover:scale-105 active:scale-95">
                <span className="material-symbols-outlined text-xl lg:text-6xl font-black">{role === 'admin' ? 'admin_panel_settings' : 'content_cut'}</span>
              </div>
              <div className="absolute -bottom-1 lg:-bottom-2 left-1/2 -translate-x-1/2 w-8 lg:w-10 h-0.5 bg-primary/30 rounded-full blur-[4px] animate-pulse"></div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 lg:gap-4 mb-0.5 lg:mb-3">
                <p className="text-[7px] lg:text-xs text-primary font-black uppercase tracking-[0.4em] leading-none shrink-0">
                  {role === 'admin' ? 'Painel Executivo' : 'Dashboard do Artista'}
                </p>
              </div>
              <h2 className="text-sm lg:text-4xl font-display font-black text-white italic tracking-tighter leading-tight truncate uppercase">
                {role === 'admin'
                  ? proProfile?.name || userProfile?.full_name || 'Gestor'
                  : proProfile?.name || userProfile?.full_name || 'Portal Aura'}
              </h2>
            </div>
          </div>

          <button
            onClick={() => navigate('/profile')}
            className="size-10 lg:size-24 rounded-[14px] lg:rounded-[40px] border-2 border-white/5 p-0.5 lg:p-1 transition-all hover:border-primary/40 active:scale-95 group overflow-hidden shadow-3xl"
          >
            <div className="size-full rounded-[12px] lg:rounded-[36px] overflow-hidden bg-surface-dark relative">
              <img
                src={userProfile?.avatar_url || (role === 'admin' ? (salon?.logo_url || 'https://i.pravatar.cc/150?u=admin') : (proProfile?.image || 'https://i.pravatar.cc/150?u=pro'))}
                className="size-full object-cover transition-transform group-hover:scale-110 duration-700"
                alt="Profile"
              />
            </div>
          </button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto w-full px-4 lg:px-12 py-6 lg:py-16 space-y-8 lg:space-y-16 pb-40 animate-fade-in">

        {/* Subscription Status Banner (Luxurious) */}
        {role === 'admin' && billingInfo?.is_trial_active && (
          <div className="p-[1px] rounded-[24px] lg:rounded-[32px] gold-gradient shadow-2xl animate-fade-in group">
            <div className="bg-background-dark/95 backdrop-blur-3xl rounded-[23px] lg:rounded-[31px] p-4 lg:p-10 flex items-center justify-between">
              <div className="flex items-center gap-4 lg:gap-6">
                <div className="size-10 lg:size-16 rounded-xl lg:rounded-3xl gold-gradient flex items-center justify-center text-background-dark shadow-gold">
                  <span className="material-symbols-outlined text-xl lg:text-3xl font-black">lock_open</span>
                </div>
                <div>
                  <h3 className="text-[10px] lg:text-sm font-black text-white uppercase tracking-[0.3em] mb-1 lg:mb-2 leading-none">Acesso Pro Liberado</h3>
                  <p className="text-[8px] lg:text-xs text-primary font-bold uppercase tracking-widest italic opacity-80 leading-none">
                    {(() => {
                      const ends = new Date(billingInfo.trial_ends_at);
                      const now = new Date();
                      const diff = ends.getTime() - now.getTime();
                      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                      return days > 0 ? `${days} dias restantes` : 'Período encerrado';
                    })()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/pro/billing')}
                className="gold-gradient text-background-dark px-5 lg:px-8 py-3 lg:py-5 rounded-xl lg:rounded-2xl text-[8px] lg:text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all hover:brightness-110"
              >
                EFETIVAR
              </button>
            </div>
          </div>
        )}

        {role === 'admin' && (billingInfo?.plan === 'free' || billingInfo?.plan === 'starter') && !billingInfo?.is_trial_active && (
          <div className="p-5 lg:p-12 bg-surface-dark/40 border border-white/5 rounded-[24px] lg:rounded-[40px] flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-8 transition-all hover:border-primary/20 shadow-3xl backdrop-blur-xl">
            <div className="flex items-center gap-5 lg:gap-8">
              <div className="size-10 lg:size-20 rounded-2xl lg:rounded-[28px] bg-white/5 flex items-center justify-center text-slate-600 border border-white/5 shadow-inner shrink-0">
                <span className="material-symbols-outlined text-xl lg:text-3xl font-black">workspace_premium</span>
              </div>
              <div>
                <h3 className="text-[10px] lg:text-base font-black text-slate-400 uppercase tracking-[0.4em] mb-1 lg:mb-2">Desbloqueie o Poder da IA</h3>
                <p className="text-[8px] lg:text-xs text-slate-600 font-bold uppercase tracking-widest leading-relaxed">Aura Concierge e relatórios financeiros premium.</p>
              </div>
            </div>
            <button onClick={() => navigate('/pro/billing')} className="gold-gradient text-background-dark px-6 lg:px-10 py-4 lg:py-6 rounded-xl lg:rounded-2xl text-[9px] lg:text-[11px] font-black uppercase tracking-[0.4em] shadow-gold-sm active:scale-95 transition-all">
              Ver Planos Elite
            </button>
          </div>
        )}

        {/* Link de Agendamento Profissional Elite */}
        {salon?.slug_publico && (
          <div className="gold-gradient p-[1px] rounded-[24px] lg:rounded-2xl sm:rounded-3xl lg:rounded-[40px] shadow-[0_30px_100px_rgba(0,0,0,0.5)] group transition-all hover:scale-[1.002]">
            <div className="bg-background-dark/98 backdrop-blur-3xl rounded-[23px] lg:rounded-2xl sm:rounded-3xl lg:rounded-[39px] p-5 sm:p-5 lg:p-5 lg:p-7 sm:p-7 lg:p-7 flex flex-col lg:flex-row items-center justify-between gap-5 lg:gap-5 lg:gap-10 lg:gap-10 relative overflow-hidden text-center lg:text-left">
              <div className="absolute top-0 -left-1/2 w-full h-full bg-gradient-to-r from-transparent via-primary/10 to-transparent skew-x-[-25deg] group-hover:left-[120%] transition-all duration-1500 ease-in-out"></div>

              <div className="relative z-10 flex-1">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-3 lg:gap-4 lg:gap-4 mb-2 lg:mb-4">
                  <span className="text-[8px] lg:text-[10px] bg-primary/10 text-primary border border-primary/20 px-4 sm:px-4 lg:px-4 py-1 sm:py-1 lg:py-1.5 rounded-full font-black uppercase tracking-[0.5em] w-fit mx-auto lg:mx-0">
                    Unidade Digital Ativa
                  </span>
                </div>
                <h3 className="text-sm lg:text-xl font-display font-black text-white italic uppercase tracking-tighter mb-1 lg:mb-2 leading-none">Portal de Reservas Aura</h3>
                <p className="text-[8px] lg:text-[11px] text-slate-500 font-bold uppercase tracking-[0.4em] italic leading-relaxed">
                  Experiência premium instantânea para seus clientes.
                </p>

                {/* Link Visual Display - Hidden on Mobile to save space */}
                <div className="hidden lg:flex items-center gap-3 lg:gap-3 bg-black/40 border border-white/5 px-4 sm:px-4 lg:px-4 py-2 sm:py-2 lg:py-2 rounded-xl w-full max-w-sm group/link hover:border-primary/30 transition-all mt-4">
                  <span className="material-symbols-outlined text-primary text-base shrink-0">link</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">
                    {`${window.location.origin}/#/q/${salon.slug_publico}`}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/#/q/${salon.slug_publico}`);
                      showToast('Link copiado!', 'success');
                    }}
                    className="ml-auto size-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-primary hover:text-background-dark transition-all shrink-0"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 lg:gap-4 relative z-10 w-full lg:w-auto mt-2 lg:mt-0">
                <button
                  onClick={async () => {
                    const baseUrl = window.location.origin;
                    const link = `${baseUrl}/#/q/${salon.slug_publico}`;
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: salon.nome, text: `Reserve na ${salon.nome} ✨`, url: link });
                      } catch (err) {
                        navigator.clipboard.writeText(link);
                        showToast('Link copiado!', 'success');
                      }
                    } else {
                      navigator.clipboard.writeText(link);
                      showToast('Link copiado!', 'success');
                    }
                  }}
                  className="flex-1 lg:flex-none gold-gradient text-background-dark h-11 lg:h-14 lg:px-10 sm:px-10 lg:px-10 rounded-xl lg:rounded-[20px] flex items-center justify-center gap-3 lg:gap-3 text-[9px] lg:text-[10px] font-black uppercase tracking-[0.4em] shadow-gold transition-all hover:brightness-110 active:scale-95"
                >
                  <span className="material-symbols-outlined text-base lg:text-lg font-black">share</span>
                  Compartilhar Link
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="p-4 lg:p-10 bg-surface-dark border border-white/5 rounded-[24px] lg:rounded-[40px] shadow-[0_50px_100px_rgba(0,0,0,0.6)] overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 lg:p-6">
            <span className="text-[8px] lg:text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 lg:px-4 py-1 lg:py-2 rounded-full border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]">LIVE MONITOR</span>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start gap-4 lg:gap-8 mb-4 lg:mb-8">
            <div>
              <p className="text-slate-500 font-black uppercase tracking-[0.5em] mb-2 lg:mb-3 text-[9px] lg:text-[10px] shrink-0">{stats.label}</p>
              <h1 className="font-display font-black text-white tracking-tighter italic text-4xl lg:text-6xl leading-none">
                R$ {stats.gross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h1>
              {role === 'pro' && (
                <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-6 mt-4 lg:mt-6 p-3 lg:p-5 bg-black/30 rounded-[20px] lg:rounded-2xl border border-white/5">
                  <div>
                    <span className="text-slate-600 font-black uppercase tracking-widest block text-[8px] lg:text-[9px] mb-0.5">Seu Net Income</span>
                    <span className="text-emerald-500 font-display font-black text-xl lg:text-2xl italic">
                      R$ {stats.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-px lg:h-10 w-full lg:w-px bg-white/5"></div>
                  <p className="text-[8px] lg:text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Baseado em {proProfile?.comissao}% de comissão bruta</p>
                </div>
              )}
            </div>
          </div>

          <div className="h-40 lg:h-52 w-full -mx-4 lg:-mx-10 scale-105 lg:scale-110 transition-transform duration-[2000ms] group-hover:scale-[1.12]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c1a571" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c1a571" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="rev"
                  stroke="#c1a571"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                  animationDuration={2500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-10 lg:space-y-16">
          <div className="flex justify-between items-center px-4 sm:px-4 lg:px-4">
            <div className="flex items-center gap-6 lg:gap-6">
              <div className="h-0.5 w-12 bg-primary"></div>
              <h3 className="text-[11px] lg:text-xs font-black text-primary uppercase tracking-[0.6em]">Ecossistema Aura</h3>
            </div>
            {role === 'admin' && lowStockCount > 0 && (
              <div className="flex items-center gap-3 lg:gap-3 px-6 sm:px-6 lg:px-6 py-2 sm:py-2 lg:py-2.5 bg-red-500/10 rounded-full border border-red-500/20 animate-pulse">
                <div className="size-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">{lowStockCount} produtos críticos em estoque</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-6">
            {menuItems.map(item => {
              let isLocked = false;
              if (item.path === '/pro/analytics' && billingInfo && !billingInfo.limits?.financial_enabled && !billingInfo.is_trial_active) isLocked = true;
              if (item.path === '/messages' && billingInfo && billingInfo.plan === 'free' && !billingInfo.is_trial_active) isLocked = true;
              if (item.path === '/pro/aura' && billingInfo && !billingInfo.limits?.ai_enabled && !billingInfo.is_trial_active) isLocked = true;

              return (
                <button
                  key={item.label}
                  onClick={() => {
                    if (isLocked) {
                      showToast("Funcionalidade exclusiva dos Planos PRO e Premium.", "error");
                      navigate('/pro/billing');
                      return;
                    }
                    navigate(item.path);
                  }}
                  className={`bg-surface-dark/40 p-3 lg:p-6 rounded-2xl lg:rounded-3xl border flex flex-col items-center gap-2 lg:gap-4 transition-all shadow-2xl text-center h-full relative group backdrop-blur-xl
                    ${isLocked ? 'opacity-40 grayscale cursor-not-allowed border-red-500/10' : 'border-white/5 hover:border-primary/30 hover:bg-surface-dark/60 active:scale-95'}
                  `}
                >
                  {item.badge && !isLocked && (
                    <div className="absolute top-3 right-3 lg:top-4 lg:right-4 size-5 lg:size-6 bg-red-600 rounded-full flex items-center justify-center text-[9px] lg:text-[10px] font-black text-white border-2 border-background-dark shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-bounce z-20">
                      {item.badge}
                    </div>
                  )}

                  {isLocked && (
                    <div className="absolute top-3 right-3 lg:top-4 lg:right-4 size-6 lg:size-7 bg-background-dark rounded-full flex items-center justify-center text-primary shadow-2xl border border-primary/20">
                      <span className="material-symbols-outlined text-[12px] lg:text-[14px] font-black">lock</span>
                    </div>
                  )}

                  <div className={`size-10 lg:size-14 rounded-xl lg:rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner
                    ${isLocked ? 'bg-white/5 text-slate-700' : 'bg-white/5 text-primary group-hover:bg-primary group-hover:text-background-dark group-hover:shadow-[0_0_30px_rgba(193,165,113,0.4)]'}
                  `}>
                    <span className="material-symbols-outlined text-lg lg:text-2xl">{item.icon}</span>
                  </div>

                  <div className="space-y-1 lg:space-y-2">
                    <span className={`text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] block leading-tight ${isLocked ? 'text-slate-600' : 'text-white'}`}>{item.label}</span>
                    <p className="text-[7px] font-bold text-slate-600 uppercase tracking-[0.1em] leading-relaxed opacity-60 hidden sm:block">{item.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {role === 'admin' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 pt-10">
            <button
              onClick={() => navigate('/pro/admin-bookings')}
              className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 h-14 lg:h-20 rounded-xl lg:rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-[0.2em] text-[8px] lg:text-[10px] active:scale-95 transition-all shadow-3xl group"
            >
              <span className="material-symbols-outlined text-sm lg:text-base group-hover:rotate-12 transition-transform">account_balance_wallet</span>
              VENDA DIRETA
            </button>
            <button
              onClick={() => navigate('/pro/operating-hours')}
              className="bg-primary/10 border border-primary/20 text-primary h-14 lg:h-20 rounded-xl lg:rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-[0.2em] text-[8px] lg:text-[10px] active:scale-95 transition-all shadow-3xl group"
            >
              <span className="material-symbols-outlined text-sm lg:text-base group-hover:scale-110 transition-transform">history</span>
              HORÁRIOS
            </button>
            <button
              onClick={async () => {
                if (billingInfo && !billingInfo.limits.ai_enabled && !billingInfo.is_trial_active) {
                  showToast("Automação de lembretes é exclusiva do PRO.", "error");
                  navigate('/pro/billing');
                  return;
                }
                if (!window.confirm('Enviar lembretes para agendamentos de AMANHÃ?')) return;
                try {
                  const { data, error } = await supabase.functions.invoke('send-reminders');
                  if (error) throw error;
                  showToast(`Sucesso! ${data?.message || 'Lembretes enviados.'}`, 'success');
                } catch (err: any) {
                  showToast('Erro: ' + err.message, 'error');
                }
              }}
              className={`h-14 lg:h-20 rounded-xl lg:rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-[0.2em] text-[8px] lg:text-[10px] active:scale-95 transition-all shadow-3xl col-span-2 lg:col-span-2 relative overflow-hidden group
                ${(billingInfo && !billingInfo.limits.ai_enabled && !billingInfo.is_trial_active)
                  ? 'bg-white/5 border border-white/10 text-slate-600 opacity-50 grayscale cursor-not-allowed'
                  : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'}
              `}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/5 to-transparent skew-x-[-25deg] group-hover:left-[100%] left-[-100%] transition-all duration-1000"></div>
              <span className="material-symbols-outlined text-sm font-black">
                {(billingInfo && !billingInfo.limits.ai_enabled && !billingInfo.is_trial_active) ? 'lock' : 'bolt'}
              </span>
              REMINDS ELITE
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
