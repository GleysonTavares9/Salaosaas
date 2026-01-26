import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ViewRole } from '../types.ts';

interface BottomNavProps {
  role: ViewRole | null;
}

const BottomNav: React.FC<BottomNavProps> = ({ role }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navClass = "flex justify-between items-center bg-background-dark/95 backdrop-blur-2xl border-t border-white/5 px-6 pb-10 pt-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]";

  // Public Guest Nav
  if (!role) {
    return (
      <div className="fixed bottom-0 left-0 right-0 max-w-[450px] mx-auto z-[100]">
        <nav className="flex justify-around items-center bg-background-dark/95 backdrop-blur-2xl border-t border-white/5 px-6 pb-10 pt-4">
          <button onClick={() => navigate('/explore')} className={`flex flex-col items-center gap-1.5 transition-all ${isActive('/explore') ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
            <span className={`material-symbols-outlined text-2xl ${isActive('/explore') ? 'fill-1' : ''}`}>explore</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Explorar</span>
          </button>
          <button onClick={() => navigate('/products')} className={`flex flex-col items-center gap-1.5 transition-all ${isActive('/products') ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
            <span className={`material-symbols-outlined text-2xl ${isActive('/products') ? 'fill-1' : ''}`}>shopping_bag</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Shop</span>
          </button>
          <button onClick={() => navigate('/login-user')} className={`flex flex-col items-center gap-1.5 transition-all text-slate-500 opacity-60`}>
            <span className="material-symbols-outlined text-2xl">login</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Entrar</span>
          </button>
        </nav>
      </div>
    );
  }

  // Client Nav
  if (role === 'client') {
    return (
      <div className="fixed bottom-0 left-0 right-0 max-w-[450px] mx-auto z-[100]">
        <nav className={navClass}>
          <button onClick={() => navigate('/explore')} className={`flex flex-col items-center gap-1.5 transition-all ${isActive('/explore') ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
            <span className={`material-symbols-outlined text-2xl ${isActive('/explore') ? 'fill-1' : ''}`}>explore</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Explorar</span>
          </button>
          <button onClick={() => navigate('/my-appointments')} className={`flex flex-col items-center gap-1.5 transition-all ${isActive('/my-appointments') ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
            <span className={`material-symbols-outlined text-2xl ${isActive('/my-appointments') ? 'fill-1' : ''}`}>calendar_month</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Agenda</span>
          </button>
          <button onClick={() => navigate('/messages')} className={`flex flex-col items-center gap-1.5 transition-all ${isActive('/messages') || location.pathname.includes('/chat') ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
            <span className={`material-symbols-outlined text-2xl ${isActive('/messages') ? 'fill-1' : ''}`}>chat</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Chat</span>
          </button>
          <button onClick={() => navigate('/profile')} className={`flex flex-col items-center gap-1.5 transition-all ${isActive('/profile') ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
            <span className={`material-symbols-outlined text-2xl ${isActive('/profile') ? 'fill-1' : ''}`}>person</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Perfil</span>
          </button>
        </nav>
      </div>
    );
  }

  // Pro/Admin Nav
  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-[450px] mx-auto z-[100]">
      <nav className={navClass}>
        <button onClick={() => navigate('/pro')} className={`flex flex-col items-center gap-1.5 transition-all ${isActive('/pro') ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
          <span className={`material-symbols-outlined text-2xl ${isActive('/pro') ? 'fill-1' : ''}`}>dashboard</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Dashboard</span>
        </button>
        <button onClick={() => navigate('/pro/schedule')} className={`flex flex-col items-center gap-1.5 transition-all ${isActive('/pro/schedule') ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
          <span className={`material-symbols-outlined text-2xl ${isActive('/pro/schedule') ? 'fill-1' : ''}`}>event_note</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Agenda</span>
        </button>
        <button onClick={() => navigate('/messages')} className={`flex flex-col items-center gap-1.5 transition-all ${isActive('/messages') ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
          <span className={`material-symbols-outlined text-2xl ${isActive('/messages') ? 'fill-1' : ''}`}>forum</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Mensagens</span>
        </button>
        <button onClick={() => navigate('/profile')} className={`flex flex-col items-center gap-1.5 transition-all ${isActive('/profile') ? 'text-primary' : 'text-slate-500 opacity-60'}`}>
          <span className={`material-symbols-outlined text-2xl ${isActive('/profile') ? 'fill-1' : ''}`}>account_circle</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Perfil</span>
        </button>
      </nav>
    </div>
  );
};

export default BottomNav;