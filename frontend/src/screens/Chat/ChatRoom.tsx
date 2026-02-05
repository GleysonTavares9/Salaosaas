
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChatMessage } from '../../types';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

interface ChatRoomProps {
  userId: string | null;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ userId }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [messageText, setMessageText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      // 1. Carregar histórico
      api.chat.getMessages(id).then(data => {
        setMessages(data || []);
        setIsLoading(false);
      });

      // 2. Inscrever em tempo real
      const subscription = api.chat.subscribeToMessages(id, (payload) => {
        const newMessage = payload.new as ChatMessage;
        setMessages(prev => {
          // Evitar duplicados
          if (prev.find(m => m.id === newMessage.id || (m as any).tempId === newMessage.id)) return prev;
          return [...prev, { ...newMessage, is_me: newMessage.sender_id === userId }];
        });
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [id, userId]);

  useEffect(() => {
    // Scroll suave e otimizado
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !id || !userId) return;

    const textToSubmit = messageText;
    setMessageText('');

    // OPTIMISTIC UPDATE: Adiciona mensagem instantaneamente na UI
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId as any,
      conversation_id: id,
      sender_id: userId,
      text: textToSubmit,
      timestamp: new Date().toISOString(),
      is_me: true,
      tempId // Marca como temporária
    } as any;

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const sentMessage = await api.chat.sendMessage({
        conversation_id: id,
        sender_id: userId,
        text: textToSubmit
      });

      // Substitui mensagem temporária pela real
      setMessages(prev => prev.map(m =>
        (m as any).tempId === tempId ? { ...sentMessage, is_me: true } : m
      ));
    } catch (error: any) {
      // Remove mensagem temporária em caso de erro
      setMessages(prev => prev.filter(m => (m as any).tempId !== tempId));
      showToast("Erro ao enviar mensagem: " + error.message, 'error');
    }
  }, [messageText, id, userId, showToast]);

  return (
    <div className="flex-1 bg-background-dark min-h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-md px-6 pt-12 pb-6 border-b border-white/5 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="size-10 rounded-full border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-[14px] bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">account_circle</span>
          </div>
          <div>
            <h3 className="text-sm font-display font-black text-white italic tracking-tight">Concierge Aura</h3>
            <p className="text-[9px] text-primary font-black uppercase tracking-widest flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Sistema Online
            </p>
          </div>
        </div>
      </header>

      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-32"
      >
        <div className="text-center">
          <span className="text-[8px] font-black text-slate-700 uppercase tracking-[0.4em]">Canal de Atendimento Premium</span>
        </div>

        {isLoading ? (
          <div className="py-20 text-center">
            <div className="size-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === userId;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-5 py-4 rounded-[32px] shadow-2xl transition-all ${isMe
                  ? 'gold-gradient text-background-dark font-black rounded-tr-sm'
                  : 'bg-surface-dark border border-white/5 text-slate-100 rounded-tl-sm'
                  }`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <div className={`flex items-center gap-1.5 mt-2 opacity-40 text-[7px] font-black uppercase tracking-widest ${isMe ? 'text-background-dark' : 'text-slate-400'}`}>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && <span className="material-symbols-outlined text-[10px]">done_all</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-background-dark/95 backdrop-blur-xl border-t border-white/5 max-w-[450px] mx-auto z-50">
        <form onSubmit={handleSend} className="flex items-center gap-4">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Digite sua mensagem premium..."
            className="flex-1 bg-surface-dark border border-white/5 rounded-[24px] py-4 px-6 text-sm text-white focus:border-primary/50 outline-none transition-all shadow-inner"
          />
          <button
            type="submit"
            className="size-12 rounded-2xl gold-gradient flex items-center justify-center text-background-dark shadow-xl active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined font-black">send</span>
          </button>
        </form>
      </footer>
    </div>
  );
};

export default ChatRoom;
