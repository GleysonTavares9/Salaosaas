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
    role: 'Especialista',
    productivity: 0,
    rating: 5.0,
    status: 'active' as const,
    comissao: 50,
    image: 'https://i.pravatar.cc/150?u=pro_new'
  });

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
    if (!salonId) return;
    setIsLoading(true);

    try {
      // 1. Criar usuário no Auth usando instância temporária (Evita deslogar o admin)
      const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false }
      });

      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: newPro.email.trim(),
        password: newPro.password.trim(),
        options: {
          data: {
            role: 'pro',
            full_name: newPro.name.trim(),
            salon_id: salonId
          }
        }
      });

      if (authError) throw authError;
      const finalId = authData.user?.id;

      // FORÇAR CONFIRMAÇÃO: Como o gestor criou, validamos o e-mail no ato
      if (finalId) {
        await supabase.rpc('admin_update_user_auth', {
          target_user_id: finalId,
          new_email: newPro.email.trim(),
          new_password: newPro.password.trim()
        });
      }

      // 2. Criar registro na tabela professionals (Removendo a senha do payload da tabela)
      const { password, ...proDatabaseData } = newPro;

      const created = await api.professionals.create({
        ...proDatabaseData,
        salon_id: salonId,
        user_id: finalId
      });

      setTeam([created, ...team]);
      setIsAdding(false);
      showNotification('success', 'Artista cadastrado e acesso liberado!');

      setNewPro({
        name: '', email: '', password: '', role: 'Especialista',
        productivity: 0, rating: 5.0, status: 'active', comissao: 50,
        image: 'https://i.pravatar.cc/150?u=pro_new'
      });

    } catch (error: any) {
      console.error("Erro ao cadastrar:", error);
      showNotification('error', "Erro ao cadastrar: " + (error.message || "Erro desconhecido"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedProId) return;
    setIsLoading(true);
    try {
      const selectedPro = team.find(p => p.id === selectedProId);
      if (!selectedPro) throw new Error("Artista não encontrado.");

      const { password, email, ...proUpdateFields } = editData;
      let finalUserId = selectedPro.user_id;

      // 1. CURA AUTOMÁTICA: Se não tem user_id, vamos criar o acesso agora
      if (!finalUserId) {
        if (!password) {
          throw new Error("Este artista não tem acesso. Digite uma SENHA para gerar o login dele agora.");
        }

        const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false }
        });

        const { data: authData, error: authError } = await tempSupabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: { role: 'pro', full_name: editData.name.trim(), salon_id: salonId }
          }
        });

        if (authError) throw authError;
        finalUserId = authData.user?.id;

        // FORÇAR CONFIRMAÇÃO AUTOMÁTICA
        if (finalUserId) {
          await supabase.rpc('admin_update_user_auth', {
            target_user_id: finalUserId,
            new_email: email.trim(),
            new_password: password.trim()
          });
        }
      }
      // 2. SINCRONIZAÇÃO: Se já tem acesso, usamos o RPC para atualizar email/senha
      else if ((password && password.length > 0) || (email !== selectedPro.email)) {
        const { error: rpcError } = await supabase.rpc('admin_update_user_auth', {
          target_user_id: finalUserId,
          new_email: email !== selectedPro.email ? email.trim() : null,
          new_password: password || null
        });

        if (rpcError) throw new Error("Erro ao sincronizar acesso: " + rpcError.message);
      }

      // 3. ATUALIZAÇÃO DA TABELA: Salva os dados e garante o vínculo do user_id
      const updated = await api.professionals.update(selectedProId, {
        ...proUpdateFields,
        email: email.trim(),
        user_id: finalUserId
      });

      setTeam(prev => prev.map(p => p.id === selectedProId ? { ...p, ...updated } : p));
      setSelectedProId(null);
      showNotification('success', 'Cadastro e Acesso atualizados!');
    } catch (error: any) {
      console.error("Update Error:", error);
      showNotification('error', error.message || 'Erro ao atualizar.');
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
    <div className="flex-1 bg-background-dark min-h-screen">
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

      <main className="px-6 py-10 space-y-10 safe-area-bottom pb-40 no-scrollbar overflow-y-auto max-w-[450px] mx-auto">

        {/* KPI da Equipe (Restaurado) */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-surface-dark border border-white/5 rounded-[40px] p-6 shadow-xl relative overflow-hidden">
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Total Ativos</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-black text-white tracking-tight italic">{team.length}</span>
              <span className="text-[8px] font-black text-primary uppercase">Membros</span>
            </div>
          </div>
          <div className="bg-surface-dark border border-white/5 rounded-[40px] p-6 shadow-xl relative overflow-hidden">
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Média Prod.</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-black text-white tracking-tight italic">
                {team.length > 0 ? (team.reduce((acc, curr) => acc + (curr.productivity || 0), 0) / team.length).toFixed(0) : 0}%
              </span>
              <span className="text-[8px] font-black text-slate-500 uppercase">Geral</span>
            </div>
          </div>
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
                  <div key={pro.id} onClick={() => setSelectedProId(pro.id)} className="relative group bg-surface-dark/60 rounded-[40px] border border-white/5 p-6 shadow-2xl transition-all active:scale-[0.98] cursor-pointer">
                    <div className="flex gap-5">
                      <div className="relative shrink-0">
                        <div className="size-20 rounded-[28px] bg-cover bg-center border border-primary/20 shadow-xl overflow-hidden" style={{ backgroundImage: `url('${pro.image || "https://i.pravatar.cc/150?u=pro"}')` }} />
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 size-6 rounded-full border-4 border-surface-dark flex items-center justify-center">
                          <span className="material-symbols-outlined text-[10px] text-white font-black">check</span>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0">
                            <h4 className="text-lg font-display font-black text-white tracking-tight leading-tight italic truncate">{pro.name}</h4>
                            <div className="flex items-center gap-2 mt-1.5 ">
                              <p className="text-[9px] uppercase font-black tracking-widest text-primary">{pro.role || 'Profissional'}</p>
                              {!pro.user_id && (
                                <span className="text-[7px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded-full font-black uppercase">Sem Acesso</span>
                              )}
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-slate-500 text-lg group-hover:text-primary transition-colors">settings</span>
                        </div>
                        <div className="mt-4">
                          <div className="flex justify-between items-end mb-2">
                            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Produtividade</p>
                            <span className="text-[9px] font-black text-primary font-display italic">{pro.productivity || 0}%</span>
                          </div>
                          <div className="w-full h-1 bg-background-dark rounded-full overflow-hidden">
                            <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${pro.productivity || 0}%` }}></div>
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
            <div className="fixed inset-0 z-[70] bg-background-dark/95 backdrop-blur-xl animate-fade-in flex flex-col">
              <header className="p-8 flex items-center justify-between">
                <h2 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">Editar Perfil</h2>
                <button onClick={() => setSelectedProId(null)} className="text-slate-500">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar pb-32">
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
          );
        })()}

        {/* Modal de Cadastro (Com Senha e Anti-Logout) */}
        {isAdding && (
          <div className="fixed inset-0 z-[60] bg-background-dark/95 backdrop-blur-xl animate-fade-in flex flex-col">
            <header className="p-8 flex items-center justify-between">
              <h2 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">Novo Artista</h2>
              <button onClick={() => setIsAdding(false)} className="text-slate-500"><span className="material-symbols-outlined">close</span></button>
            </header>
            <form onSubmit={handleCreate} className="p-8 flex-1 overflow-y-auto space-y-6 no-scrollbar pb-32">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                <input type="text" required value={newPro.name} onChange={e => setNewPro({ ...newPro, name: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary" />
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">E-mail (Login)</label>
                  <input type="email" required value={newPro.email} onChange={e => setNewPro({ ...newPro, email: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Senha Inicial</label>
                  <input type="password" required value={newPro.password} onChange={e => setNewPro({ ...newPro, password: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary" placeholder="••••••••" />
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
        )}

        <div className="fixed bottom-[120px] left-8 right-8 z-40 max-w-[450px] mx-auto pointer-events-none">
          <button onClick={() => setIsAdding(true)} className="w-full gold-gradient text-background-dark font-black py-6 rounded-3xl shadow-2xl uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all pointer-events-auto">
            <span className="material-symbols-outlined text-xl font-black">person_add</span>
            Novo Artista
          </button>
        </div>
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
