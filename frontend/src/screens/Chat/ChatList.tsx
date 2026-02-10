
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
        <div className="max-w-[1000px] mx-auto w-full flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="size-10 sm:size-12 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="text-center">
            <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none" style={{ fontSize: 'var(--step-1)' }}>Concierge Aura</h1>
            <p className="text-[7px] text-primary font-black uppercase tracking-[0.4em] mt-1">Atendimento de Elite</p>
          </div>
          <button className="size-10 sm:size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary active:scale-90 transition-all group">
            <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">edit_square</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto w-full px-6 py-12 space-y-10 safe-area-bottom">
        <div className="relative group w-full">
          <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 text-2xl group-focus-within:text-primary transition-colors">search</span>
          <input
            type="text"
            placeholder="Busque por contatos ou mensagens..."
            className="w-full bg-surface-dark/40 border border-white/5 rounded-2xl py-6 pl-16 pr-8 text-sm lg:text-base text-white placeholder:text-slate-600 focus:border-primary/40 focus:bg-surface-dark/60 outline-none transition-all shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-min">
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
                  className={`w-full group rounded-[32px] p-6 flex items-center gap-6 active:scale-[0.98] transition-all relative border border-white/5 shadow-2xl ${chat.unread_count > 0
                    ? 'bg-primary border-white/20'
                    : 'bg-surface-dark/40 border-white/5 hover:bg-white/5 hover:border-white/10'}`}
                >
                  <div className="relative shrink-0">
                    <div className={`size-16 rounded-[24px] p-0.5 border transition-all duration-500 ${chat.unread_count > 0 ? 'border-background-dark/20' : 'border-white/10 group-hover:border-primary/40'}`}>
                      <img src={chat.participant_image || "https://i.pravatar.cc/150?u=aura"} className="size-full rounded-[22px] object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all" alt={chat.participant_name} />
                    </div>
                    {chat.unread_count > 0 && (
                      <div className="absolute -top-2 -right-2 size-8 bg-background-dark rounded-full border-2 border-white flex items-center justify-center text-[12px] font-black text-white shadow-2xl animate-bounce z-20">
                        {chat.unread_count}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-left min-w-0 relative z-10">
                    <div className="flex flex-col mb-1">
                      <h3 className={`text-lg font-display font-black italic tracking-tight truncate ${chat.unread_count > 0 ? 'text-background-dark' : 'text-white'}`}>
                        {chat.participant_name || "Membro Aura"}
                      </h3>
                      <span className={`text-[8px] font-black uppercase tracking-widest ${chat.unread_count > 0 ? 'text-background-dark/60' : 'text-slate-600'}`}>
                        {chat.unread_count > 0 ? 'Mensagem Nova' : (chat.timestamp || "Agora")}
                      </span>
                    </div>
                    <p className={`text-xs line-clamp-1 italic ${chat.unread_count > 0 ? 'text-background-dark font-black' : 'text-slate-500 font-medium'}`}>
                      {chat.last_message || "Inicie um exclusivo bate-papo..."}
                    </p>
                  </div>
                </button>
              ))}

              {conversations.length === 0 && (
                <div className="col-span-full py-24 text-center flex flex-col items-center justify-center space-y-6 bg-surface-dark/10 border border-dashed border-white/10 rounded-[48px]">
                  <div className="size-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-white/10">
                    <span className="material-symbols-outlined text-4xl">chat_bubble</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">Sem Mensagens Ativas</p>
                    <p className="text-[8px] font-bold text-slate-700 uppercase tracking-widest">Inicie um ritual de conversa com nossos parceiros</p>
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
