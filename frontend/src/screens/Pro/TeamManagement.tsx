
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Professional } from '../../types';
import { api } from '../../lib/api';

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
    image: ''
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
        setTeam(data);
        setIsLoading(false);
      });
    }
  }, [salonId]);

  // Sync editData when selectedProId changes
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
          image: selectedPro.image || ''
        });
      }
    }
  }, [selectedProId, team]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId) return;
    try {
      // O Admin cria o registro. Se o barbeiro logar com este email, eles são vinculados via o backend/trigger
      const created = await api.professionals.create({
        ...newPro,
        salon_id: salonId
      });
      setTeam([created, ...team]);
      setIsAdding(false);
      setNewPro({
        name: '',
        email: '',
        role: 'Especialista',
        productivity: 0,
        rating: 5.0,
        status: 'active',
        comissao: 50,
        image: 'https://i.pravatar.cc/150?u=pro_new'
      });
    } catch (error: any) {
      console.error("Error creating professional:", error);
      showNotification('error', "Erro ao adicionar artista: " + (error.message || error.error_description || 'Erro desconhecido'));
    }
  };

  const handleUpdate = async () => {
    if (!selectedProId) return;
    try {
      const updated = await api.professionals.update(selectedProId, editData);
      setTeam(prev => prev.map(p => p.id === selectedProId ? { ...p, ...updated } : p));
      setSelectedProId(null);
      showNotification('success', 'Artista atualizado com sucesso!');
    } catch (error: any) {
      console.error('Error updating professional:', error);
      showNotification('error', 'Erro ao atualizar: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedProId) return;

    setConfirmDialog({
      show: true,
      title: 'Excluir Artista',
      message: 'Tem certeza que deseja excluir este artista? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { } });
        try {
          await api.professionals.delete(selectedProId);
          setTeam(prev => prev.filter(p => p.id !== selectedProId));
          setSelectedProId(null);
          showNotification('success', 'Artista excluído com sucesso!');
        } catch (error: any) {
          console.error('Error deleting professional:', error);
          showNotification('error', 'Erro ao excluir: ' + error.message);
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
        {/* KPI da Equipe (Dinâmico) */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-surface-dark border border-white/5 rounded-[40px] p-6 shadow-xl relative overflow-hidden">
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Total Ativos</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-black text-white tracking-tight italic">{team.length}</span>
              <span className="text-[8px] font-black text-primary uppercase">Membros</span>
            </div>
          </div>
          <div className="bg-surface-dark border border-white/5 rounded-[40px] p-6 shadow-xl relative overflow-hidden">
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Média Unidade</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-black text-white tracking-tight italic">
                {team.length > 0 ? (team.reduce((acc, curr) => acc + (curr.productivity || 0), 0) / team.length).toFixed(0) : 0}%
              </span>
              <span className="text-[8px] font-black text-slate-500 uppercase">YLD</span>
            </div>
          </div>
        </section>

        {/* Lista de Profissionais */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] uppercase font-black tracking-[0.25em] text-primary">Artistas & Parceiros</h3>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Base de dados Real</span>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="py-20 text-center flex flex-col items-center">
                <div className="size-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                {team.map(pro => (
                  <div
                    key={pro.id}
                    onClick={() => setSelectedProId(pro.id)}
                    className="relative group bg-surface-dark/60 rounded-[40px] border border-white/5 p-6 shadow-2xl transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <div className="flex gap-5">
                      <div className="relative shrink-0">
                        <div
                          className="size-20 rounded-[28px] bg-cover bg-center border border-primary/20 shadow-xl grayscale-[0.2] group-hover:grayscale-0 transition-all"
                          style={{ backgroundImage: `url('${pro.image || "https://i.pravatar.cc/150?u=pro"}')` }}
                        />
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 size-6 rounded-full border-4 border-surface-dark flex items-center justify-center">
                          <span className="material-symbols-outlined text-[12px] text-white font-black">check</span>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0">
                            <h4 className="text-lg font-display font-black text-white tracking-tight leading-tight italic truncate">{pro.name}</h4>
                            <p className="text-[9px] uppercase font-black tracking-widest text-primary mt-1.5">{pro.role || 'Profissional'}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProId(pro.id);
                            }}
                            className="text-slate-500 hover:text-white transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">settings</span>
                          </button>
                        </div>
                        <div className="mt-4">
                          <div className="flex justify-between items-end mb-2">
                            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Meta de Produção</p>
                            <span className="text-[9px] font-black text-primary">{pro.productivity || 0}%</span>
                          </div>
                          <div className="w-full h-1 bg-background-dark rounded-full overflow-hidden">
                            <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${pro.productivity || 0}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {team.length === 0 && !isAdding && (
                  <div className="py-20 text-center flex flex-col items-center opacity-30">
                    <span className="material-symbols-outlined text-6xl mb-4">groups</span>
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhum artista cadastrado</p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Professional Profile Modal */}
        {selectedProId && (() => {
          const selectedPro = team.find(p => p.id === selectedProId);
          if (!selectedPro) return null;

          return (
            <div className="fixed inset-0 z-[70] bg-background-dark/95 backdrop-blur-xl animate-fade-in flex flex-col">
              <header className="p-8 flex items-center justify-between">
                <h2 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">Editar Artista</h2>
                <button onClick={() => setSelectedProId(null)} className="text-slate-500">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar pb-32">
                {/* Profile Header */}
                <div className="flex items-center gap-6">
                  <div className="size-24 rounded-3xl bg-cover bg-center border-2 border-primary/20 shadow-xl" style={{ backgroundImage: `url('${editData.image}')` }} />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="text-2xl font-display font-black text-white italic bg-transparent border-b border-white/20 outline-none focus:border-primary w-full"
                    />
                    <input
                      type="text"
                      value={editData.role}
                      onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                      className="text-primary text-xs font-black uppercase tracking-widest mt-1 bg-transparent border-b border-primary/20 outline-none focus:border-primary w-full"
                    />
                  </div>
                </div>

                {/* Editable Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-dark border border-white/5 rounded-3xl p-6">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Produtividade</p>
                    <input
                      type="number"
                      value={editData.productivity}
                      onChange={(e) => setEditData({ ...editData, productivity: parseInt(e.target.value) || 0 })}
                      className="text-3xl font-display font-black text-primary italic bg-transparent outline-none w-full"
                    />
                  </div>
                  <div className="bg-surface-dark border border-white/5 rounded-3xl p-6">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Comissão</p>
                    <input
                      type="number"
                      value={editData.comissao}
                      onChange={(e) => setEditData({ ...editData, comissao: parseInt(e.target.value) || 0 })}
                      className="text-3xl font-display font-black text-white italic bg-transparent outline-none w-full"
                    />
                  </div>
                </div>

                {/* Status Toggle */}
                <div className="bg-surface-dark border border-white/5 rounded-3xl p-6">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3">Status</p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setEditData({ ...editData, status: 'active' })}
                      className={`flex-1 p-4 rounded-2xl border transition-all ${editData.status === 'active' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'border-white/10 text-slate-500'}`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="size-3 rounded-full bg-emerald-500" />
                        <span className="text-xs font-black uppercase">Ativo</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setEditData({ ...editData, status: 'away' })}
                      className={`flex-1 p-4 rounded-2xl border transition-all ${editData.status === 'away' ? 'bg-slate-500/20 border-slate-500 text-slate-400' : 'border-white/10 text-slate-500'}`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="size-3 rounded-full bg-slate-500" />
                        <span className="text-xs font-black uppercase">Ausente</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleUpdate}
                  className="w-full gold-gradient text-background-dark py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
                >
                  Salvar Alterações
                </button>

                {/* Delete Button */}
                <button
                  onClick={handleDelete}
                  className="w-full bg-red-500/10 border border-red-500/30 text-red-500 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all hover:bg-red-500/20"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Excluir Artista
                  </div>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Overlay de Adicionar */}
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
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cargo / Especialidade</label>
                <input type="text" required value={newPro.role} onChange={e => setNewPro({ ...newPro, role: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail de Acesso (Login)</label>
                <input type="email" value={newPro.email} onChange={e => setNewPro({ ...newPro, email: e.target.value })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none" placeholder="barbeiro@exemplo.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Comissão (%)</label>
                  <input type="number" required value={newPro.comissao} onChange={e => setNewPro({ ...newPro, comissao: parseInt(e.target.value) })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Produção Inicial %</label>
                  <input type="number" required value={newPro.productivity} onChange={e => setNewPro({ ...newPro, productivity: parseInt(e.target.value) })} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 text-white text-sm outline-none" />
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Foto do Artista</label>
                <div className="flex items-center gap-6">
                  <div className="size-24 rounded-3xl bg-surface-dark border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {newPro.image ? (
                      <img src={newPro.image} className="size-full object-cover" alt="Preview" />
                    ) : (
                      <span className="material-symbols-outlined text-slate-700 text-3xl">add_a_photo</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      id="pro-photo"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const publicUrl = await api.storage.upload(file);
                            setNewPro({ ...newPro, image: publicUrl });
                          } catch (err: any) {
                            alert("Erro no upload: " + err.message);
                          }
                        }
                      }}
                    />
                    <label htmlFor="pro-photo" className="inline-block px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-white uppercase tracking-widest cursor-pointer hover:bg-white/10 active:scale-95 transition-all">
                      {newPro.image ? 'Alterar Foto' : 'Selecionar Arquivo'}
                    </label>
                    <p className="text-[7px] text-slate-600 font-bold uppercase tracking-widest">PNG, JPG ou WEBP (Máx 2MB)</p>
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs">Contratar Artista</button>
            </form>
          </div>
        )}

        {/* Botão de Adicionar Profissional */}
        <div className="fixed bottom-[120px] left-8 right-8 z-40 max-w-[450px] mx-auto pointer-events-none">
          <button onClick={() => setIsAdding(true)} className="w-full gold-gradient text-background-dark font-black py-6 rounded-3xl shadow-2xl uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all pointer-events-auto">
            <span className="material-symbols-outlined text-xl font-black">person_add</span>
            Novo Artista
          </button>
        </div>
      </main>

      {/* Confirmation Dialog Modal */}
      {confirmDialog.show && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-surface-dark border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-scale-in">
            <h3 className="text-xl font-display font-black text-white italic mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-400 text-sm mb-8">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { } })}
                className="flex-1 bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-lg"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification.show && (
        <div className="fixed top-6 left-6 right-6 z-[90] animate-slide-down">
          <div className={`p-5 rounded-2xl shadow-2xl border backdrop-blur-xl ${notification.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-500'
              : 'bg-red-500/20 border-red-500/30 text-red-500'
            }`}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">
                {notification.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <p className="flex-1 font-bold text-sm">{notification.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
