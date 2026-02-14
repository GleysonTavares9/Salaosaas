import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ViewRole } from '../types.ts';

interface BottomNavProps {
  role: ViewRole | null;
}

const BottomNav: React.FC<BottomNavProps> = ({ role }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/pro') return location.pathname === '/pro' || location.pathname.startsWith('/pro/');
    return location.pathname === path;
  };

  // MELHORADO: Base classes responsivas otimizadas
  const containerClass = "transition-all duration-300 z-[100] " +
    // Mobile: Bottom fixed to viewport
    "fixed bottom-0 left-0 right-0 w-full " +
    // Tablet: Ainda no bottom mas com melhor espaçamento
    "sm:px-2 " +
    // Desktop: Left Sidebar FIXED
    "lg:fixed lg:top-0 lg:left-0 lg:h-full lg:w-full lg:max-w-[240px] xl:max-w-[280px] " +
    "lg:px-0 lg:pb-0 lg:border-r lg:border-white/5 lg:bg-background-dark/95 " +
    "lg:backdrop-blur-xl lg:flex lg:flex-col lg:items-stretch lg:pt-10 " +
    "lg:overflow-y-auto lg:no-scrollbar";

  // MELHORADO: Nav classes responsivas
  const navClass = "flex items-center justify-between w-full transition-all " +
    // Mobile: Native-style Tab Bar
    "bg-background-dark/95 backdrop-blur-3xl border-t border-white/5 " +
    "px-1 sm:px-2 pt-2 sm:pt-3 pb-[calc(0.5rem+var(--sab))] sm:pb-[calc(0.75rem+var(--sab))] " +
    "shadow-[0_-10px_40px_rgba(0,0,0,0.6)] " +
    // Desktop: Vertical Column
    "lg:flex-col lg:justify-start lg:gap-2 lg:bg-transparent lg:border-none " +
    "lg:shadow-none lg:rounded-none lg:px-3 xl:px-4 lg:py-2 lg:h-auto lg:w-full";

  // MELHORADO: NavItem com melhor responsividade
  const NavItem = ({ path, icon, label, badge }: { path: string, icon: string, label: string, badge?: number }) => {
    const active = isActive(path);
    return (
      <button
        onClick={() => navigate(path)}
        className={`relative group flex transition-all outline-none 
          /* Mobile: Minimal Tab - Otimizado para telas pequenas */
          flex-col items-center gap-0.5 sm:gap-1 flex-1 py-1 sm:py-1.5
          /* Tablet: Melhor espaçamento */
          md:gap-1.5 md:py-2
          /* Desktop: Luxury Row */
          lg:flex-row lg:gap-4 xl:gap-5 lg:px-4 xl:px-6 lg:py-4 xl:py-5 
          lg:rounded-[20px] xl:rounded-[24px] lg:justify-start lg:flex-none lg:w-full
          ${active
            ? 'text-primary'
            : 'text-slate-500 hover:text-slate-200'}
          ${active && 'lg:bg-primary/10 lg:border lg:border-primary/10'}
          lg:hover:bg-white/5 active:scale-95 lg:active:scale-100
        `}
      >
        {/* Desktop Active Glow Indicator */}
        {active && <div className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 h-8 xl:h-10 w-1 xl:w-1.5 bg-primary rounded-r-full shadow-[0_0_20px_rgba(193,165,113,0.8)]"></div>}

        <div className={`relative z-10 flex items-center justify-center transition-all duration-300 ${active ? 'scale-105 sm:scale-110 lg:scale-100' : 'scale-100'}`}>
          <span className={`material-symbols-outlined text-[18px] sm:text-[20px] md:text-[22px] lg:text-[28px] xl:text-[32px] transition-transform ${active ? 'fill-1 animate-pulse-slow' : ''}`}>
            {icon}
          </span>

          {/* Badge - Responsivo */}
          {badge && badge > 0 && (
            <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 size-3.5 sm:size-4 lg:size-5 xl:size-6 bg-red-600 rounded-full text-[8px] sm:text-[9px] lg:text-[10px] xl:text-[11px] font-black text-white flex items-center justify-center border-2 border-background-dark shadow-lg shadow-red-600/40">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </div>

        {/* Mobile Label - Melhor tipografia */}
        <span className={`text-[7px] sm:text-[8px] md:text-[9px] font-black uppercase tracking-wider sm:tracking-widest lg:hidden transition-colors ${active ? 'text-primary' : 'text-slate-500'}`}>
          {label}
        </span>

        {/* Desktop Label */}
        <span className={`
          hidden lg:block font-black uppercase tracking-[0.15em] xl:tracking-[0.2em] 
          text-[11px] xl:text-[12px] text-left flex-1 transition-colors leading-none
          ${active ? 'text-primary' : 'text-slate-400 group-hover:text-white'}
        `}>
          {label}
        </span>
      </button>
    );
  };

  // Content based on Role
  let items = [];

  if (!role) {
    items = [
      { path: '/explore', icon: 'explore', label: 'Explorar' },
      { path: '/products', icon: 'shopping_bag', label: 'Shop' },
      { path: '/login-user', icon: 'login', label: 'Entrar' }
    ];
  } else if (role === 'client') {
    items = [
      { path: '/explore', icon: 'explore', label: 'Explorar' },
      { path: '/my-appointments', icon: 'calendar_month', label: 'Agenda' },
      { path: '/messages', icon: 'chat', label: 'Chat' },
      { path: '/profile', icon: 'person', label: 'Perfil' }
    ];
  } else {
    // Admin / Pro
    items = [
      { path: '/pro', icon: 'dashboard', label: 'Dashboard' },
      ...(role === 'admin' ? [{ path: '/pro/tasks', icon: 'account_balance_wallet', label: 'Saídas' }] : []),
      { path: '/pro/schedule', icon: 'event_note', label: 'Agenda' },
      { path: '/messages', icon: 'chat_bubble', label: 'Mensagens' },
      { path: '/profile', icon: 'account_circle', label: 'Perfil' }
    ];
  }

  return (
    <div className={containerClass}>
      {/* Header Desktop - Versão Elite */}
      <div className="hidden lg:flex flex-col mb-12 xl:mb-16 px-6 xl:px-8 items-start animate-fade-in w-full">
        <div className="flex items-center gap-4 xl:gap-5 mb-6">
          <div className="size-12 xl:size-14 rounded-[20px] xl:rounded-[24px] gold-gradient flex items-center justify-center text-background-dark shadow-[0_15px_35px_rgba(193,165,113,0.4)] shrink-0 transition-all hover:scale-110 hover:rotate-3">
            <span className="material-symbols-outlined text-3xl xl:text-4xl font-black">spa</span>
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="font-display font-black italic text-2xl xl:text-3xl text-white tracking-widest leading-none uppercase">Luxe Aura</h1>
            <p className="text-[10px] xl:text-[11px] font-black text-primary uppercase tracking-[0.4em] leading-none mt-2 opacity-70">Beauty Platform</p>
          </div>
        </div>
        <div className="w-full h-px bg-gradient-to-r from-primary/20 via-primary/5 to-transparent"></div>
      </div>

      <nav className={navClass}>
        {items.map(item => (
          <NavItem key={item.path} {...item} />
        ))}
      </nav>

      {/* Desktop Sidebar Footer */}
      <div className="hidden lg:flex mt-auto p-6 xl:p-8 border-t border-white/5 w-full bg-black/20">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-4 text-slate-500 hover:text-white transition-all group w-full px-5 py-4 rounded-[20px] hover:bg-white/5 active:scale-95 border border-transparent hover:border-white/5"
        >
          <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-xl xl:text-2xl transition-transform group-hover:scale-110">home</span>
          </div>
          <span className="text-[11px] xl:text-[12px] font-black uppercase tracking-[0.2em] flex-1 text-left">Início</span>
          <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">arrow_forward_ios</span>
        </button>
      </div>
    </div>
  );
};

export default BottomNav;
