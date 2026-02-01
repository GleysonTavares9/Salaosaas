
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
      api.chat.getConversations(userId).then(data => {
        // Mapeamento simulado: No mundo real, buscaríamos os nomes no banco
        // Por agora, vamos garantir que o array exista
        setConversations(data || []);
        setIsLoading(false);
      });
    }
  }, [userId]);

  return (
    <div className="flex-1 bg-background-dark min-h-screen no-scrollbar overflow-y-auto">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-md px-6 pt-12 pb-6 border-b border-white/5 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="size-10 rounded-full border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">Concierge Aura</h1>
        <button className="size-10 rounded-full border border-white/10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined">edit_square</span>
        </button>
      </header>

      <main className="p-6 space-y-4 safe-area-bottom no-scrollbar overflow-y-auto">
        <div className="relative group mb-8">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
          <input
            type="text"
            placeholder="Buscar conversas..."
            className="w-full bg-surface-dark border border-white/5 rounded-[24px] py-4 pl-12 pr-4 text-[11px] font-bold text-white focus:border-primary/50 outline-none transition-all shadow-inner"
          />
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="py-10 text-center">
              <div className="size-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
            </div>
          ) : (
            <>
              {conversations.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => navigate(`/chat/${chat.id}`)}
                  className="w-full bg-surface-dark/40 border border-white/5 rounded-[40px] p-6 flex items-center gap-5 active:bg-white/5 transition-all group shadow-xl"
                >
                  <div className="relative shrink-0">
                    <img src={chat.participant_image || "https://i.pravatar.cc/150?u=aura"} className="size-16 rounded-[24px] object-cover border border-white/10 shadow-lg" alt={chat.participant_name} />
                    {chat.unread_count > 0 && (
                      <div className="absolute -top-1 -right-1 size-6 bg-primary rounded-full border-2 border-background-dark flex items-center justify-center text-[10px] font-black text-background-dark shadow-lg">
                        {chat.unread_count}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <h3 className="text-sm font-display font-black text-white group-hover:text-primary transition-colors italic tracking-tight truncate">{chat.participant_name || "Membro Aura"}</h3>
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{chat.timestamp || "Agora"}</span>
                    </div>
                    <p className={`text-[11px] line-clamp-1 italic ${chat.unread_count > 0 ? 'text-white font-black' : 'text-slate-500'}`}>
                      {chat.last_message || "Inicie um bate-papo..."}
                    </p>
                  </div>
                </button>
              ))}

              {conversations.length === 0 && (
                <div className="py-20 text-center flex flex-col items-center opacity-30">
                  <span className="material-symbols-outlined text-6xl mb-4">chat_bubble</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white leading-relaxed">Nenhuma conversa ativa no momento.<br />Fale com um de nossos parceiros.</p>
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
