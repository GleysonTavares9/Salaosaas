
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

interface UserRegisterProps {
  onRegister: (role: 'client', userId: string) => void;
}

const UserRegister: React.FC<UserRegisterProps> = ({ onRegister }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      showToast("As senhas não coincidem.", "error");
      return;
    }
    setIsLoading(true);
    try {
      const authRes = await api.auth.signUp(formData.email, formData.password, {
        role: 'client',
        nome: formData.nome,
        phone: formData.phone
      });
      if (authRes.user) {
        onRegister('client', authRes.user.id);
        navigate('/');
      }

    } catch (error: any) {
      if (error.message?.includes('rate limit exceeded') || error.message?.includes('Too Many Requests')) {
        showToast("⏰ Limite de cadastros atingido!\n\nVocê tentou criar muitas contas em pouco tempo. Por favor, aguarde 1 hora e tente novamente.\n\nSe já possui uma conta, faça login em vez de criar uma nova.", 'error');
      } else if (error.message?.includes('User already registered') || error.message?.includes('Database error saving new user')) {
        showToast("Este e-mail já está cadastrado em nossa plataforma. Não é possível criar contas diferentes com o mesmo e-mail.", 'error');
      } else {
        showToast("Erro no cadastro: " + (error.message || "Tente novamente mais tarde."), 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-background-dark h-full overflow-y-auto flex flex-col p-8 no-scrollbar">
      <header className="pt-8 pb-12">
        <button onClick={() => navigate(-1)} className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <div className="mb-10 text-center">
          <div className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-full inline-block mb-4">
            <span className="text-[8px] font-black text-primary uppercase tracking-[0.3em]">Cadastro de Cliente</span>
          </div>
          <h1 className="text-4xl font-display font-black text-white italic tracking-tighter mb-2">Sua Aura <br /><span className="text-primary text-5xl">Começa Aqui.</span></h1>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Para você que ama se cuidar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
            <input type="text" required value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Como quer ser chamado?" className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
            <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="seu@email.com" className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">WhatsApp</label>
            <input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(00) 00000-0000" className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500"
              >
                <span className="material-symbols-outlined text-sm">
                  {showPassword ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5 animate-fade-in">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar Senha</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
                className={`w-full bg-surface-dark border rounded-2xl py-4 px-6 text-white text-sm outline-none transition-all font-mono ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500/50' : 'border-white/5 focus:border-primary/50'}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500"
              >
                <span className="material-symbols-outlined text-sm">
                  {showConfirmPassword ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl shadow-2xl uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all mt-4"
          >
            {isLoading ? <div className="size-5 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div> : 'Criar minha conta'}
          </button>
        </form>

        <p className="mt-8 text-center text-slate-700 text-[10px] font-bold uppercase tracking-widest">
          Quer cadastrar seu negócio? <button onClick={() => navigate('/register')} className="text-primary ml-1">Aura para Parceiros</button>
        </p>
      </main>
    </div>
  );
};

export default UserRegister;
