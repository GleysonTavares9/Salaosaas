
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BusinessSegment, Salon } from '../../types';
import { api } from '../../lib/api';
import { INITIAL_HOURS } from '../../constants';

interface PartnerRegisterProps {
  onRegister: (role: 'admin', userId: string) => void;
}

const PartnerRegister: React.FC<PartnerRegisterProps> = ({ onRegister }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    salonName: '',
    ownerName: '',
    email: '',
    password: '',
    segment: 'Salão' as BusinessSegment
  });

  const segments: BusinessSegment[] = ['Salão', 'Manicure', 'Sobrancelha', 'Barba', 'Estética', 'Spa'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      console.log("✅ Usuário criado:", authRes.user.id);

      // Aguardar um momento para garantir que o usuário foi persistido
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 2. Criar o Salão no Banco
      const slug = formData.salonName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
      const newSalon: Omit<Salon, 'id'> = {
        nome: formData.salonName,
        slug_publico: `${slug}-${Math.floor(Math.random() * 1000)}`,
        segmento: formData.segment,
        descricao: `Seja bem-vindo ao ${formData.salonName}!`,
        logo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.salonName)}&background=c1a571&color=0c0d10&bold=true`,
        banner_url: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&q=80&w=1200",
        endereco: "Endereço a definir",
        cidade: "São Paulo",
        rating: 5.0,
        reviews: 0,
        telefone: "",
        amenities: [],
        location: { lat: 0, lng: 0 }, // Pendente de ajuste no Business Setup
        horario_funcionamento: INITIAL_HOURS
      };

      const salonRecord = await api.salons.create(newSalon);
      console.log("✅ Salão criado:", salonRecord.id);

      // 3. Criar o registro de Profissional (Dono)
      await api.professionals.create({
        salon_id: salonRecord.id,
        user_id: authRes.user.id,
        name: formData.ownerName,
        role: 'Proprietário',
        image: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.ownerName)}&background=0c0d10&color=c1a571&bold=true`,
        productivity: 0,
        rating: 5.0,
        status: 'active',
        comissao: 100
      });

      console.log("✅ Profissional criado");

      onRegister('admin', authRes.user.id);
      navigate('/pro/business-setup'); // Leva direto para configurar a unidade

    } catch (error: any) {
      console.error(error);
      if (error.message?.includes('rate limit exceeded') || error.message?.includes('Too Many Requests')) {
        alert("⏰ Limite de cadastros atingido!\n\nVocê tentou criar muitas contas em pouco tempo. Por favor, aguarde 1 hora e tente novamente.\n\nSe já possui uma conta, faça login em vez de criar uma nova.");
      } else if (error.message?.includes('User already registered') || error.message?.includes('Database error saving new user')) {
        alert("Este e-mail já está cadastrado. Não é possível usar o mesmo e-mail para contas diferentes (Cliente/Parceiro).");
      } else {
        alert("Erro no cadastro: " + (error.message || error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-screen bg-background-dark overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src="https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&q=80&w=1200" className="w-full h-full object-cover opacity-10 grayscale" alt="Interior" />
        <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/80 to-transparent"></div>
      </div>

      <header className="relative z-10 p-8 flex items-center justify-between">
        <button onClick={() => navigate('/login')} className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
          <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Parceiro Aura</span>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col px-8 pb-12 overflow-y-auto no-scrollbar">
        <div className="space-y-2 mb-10">
          <h1 className="text-4xl font-display font-black text-white italic tracking-tighter leading-none">Digitalize sua <br /> <span className="text-primary">Excelência.</span></h1>
          <p className="text-slate-500 text-sm font-medium">Gestão premium para o seu negócio.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome da Unidade</label>
            <input type="text" required value={formData.salonName} onChange={(e) => setFormData({ ...formData, salonName: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Proprietário</label>
              <input type="text" required value={formData.ownerName} onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Segmento</label>
              <select value={formData.segment} onChange={(e) => setFormData({ ...formData, segment: e.target.value as BusinessSegment })} className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all appearance-none">
                {segments.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail Corporativo</label>
            <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha de Admin</label>
            <input type="password" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-primary/50 transition-all" />
          </div>

          <button type="submit" disabled={isLoading} className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl shadow-2xl uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all">
            {isLoading ? <div className="size-5 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div> : 'Criar Unidade Aura'}
          </button>
        </form>

        <p className="mt-8 text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest">
          Agendando como cliente? <button onClick={() => navigate('/register-user')} className="text-primary ml-1">Crie sua conta pessoal</button>
        </p>
      </main>
    </div>
  );
};

export default PartnerRegister;
