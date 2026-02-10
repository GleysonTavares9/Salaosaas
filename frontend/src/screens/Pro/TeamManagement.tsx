import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Professional, Salon } from '../../types';
import { api } from '../../lib/api';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';

interface TeamManagementProps {
  salon?: Salon;
  salonId?: string; // Fallback
}

const TeamManagement: React.FC<TeamManagementProps> = ({ salon, salonId: explicitId }) => {
  const salonId = salon?.id || explicitId;

  const navigate = useNavigate();
  const [team, setTeam] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedProId, setSelectedProId] = useState<string | null>(null);
  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [activeEditTab, setActiveEditTab] = useState<'info' | 'hours'>('info');

  const DAYS_OF_WEEK = [
    { key: 'segunda', label: 'Segunda-feira' },
    { key: 'terca', label: 'Terça-feira' },
    { key: 'quarta', label: 'Quarta-feira' },
    { key: 'quinta', label: 'Quinta-feira' },
    { key: 'sexta', label: 'Sexta-feira' },
    { key: 'sabado', label: 'Sábado' },
    { key: 'domingo', label: 'Domingo' }
  ];

  const [newPro, setNewPro] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Especialista',
    productivity: 0,
    rating: 5.0,
    status: 'active' as const,
    comissao: 50,
    image: 'https://i.pravatar.cc/150?u=pro_new'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [editData, setEditData] = useState<any>({
    name: '',
    role: '',
    productivity: 0,
    comissao: 0,
    status: 'active',
    image: '',
    email: '',
    password: '',
    horario_funcionamento: {}
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ show: false, title: '', message: '', onConfirm: () => { } });

  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: 'success', message: '' }), 3000);
  };

  useEffect(() => {
    if (salonId) {
      api.professionals.getBySalon(salonId).then(data => {
        setTeam(data || []);
      }).catch(() => { });

      api.salons.getBilling(salonId)
        .then(data => {
          if (data) setBillingInfo(data);
          setIsLoading(false);
        }).catch(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [salonId]);

  useEffect(() => {
    if (selectedProId) {
      const selectedPro = team.find(p => p.id === selectedProId);
      if (selectedPro) {
        setEditData({
          name: selectedPro.name || '',
          role: selectedPro.role || '',
          productivity: selectedPro.productivity || 0,
          comissao: selectedPro.comissao || 0,
          status: selectedPro.status || 'active',
          image: selectedPro.image || '',
          email: selectedPro.email || '',
          password: '', // Reset para evitar conflitos
          horario_funcionamento: selectedPro.horario_funcionamento || {}
        });
      }
    }
  }, [selectedProId, team]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPro.password !== newPro.confirmPassword) {
      console.log('❌ Senhas não coincidem');
      showNotification('error', "As senhas não coincidem.");
      return;
    }
    if (!salonId) {
      return;
    }

    // Bloqueio de Plano Elite (Limits - Calculado pelo Banco)
    const maxPros = billingInfo?.limits?.max_professionals || 2;
    const isTrial = billingInfo?.is_trial_active;

    // O banco já resolve o Downgrade Virtual, mas aqui reforçamos o limite visual
    if (!isTrial && team.length >= maxPros) {
      if (maxPros === 2) {
        showNotification('error', "Limite de 2 profissionais atingido no plano Gratuito. Faça upgrade para o PRO para ilimitados!");
      } else {
        showNotification('error', `Limite de ${maxPros} profissionais atingido para seu plano atual.`);
      }
      return;
    }

    setIsLoading(true);

    // 0. Pre-verificação local
    if (team.some(p => p.email.toLowerCase() === newPro.email.trim().toLowerCase())) {
      showNotification('error', "Este e-mail já faz parte da sua equipe.");
      setIsLoading(false);
      return;
    }
    try {
      const cleanEmail = newPro.email.trim().toLowerCase();
      const authConfig = {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: `aura-auth-create-${Date.now()}`,
          storage: {
            getItem: () => null,
            setItem: () => { },
            removeItem: () => { },
          }
        },
        global: {
          headers: { 'x-aura-stateless': 'true' }
        }
      };

      // 1. GESTÃO DE ACESSO (God Mode)
      let finalId: string | undefined = undefined;

      try {
        const { data: v_user_id, error: rpcError } = await supabase.rpc('admin_manage_user_access', {
          p_email: cleanEmail,
          p_password: newPro.password.trim() || 'Aura@123456',
          p_full_name: newPro.name.trim()
        });

        if (rpcError) throw rpcError;
        finalId = v_user_id;
      } catch (authError: any) {
        console.warn("Falha no God Mode de criação:", authError.message);
      }

      // 2. SALVAMENTO (Manual Upsert para evitar erro 42P10)
      const { password, confirmPassword, ...proDatabaseData } = newPro;

      // Busca se JÁ EXISTE um profissional com este e-mail NESTA UNIDADE
      const { data: existing } = await supabase
        .from('professionals')
        .select('id')
        .eq('email', cleanEmail)
        .eq('salon_id', salonId)
        .maybeSingle();

      let finalResult;

      if (existing) {
        const { data: updated, error: updateError } = await supabase
          .from('professionals')
          .update({
            ...proDatabaseData,
            email: cleanEmail,
            user_id: finalId || null
          })
          .eq('id', existing.id)
          .select()
          .maybeSingle();

        if (updateError) throw updateError;
        finalResult = updated;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('professionals')
          .insert({
            ...proDatabaseData,
            email: cleanEmail,
            salon_id: salonId,
            user_id: finalId || null
          })
          .select()
          .maybeSingle();

        if (insertError) {
          // 23503: FK Violation, 23505: Unique Violation (user_id já em uso)
          if (insertError.code === '23503' || insertError.code === '23505') {
            const { data: fallback, error: fallbackError } = await supabase
              .from('professionals')
              .insert({
                ...proDatabaseData,
                email: cleanEmail,
                salon_id: salonId,
                user_id: null
              })
              .select()
              .maybeSingle();

            if (fallbackError) throw fallbackError;
            finalResult = fallback;
            showNotification('error', "O login não pôde ser vinculado automaticamente, mas o perfil foi criado.");
          } else {
            throw insertError;
          }
        } else {
          finalResult = inserted;
        }
      }

      if (finalResult) {
        setTeam(prev => [finalResult, ...prev.filter(p => p.id !== finalResult.id)]);
        showNotification('success', 'Artista registrado com sucesso!');
      }

      setIsAdding(false);
      setNewPro({
        name: '', email: '', password: '', role: 'Especialista',
        productivity: 0, rating: 5.0, status: 'active', comissao: 50,
        image: 'https://i.pravatar.cc/150?u=pro_new'
      });

    } catch (error: any) {
      const errorMessage = error.message || error.details || "Erro desconhecido";
      if (errorMessage.includes("already registered")) {
        showNotification('error', "Este e-mail já tem uma conta na Aura. Se ele já trabalha aqui, use a edição.");
      } else {
        showNotification('error', "Falha no cadastro: " + errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedProId) return;
    setIsLoading(true);

    try {
      const selectedPro = team.find(p => p.id === selectedProId);
      if (!selectedPro) throw new Error("Artista não encontrado no estado local.");

      const { password, email, ...proUpdateFields } = editData;
      const cleanEmail = email.trim().toLowerCase();

      // Estado inicial do vínculo de acesso
      let finalUserId: string | null = selectedPro.user_id || null;

      // --- PASSO 1: ATUALIZAR DADOS BÁSICOS (Sempre primeiro) ---
      const { data: updatedBasic, error: basicError } = await supabase
        .from('professionals')
        .update({ ...proUpdateFields, email: cleanEmail })
        .eq('id', selectedProId)
        .select()
        .maybeSingle();

      if (basicError) {
        throw new Error("Erro ao salvar dados básicos: " + basicError.message);
      }

      if (updatedBasic) {
        setTeam(prev => prev.map(p => p.id === selectedProId ? { ...p, ...updatedBasic } : p));
      }

      // --- PASSO 2: GESTÃO DE ACESSO (Somente se houver mudança ou nova senha) ---
      const emailChanged = cleanEmail !== selectedPro.email?.toLowerCase();
      const hasNewPassword = (password && password.length > 0);

      if (hasNewPassword || emailChanged) {
        try {
          // Chamada mestre que cria, atualiza e confirma o usuário em um só passo (Bypassa 429)
          const { data: v_user_id, error: rpcError } = await supabase.rpc('admin_manage_user_access', {
            p_email: cleanEmail,
            p_password: hasNewPassword ? password?.trim() : 'Aura@123456',
            p_full_name: editData.name.trim()
          });

          if (rpcError) throw rpcError;
          finalUserId = v_user_id;

          // C. Vincular ID ao registro do profissional (Com Sincronia Inteligente)
          if (finalUserId && finalUserId !== selectedPro.user_id) {
            const { error: linkError } = await supabase.rpc('safe_link_professional', {
              p_pro_id: selectedProId,
              p_user_id: finalUserId
            });

            if (linkError) {
              await supabase.from('professionals').update({ user_id: finalUserId }).eq('id', selectedProId);
            }

            setTeam(prev => prev.map(p => p.id === selectedProId ? { ...p, user_id: finalUserId! } : p));
          }
        } catch (authError: any) {
          showNotification('error', "Os dados foram salvos, mas o login não pôde ser ativado automaticamente.");
        }
      }

      setSelectedProId(null);
      showNotification('success', 'Cadastro atualizado com sucesso!');

    } catch (error: any) {
      showNotification('error', error.message || 'Erro inesperado ao salvar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProId) return;
    setConfirmDialog({
      show: true,
      title: 'Remover Membro',
      message: 'Deseja revogar o acesso deste artista? Esta ação remove o login e o perfil dele da unidade.',
      onConfirm: async () => {
        setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { } });
        try {
          await api.professionals.delete(selectedProId);
          setTeam(prev => prev.filter(p => p.id !== selectedProId));
          setSelectedProId(null);
          showNotification('success', 'Acesso revogado com sucesso.');
        } catch (error: any) {
          showNotification('error', 'Erro ao remover artista.');
        }
      }
    });
  };

  return (
    <div className="flex-1 overflow-y-auto h-full no-scrollbar bg-background-dark relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] pointer-events-none"></div>

      <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-3xl px-4 lg:px-6 pt-2 lg:pt-12 pb-2 lg:pb-10 border-b border-white/5">
        <div className="max-w-full max-w-[1400px] mx-auto w-full flex items-center justify-between px-2">
          <button onClick={() => navigate('/pro')} className="size-9 lg:size-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="text-center">
            <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none text-base lg:text-2xl">Gestão de Talentos</h1>
            <p className="text-[7px] text-primary font-black uppercase tracking-[0.4em] mt-1 lg:mt-3">Artistas & Parceiros Aura</p>
          </div>
          <div className="size-9 lg:size-12 opacity-0 pointer-events-none"></div>
        </div>
      </header>

      <main className="max-w-full max-w-[1400px] mx-auto w-full px-6 sm:px-6 lg:px-6 py-10 sm:py-10 lg:py-10 lg:py-16 sm:py-16 lg:py-16 space-y-16 pb-40 animate-fade-in relative z-10">

        {/* KPI da Equipe (Luxurious) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-8">
          <div className="bg-surface-dark/40 border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[40px] p-8 sm:p-8 lg:p-8 shadow-3xl relative overflow-hidden group backdrop-blur-xl">
            <div className="absolute top-0 right-0 p-6 sm:p-6 lg:p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-symbols-outlined text-4xl sm:text-5xl lg:text-6xl lg:text-4xl sm:text-5xl lg:text-6xl">groups</span>
            </div>
            <p className="text-[10px] uppercase font-black tracking-[0.4em] text-slate-500 mb-4">Time Ativo</p>
            <div className="flex items-baseline gap-3 lg:gap-3">
              <span className="text-4xl lg:text-4xl lg:text-3xl sm:text-4xl lg:text-5xl lg:text-3xl sm:text-4xl lg:text-5xl font-display font-black text-white tracking-tight italic">{team.length}</span>
              <span className="text-[9px] font-black text-primary uppercase tracking-widest">Artistas</span>
            </div>
          </div>
          <div className="bg-surface-dark/40 border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[40px] p-8 sm:p-8 lg:p-8 shadow-3xl relative overflow-hidden group backdrop-blur-xl">
            <div className="absolute top-0 right-0 p-6 sm:p-6 lg:p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-symbols-outlined text-4xl sm:text-5xl lg:text-6xl lg:text-4xl sm:text-5xl lg:text-6xl">auto_graph</span>
            </div>
            <p className="text-[10px] uppercase font-black tracking-[0.4em] text-slate-500 mb-4">Média Produtividade</p>
            <div className="flex items-baseline gap-3 lg:gap-3">
              <span className="text-4xl lg:text-4xl lg:text-3xl sm:text-4xl lg:text-5xl lg:text-3xl sm:text-4xl lg:text-5xl font-display font-black text-white tracking-tight italic">
                {team.length > 0 ? (team.reduce((acc, curr) => acc + (curr.productivity || 0), 0) / team.length).toFixed(0) : 0}%
              </span>
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Score</span>
            </div>
          </div>
        </section>

        <section>
          {(() => {
            const maxPros = billingInfo?.limits?.max_professionals || 2;
            const isTrial = billingInfo?.is_trial_active;
            const isCapReached = !isTrial && team.length >= maxPros;

            return (
              <button
                onClick={() => {
                  if (isCapReached) {
                    showNotification('error', `Limite de ${maxPros} artistas atingido no plano Gratuito.`);
                    return;
                  }
                  setIsAdding(true);
                }}
                className={`w-full border-2 border-dashed rounded-2xl sm:rounded-3xl lg:rounded-[50px] py-16 sm:py-16 lg:py-16 flex flex-col items-center justify-center gap-6 lg:gap-6 group transition-all active:scale-[0.99] shadow-inner
                  ${isCapReached
                    ? 'bg-red-500/[0.02] border-red-500/10 cursor-not-allowed opacity-60'
                    : 'bg-white/[0.02] border-white/5 hover:border-primary/20 hover:bg-white/[0.04]'}
                `}
              >
                <div className={`size-14 sm:size-16 lg:size-20 rounded-2xl sm:rounded-3xl lg:rounded-[32px] flex items-center justify-center text-background-dark shadow-2xl transition-all duration-500 ${!isCapReached && 'group-hover:scale-110 group-hover:rotate-12'} 
                  ${isCapReached ? 'bg-slate-700' : 'gold-gradient shadow-gold'}`}>
                  <span className="material-symbols-outlined text-3xl lg:text-3xl font-black">
                    {isCapReached ? 'lock' : 'person_add'}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-3 lg:gap-3">
                  <span className={`text-xs lg:text-sm font-black uppercase tracking-[0.6em] ${isCapReached ? 'text-slate-600' : 'text-white'}`}>
                    {isCapReached ? 'Capacidade Máxima atingida' : 'Integrar Novo Talento'}
                  </span>
                  {isCapReached && (
                    <span className="text-[9px] font-black text-red-400 uppercase tracking-[0.4em] bg-red-500/10 px-4 sm:px-4 lg:px-4 py-2 sm:py-2 lg:py-2 rounded-full border border-red-500/10">
                      Liberar Slots no Combo Pro
                    </span>
                  )}
                </div>
              </button>
            );
          })()}
        </section>

        {/* Lista de Profissionais (Elite Gallery) */}
        <section className="space-y-12">
          <div className="flex items-center justify-between px-4 sm:px-4 lg:px-4">
            <div className="flex items-center gap-6 lg:gap-6">
              <div className="h-px w-10 bg-primary/30"></div>
              <h3 className="text-[11px] uppercase font-black tracking-[0.5em] text-primary">Galeria de Especialistas</h3>
            </div>
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] italic">Curadoria Aura</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xxl:grid-cols-5 gap-6 lg:gap-8">
            {isLoading ? (
              <div className="py-20 lg:py-40 text-center flex flex-col items-center col-span-full gap-4 lg:gap-6">
                <div className="size-10 lg:size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] animate-pulse">Sincronizando time...</p>
              </div>
            ) : (
              <>
                {team.map(pro => (
                  <div key={pro.id} onClick={() => setSelectedProId(pro.id)} className="relative group bg-surface-dark/40 rounded-2xl lg:rounded-[40px] border border-white/5 p-6 lg:p-8 shadow-2xl transition-all active:scale-95 cursor-pointer hover:border-primary/20 backdrop-blur-xl overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 sm:p-4 lg:p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-primary/40">edit_square</span>
                    </div>

                    <div className="flex gap-6 lg:gap-10">
                      <div className="relative shrink-0">
                        <div className="size-24 sm:size-28 lg:size-32 rounded-2xl lg:rounded-[32px] border-2 border-white/5 p-1 transition-all group-hover:border-primary/20 shadow-2xl relative z-10">
                          <img
                            src={pro.image || "https://i.pravatar.cc/150?u=pro"}
                            className="size-full rounded-2xl lg:rounded-[30px] object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-1000"
                            alt={pro.name}
                          />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-background-dark/90 backdrop-blur-md px-4 sm:px-4 lg:px-4 py-2 sm:py-2 lg:py-2 rounded-2xl border border-white/10 z-20 shadow-xl">
                          <p className={`text-[8px] font-black text-center uppercase tracking-widest leading-none ${pro.status === 'active' ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {pro.status === 'active' ? 'ESTÚDIO ON' : 'AUSENTE'}
                          </p>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col justify-center py-2 sm:py-2 lg:py-2 min-w-0">
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-xl lg:text-2xl lg:text-2xl font-display font-black text-white tracking-tight uppercase leading-none italic truncate group-hover:text-primary transition-colors">{pro.name}</h4>
                            <div className="flex items-center gap-3 lg:gap-3 mt-3">
                              <span className="text-[9px] uppercase font-black tracking-[0.3em] text-primary">{pro.role || 'Mestre Aura'}</span>
                              {!pro.user_id && (
                                <span className="text-[7px] bg-red-500/10 text-red-500 px-3 sm:px-3 lg:px-3 py-1 sm:py-1 lg:py-1.5 rounded-full font-black uppercase border border-red-500/10">Acesso Pendente</span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-end">
                              <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none">Desempenho Profissional</p>
                              <span className="text-xl font-display font-black text-primary font-display italic leading-none">{pro.productivity || 0}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                              <div className="bg-primary h-full transition-all duration-1500 shadow-gold" style={{ width: `${pro.productivity || 0}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>

        {/* Modal de Edição Refinado */}
        {selectedProId && (() => {
          const selectedPro = team.find(p => p.id === selectedProId);
          if (!selectedPro) return null;
          return (
            <div className="fixed inset-0 z-[100] bg-background-dark/95 backdrop-blur-3xl animate-fade-in flex flex-col items-center overflow-hidden">
              <div className="flex-1 flex flex-col max-w-full max-w-[600px] w-full h-full relative">
                <header className="px-10 sm:px-10 lg:px-10 pt-16 flex items-center justify-between shrink-0">
                  <div>
                    <h2 className="text-2xl lg:text-2xl lg:text-3xl lg:text-3xl font-display font-black text-white italic tracking-tighter uppercase">Editar Registro</h2>
                    <p className="text-[9px] text-primary font-black uppercase tracking-[0.4em] mt-2 leading-none">Perfil de {selectedPro.name}</p>
                  </div>
                  <button onClick={() => setSelectedProId(null)} className="size-10 sm:size-12 lg:size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                    <span className="material-symbols-outlined font-black">close</span>
                  </button>
                </header>

                <div className="px-10 sm:px-10 lg:px-10 mt-10 shrink-0">
                  <div className="flex bg-surface-dark/60 p-1 sm:p-1 lg:p-1.5 rounded-[24px] border border-white/5 backdrop-blur-md">
                    <button onClick={() => setActiveEditTab('info')} className={`flex-1 py-4 sm:py-4 lg:py-4 lg:py-5 sm:py-5 lg:py-5 rounded-[18px] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeEditTab === 'info' ? 'gold-gradient text-background-dark shadow-gold' : 'text-slate-500 hover:text-slate-300'}`}>DADOS DE ACESSO</button>
                    <button onClick={() => setActiveEditTab('hours')} className={`flex-1 py-4 sm:py-4 lg:py-4 lg:py-5 sm:py-5 lg:py-5 rounded-[18px] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeEditTab === 'hours' ? 'gold-gradient text-background-dark shadow-gold' : 'text-slate-500 hover:text-slate-300'}`}>AGENDAS ELITE</button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-10 sm:p-10 lg:p-10 space-y-10 pb-40 no-scrollbar min-h-0">
                  {activeEditTab === 'info' ? (
                    <div className="space-y-10 animate-fade-in">
                      <div className="flex items-center gap-10 lg:gap-10">
                        <div className="relative group shrink-0">
                          <div className="size-26 sm:size-28 lg:size-32 lg:size-34 sm:size-36 lg:size-40 rounded-2xl sm:rounded-3xl lg:rounded-[40px] border-2 border-primary/20 p-1 sm:p-1 lg:p-1 shadow-3xl overflow-hidden bg-surface-dark cursor-pointer relative">
                            <img src={editData.image} className="size-full rounded-2xl sm:rounded-3xl lg:rounded-[35px] object-cover group-hover:scale-110 transition-transform duration-700" alt="Avatar" />
                            <label htmlFor="edit-pro-photo" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                              <span className="material-symbols-outlined text-white text-3xl lg:text-3xl font-black">add_a_photo</span>
                            </label>
                          </div>
                          <input type="file" id="edit-pro-photo" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                showNotification('success', 'Carregando arte...');
                                const publicUrl = await api.storage.upload(file);
                                setEditData({ ...editData, image: publicUrl });
                              } catch (err) { showNotification('error', 'Falha no upload'); }
                            }
                          }} />
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="relative">
                            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest absolute -top-5 left-0">NOME DO ARTISTA</label>
                            <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="text-3xl lg:text-3xl font-display font-black text-white italic bg-transparent border-b border-white/20 outline-none w-full py-2 sm:py-2 lg:py-2 hover:border-primary/40 focus:border-primary transition-all" />
                          </div>
                          <div className="relative pt-4">
                            <label className="text-[8px] font-black text-primary/60 uppercase tracking-widest absolute top-1 left-0">CARGO / ESPECIALIDADE</label>
                            <input type="text" value={editData.role} onChange={(e) => setEditData({ ...editData, role: e.target.value })} className="text-sm font-black text-primary uppercase tracking-widest bg-transparent border-b border-primary/20 outline-none w-full py-2 sm:py-2 lg:py-2 focus:border-primary transition-all" />
                          </div>
                        </div>
                      </div>

                      <div className="bg-surface-dark border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[40px] p-8 sm:p-8 lg:p-8 lg:p-10 sm:p-10 lg:p-10 space-y-8 shadow-2xl">
                        <div className="space-y-4">
                          <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3 lg:gap-3">
                            <span className="material-symbols-outlined text-primary text-lg">key</span>
                            Credenciais de Logística
                          </p>
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-2">E-mail Aura</label>
                              <input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className="w-full bg-background-dark border border-white/5 rounded-2xl p-5 sm:p-5 lg:p-5 text-white text-sm font-bold italic outline-none focus:border-primary/40 transition-all" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[8px] font-black text-primary uppercase tracking-widest ml-2">Redefinir Senha</label>
                              <input type="password" value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} placeholder="•••••••• (deixe vazio para manter)" className="w-full bg-background-dark border border-primary/10 rounded-2xl p-5 sm:p-5 lg:p-5 text-white text-sm font-bold italic outline-none focus:border-primary transition-all placeholder:text-white/10" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-8">
                        <div className="bg-surface-dark border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[32px] p-8 sm:p-8 lg:p-8 shadow-xl">
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Meta Produtiva</p>
                          <div className="flex items-center gap-4 lg:gap-4">
                            <input type="number" value={editData.productivity} onChange={(e) => setEditData({ ...editData, productivity: parseInt(e.target.value) || 0 })} className="text-4xl lg:text-4xl font-display font-black text-primary italic bg-transparent outline-none w-full" />
                            <span className="text-2xl lg:text-2xl font-display font-black text-primary/40 italic">%</span>
                          </div>
                        </div>
                        <div className="bg-surface-dark border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[32px] p-8 sm:p-8 lg:p-8 shadow-xl">
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Comissão Base</p>
                          <div className="flex items-center gap-4 lg:gap-4">
                            <input type="number" value={editData.comissao} onChange={(e) => setEditData({ ...editData, comissao: parseInt(e.target.value) || 0 })} className="text-4xl lg:text-4xl font-display font-black text-white italic bg-transparent outline-none w-full" />
                            <span className="text-2xl lg:text-2xl font-display font-black text-white/20 italic">%</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-surface-dark/60 border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[40px] p-8 sm:p-8 lg:p-8 lg:p-10 sm:p-10 lg:p-10 shadow-2xl">
                        <p className="text-[10px] font-black text-white uppercase tracking-[0.4em] mb-8 text-center lg:text-left">Status do Estúdio</p>
                        <div className="flex gap-6 lg:gap-6">
                          <button onClick={() => setEditData({ ...editData, status: 'active' })} className={`flex-1 h-20 rounded-3xl border-2 flex items-center justify-center gap-3 lg:gap-3 transition-all ${editData.status === 'active' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-white/5 text-slate-700 hover:border-white/10'}`}>
                            <span className="material-symbols-outlined text-xl">check_circle</span>
                            <span className="text-[11px] font-black uppercase tracking-widest">Ativo</span>
                          </button>
                          <button onClick={() => setEditData({ ...editData, status: 'away' })} className={`flex-1 h-20 rounded-3xl border-2 flex items-center justify-center gap-3 lg:gap-3 transition-all ${editData.status === 'away' ? 'bg-red-500/10 border-red-500 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.1)]' : 'border-white/5 text-slate-700 hover:border-white/10'}`}>
                            <span className="material-symbols-outlined text-xl">block</span>
                            <span className="text-[11px] font-black uppercase tracking-widest">Ausente</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-10 animate-fade-in pb-20">
                      <div className="gold-gradient p-10 sm:p-10 lg:p-10 rounded-2xl sm:rounded-3xl lg:rounded-[40px] shadow-gold-sm">
                        <div className="flex items-center gap-6 lg:gap-6 mb-4">
                          <div className="size-10 sm:size-12 lg:size-12 rounded-2xl bg-background-dark/30 flex items-center justify-center text-background-dark">
                            <span className="material-symbols-outlined text-2xl lg:text-2xl font-black">auto_awesome</span>
                          </div>
                          <h4 className="text-sm font-black text-background-dark uppercase tracking-[0.4em]">Agenda de Alta Performance</h4>
                        </div>
                        <p className="text-[11px] text-background-dark/80 font-bold uppercase tracking-widest leading-relaxed">Personalize a disponibilidade única deste mestre aura. Se vazio, o sistema herda o horário geral da unidade.</p>
                      </div>

                      <div className="space-y-6">
                        {DAYS_OF_WEEK.map(({ key, label }) => {
                          const dayData = editData.horario_funcionamento?.[key] || { closed: true, open: '09:00', close: '18:00' };

                          const toggleDay = () => {
                            const newHours = { ...editData.horario_funcionamento };
                            newHours[key] = dayData.closed ? { closed: false, open: '09:00', close: '18:00' } : { ...dayData, closed: true };
                            setEditData({ ...editData, horario_funcionamento: newHours });
                          };

                          const updateTime = (field: 'open' | 'close', value: string) => {
                            const newHours = { ...editData.horario_funcionamento };
                            newHours[key] = { ...dayData, [field]: value };
                            setEditData({ ...editData, horario_funcionamento: newHours });
                          };

                          return (
                            <div key={key} className={`bg-surface-dark border p-8 sm:p-8 lg:p-8 rounded-2xl sm:rounded-3xl lg:rounded-[40px] transition-all ${!dayData.closed ? 'border-primary/20 shadow-3xl' : 'border-white/5 opacity-40 shadow-none'}`}>
                              <div className="flex items-center justify-between">
                                <span className={`text-[11px] font-black uppercase tracking-[0.3em] ${!dayData.closed ? 'text-white' : 'text-slate-700'}`}>{label}</span>
                                <button
                                  type="button"
                                  onClick={toggleDay}
                                  className={`relative w-16 h-8 rounded-full transition-all ${!dayData.closed ? 'gold-gradient' : 'bg-white/10'}`}
                                >
                                  <div className={`absolute top-1.5 size-5 rounded-full bg-background-dark shadow-2xl transition-all ${!dayData.closed ? 'left-9' : 'left-1.5'}`} />
                                </button>
                              </div>

                              {!dayData.closed && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-8 mt-8 animate-slide-up">
                                  <div className="space-y-3">
                                    <label className="text-[8px] font-black text-primary uppercase tracking-[0.2em] ml-2">Abertura Elite</label>
                                    <input
                                      type="time"
                                      value={dayData.open}
                                      onChange={(e) => updateTime('open', e.target.value)}
                                      className="w-full bg-background-dark border border-white/10 rounded-2xl p-5 sm:p-5 lg:p-5 text-white text-sm font-bold outline-none focus:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-3">
                                    <label className="text-[8px] font-black text-primary uppercase tracking-[0.2em] ml-2">Encerramento Elite</label>
                                    <input
                                      type="time"
                                      value={dayData.close}
                                      onChange={(e) => updateTime('close', e.target.value)}
                                      className="w-full bg-background-dark border border-white/10 rounded-2xl p-5 sm:p-5 lg:p-5 text-white text-sm font-bold outline-none focus:border-primary"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-10 sm:p-10 lg:p-10 bg-gradient-to-t from-background-dark via-background-dark to-transparent flex flex-col gap-6 lg:gap-6">
                  <button onClick={handleUpdate} className="w-full gold-gradient text-background-dark h-20 rounded-[28px] font-black uppercase tracking-[0.5em] text-[11px] lg:text-[12px] shadow-gold-sm active:scale-95 transition-all hover:brightness-110">
                    Sincronizar Atualizações
                  </button>
                  {activeEditTab === 'info' && (
                    <button onClick={handleDelete} className="w-full bg-red-500/10 border border-red-500/20 text-red-500 h-16 rounded-[22px] font-black uppercase tracking-[0.4em] text-[9px] active:scale-95 transition-all text-center">
                      Revogar Acesso do Artista
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal de Cadastro Completo Refinado */}
        {isAdding && (
          <div className="fixed inset-0 z-[100] bg-background-dark/95 backdrop-blur-3xl animate-fade-in flex flex-col items-center overflow-hidden">
            <div className="flex-1 flex flex-col max-w-full max-w-[600px] w-full h-full relative">
              <header className="px-10 sm:px-10 lg:px-10 pt-16 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-2xl lg:text-2xl lg:text-3xl lg:text-3xl font-display font-black text-white italic tracking-tighter uppercase">Integrar Especialista</h2>
                  <p className="text-[9px] text-primary font-black uppercase tracking-[0.4em] mt-2 leading-none">Novos Talentos Aura</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="size-10 sm:size-12 lg:size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                  <span className="material-symbols-outlined font-black">close</span>
                </button>
              </header>

              <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-10 sm:p-10 lg:p-10 space-y-12 pb-60 no-scrollbar min-h-0">
                <div className="flex flex-col items-center gap-6 lg:gap-6">
                  <div className="relative group shrink-0">
                    <div className="size-34 sm:size-36 lg:size-40 rounded-2xl sm:rounded-3xl lg:rounded-[50px] bg-cover bg-center border-2 border-dashed border-white/10 shadow-2xl overflow-hidden bg-surface-dark flex items-center justify-center relative" style={{ backgroundImage: newPro.image ? `url('${newPro.image}')` : 'none' }}>
                      {!newPro.image && <span className="material-symbols-outlined text-slate-700 text-4xl sm:text-5xl lg:text-6xl lg:text-4xl sm:text-5xl lg:text-6xl">person_add</span>}
                      <label htmlFor="new-pro-photo" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                        <span className="material-symbols-outlined text-white text-3xl lg:text-3xl font-black">add_a_photo</span>
                      </label>
                    </div>
                    <input type="file" id="new-pro-photo" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          setIsLoading(true);
                          const publicUrl = await api.storage.upload(file);
                          setNewPro({ ...newPro, image: publicUrl });
                          showNotification('success', 'Arte integrada!');
                        } catch (err) { showNotification('error', 'Falha no upload'); } finally { setIsLoading(false); }
                      }
                    }} />
                  </div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Curadoria Visual</p>
                </div>

                <div className="space-y-10">
                  <div className="relative">
                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest absolute -top-5 left-0">NOME COMPLETO</label>
                    <input type="text" required value={newPro.name} onChange={e => setNewPro({ ...newPro, name: e.target.value })} className="w-full bg-transparent border-b-2 border-white/5 p-4 sm:p-4 lg:p-4 text-white text-2xl lg:text-2xl font-display font-black italic outline-none focus:border-primary transition-all" placeholder="MASTER NOME" />
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-2xl sm:rounded-3xl lg:rounded-[40px] p-8 sm:p-8 lg:p-8 lg:p-10 sm:p-10 lg:p-10 space-y-8 shadow-2xl">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-4 text-center">Protocolo de Acesso Digital</p>
                      <div className="space-y-8">
                        <div className="space-y-2">
                          <label className="text-[8px] font-black text-primary/60 uppercase tracking-widest ml-4">E-mail Corporativo</label>
                          <input type="email" required value={newPro.email} onChange={e => setNewPro({ ...newPro, email: e.target.value })} className="w-full bg-background-dark border border-primary/10 rounded-2xl p-6 sm:p-6 lg:p-6 text-white text-sm font-bold italic outline-none focus:border-primary" placeholder="artista@aura.com" />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-6">
                          <div className="space-y-2">
                            <label className="text-[8px] font-black text-primary/60 uppercase tracking-widest ml-4">Senha Segura</label>
                            <div className="relative">
                              <input type={showPassword ? "text" : "password"} required value={newPro.password} onChange={e => setNewPro({ ...newPro, password: e.target.value })} className="w-full bg-background-dark border border-primary/10 rounded-2xl p-6 sm:p-6 lg:p-6 text-white text-sm font-bold italic outline-none focus:border-primary" placeholder="••••••••" />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500">
                                <span className="material-symbols-outlined text-sm">{showPassword ? 'visibility' : 'visibility_off'}</span>
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[8px] font-black text-primary/60 uppercase tracking-widest ml-4">Validar Senha</label>
                            <div className="relative">
                              <input type={showConfirmPassword ? "text" : "password"} required value={newPro.confirmPassword} onChange={e => setNewPro({ ...newPro, confirmPassword: e.target.value })} className="w-full bg-background-dark border border-primary/10 rounded-2xl p-6 sm:p-6 lg:p-6 text-white text-sm font-bold italic outline-none focus:border-primary" placeholder="••••••••" />
                              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500">
                                <span className="material-symbols-outlined text-sm">{showConfirmPassword ? 'visibility' : 'visibility_off'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative pt-6">
                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest absolute top-0 left-0">CARGO / ESPECIALIDADE</label>
                    <input type="text" required value={newPro.role} onChange={e => setNewPro({ ...newPro, role: e.target.value })} className="w-full bg-transparent border-b-2 border-white/5 p-4 sm:p-4 lg:p-4 text-white text-xl font-display font-black italic outline-none focus:border-primary" placeholder="EX: DESIGNER DE OLHARES" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-8">
                    <div className="bg-surface-dark border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[32px] p-8 sm:p-8 lg:p-8">
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Comissão %</p>
                      <input type="number" required value={newPro.comissao} onChange={e => setNewPro({ ...newPro, comissao: parseInt(e.target.value) })} className="text-4xl lg:text-4xl font-display font-black text-white italic bg-transparent outline-none w-full" />
                    </div>
                    <div className="bg-surface-dark border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[32px] p-8 sm:p-8 lg:p-8">
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Meta Prod %</p>
                      <input type="number" required value={newPro.productivity} onChange={e => setNewPro({ ...newPro, productivity: parseInt(e.target.value) })} className="text-4xl lg:text-4xl font-display font-black text-primary italic bg-transparent outline-none w-full" />
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-10 sm:p-10 lg:p-10 bg-gradient-to-t from-background-dark via-background-dark to-transparent">
                  <button type="submit" disabled={isLoading} className="w-full gold-gradient text-background-dark h-24 rounded-2xl sm:rounded-3xl lg:rounded-[32px] font-black shadow-[0_30px_70px_rgba(0,0,0,0.5)] uppercase tracking-[0.6em] text-[11px] lg:text-[13px] active:scale-95 transition-all hover:brightness-110">
                    {isLoading ? 'SINCRONIZANDO...' : 'FINALIZAR E ATIVAR ACESSO'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>

      {confirmDialog.show && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-8 sm:p-8 lg:p-8 animate-fade-in text-center">
          <div className="bg-surface-dark border border-white/10 rounded-2xl sm:rounded-3xl lg:rounded-[48px] p-12 sm:p-14 lg:p-16 sm:p-12 sm:p-14 lg:p-16 lg:p-12 sm:p-14 lg:p-16 max-w-sm w-full shadow-3xl">
            <div className="size-14 sm:size-16 lg:size-20 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-8 animate-pulse">
              <span className="material-symbols-outlined text-4xl lg:text-4xl">warning</span>
            </div>
            <h3 className="text-2xl lg:text-2xl font-display font-black text-white italic mb-4 uppercase tracking-tighter">{confirmDialog.title}</h3>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed mb-10">{confirmDialog.message}</p>
            <div className="flex flex-col gap-4 lg:gap-4">
              <button onClick={confirmDialog.onConfirm} className="w-full bg-red-500 text-white h-16 rounded-2xl font-black uppercase tracking-[0.4em] text-[10px] shadow-2xl active:scale-95 transition-all">Revogar e Excluir</button>
              <button onClick={() => setConfirmDialog({ ...confirmDialog, show: false })} className="w-full bg-white/5 border border-white/10 text-white h-16 rounded-2xl font-black uppercase tracking-[0.4em] text-[10px]">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {notification.show && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] animate-slide-up">
          <div className={`px-10 sm:px-10 lg:px-10 py-5 sm:py-5 lg:py-5 rounded-full border shadow-3xl backdrop-blur-xl flex items-center gap-4 lg:gap-4 ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
            <span className="material-symbols-outlined font-black">
              {notification.type === 'success' ? 'verified' : 'error'}
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
