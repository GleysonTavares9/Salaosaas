
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface AuthClientProps {
  onLogin: (role: 'client', userId: string) => void;
}

const AuthClient: React.FC<AuthClientProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { showToast } = useToast();

  // Estado para o Overlay de Redirecionamento
  const [redirectInfo, setRedirectInfo] = useState<{ role: string, message: string } | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Verificação de Sessão Existente (Para quando o usuário já está logado ou dá F5)
  React.useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const actualRole = session.user.user_metadata.role || 'client';
        if (actualRole === 'admin' || actualRole === 'pro') {
          // Ativa Overlay
          const roleName = actualRole === 'admin' ? 'Gestor' : 'Barbeiro';
          setRedirectInfo({
            role: roleName,
            message: `Identificamos perfil de ${roleName}. Redirecionando para Portal do Parceiro...`
          });

          setTimeout(async () => {
            await api.auth.signOut();
            navigate('/login');
          }, 3500);
        }
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && password !== confirmPassword) {
      setErrorMessage("As senhas não coincidem!");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      let authRes;
      if (isLogin) {
        authRes = await api.auth.signIn(email, password);

        // LOGIN: Fluxo normal de entrada
        if (authRes.user) {
          const actualRole = authRes.user.user_metadata.role || 'client';

          // TRAVA DE SEGURANÇA: Admin/Pro no Cliente
          if (actualRole === 'admin' || actualRole === 'pro') {
            // ATIVA O OVERLAY DE TELA CHEIA
            const roleName = actualRole === 'admin' ? 'Gestor' : 'Barbeiro';
            setRedirectInfo({
              role: roleName,
              message: `Identificamos perfil de ${roleName}. Redirecionando para Portal do Parceiro...`
            });

            // Remove loading do form (pois o form vai sumir)
            setIsLoading(false);

            // Aguarda com a TELA CHEIA VISÍVEL antes de trocar e DESLOGAR
            setTimeout(async () => {
              await api.auth.signOut();
              navigate('/login');
            }, 3500);

            return;
          }

          onLogin('client', authRes.user.id);
        }
      } else {
        // CADASTRO: Apenas cria, não loga automático na UI
        authRes = await api.auth.signUp(email, password, { role: 'client', phone });

        if (authRes.user) {
          // Mostra mensagem de sucesso e muda para a aba de login
          showToast("✨ Cadastro realizado com sucesso! Bem-vindo à Aura. Por favor, faça login para acessar.", 'success');
          setIsLogin(true);
          setIsLoading(false);
          return;
        }
      }

    } catch (error: any) {
      console.error("Login Error:", error);
      const msg = error.message || "";

      if (msg.includes('Invalid login credentials')) {
        setErrorMessage("E-mail ou senha incorretos. Verifique seus dados.");
      } else if (msg.includes('Email not confirmed') || error.status === 400) {
        setErrorMessage("E-mail não confirmado. Verifique sua caixa de entrada (e spam) para ativar a conta.");
      } else {
        setErrorMessage(msg || "Erro na autenticação.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      showToast(`Enviamos um link de recuperação para: ${email}`, 'success');
      setTimeout(() => setIsRecovering(false), 2000);
    } catch (error: any) {
      console.error("Recovery Error:", error);
      const msg = error.message || "";

      if (msg.includes('Email not confirmed')) {
        setErrorMessage("E-mail não confirmado. Você precisa confirmar seu e-mail antes de recuperar a senha.");
      } else if (msg.includes('rate limit exceeded') || msg.includes('Too Many Requests')) {
        setErrorMessage("⏰ Calma lá! Curto-circuito de segurança.\n\nEnviamos muitos e-mails recentemente. Por segurança, aguarde alguns minutos ou cerca de 1 hora antes de tentar novamente.");
      } else {
        setErrorMessage("Erro na recuperação: " + (msg || error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isRecovering) {
    return (
      <div className="flex-1 bg-background-dark min-h-screen flex flex-col p-8 relative">
        <header className="pt-[calc(env(safe-area-inset-top)+2rem)] pb-8 flex items-center justify-between">
          <button onClick={() => setIsRecovering(false)} className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <button onClick={() => navigate('/login')} className="text-[10px] font-black text-primary border border-primary/30 px-4 py-2 rounded-xl uppercase tracking-widest bg-primary/5">
            Portal Pro
          </button>
        </header>
        <main className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-display font-black text-white italic tracking-tighter mb-2">Recuperar <span className="text-primary">Acesso.</span></h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-4">Informe seu e-mail para receber o link</p>
          </div>
          <form onSubmit={handleRecover} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Seu E-mail Cadastrado</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemplo@email.com" className="w-full bg-surface-dark border border-white/5 rounded-2xl py-5 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all shadow-inner" />
            </div>

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-[10px] font-black uppercase tracking-widest text-center">
                {errorMessage}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl shadow-2xl uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all mt-4">
              {isLoading ? <div className="size-5 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div> : 'Enviar E-mail de Recuperação'}
            </button>
          </form>
        </main>
      </div>
    );
  }

  // No longer needed here as it's defined at the top
  if (redirectInfo) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background-dark/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-fade-in text-center">
        <div className="size-20 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mb-6 animate-pulse">
          <span className="material-symbols-outlined text-4xl text-primary">sync_alt</span>
        </div>
        <h2 className="text-3xl font-display font-black text-white italic tracking-tighter mb-2">
          Redirecionando...
        </h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest max-w-xs">
          {redirectInfo.message}
        </p>
        <div className="w-48 h-1 bg-white/10 rounded-full mt-8 overflow-hidden">
          <div className="h-full bg-primary animate-progress-bar"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background-dark h-full flex flex-col p-8 overflow-y-auto no-scrollbar relative">
      <header className="pt-[calc(env(safe-area-inset-top)+2rem)] pb-6 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform shadow-xl">
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="flex flex-col items-end">
          <button onClick={() => navigate('/login')} className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary/10 border border-primary/40 text-primary shadow-lg shadow-primary/5 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-sm font-black">storefront</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Acesso Profissional</span>
          </button>
          <p className="text-[7px] text-slate-600 font-black uppercase tracking-[0.2em] mt-2 mr-2">Salões & Artistas</p>
        </div>
      </header>
      <div className="flex justify-center mb-10">
        <div className="flex bg-surface-dark p-1.5 rounded-2xl border border-white/5 shadow-2xl">
          <button onClick={() => setIsLogin(true)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isLogin ? 'bg-primary text-background-dark shadow-xl' : 'text-slate-500'}`}>Entrar</button>
          <button onClick={() => setIsLogin(false)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isLogin ? 'bg-primary text-background-dark shadow-xl' : 'text-slate-500'}`}>Cadastrar</button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="max-w-sm mx-auto w-full mb-6">
          <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-[24px] text-red-500 text-[10px] font-black uppercase tracking-widest text-center animate-shake">
            {errorMessage}
          </div>
        </div>
      )}
      <main className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full pb-20">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-display font-black text-white italic tracking-tighter mb-2 leading-none">
            {isLogin ? 'Seu Momento' : 'Nova Conta'} <br />
            <span className="text-primary text-5xl tracking-[-0.05em]">Luxe Aura.</span>
          </h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-4">
            {isLogin ? 'Bem-vinda de volta à elite' : 'E-mail e WhatsApp para começar'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
              <input type="text" required placeholder="Ex: Maria Eduarda" className="w-full bg-surface-dark border border-white/5 rounded-2xl py-5 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all shadow-inner" />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Seu E-mail</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.com" className="w-full bg-surface-dark border border-white/5 rounded-2xl py-5 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all shadow-inner" />
          </div>
          {!isLogin && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">WhatsApp / Celular</label>
              <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" className="w-full bg-surface-dark border border-white/5 rounded-2xl py-5 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all shadow-inner" />
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center pr-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
              {isLogin && <button type="button" onClick={() => setIsRecovering(true)} className="text-[9px] font-black text-primary uppercase tracking-widest">Esqueceu?</button>}
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
          {!isLogin && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar Senha</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full bg-surface-dark border rounded-2xl py-5 px-6 text-white text-sm outline-none transition-all shadow-inner ${confirmPassword && password !== confirmPassword ? 'border-danger/50' : 'border-white/5 focus:border-primary/50'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500"
                >
                  <span className="material-symbols-outlined">
                    {showConfirmPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>
          )}
          <button type="submit" disabled={isLoading} className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl shadow-2xl uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all mt-4 border border-white/10">
            {isLoading ? <div className="size-5 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div> : (isLogin ? 'Entrar na Aura' : 'Confirmar Cadastro')}
          </button>
        </form>
        <div className="mt-12 pt-8 border-t border-white/5 text-center">
          <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-8">
            {isLogin ? 'Ainda não tem conta?' : 'Já possui uma conta?'}
            <button onClick={() => setIsLogin(!isLogin)} className="text-primary ml-1 underline underline-offset-4">Clique aqui</button>
          </p>
          <div className="bg-primary/5 p-6 rounded-[32px] border border-primary/10 shadow-inner">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Área do Parceiro</p>
            <button onClick={() => navigate('/login')} className="w-full py-4 rounded-xl border border-primary/30 text-primary text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-primary/10 transition-all">
              <span className="material-symbols-outlined text-lg">rocket_launch</span>
              Portal Profissional
            </button>
            <p className="text-[8px] text-slate-600 mt-3 uppercase tracking-widest">Para Salões, Spas e Artistas</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuthClient;
