

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { Professional } from '../../types';
import { useToast } from '../../contexts/ToastContext';

interface ProfileProps {
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ onLogout }) => {

  const navigate = useNavigate();
  const { showToast } = useToast();

  const [userData, setUserData] = useState<{ id: string, name: string, email: string, role: string, avatar_url?: string, phone?: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);


  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  // Notification States
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(true);

  const [proData, setProData] = useState<Professional | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Load persistencia
        const prefs = user.user_metadata.notification_preferences || {};
        setNotifyPush(prefs.push ?? true);
        setNotifyEmail(prefs.email ?? true);
        setNotifySms(prefs.sms ?? true);

        // Tenta buscar perfil completo do banco
        try {
          const profile = await api.profiles.getById(user.id);
          const name = profile?.full_name || user.user_metadata.nome || user.user_metadata.owner_name || 'Membro Aura';
          const avatar = profile?.avatar_url || user.user_metadata.avatar_url;
          const phone = profile?.phone || user.user_metadata.phone || '';
          const role = user.user_metadata.role || 'client';

          setUserData({
            id: user.id,
            name: name,
            email: user.email || '',
            role: role,
            avatar_url: avatar,
            phone: phone
          });
          setEditName(name);
          setEditPhone(phone);

          // Se for PRO, busca os dados da tabela professionals
          if (role === 'pro') {
            const { data: pData } = await supabase
              .from('professionals')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle();
            if (pData) setProData(pData);
          }

        } catch (err) {
          console.error("Erro ao buscar perfil:", err);
          setUserData({
            id: user.id,
            name: user.user_metadata.nome || 'Membro Aura',
            email: user.email || '',
            role: user.user_metadata.role || 'client',
            phone: user.user_metadata.phone || ''
          });
        }
      }
    };
    getUser();
  }, []);

  const handleSave = async () => {
    if (!userData || !editName.trim()) return;
    setIsSaving(true);
    try {
      // 1. Atualiza a tabela pública (profiles)
      await api.profiles.update(userData.id, {
        full_name: editName,
        phone: editPhone
      });

      // 2. Se for PRO, atualiza dados profissionais (como Status)
      if (userData.role === 'pro' && proData) {
        const { error: proError } = await supabase
          .from('professionals')
          .update({
            status: proData.status,
            // name: editName, // Sincroniza nome se necessário
          })
          .eq('user_id', userData.id);

        if (proError) throw proError;
      }

      // 3. Sincroniza com os metadados do Auth
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: editName,
          phone: editPhone
        }
      });

      if (authError) throw authError;

      // 4. Atualiza o estado local
      setUserData(prev => prev ? { ...prev, full_name: editName, phone: editPhone, name: editName } : null);
      setIsEditing(false);
      showToast("✨ Sua Aura foi atualizada com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      showToast("Erro ao atualizar perfil.", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarClick = () => { fileInputRef.current?.click(); };
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userData) return;

    try {
      const publicUrl = await api.storage.upload(file, 'avatars');
      await api.profiles.update(userData.id, { avatar_url: publicUrl });
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      setUserData(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
    } catch (error: any) {
      console.error("Erro no upload:", error);
      showToast("Erro ao enviar foto. Tente novamente.", 'error');
    }
  };

  // --- Persistence Handlers ---
  const toggleNotification = async (type: 'push' | 'email' | 'sms') => {
    let newPush = notifyPush;
    let newEmail = notifyEmail;
    let newSms = notifySms;

    if (type === 'push') { newPush = !notifyPush; setNotifyPush(newPush); }
    if (type === 'email') { newEmail = !notifyEmail; setNotifyEmail(newEmail); }
    if (type === 'sms') { newSms = !notifySms; setNotifySms(newSms); }

    try {
      await supabase.auth.updateUser({
        data: {
          notification_preferences: { push: newPush, email: newEmail, sms: newSms }
        }
      });
    } catch (err) {
      console.error("Erro ao salvar preferências:", err);
    }
  };

  const handleExportData = async () => {
    if (!userData) return;
    const confirmExport = window.confirm("Deseja baixar uma cópia dos seus dados?");
    if (!confirmExport) return;

    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.id).single();
      const { data: appointments } = await supabase.from('appointments').select('*').eq('client_id', userData.id);
      const { data: reviews } = await supabase.from('reviews').select('*').eq('client_id', userData.id);

      const exportPacket = { user_info: profile, history: appointments, feedback: reviews, exported_at: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(exportPacket, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aura_data_${userData.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Download iniciado com sucesso.", 'success');
    } catch (err: any) {
      showToast("Erro ao exportar dados.", 'error');
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("TEM CERTEZA? Essa ação não pode ser desfeita.")) return;
    if (!window.confirm("Sua conta será marcada para exclusão definitiva. Continuar?")) return;

    try {
      await supabase.auth.updateUser({
        data: { deletion_requested: true, deletion_requested_at: new Date().toISOString() }
      });
      showToast("Solicitação recebida. Sua conta será desativada em breve.", 'info');
      onLogout();
    } catch (err: any) {
      showToast("Erro ao solicitar exclusão.", 'error');
    }
  };

  return (
    <div className="flex-1 bg-background-dark h-full overflow-y-auto pb-32 no-scrollbar">
      {/* ... Header ... */}
      <header className="p-8 pt-20 flex flex-col items-center gap-6 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent">
        <div className="relative group">
          <div className="size-32 rounded-[40px] border-2 border-primary/30 p-1.5 bg-surface-dark shadow-2xl transition-all group-hover:border-primary/60">
            <div
              className="size-full rounded-[32px] bg-cover bg-center transition-all shadow-inner relative overflow-hidden"
              style={{
                backgroundImage: `url('${userData?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.name || 'Aura')}&background=c1a571&color=0c0d10&bold=true&size=200`}')`,
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
              />
            </div>
          </div>
          <button onClick={handleAvatarClick} className="absolute -bottom-2 -right-2 size-10 rounded-2xl bg-primary text-background-dark flex items-center justify-center shadow-lg active:scale-90 transition-all border-4 border-background-dark z-10">
            <span className="material-symbols-outlined text-lg font-black">{userData?.avatar_url ? 'photo_camera' : 'edit'}</span>
          </button>
        </div>

        <div className="text-center">
          <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 inline-block mb-3">
            <span className="text-[8px] font-black text-primary uppercase tracking-[0.3em]">
              {userData?.role === 'admin' ? 'Proprietário' : userData?.role === 'pro' ? (proData?.role || 'Artista') : 'Cliente Vip'}
            </span>
          </div>

          <h2 className="text-3xl font-display font-black text-white italic tracking-tighter uppercase leading-none">{userData?.name || 'Carregando...'}</h2>

          {userData?.role === 'pro' && proData && (
            <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mt-2 italic">{proData.role}</p>
          )}

          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1.5">{userData?.email}</p>
          {userData?.phone && <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">{userData.phone}</p>}
        </div>
      </header>

      <main className="px-8 py-10 space-y-10 safe-area-bottom pb-32 max-w-[450px] mx-auto animate-fade-in">
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em] ml-2">Preferências Elite</h3>
          <div className="bg-surface-dark/60 rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
            <button onClick={() => setIsEditing(true)} className="w-full p-7 flex justify-between items-center text-white text-sm font-bold border-b border-white/5 hover:bg-white/5 transition-all group">
              <div className="flex items-center gap-5">
                <span className="material-symbols-outlined text-primary text-2xl">account_circle</span>
                <span className="font-display italic text-lg tracking-tight">Editar Perfil</span>
              </div>
              <span className="material-symbols-outlined text-slate-700 group-hover:text-primary transition-colors">chevron_right</span>
            </button>

            <button onClick={() => setIsNotificationsOpen(true)} className="w-full p-7 flex justify-between items-center text-white text-sm font-bold border-b border-white/5 hover:bg-white/5 transition-all group">
              <div className="flex items-center gap-5">
                <span className="material-symbols-outlined text-primary text-2xl">notifications</span>
                <span className="font-display italic text-lg tracking-tight">Central de Notificações</span>
              </div>
              <span className="material-symbols-outlined text-slate-700 group-hover:text-primary transition-colors">chevron_right</span>
            </button>

            <button onClick={() => setIsPrivacyOpen(true)} className="w-full p-7 flex justify-between items-center text-white text-sm font-bold border-b border-white/5 hover:bg-white/5 transition-all group">
              <div className="flex items-center gap-5">
                <span className="material-symbols-outlined text-primary text-2xl">security</span>
                <span className="font-display italic text-lg tracking-tight">Privacidade & Dados</span>
              </div>
              <span className="material-symbols-outlined text-slate-700 group-hover:text-primary transition-colors">chevron_right</span>
            </button>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full mt-4 p-7 flex justify-center items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-[32px] text-red-500 text-[10px] font-black uppercase tracking-[0.4em] active:scale-95 transition-all shadow-xl"
        >
          <span className="material-symbols-outlined">logout</span>
          Desconectar sua Aura
        </button>

        <p className="text-center text-slate-900 text-[8px] font-black uppercase tracking-[0.8em] pt-8 opacity-40">Luxe Aura • Built for Excellence</p>
      </main>

      {/* MODAL EDIT PERFIL */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] bg-background-dark/95 backdrop-blur-2xl flex items-center justify-center p-8 animate-fade-in">
          <div className="w-full max-w-sm space-y-10">
            <div className="text-center">
              <h2 className="text-4xl font-display font-black text-white italic tracking-tighter mb-2">Editar <span className="text-primary italic">Perfil.</span></h2>
              {userData?.role === 'pro' && proData && (
                <p className="text-primary text-[10px] font-black uppercase tracking-widest italic">{proData.role}</p>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className="space-y-6"
            >
              {/* Nome e Telefone para Todos */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome de Exibição</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-surface-dark border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-primary shadow-inner" placeholder="Seu nome completo" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Telefone</label>
                <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full bg-surface-dark border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-primary shadow-inner" placeholder="(00) 00000-0000" />
              </div>

              {/* Campos Exclusivos de Profissional (Estilo Marco Aurélio) */}
              {userData?.role === 'pro' && proData && (
                <div className="animate-fade-in space-y-6">
                  <div className="bg-surface-dark border border-white/5 rounded-3xl p-6">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">E-mail de Acesso</p>
                    <p className="text-sm font-bold text-white/40 italic">{userData.email}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface-dark border border-white/5 rounded-3xl p-6">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Produtividade</p>
                      <p className="text-3xl font-display font-black text-primary italic leading-none">{proData.productivity || 0}</p>
                    </div>
                    <div className="bg-surface-dark border border-white/5 rounded-3xl p-6">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Comissão %</p>
                      <p className="text-3xl font-display font-black text-white italic leading-none">{proData.comissao || 0}</p>
                    </div>
                  </div>

                  <div className="bg-surface-dark border border-white/5 rounded-3xl p-6">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3">Minha Disponibilidade</p>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setProData({ ...proData, status: 'active' })}
                        className={`flex-1 p-4 rounded-2xl border transition-all ${proData.status === 'active' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'border-white/10 text-slate-500'}`}
                      >
                        <span className="text-xs font-black uppercase">Ativo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProData({ ...proData, status: 'away' })}
                        className={`flex-1 p-4 rounded-2xl border transition-all ${proData.status === 'away' ? 'bg-red-500/10 border-red-500 text-red-500' : 'border-white/10 text-slate-500'}`}
                      >
                        <span className="text-xs font-black uppercase">Ausente</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-4">
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-5 rounded-2xl border border-white/10 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-5 rounded-2xl gold-gradient text-background-dark text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-2xl">{isSaving ? 'Salvando...' : 'Confirmar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOTIFICAÇÕES */}
      {isNotificationsOpen && (
        <div className="fixed inset-0 z-[100] bg-background-dark/95 backdrop-blur-2xl flex items-center justify-center p-8 animate-fade-in">
          <div className="w-full max-w-sm space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-display font-black text-white italic tracking-tighter mb-2">Central de <span className="text-primary italic">Alertas.</span></h2>
              <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Personalize como a Aura fala com você</p>
            </div>

            <div className="space-y-4">
              <div onClick={() => toggleNotification('push')} className="bg-surface-dark border border-white/5 rounded-2xl p-5 flex items-center justify-between cursor-pointer active:scale-95 transition-all">
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${notifyPush ? 'text-white' : 'text-slate-500'}`}>Push Notifications</h4>
                  <p className="text-slate-500 text-[8px] font-medium mt-1">Lembretes de agendamentos no app</p>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${notifyPush ? 'bg-primary' : 'bg-white/10'}`}>
                  <div className={`absolute top-1 size-3 bg-background-dark rounded-full transition-all ${notifyPush ? 'right-1' : 'left-1 bg-white/40'}`}></div>
                </div>
              </div>
              <div onClick={() => toggleNotification('email')} className="bg-surface-dark border border-white/5 rounded-2xl p-5 flex items-center justify-between cursor-pointer active:scale-95 transition-all">
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${notifyEmail ? 'text-white' : 'text-slate-500'}`}>E-mail Marketing</h4>
                  <p className="text-slate-500 text-[8px] font-medium mt-1">Novidades e ofertas exclusivas</p>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${notifyEmail ? 'bg-primary' : 'bg-white/10'}`}>
                  <div className={`absolute top-1 size-3 bg-background-dark rounded-full transition-all ${notifyEmail ? 'right-1' : 'left-1 bg-white/40'}`}></div>
                </div>
              </div>
              <div onClick={() => toggleNotification('sms')} className="bg-surface-dark border border-white/5 rounded-2xl p-5 flex items-center justify-between cursor-pointer active:scale-95 transition-all">
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${notifySms ? 'text-white' : 'text-slate-500'}`}>SMS / WhatsApp</h4>
                  <p className="text-slate-500 text-[8px] font-medium mt-1">Confirmações importantes</p>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${notifySms ? 'bg-primary' : 'bg-white/10'}`}>
                  <div className={`absolute top-1 size-3 bg-background-dark rounded-full transition-all ${notifySms ? 'right-1' : 'left-1 bg-white/40'}`}></div>
                </div>
              </div>
            </div>
            <button onClick={() => setIsNotificationsOpen(false)} className="w-full py-5 rounded-2xl border border-white/10 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Fechar</button>
          </div>
        </div>
      )}

      {/* MODAL PRIVACIDADE */}
      {isPrivacyOpen && (
        <div className="fixed inset-0 z-[100] bg-background-dark/95 backdrop-blur-2xl flex items-center justify-center p-8 animate-fade-in">
          <div className="w-full max-w-sm space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-display font-black text-white italic tracking-tighter mb-2">Seus <span className="text-primary italic">Dados.</span></h2>
              <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Controle total sobre sua privacidade</p>
            </div>
            <div className="space-y-4">
              <button onClick={handleExportData} className="w-full bg-surface-dark border border-white/5 rounded-2xl p-5 flex items-center justify-between group active:scale-95 transition-all">
                <div>
                  <h4 className="text-white text-left text-xs font-bold uppercase tracking-wider group-hover:text-primary transition-colors">Exportar meus dados</h4>
                  <p className="text-slate-500 text-[8px] font-medium mt-1 text-left">Baixe uma cópia de tudo que sabemos</p>
                </div>
                <span className="material-symbols-outlined text-white/20 group-hover:text-primary">download</span>
              </button>
              <button onClick={handleDeleteAccount} className="w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-center justify-between group active:scale-95 transition-all">
                <div>
                  <h4 className="text-red-500 text-left text-xs font-bold uppercase tracking-wider">Excluir minha conta</h4>
                  <p className="text-red-400/60 text-[8px] font-medium mt-1 text-left">Ação irreversível. Adeus Aura.</p>
                </div>
                <span className="material-symbols-outlined text-red-500/50 group-hover:text-red-500">delete_forever</span>
              </button>
            </div>
            <p className="text-center text-slate-600 text-[8px] leading-relaxed px-4">
              A Aura segue rigorosamente a LGPD. Seus dados são criptografados e nunca vendidos a terceiros sem seu consentimento explícito.
            </p>
            <button onClick={() => setIsPrivacyOpen(false)} className="w-full py-5 rounded-2xl border border-white/10 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
