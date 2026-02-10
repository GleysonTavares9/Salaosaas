
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
  const [conversation, setConversation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  // Pre-inicializa o áudio para evitar bloqueios no mobile
  const audioRef = useRef<HTMLAudioElement>(new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'));
  const isAudioPrimed = useRef(false);

  const primeAudio = useCallback(() => {
    if (!isAudioPrimed.current) {
      const audio = audioRef.current;
      audio.muted = true;
      audio.play().then(() => {
        audio.pause();
        audio.muted = false;
        isAudioPrimed.current = true;
        console.log("🔊 Áudio desbloqueado para este chat.");
        showToast("Som ativado para esta conversa", "success");
      }).catch((e) => {
        console.warn("Erro ao desbloquear áudio:", e);
      });
    }
  }, [showToast]);

  const playNotificationSound = useCallback(() => {
    try {
      console.log("🔊 Tentando tocar som de notificação...");
      const audio = audioRef.current;
      audio.currentTime = 0;
      audio.volume = 0.8;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => console.log("✅ Som reproduzido com sucesso."))
          .catch(e => {
            console.warn("❌ Android bloqueou o som. Clique na tela primeiro.", e);
          });
      }
    } catch (e) {
      console.error("Erro ao tocar áudio:", e);
    }
  }, []);

  useEffect(() => {
    if (id) {
      // 1. Carregar histórico (Prioridade Máxima)
      api.chat.getMessages(id).then(msgs => {
        setMessages(msgs || []);
        setIsLoading(false);
        api.chat.markAsRead(id); // Limpa as mensagens ao abrir
      }).catch(err => {
        console.error("Erro ao carregar mensagens:", err);
        setIsLoading(false);
      });

      // 2. Carregar info da conversa em paralelo (Opcional)
      if (userId) {
        api.chat.getConversations(userId).then(convs => {
          const conv = convs.find(c => c.id === id);
          if (conv) setConversation(conv);
        }).catch(err => console.warn("Erro ao carregar detalhes do contato:", err));
      }

      // 3. Inscrever em tempo real
      const channel = api.chat.subscribeToMessages(id, (payload) => {
        const newMessage = payload.new as ChatMessage;
        console.log("👤 Comparação de IDs para Som:", {
          remetente: newMessage.sender_id,
          meu_id: userId,
          match: newMessage.sender_id === userId
        });

        // Se a mensagem não for minha, toca o som e marca como lida
        if (newMessage.sender_id !== userId) {
          playNotificationSound();
          api.chat.markAsRead(id);
        }

        setMessages(prev => {
          // Evita duplicatas (id real vs tempId)
          const exists = prev.find(m => m.id === newMessage.id || (m as any).tempId === newMessage.id);
          if (exists) return prev;
          return [...prev, { ...newMessage, is_me: newMessage.sender_id === userId }];
        });
      });

      // Monitorar status da conexão
      channel.on('system', { event: '*' }, (payload: any) => {
        if (payload.status === 'SUBSCRIBED') setIsLive(true);
        else if (payload.status === 'CLOSED' || payload.status === 'CHANNEL_ERROR') setIsLive(false);
      });
      // Fallback: se o subscribe rodou, tentamos assumir que está tentando conectar
      setIsLive(true);

      return () => {
        console.log('🔌 Desconectando do canal de chat:', id);
        channel.unsubscribe();
      };
    }
  }, [id, userId, playNotificationSound]);


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

      // Forçar atualização do card na lista (Opcional, mas ajuda no Sync)
      api.chat.markAsRead(id);
    } catch (error: any) {
      // Remove mensagem temporária em caso de erro
      setMessages(prev => prev.filter(m => (m as any).tempId !== tempId));
      showToast("Erro ao enviar mensagem: " + error.message, 'error');
    }
  }, [messageText, id, userId, showToast]);

  return (
    <div className="flex-1 min-h-screen flex flex-col overflow-hidden bg-background-dark">
      <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-2xl px-6 pt-12 pb-8 border-b border-white/5">
        <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between px-2">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate(-1)} className="size-12 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-[20px] bg-primary/10 border border-primary/20 p-0.5 flex items-center justify-center text-primary overflow-hidden shadow-xl">
                {conversation?.participant_image ? (
                  <img src={conversation.participant_image} className="size-full rounded-[18px] object-cover" alt="" />
                ) : (
                  <span className="material-symbols-outlined text-3xl">account_circle</span>
                )}
              </div>
              <div className="text-left">
                <h3 className="text-xl font-display font-black text-white italic tracking-tight uppercase leading-tight">
                  {conversation?.participant_name || 'Carregando...'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`size-2 rounded-full ${isLive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`}></div>
                  <p className="text-[9px] text-primary font-black uppercase tracking-widest">
                    {isLive ? 'Canal Sincronizado' : 'Conectando à Aura...'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          {!isAudioPrimed.current && (
            <button
              onClick={primeAudio}
              className="px-6 py-3 bg-primary/10 border border-primary/20 rounded-full text-[9px] font-black text-primary uppercase tracking-[0.2em] hover:bg-primary hover:text-background-dark transition-all active:scale-95"
            >
              Ativar Áudio
            </button>
          )}
        </div>
      </header>

      <main
        ref={scrollRef}
        onClick={primeAudio}
        className="flex-1 overflow-y-auto p-6 lg:p-12 space-y-8 no-scrollbar pb-40"
      >
        <div className="max-w-[1000px] mx-auto w-full space-y-8">
          <div className="flex flex-col items-center gap-4 mb-12 opacity-30">
            <div className="h-0.5 w-12 bg-white/10"></div>
            <span className="text-[10px] font-black text-white uppercase tracking-[0.5em]">Experiência de Atendimento Elite</span>
            <div className="h-0.5 w-12 bg-white/10"></div>
          </div>

          {isLoading ? (
            <div className="py-20 text-center">
              <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === userId;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div className={`max-w-[85%] lg:max-w-[70%] px-6 lg:px-8 py-5 rounded-[40px] shadow-2xl transition-all relative ${isMe
                    ? 'gold-gradient text-background-dark font-display font-medium rounded-tr-sm'
                    : 'bg-surface-dark border border-white/5 text-slate-100 rounded-tl-sm'
                    }`}>
                    <p className="text-base lg:text-lg leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    <div className={`flex items-center gap-2 mt-3 opacity-40 text-[9px] font-black uppercase tracking-widest ${isMe ? 'text-background-dark' : 'text-slate-400'}`}>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && <span className="material-symbols-outlined text-[14px]">done_all</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 lg:p-10 bg-background-dark/80 backdrop-blur-2xl border-t border-white/5 z-50">
        <div className="max-w-[1000px] mx-auto w-full">
          <form onSubmit={handleSend} className="flex items-center gap-6">
            <div className="flex-1 relative group">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onFocus={primeAudio}
                placeholder="Esculpa sua mensagem..."
                className="w-full bg-surface-dark/40 border border-white/5 rounded-full py-6 px-8 text-base text-white placeholder:text-slate-600 focus:border-primary/40 focus:bg-surface-dark/60 outline-none transition-all shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)]"
              />
            </div>
            <button
              type="submit"
              disabled={!messageText.trim()}
              className="size-16 rounded-full gold-gradient flex items-center justify-center text-background-dark shadow-[0_10px_40px_rgba(193,165,113,0.3)] hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale disabled:scale-100"
            >
              <span className="material-symbols-outlined text-2xl font-black">send</span>
            </button>
          </form>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </footer>
    </div>
  );
};

export default ChatRoom;
