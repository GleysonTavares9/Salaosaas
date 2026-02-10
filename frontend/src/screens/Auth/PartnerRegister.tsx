
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BusinessSegment, Salon } from '../../types';
import { api } from '../../lib/api';
import { INITIAL_HOURS } from '../../constants';
import { useToast } from '../../contexts/ToastContext';

interface PartnerRegisterProps {
  onRegister: (role: 'admin', userId: string) => Promise<void> | void;
}

const PartnerRegister: React.FC<PartnerRegisterProps> = ({ onRegister }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    salonName: '',
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
    segment: 'Salão' as BusinessSegment
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const segments: BusinessSegment[] = ['Salão', 'Manicure', 'Sobrancelha', 'Barba', 'Estética', 'Spa'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      showToast("As senhas não coincidem. Verifique e tente novamente.", "error");
      return;
    }
    setIsLoading(true);
    try {
      // 1. Criar usuário no Auth
      const authRes = await api.auth.signUp(formData.email, formData.password, {
        role: 'admin',
        salon_name: formData.salonName,
        owner_name: formData.ownerName,
        segment: formData.segment
      });

      if (!authRes.user) throw new Error("Erro ao criar usuário.");

      // Aguardar um momento para garantir que o usuário foi persistido
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 2. Criar o Salão e o Profissional via RPC (Resolve erro de RLS/Auth)
      const slug = formData.salonName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
      const salonId = await api.salons.registerNewSalon({
        p_user_id: authRes.user.id,
        p_salon_name: formData.salonName,
        p_segment: formData.segment,
        p_owner_name: formData.ownerName,
        p_slug: `${slug}-${Math.floor(Math.random() * 1000)}`,
        p_email: formData.email,
        p_logo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.salonName)}&background=c1a571&color=0c0d10&bold=true`,
        p_banner_url: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&q=80&w=1200",
        p_initial_hours: INITIAL_HOURS
      });

      showToast("✨ Unidade Aura criada com sucesso! Seja bem-vindo.", "success");
      await onRegister('admin', authRes.user.id);
      // O App.tsx já cuida do redirecionamento após o onRegister concluir o fetch de dados

    } catch (error: any) {
      console.error("Erro no cadastro:", error.message || error);
      const errorMessage = error.message || '';

      if (errorMessage.includes('Too Many Requests') || errorMessage.includes('security purposes') || errorMessage.includes('email rate limit exceeded')) {
        // Tenta extrair os segundos se existirem na mensagem
        const secondsMatch = errorMessage.match(/(\d+)\s+seconds/);
        const waitTime = secondsMatch ? `por mais ${secondsMatch[1]} segundos` : 'por um momento';

        let customMsg = `⏰ Calma lá! Curto-circuito de segurança.\n\nPor segurança, o sistema pede que você aguarde ${waitTime} antes de tentar um novo cadastro.`;

        if (errorMessage.includes('email rate limit exceeded')) {
          customMsg = `📧 Limite de E-mails atingido!\n\nO servidor de e-mail enviou muitas mensagens em pouco tempo. Por favor, aguarde cerca de 1 hora ou use um e-mail diferente para continuar testando agora. 🛡️`;
        } else {
          customMsg += `\n\nIsso acontece para proteger sua conta contra robôs. 🛡️`;
        }

        showToast(customMsg, 'error');
      } else if (errorMessage.includes('User already registered') || errorMessage.includes('Database error saving new user')) {
        showToast("Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail corporativo.", 'error');
      } else {
        showToast("Erro no cadastro: " + errorMessage, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-screen overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src="https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&q=80&w=1200" className="w-full h-full object-cover opacity-5 grayscale" alt="Interior" />
        <div className="absolute inset-0 bg-gradient-to-t from-background-dark/80 via-background-dark/20 to-transparent"></div>
      </div>

      <header className="relative z-10 p-8 sm:p-8 lg:p-8 flex items-center justify-between">
        <button onClick={() => navigate('/login')} className="size-10 sm:size-12 lg:size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="px-4 sm:px-4 lg:px-4 py-2 sm:py-2 lg:py-2 rounded-xl bg-primary/10 border border-primary/20">
          <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Parceiro Aura</span>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col px-8 sm:px-8 lg:px-8 pb-12 overflow-y-auto no-scrollbar">
        <div className="space-y-2 mb-10">
          <h1 className="font-display font-black text-white italic tracking-tighter leading-none" style={{ fontSize: 'var(--step-4)' }}>Digitalize sua <br /> <span className="text-primary">Excelência.</span></h1>
          <p className="text-slate-500 font-medium" style={{ fontSize: 'var(--step-0)' }}>Gestão premium para o seu negócio.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome da Unidade</label>
            <input type="text" required value={formData.salonName} onChange={(e) => setFormData({ ...formData, salonName: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 sm:py-4 lg:py-4 px-6 sm:px-6 lg:px-6 text-white text-sm outline-none focus:border-primary/50 transition-all" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Proprietário</label>
              <input type="text" required value={formData.ownerName} onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 sm:py-4 lg:py-4 px-6 sm:px-6 lg:px-6 text-white text-sm outline-none focus:border-primary/50 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Segmento</label>
              <div className="relative">
                <div
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 sm:py-4 lg:py-4 px-6 sm:px-6 lg:px-6 text-white text-sm outline-none cursor-pointer flex items-center justify-between group active:scale-[0.98] transition-all"
                >
                  <span className="font-medium">{formData.segment}</span>
                  <span className={`material-symbols-outlined text-primary transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </div>

                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface-dark border border-white/10 rounded-[24px] shadow-2xl overflow-hidden z-[100] animate-fade-in ring-1 ring-white/10">
                    {segments.map(s => (
                      <div
                        key={s}
                        onClick={() => {
                          setFormData({ ...formData, segment: s });
                          setIsDropdownOpen(false);
                        }}
                        className={`px-6 sm:px-6 lg:px-6 py-4 sm:py-4 lg:py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all hover:bg-white/5 hover:pl-8 ${formData.segment === s ? 'text-primary bg-primary/5' : 'text-slate-400'}`}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail Corporativo</label>
            <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 sm:py-4 lg:py-4 px-6 sm:px-6 lg:px-6 text-white text-sm outline-none focus:border-primary/50 transition-all" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha de Admin</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 sm:py-4 lg:py-4 px-6 sm:px-6 lg:px-6 text-white text-sm outline-none focus:border-primary/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar Senha</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 sm:py-4 lg:py-4 px-6 sm:px-6 lg:px-6 text-white text-sm outline-none focus:border-primary/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showConfirmPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <button type="submit" disabled={isLoading} className="w-full gold-gradient text-background-dark font-black py-5 sm:py-5 lg:py-5 rounded-2xl shadow-2xl uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 lg:gap-3 active:scale-95 transition-all">
            {isLoading ? <div className="size-5 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div> : 'Criar Unidade Aura'}
          </button>
        </form>

        <p className="mt-8 text-center text-slate-700 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
          Ao cadastrar sua unidade, você aceita nossos <br />
          <button onClick={() => navigate('/terms')} className="text-primary underline underline-offset-4">termos de uso</button> e <button onClick={() => navigate('/privacy')} className="text-primary underline underline-offset-4">privacidade</button>
        </p>

        <p className="mt-12 text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest">
          Agendando como cliente? <button onClick={() => navigate('/register-user')} className="text-primary ml-1 underline underline-offset-4">Crie sua conta pessoal</button>
        </p>
      </main>
    </div>
  );
};

export default PartnerRegister;
