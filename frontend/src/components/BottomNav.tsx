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

  // Base classes for the container
  const containerClass = "transition-all duration-300 z-[100] " +
    // Mobile: Bottom fixed to viewport
    "fixed bottom-0 left-0 right-0 w-full px-4 pb-[env(safe-area-inset-bottom)] " +
    // Desktop: Left Sidebar FIXED
    "lg:fixed lg:top-0 lg:left-0 lg:h-full lg:w-[260px] lg:px-0 lg:pb-0 lg:border-r lg:border-white/5 lg:bg-background-dark/95 lg:backdrop-blur-xl lg:flex lg:flex-col lg:items-stretch lg:pt-8 lg:overflow-y-auto lg:no-scrollbar";

  // Base classes for the nav element
  const navClass = "flex items-center justify-between w-full transition-all " +
    // Mobile: Glassmorphism Bottom Sheet
    "bg-background-dark/90 backdrop-blur-2xl border-t border-white/5 rounded-t-[32px] px-6 pt-4 pb-[calc(1.5rem+var(--sab))] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] " +
    // Desktop: Vertical Column
    "lg:flex-col lg:justify-start lg:gap-1 lg:bg-transparent lg:border-none lg:shadow-none lg:rounded-none lg:px-4 lg:py-2 lg:h-auto lg:w-full";

  // Helper to render a nav item
  const NavItem = ({ path, icon, label, badge }: { path: string, icon: string, label: string, badge?: number }) => {
    const active = isActive(path);
    return (
      <button
        onClick={() => navigate(path)}
        className={`relative group flex transition-all outline-none w-full
          /* Mobile: Column */
          flex-col items-center gap-1 
          /* Desktop: Row */
          lg:flex-row lg:gap-5 lg:px-6 lg:py-4 lg:rounded-[20px] lg:justify-start
          ${active
            ? 'text-primary scale-110 lg:scale-100 lg:bg-primary/10 lg:border lg:border-primary/10'
            : 'text-slate-500 hover:text-slate-200 lg:hover:bg-white/5'}
        `}
      >
        {/* Desktop Active Glow Indicator */}
        {active && <div className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-primary rounded-r-full shadow-[0_0_15px_rgba(193,165,113,0.6)]"></div>}

        <div className={`relative z-10 flex items-center justify-center transition-all duration-300`}>
          <span className={`material-symbols-outlined text-xl lg:text-[28px] transition-transform ${active ? 'fill-1' : ''}`}>
            {icon}
          </span>

          {/* Badge */}
          {badge && badge > 0 && (
            <span className="absolute -top-1 -right-1 size-3.5 lg:size-5 bg-red-600 rounded-full text-[8px] lg:text-[10px] font-black text-white flex items-center justify-center border-2 border-background-dark lg:relative lg:ml-auto lg:border-none shadow-lg shadow-red-600/30">
              {badge}
            </span>
          )}
        </div>

        {/* Mobile Label */}
        <span className="text-[8px] font-black uppercase tracking-widest lg:hidden">
          {label}
        </span>

        {/* Desktop Label */}
        <span className={`
          hidden lg:block font-black uppercase tracking-[0.15em] text-[11px] text-left flex-1 transition-colors leading-tight
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
      { path: '/explore', icon: 'explore', label: 'Explorar' },
      { path: '/pro/schedule', icon: 'event_note', label: 'Agenda' },
      { path: '/messages', icon: 'chat_bubble', label: 'Mensagens' },
      { path: '/profile', icon: 'account_circle', label: 'Perfil' }
    ];
  }

  return (
    <div className={containerClass}>
      <div className="hidden lg:flex mb-10 px-6 items-center gap-4 animate-fade-in w-full">
        <div className="size-12 rounded-[18px] gold-gradient flex items-center justify-center text-background-dark shadow-[0_10px_30px_rgba(193,165,113,0.3)] shrink-0 transition-transform hover:scale-105">
          <span className="material-symbols-outlined text-3xl font-black">spa</span>
        </div>
        <div className="flex flex-col min-w-0">
          <h1 className="font-display font-black italic text-2xl text-white tracking-widest leading-none uppercase">Luxe Aura</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] leading-none mt-2 opacity-80">Beauty Platform</p>
        </div>
      </div>

      <nav className={navClass}>
        {items.map(item => (
          <NavItem key={item.path} {...item} />
        ))}
      </nav>

      {/* Desktop Sidebar Footer: Settings */}
      <div className="hidden lg:flex mt-auto p-6 border-t border-white/5 w-full">
        <button onClick={() => navigate('/')} className="flex items-center gap-4 text-slate-500 hover:text-white transition-all group w-full px-4 py-3 rounded-xl hover:bg-white/5">
          <span className="material-symbols-outlined group-hover:scale-110 transition-transform text-2xl">home</span>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] flex-1 text-left">Início</span>
        </button>
      </div>
    </div>
  );
};

export default BottomNav;