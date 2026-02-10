
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface UserLoginProps {
  onLogin: (role: 'client') => void;
}

const UserLogin: React.FC<UserLoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      onLogin('client');
      setIsLoading(false);
      navigate('/');
    }, 1200);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto flex flex-col p-8 sm:p-8 lg:p-8 no-scrollbar">
      <header className="pt-8 pb-12">
        <button onClick={() => navigate('/')} className="size-10 sm:size-12 lg:size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <div className="mb-12 text-center">
          <div className="px-4 sm:px-4 lg:px-4 py-2 sm:py-2 lg:py-2 bg-primary/10 border border-primary/20 rounded-full inline-block mb-4">
            <span className="text-[8px] font-black text-primary uppercase tracking-[0.3em]">Área do Cliente</span>
          </div>
          <h1 className="text-4xl lg:text-4xl font-display font-black text-white italic tracking-tighter mb-2">Bem-vinda de <br /><span className="text-primary">Volta.</span></h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Entre para gerenciar seus agendamentos</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
            <input type="email" required placeholder="seu@email.com" className="w-full bg-surface-dark border border-white/5 rounded-2xl py-5 sm:py-5 lg:py-5 px-6 sm:px-6 lg:px-6 text-white text-sm outline-none focus:border-primary/50 transition-all shadow-inner" />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center pr-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
              <button type="button" className="text-[9px] font-black text-primary uppercase tracking-widest">Esqueci</button>
            </div>
            <input type="password" required placeholder="••••••••" className="w-full bg-surface-dark border border-white/5 rounded-2xl py-5 sm:py-5 lg:py-5 px-6 sm:px-6 lg:px-6 text-white text-sm outline-none focus:border-primary/50 transition-all shadow-inner" />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full gold-gradient text-background-dark font-black py-5 sm:py-5 lg:py-5 rounded-2xl shadow-2xl uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 lg:gap-3 active:scale-95 transition-all"
          >
            {isLoading ? <div className="size-5 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div> : 'Entrar na Aura'}
          </button>
        </form>

        <div className="mt-10 space-y-6 text-center">
          <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">
            Novo na Aura? <button onClick={() => navigate('/register-user')} className="text-primary ml-1 underline underline-offset-4">Criar conta grátis</button>
          </p>

          <div className="pt-8 border-t border-white/5">
            <button
              onClick={() => navigate('/login')}
              className="text-[9px] font-black text-slate-700 uppercase tracking-[0.2em] hover:text-slate-400 transition-colors"
            >
              Sou um Profissional / Salão →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserLogin;
