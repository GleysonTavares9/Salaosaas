
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Conversation } from '../../types';
import { api } from '../../lib/api';

interface ChatListProps {
  userId: string | null;
}

const ChatList: React.FC<ChatListProps> = ({ userId }) => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      // 1. Carregar inicial
      api.chat.getConversations(userId).then(data => {
        setConversations(data || []);
        setIsLoading(false);
      });

      // 2. Ouvir atualizações em tempo real (Novas mensagens mudam conversa)
      const channel = api.supabase
        .channel('public:conversations')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `user1_id=eq.${userId}`
        }, (payload) => {
          setConversations(prev => prev.map(c => c.id === payload.new.id ? {
            ...c,
            ...payload.new,
            unread_count: payload.new.user1_unread_count
          } : c));

          if (payload.new.user1_unread_count > (payload.old.user1_unread_count || 0)) {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
            audio.play().catch(() => { });
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `user2_id=eq.${userId}`
        }, (payload) => {
          setConversations(prev => prev.map(c => c.id === payload.new.id ? {
            ...c,
            ...payload.new,
            unread_count: payload.new.user2_unread_count
          } : c));

          if (payload.new.user2_unread_count > (payload.old.user2_unread_count || 0)) {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
            audio.play().catch(() => { });
          }
        })
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [userId]);

  return (
    <div className="flex-1 min-h-screen no-scrollbar overflow-y-auto bg-background-dark">
      <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-2xl px-6 pt-12 pb-8 border-b border-white/5">
        <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between px-2">
          <button onClick={() => navigate(-1)} className="size-12 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="text-center">
            <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none" style={{ fontSize: 'var(--step-1)' }}>Concierge Aura</h1>
            <p className="text-[7px] text-primary font-black uppercase tracking-[0.4em] mt-2">Atendimento de Elite</p>
          </div>
          <button className="size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary active:scale-90 transition-all group">
            <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">edit_square</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto w-full p-6 lg:p-12 space-y-10 safe-area-bottom">
        <div className="relative group max-w-2xl mx-auto">
          <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 text-2xl group-focus-within:text-primary transition-colors">search</span>
          <input
            type="text"
            placeholder="Busque por contatos ou mensagens..."
            className="w-full bg-surface-dark/40 border border-white/5 rounded-[32px] py-6 lg:py-7 pl-16 pr-8 text-sm lg:text-base text-white placeholder:text-slate-600 focus:border-primary/40 focus:bg-surface-dark/60 outline-none transition-all shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)]"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 auto-rows-min">
          {isLoading ? (
            <div className="col-span-full py-32 text-center">
              <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-6"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">Sincronizando Conversas...</p>
            </div>
          ) : (
            <>
              {conversations.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => navigate(`/chat/${chat.id}`)}
                  className={`w-full group rounded-[48px] p-8 lg:p-10 flex items-center gap-6 lg:gap-8 active:scale-[0.98] transition-all relative border-2 shadow-2xl ${chat.unread_count > 0
                    ? 'bg-primary border-white ring-8 ring-primary/5'
                    : 'bg-surface-dark/40 border-white/5 hover:bg-white/5 hover:border-white/10'}`}
                >
                  <div className="relative shrink-0">
                    <div className={`size-20 lg:size-24 rounded-[32px] lg:rounded-[40px] p-1 border-2 transition-all duration-500 ${chat.unread_count > 0 ? 'border-background-dark/20' : 'border-white/10 group-hover:border-primary/40'}`}>
                      <img src={chat.participant_image || "https://i.pravatar.cc/150?u=aura"} className="size-full rounded-[24px] lg:rounded-[32px] object-cover shadow-lg grayscale-[0.2] group-hover:grayscale-0 transition-all" alt={chat.participant_name} />
                    </div>
                    {chat.unread_count > 0 && (
                      <div className="absolute -top-2 -right-2 size-10 bg-background-dark rounded-full border-4 border-white flex items-center justify-center text-[14px] font-black text-white shadow-2xl animate-bounce z-20">
                        {chat.unread_count}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-left min-w-0 relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <h3 className={`text-xl font-display font-black italic tracking-tight truncate ${chat.unread_count > 0 ? 'text-background-dark' : 'text-white'}`}>
                        {chat.participant_name || "Membro Aura"}
                      </h3>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap self-start ${chat.unread_count > 0 ? 'bg-background-dark text-white' : 'text-slate-600 bg-white/5'}`}>
                        {chat.unread_count > 0 ? 'Mensagem Nova' : (chat.timestamp || "Agora")}
                      </span>
                    </div>
                    <p className={`text-sm lg:text-base line-clamp-1 italic ${chat.unread_count > 0 ? 'text-background-dark font-black' : 'text-slate-500 font-medium'}`}>
                      {chat.last_message || "Inicie um bate-papo exclusivo..."}
                    </p>
                  </div>
                </button>
              ))}

              {conversations.length === 0 && (
                <div className="col-span-full py-40 text-center flex flex-col items-center justify-center space-y-8 bg-surface-dark/20 border border-dashed border-white/10 rounded-[64px]">
                  <div className="size-24 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <span className="material-symbols-outlined text-6xl text-white/5">chat_bubble</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/20">Sem Mensagens Ativas</p>
                    <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">Inicie um ritual de conversa com nossos parceiros</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ChatList;
