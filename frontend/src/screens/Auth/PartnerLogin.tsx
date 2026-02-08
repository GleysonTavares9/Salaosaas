import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ViewRole } from '../../types';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

interface PartnerLoginProps {
  onLogin: (role: ViewRole, userId: string) => void | Promise<void>;
}

const PartnerLogin: React.FC<PartnerLoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  // ... (rest of states remain same)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginRole, setLoginRole] = useState<ViewRole>('pro');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [redirectInfo, setRedirectInfo] = useState<{ role: string, message: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const data = await api.auth.signIn(cleanEmail, password.trim());
      const user = data.user;

      if (user) {
        const realRole = user.user_metadata.role || 'client';

        // 1. Redirecionamento Automático de Cliente na porta Pro
        if (realRole === 'client') {
          setRedirectInfo({ role: 'client', message: 'Identificamos seu perfil de Cliente. Levando você para o acesso correto.' });

          setIsLoading(false);
          setTimeout(async () => {
            navigate('/explore', { replace: true });
          }, 3500);
          return;
        }

        // 2. CORREÇÃO DE ABA (Barbeiro vs Gestor)
        if (loginRole !== realRole) {
          const roleLabel = realRole === 'admin' ? 'Gestor' : 'Barbeiro';

          setRedirectInfo({ role: realRole, message: `Perfil de ${roleLabel} identificado. Sincronizando acesso...` });
          setIsLoading(false);

          setTimeout(() => {
            setRedirectInfo(null);
            setLoginRole(realRole as ViewRole);
            onLogin(realRole as ViewRole, user.id);
          }, 2000);

          return;
        }

        console.log("Aura: 🔐 Login Supabase OK. Sincronizando Perfil...");
        showToast("✨ Login realizado com sucesso! Bem-vindo ao seu painel.", "success");
        onLogin(realRole as ViewRole, user.id);
        console.log("Aura: 🏁 Fluxo de login disparado.");
      }
    } catch (error: any) {
      console.error("Login Error:", error);
      let msg = error.message || "Erro no login.";

      if (msg.includes("Email not confirmed")) {
        msg = "Acesso ainda não ativado. Peça ao Gestor para 'Salvar' seu perfil novamente na Gestão de Equipe para liberar seu acesso.";
      } else if (msg.includes("Invalid login credentials")) {
        msg = "E-mail ou senha incorretos. Verifique seus dados.";
      }

      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.auth.resetPassword(resetEmail.trim());
      setSuccessMessage("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (error: any) {
      console.error("Reset Error:", error);
      setErrorMessage(error.message || "Erro ao solicitar recuperação.");
    } finally {
      setIsLoading(false);
    }
  };

  if (redirectInfo) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background-dark/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-fade-in text-center">
        <div className="size-20 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mb-6 animate-pulse">
          <span className="material-symbols-outlined text-4xl text-primary">sync_alt</span>
        </div>
        <h2 className="text-3xl font-display font-black text-white italic tracking-tighter mb-2">Redirecionando...</h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest max-w-xs">{redirectInfo.message}</p>
        <div className="w-48 h-1 bg-white/10 rounded-full mt-8 overflow-hidden">
          <div className="h-full bg-primary animate-progress-bar"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col h-full bg-background-dark overflow-y-auto no-scrollbar">
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200"
          className="w-full h-full object-cover opacity-20 grayscale"
          alt="Office Background"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background-dark via-transparent to-background-dark"></div>
      </div>

      <header className="relative z-10 p-8 pt-[calc(env(safe-area-inset-top)+2rem)] flex items-center justify-between">
        <button onClick={() => navigate('/')} className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
          <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Painel de Profissional</span>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col justify-center px-8 pb-32">
        <div className="space-y-2 mb-10 text-center">
          <h1 className="text-5xl font-display font-black text-white italic tracking-tighter leading-none">Aura <br /> <span className="text-primary text-4xl uppercase">Management.</span></h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-4">Gestão inteligente para artistas.</p>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-[24px] text-red-500 text-[10px] font-black uppercase tracking-widest text-center animate-shake mb-8">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-[24px] text-emerald-500 text-[10px] font-black uppercase tracking-widest text-center animate-fade-in mb-8">
            {successMessage}
          </div>
        )}

        {!isForgotPassword ? (
          <>
            <div className="flex bg-surface-dark p-1.5 rounded-2xl border border-white/5 mb-10 shadow-2xl">
              <button
                type="button"
                onClick={() => setLoginRole('pro')}
                className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${loginRole === 'pro' ? 'bg-primary text-background-dark shadow-xl' : 'text-slate-500'}`}
              >
                Barbeiro
              </button>
              <button
                type="button"
                onClick={() => setLoginRole('admin')}
                className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${loginRole === 'admin' ? 'bg-primary text-background-dark shadow-xl' : 'text-slate-500'}`}
              >
                Gestor
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-surface-dark border border-white/5 rounded-2xl py-5 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all shadow-inner"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Senha</label>
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface-dark border border-white/5 rounded-2xl py-5 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500"
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl shadow-2xl uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all mt-4"
              >
                {isLoading ? (
                  <div className="size-5 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div>
                ) : (
                  <>
                    Acessar Portal
                    <span className="material-symbols-outlined font-black">login</span>
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail para Recuperação</label>
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-surface-dark border border-white/5 rounded-2xl py-5 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl shadow-2xl uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all mt-4"
            >
              {isLoading ? (
                <div className="size-5 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div>
              ) : (
                <>
                  Enviar Instruções
                  <span className="material-symbols-outlined font-black">mail</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsForgotPassword(false)}
              className="w-full py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest"
            >
              Voltar para o Login
            </button>
          </form>
        )}

        <div className="mt-12 text-center">
          {loginRole === 'admin' ? (
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-4">
              Ainda não é parceiro? <button onClick={() => navigate('/register')} className="text-primary ml-1 underline">Cadastrar Unidade</button>
            </p>
          ) : (
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-4 italic">
              Barbeiros devem solicitar acesso ao gestor da unidade.
            </p>
          )}
          <button
            onClick={() => navigate('/login-user')}
            className="text-[9px] font-black text-slate-700 uppercase tracking-widest hover:text-white transition-colors"
          >
            ← Retornar ao site
          </button>
        </div>
      </main>
    </div>
  );
};

export default PartnerLogin;