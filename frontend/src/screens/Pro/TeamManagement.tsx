import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Professional } from '../../types';
import { api } from '../../lib/api';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';

interface TeamManagementProps {
  salonId?: string;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ salonId }) => {
  const navigate = useNavigate();
  const [team, setTeam] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedProId, setSelectedProId] = useState<string | null>(null);

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

  const [editData, setEditData] = useState({
    name: '',
    role: '',
    productivity: 0,
    comissao: 0,
    status: 'active' as 'active' | 'away',
    image: '',
    email: '',
    password: ''
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
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [salonId]);

  useEffect(() => {
    if (selectedProId) {
      const selectedPro = team.find(p => p.id === selectedProId);
      if (selectedPro) {
        setEditData({
          name: selectedPro.name,
          role: selectedPro.role || '',
          productivity: selectedPro.productivity || 0,
          comissao: selectedPro.comissao || 0,
          status: selectedPro.status,
          image: selectedPro.image || '',
          email: selectedPro.email || '',
          password: '' // Reset para evitar conflitos
        });
      }
    }
  }, [selectedProId, team]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPro.password !== newPro.confirmPassword) {
      showNotification('error', "As senhas não coincidem.");
      return;
    }
    if (!salonId) return;
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
      console.log("Ativando God Mode para criação de acesso...");
      let finalId: string | undefined = undefined;

      try {
        const { data: v_user_id, error: rpcError } = await supabase.rpc('admin_manage_user_access', {
          p_email: cleanEmail,
          p_password: newPro.password.trim() || 'Aura@123456',
          p_full_name: newPro.name.trim()
        });

        if (rpcError) throw rpcError;
        finalId = v_user_id;
        console.log("Acesso garantido via RPC. ID:", finalId);
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
      console.error("Erro completo ao cadastrar:", error);
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
    console.log("Iniciando atualização do profissional:", selectedProId);

    try {
      const selectedPro = team.find(p => p.id === selectedProId);
      if (!selectedPro) throw new Error("Artista não encontrado no estado local.");

      const { password, email, ...proUpdateFields } = editData;
      const cleanEmail = email.trim().toLowerCase();

      // Estado inicial do vínculo de acesso
      let finalUserId: string | null = selectedPro.user_id || null;
      console.log("Dados atuais - Email:", cleanEmail, "User ID:", finalUserId);

      // --- PASSO 1: ATUALIZAR DADOS BÁSICOS (Sempre primeiro) ---
      const { data: updatedBasic, error: basicError } = await supabase
        .from('professionals')
        .update({ ...proUpdateFields, email: cleanEmail })
        .eq('id', selectedProId)
        .select()
        .maybeSingle();

      if (basicError) {
        console.error("Erro no Passo 1 (Dados Básicos):", basicError);
        throw new Error("Erro ao salvar dados básicos: " + basicError.message);
      }

      if (updatedBasic) {
        setTeam(prev => prev.map(p => p.id === selectedProId ? { ...p, ...updatedBasic } : p));
      }

      // --- PASSO 2: GESTÃO DE ACESSO (Somente se houver mudança ou nova senha) ---
      const emailChanged = cleanEmail !== selectedPro.email?.toLowerCase();
      const hasNewPassword = (password && password.length > 0);

      if (hasNewPassword || emailChanged) {
        console.log("Ativando God Mode para gestão de acesso...");
        try {
          // Chamada mestre que cria, atualiza e confirma o usuário em um só passo (Bypassa 429)
          const { data: v_user_id, error: rpcError } = await supabase.rpc('admin_manage_user_access', {
            p_email: cleanEmail,
            p_password: hasNewPassword ? password?.trim() : 'Aura@123456',
            p_full_name: editData.name.trim()
          });

          if (rpcError) throw rpcError;
          finalUserId = v_user_id;
          console.log("Acesso garantido via RPC. ID:", finalUserId);

          // C. Vincular ID ao registro do profissional (Com Sincronia Inteligente)
          if (finalUserId && finalUserId !== selectedPro.user_id) {
            console.log("Sincronizando vínculo com o servidor...");
            const { error: linkError } = await supabase.rpc('safe_link_professional', {
              p_pro_id: selectedProId,
              p_user_id: finalUserId
            });

            if (linkError) {
              console.error("Falha na sincronia final:", linkError);
              await supabase.from('professionals').update({ user_id: finalUserId }).eq('id', selectedProId);
            }

            setTeam(prev => prev.map(p => p.id === selectedProId ? { ...p, user_id: finalUserId! } : p));
          }
        } catch (authError: any) {
          console.error("Erro no God Mode:", authError);
          showNotification('error', "Os dados foram salvos, mas o login não pôde ser ativado automaticamente.");
        }
      }

      setSelectedProId(null);
      showNotification('success', 'Cadastro atualizado com sucesso!');

    } catch (error: any) {
      console.error("Erro fatal no update:", error);
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
    <div className="flex-1 bg-background-dark overflow-y-auto h-full no-scrollbar">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-xl px-6 pt-12 pb-6 border-b border-white/5 flex items-center justify-between">
        <button onClick={() => navigate('/pro')} className="size-10 rounded-full border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-xl font-display font-black text-white italic tracking-tighter uppercase leading-none text-center">Gestão de Talentos</h1>
          <p className="text-primary text-[8px] font-black uppercase tracking-[0.2em] mt-1 text-center">Artistas da Unidade</p>
        </div>
        <div className="size-10"></div>
      </header>

      <main className="px-6 py-10 space-y-10 safe-area-bottom pb-40 max-w-[450px] mx-auto">

        {/* KPI da Equipe (Standardized) */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-surface-dark/40 border border-white/5 rounded-[32px] p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-4xl">groups</span>
            </div>
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Equipe Ativa</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-black text-white tracking-tight italic">{team.length}</span>
              <span className="text-[8px] font-black text-primary uppercase">Artistas</span>
            </div>
          </div>
          <div className="bg-surface-dark/40 border border-white/5 rounded-[32px] p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-4xl">analytics</span>
            </div>
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Média Prod.</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-black text-white tracking-tight italic">
                {team.length > 0 ? (team.reduce((acc, curr) => acc + (curr.productivity || 0), 0) / team.length).toFixed(0) : 0}%
              </span>
              <span className="text-[8px] font-black text-slate-500 uppercase">Geral</span>
            </div>
          </div>
        </section>

        <section>
          <button
            onClick={() => setIsAdding(true)}
            className="w-full bg-white/5 border border-dashed border-white/10 rounded-[32px] py-10 flex flex-col items-center justify-center gap-4 group hover:border-primary/20 hover:bg-white/[0.07] transition-all active:scale-[0.98]"
          >
            <div className="size-14 rounded-full gold-gradient flex items-center justify-center text-background-dark shadow-xl shadow-primary/20 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-2xl font-black">person_add</span>
            </div>
            <span className="text-[11px] font-black text-white uppercase tracking-[0.4em]">Contratar Novo Artista</span>
          </button>
        </section>

        {/* Lista de Profissionais */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] uppercase font-black tracking-[0.25em] text-primary">Artistas & Parceiros</h3>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Base de Dados</span>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="py-20 text-center flex flex-col items-center">
                <div className="size-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                {team.map(pro => (
                  <div key={pro.id} onClick={() => setSelectedProId(pro.id)} className="relative group bg-surface-dark/60 rounded-[32px] border border-white/5 p-5 shadow-2xl transition-all active:scale-[0.98] cursor-pointer hover:border-primary/20">
                    <div className="flex gap-5">
                      <div className="relative shrink-0">
                        <div className="size-24 rounded-2xl bg-cover bg-center border border-white/5 shadow-xl overflow-hidden grayscale-[0.3] group-hover:grayscale-0 transition-all duration-700" style={{ backgroundImage: `url('${pro.image || "https://i.pravatar.cc/150?u=pro"}')` }}>
                          <div className="absolute inset-x-0 bottom-0 bg-black/40 backdrop-blur-md py-1">
                            <p className="text-[7px] text-emerald-400 font-black text-center uppercase tracking-widest leading-none">Status: {pro.status === 'active' ? 'ON' : 'OFF'}</p>
                          </div>
                        </div>
                        {pro.status === 'active' && (
                          <div className="absolute -top-1 -right-1 bg-emerald-500 size-4 rounded-full border-2 border-surface-dark shadow-lg shadow-emerald-500/40"></div>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col justify-center py-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <div className="min-w-0">
                            <h4 className="text-base font-display font-black text-white tracking-tight uppercase leading-tight italic truncate">{pro.name}</h4>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[8px] uppercase font-black tracking-[0.2em] text-primary">{pro.role || 'Profissional'}</span>
                              {!pro.user_id && (
                                <span className="text-[7px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-lg font-black uppercase border border-red-500/10">Sem Login</span>
                              )}
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-slate-600 text-lg group-hover:text-primary transition-colors">tune</span>
                        </div>
                        <div className="mt-2">
                          <div className="flex justify-between items-end mb-1.5">
                            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Produtividade Semanal</p>
                            <span className="text-[10px] font-black text-primary font-display italic">{pro.productivity || 0}%</span>
                          </div>
                          <div className="w-full h-1 bg-background-dark/50 rounded-full overflow-hidden border border-white/5">
                            <div className="bg-primary h-full transition-all duration-1000 shadow-[0_0_10px_rgba(193,165,113,0.5)]" style={{ width: `${pro.productivity || 0}%` }}></div>
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

        {/* Modal de Edição (Restaurado Completo) */}
        {selectedProId && (() => {
          const selectedPro = team.find(p => p.id === selectedProId);
          if (!selectedPro) return null;
          return (
            <div className="fixed inset-0 z-[70] bg-background-dark/95 backdrop-blur-xl animate-fade-in flex flex-col items-center overflow-hidden">
              <div className="flex-1 flex flex-col bg-background-dark max-w-[450px] w-full h-full">
                <header className="p-8 flex items-center justify-between">
                  <h2 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">Editar Perfil</h2>
                  <button onClick={() => setSelectedProId(null)} className="text-slate-500">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </header>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 pb-40 min-h-0">
                  <div className="flex items-center gap-6">
                    <div className="relative group shrink-0">
                      <div className="size-24 rounded-3xl bg-cover bg-center border-2 border-primary/20 shadow-xl overflow-hidden" style={{ backgroundImage: `url('${editData.image}')` }}>
                        <label htmlFor="edit-pro-photo" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <span className="material-symbols-outlined text-white text-xl">add_a_photo</span>
                        </label>
                      </div>
                      <input type="file" id="edit-pro-photo" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const publicUrl = await api.storage.upload(file);
                            setEditData({ ...editData, image: publicUrl });
                            showNotification('success', 'Foto atualizada!');
                          } catch (err) { showNotification('error', 'Falha no upload'); }
                        }
                      }} />
                    </div>
                    <div className="flex-1">
                      <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="text-2xl font-display font-black text-white italic bg-transparent border-b border-white/20 outline-none w-full" />
                      <input type="text" value={editData.role} onChange={(e) => setEditData({ ...editData, role: e.target.value })} className="text-primary text-xs font-black uppercase tracking-widest mt-1 bg-transparent border-b border-primary/20 outline-none w-full shadow-none" />
                    </div>
                  </div>

                  <div className="bg-surface-dark border border-white/5 rounded-3xl p-6 space-y-5">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 leading-none">E-mail de Acesso</p>
                      <input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className="text-sm font-bold text-white italic bg-transparent border-b border-white/10 outline-none w-full py-1 focus:border-primary transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-1 leading-none">Alterar Senha (Login)</p>
                      <input type="password" value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} placeholder="•••••••• (vazio mantém a atual)" className="text-sm font-bold text-white italic bg-transparent border-b border-primary/20 outline-none w-full py-1 focus:border-primary transition-colors placeholder:text-white/20" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface-dark border border-white/5 rounded-3xl p-6">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Produtividade</p>
                      <input type="number" value={editData.productivity} onChange={(e) => setEditData({ ...editData, productivity: parseInt(e.target.value) || 0 })} className="text-3xl font-display font-black text-primary italic bg-transparent outline-none w-full" />
                    </div>
                    <div className="bg-surface-dark border border-white/5 rounded-3xl p-6">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Comissão %</p>
                      <input type="number" value={editData.comissao} onChange={(e) => setEditData({ ...editData, comissao: parseInt(e.target.value) || 0 })} className="text-3xl font-display font-black text-white italic bg-transparent outline-none w-full" />
                    </div>
                  </div>

                  <div className="bg-surface-dark border border-white/5 rounded-3xl p-6">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3">Status</p>
                    <div className="flex gap-4">
                      <button onClick={() => setEditData({ ...editData, status: 'active' })} className={`flex-1 p-4 rounded-2xl border transition-all ${editData.status === 'active' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'border-white/10 text-slate-500'}`}>
                        <span className="text-xs font-black uppercase">Ativo</span>
                      </button>
                      <button onClick={() => setEditData({ ...editData, status: 'away' })} className={`flex-1 p-4 rounded-2xl border transition-all ${editData.status === 'away' ? 'bg-red-500/10 border-red-500 text-red-400' : 'border-white/10 text-slate-500'}`}>
                        <span className="text-xs font-black uppercase">Ausente</span>
                      </button>
                    </div>
                  </div>

                  <button onClick={handleUpdate} className="w-full gold-gradient text-background-dark py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">Salvar Alterações</button>
                  <button onClick={handleDelete} className="w-full bg-red-500/10 border border-red-500/30 text-red-500 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all">Revogar Acesso</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal de Cadastro (Com Senha e Anti-Logout) */}
        {isAdding && (
          <div className="fixed inset-0 z-[60] bg-background-dark/95 backdrop-blur-xl animate-fade-in flex flex-col items-center overflow-hidden">
            <div className="flex-1 flex flex-col bg-background-dark max-w-[450px] w-full h-full">
              <header className="p-8 flex items-center justify-between">
                <h2 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">Novo Artista</h2>
                <button onClick={() => setIsAdding(false)} className="text-slate-500"><span className="material-symbols-outlined">close</span></button>
              </header>
              <form onSubmit={handleCreate} className="p-8 flex-1 overflow-y-auto space-y-6 pb-40 min-h-0">
                {/* Upload de Foto no Cadastro */}
                <div className="flex flex-col items-center gap-4 mb-8">
                  <div className="relative group shrink-0">
                    <div className="size-28 rounded-[40px] bg-cover bg-center border-2 border-primary/20 shadow-2xl overflow-hidden bg-surface-dark flex items-center justify-center" style={{ backgroundImage: newPro.image ? `url('${newPro.image}')` : 'none' }}>
                      {!newPro.image && <span className="material-symbols-outlined text-slate-700 text-4xl">person_add</span>}
                      <label htmlFor="new-pro-photo" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <span className="material-symbols-outlined text-white text-2xl">add_a_photo</span>
                      </label>
                    </div>
                    <input type="file" id="new-pro-photo" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          setIsLoading(true);
                          const publicUrl = await api.storage.upload(file);
                          setNewPro({ ...newPro, image: publicUrl });
                          showNotification('success', 'Foto carregada!');
                        } catch (err) {
                          showNotification('error', 'Falha no upload');
                        } finally {
                          setIsLoading(false);
                        }
                      }
                    }} />
                  </div>
                  <p className="text-[9px] font-black text-primary uppercase tracking-widest">Foto de Perfil (Opcional)</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input type="text" required value={newPro.name} onChange={e => setNewPro({ ...newPro, name: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary" />
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">E-mail (Login)</label>
                    <input type="email" required value={newPro.email} onChange={e => setNewPro({ ...newPro, email: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary" />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Senha Inicial</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={newPro.password}
                          onChange={e => setNewPro({ ...newPro, password: e.target.value })}
                          className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {showPassword ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Confirmar Senha</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          value={newPro.confirmPassword}
                          onChange={e => setNewPro({ ...newPro, confirmPassword: e.target.value })}
                          className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {showConfirmPassword ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cargo / Especialidade</label>
                  <input type="text" required value={newPro.role} onChange={e => setNewPro({ ...newPro, role: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Comissão %</label>
                    <input type="number" required value={newPro.comissao} onChange={e => setNewPro({ ...newPro, comissao: parseInt(e.target.value) })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Produtividade %</label>
                    <input type="number" required value={newPro.productivity} onChange={e => setNewPro({ ...newPro, productivity: parseInt(e.target.value) })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none" />
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs active:scale-95 transition-all">
                  {isLoading ? 'Contratando...' : 'Finalizar e Gerar Acesso'}
                </button>
              </form>
            </div>
          </div>
        )}

      </main>

      {confirmDialog.show && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in text-center">
          <div className="bg-surface-dark border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-display font-black text-white italic mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-400 text-sm mb-8">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog({ ...confirmDialog, show: false })} className="flex-1 bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]">Não</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]">Sim, Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {notification.show && (
        <div className="fixed top-6 left-6 right-6 z-[90] animate-slide-down">
          <div className={`p-5 rounded-2xl shadow-2xl border backdrop-blur-xl ${notification.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-500' : 'bg-red-500/20 border-red-500/30 text-red-500'}`}>
            <p className="font-bold text-sm text-center italic">{notification.message}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
