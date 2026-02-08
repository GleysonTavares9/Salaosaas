
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
      if (role === 'admin') {
        api.products.getBySalon(salon.id).then(products => {
          const low = products.filter(p => p.stock < 5).length;
          setLowStockCount(low);
        });

        // Buscar billing info centralizado do banco
        api.salons.getBilling(salon.id).then(info => {
          setBillingInfo({
            ...info,
            plan: info.plan || info.plan_id
          });
        }).catch(err => console.error("Erro billing rpc:", err));
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

      // Inscrição Realtime para atualizar o Badge do Dashboard
      const channel = supabase
        .channel('dashboard:messages')
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

      return () => {
        channel.unsubscribe();
      };
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
    { label: 'Agenda Geral', icon: 'calendar_month', path: '/pro/schedule', color: 'purple', desc: 'Visualizar grade de agendamentos' },
    { label: 'Relatórios', icon: 'insights', path: '/pro/analytics', color: 'cyan', desc: 'Dados e KPIs' },
    { label: 'Gestão de Estoque', icon: 'inventory_2', path: '/pro/products', color: 'emerald', desc: 'Produtos e insumos' },
    { label: 'Minha Assinatura', icon: 'stars', path: '/pro/billing', color: 'amber', desc: 'Planos e faturamento' },
    { label: 'Horários Funcionamento', icon: 'more_time', path: '/pro/operating-hours', color: 'amber', desc: 'Configurar abertura/fechamento' },
    { label: 'Equipe', icon: 'groups', path: '/pro/team', color: 'purple', desc: 'Artistas e metas' },
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
    <div className="flex-1 bg-background-dark h-full overflow-y-auto no-scrollbar">
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

      {/* Subscription Status Banner (New) */}
      {role === 'admin' && billingInfo?.is_trial_active && (
        <div className="mx-6 mt-4 p-3 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between animate-fade-in shadow-lg">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl gold-gradient flex items-center justify-center text-background-dark">
              <span className="material-symbols-outlined text-sm font-black">timer</span>
            </div>
            <div>
              <p className="text-[9px] font-black text-white uppercase tracking-widest leading-none mb-1">Período de Experiência</p>
              <p className="text-[7px] text-primary font-bold uppercase tracking-widest">
                {(() => {
                  const ends = new Date(billingInfo.trial_ends_at);
                  const now = new Date();
                  const diff = ends.getTime() - now.getTime();
                  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                  return days > 0 ? `${days} dias restantes no seu passe elite` : 'Período encerrado. Renove agora!';
                })()}
              </p>
            </div>
          </div>
          <button onClick={() => navigate('/pro/billing')} className="bg-primary text-background-dark px-3 py-1.5 rounded-lg text-[7px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">
            Assinar PRO
          </button>
        </div>
      )}

      {role === 'admin' && (billingInfo?.plan === 'free' || billingInfo?.plan === 'starter') && !billingInfo?.is_trial_active && (
        <div className="mx-6 mt-4 p-3 bg-surface-dark border border-white/10 rounded-2xl flex items-center justify-between animate-fade-in shadow-lg">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 border border-white/5">
              <span className="material-symbols-outlined text-sm font-black">lock</span>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Plano Gratuito Ativo</p>
              <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">IA e Financeiro bloqueados. Migre para o PRO.</p>
            </div>
          </div>
          <button onClick={() => navigate('/pro/billing')} className="gold-gradient text-background-dark px-3 py-1.5 rounded-lg text-[7px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">
            Upgrade
          </button>
        </div>
      )}

      <main className="p-6 space-y-8 pb-32 safe-area-bottom animate-fade-in">

        {/* Link de Agendamento Profissional Elite */}
        {salon?.slug_publico && (
          <div className="gold-gradient p-[1px] rounded-[32px] shadow-2xl group transition-all active:scale-[0.98]">
            <div className="bg-background-dark/95 backdrop-blur-xl rounded-[31px] p-6 flex items-center justify-between relative overflow-hidden">
              {/* Efeito de brilho sutil */}
              <div className="absolute top-0 -left-1/2 w-full h-full bg-gradient-to-r from-transparent via-primary/5 to-transparent skew-x-[-25deg] group-hover:left-[120%] transition-all duration-1000"></div>

              <div className="relative z-10 flex-1 mr-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="size-2 rounded-full bg-primary animate-pulse"></div>
                  <h3 className="text-white font-black text-xs uppercase tracking-[0.2em]">Seu Link Aura</h3>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Compartilhe o luxo com seus clientes</p>
              </div>

              <div className="flex items-center gap-2 relative z-10">
                <button
                  onClick={async () => {
                    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
                    if (window.location.hostname === 'localhost' && !import.meta.env.VITE_APP_URL && (window as any).Capacitor) {
                      alert('Atenção: Configure a VITE_APP_URL no seu .env para gerar links válidos no celular.');
                    }
                    const link = `${baseUrl}/#/q/${salon.slug_publico}`;

                    // Se estiver no mobile e suportar compartilhamento nativo
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: salon.nome,
                          text: `Agende seu horário na ${salon.nome} ✨`,
                          url: link,
                        });
                      } catch (err) {
                        navigator.clipboard.writeText(link);
                        alert('Link copiado para a área de transferência!');
                      }
                    } else {
                      navigator.clipboard.writeText(link);
                      alert('Link copiado! Envie para seus clientes: ' + link);
                    }
                  }}
                  className="bg-primary text-background-dark size-12 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:brightness-110 active:scale-90"
                >
                  <span className="material-symbols-outlined font-black">share</span>
                </button>
              </div>
            </div>
          </div>
        )}

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
            {menuItems.map(item => {
              // Lógica de Travamento Visual
              let isLocked = false;

              // 1. Relatórios Financeiros (Analytics) - Bloqueado no Free
              if (item.path === '/pro/analytics') {
                if (billingInfo && !billingInfo.limits.financial_enabled && !billingInfo.is_trial_active) {
                  isLocked = true;
                }
              }

              // 2. Mensagens (SAC/CRM) - Bloqueado no Free
              if (item.path === '/messages') {
                if (billingInfo && billingInfo.plan === 'free' && !billingInfo.is_trial_active) {
                  isLocked = true;
                }
              }

              return (
                <button
                  key={item.label}
                  onClick={() => {
                    if (isLocked) {
                      showToast("Funcionalidade exclusiva dos Planos PRO e Premium.", "error");
                      navigate('/pro/billing'); // Atalho para upgrade
                      return;
                    }
                    navigate(item.path);
                  }}
                  className={`bg-surface-dark/60 p-5 rounded-[32px] border flex flex-col items-center gap-4 transition-all shadow-lg text-center h-full relative group hover:border-primary/20
                    ${isLocked ? 'opacity-50 grayscale cursor-not-allowed border-red-500/20' : 'border-white/5 active:scale-95'}
                  `}
                >
                  {item.badge && !isLocked && (
                    <div className="absolute top-4 right-4 size-6 bg-red-600 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 border-surface-dark shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-pulse z-20">
                      {item.badge}
                    </div>
                  )}

                  {isLocked && (
                    <div className="absolute top-3 right-3 size-6 bg-background-dark rounded-full flex items-center justify-center text-primary shadow-lg border border-primary/20">
                      <span className="material-symbols-outlined text-[14px]">lock</span>
                    </div>
                  )}

                  <div className={`size-12 rounded-2xl flex items-center justify-center transition-colors
                    ${isLocked ? 'bg-white/5 text-slate-500' : 'bg-white/5 text-primary group-hover:bg-primary/10'}
                  `}>
                    <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                  </div>
                  <div>
                    <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${isLocked ? 'text-slate-500' : 'text-white'}`}>{item.label}</span>
                    <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest leading-none">{item.desc}</p>
                  </div>
                </button>
              );
            })
            }
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
                // Bloqueio de Lembretes Automáticos no Free
                if (billingInfo && !billingInfo.limits.ai_enabled && !billingInfo.is_trial_active) {
                  showToast("Automação de lembretes é exclusiva do PRO.", "error");
                  navigate('/pro/billing');
                  return;
                }

                if (!window.confirm('Enviar lembretes para agendamentos de AMANHÃ?')) return;
                try {
                  const { data, error } = await supabase.functions.invoke('send-reminders');
                  if (error) throw error;
                  alert(`Sucesso! ${data?.message || 'Lembretes enviados.'}`);
                } catch (err: any) {
                  alert('Erro: ' + err.message);
                }
              }}
              className={`py-6 rounded-3xl flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all shadow-lg col-span-2
                ${(billingInfo && !billingInfo.limits.ai_enabled && !billingInfo.is_trial_active)
                  ? 'bg-white/5 border border-white/10 text-slate-500 opacity-50 grayscale cursor-not-allowed'
                  : 'bg-purple-500/10 border border-purple-500/20 text-purple-500'}
              `}
            >
              <span className="material-symbols-outlined">
                {(billingInfo && !billingInfo.limits.ai_enabled && !billingInfo.is_trial_active) ? 'lock' : 'notification_important'}
              </span>
              DISPARAR LEMBRETES (AMANHÃ)
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
