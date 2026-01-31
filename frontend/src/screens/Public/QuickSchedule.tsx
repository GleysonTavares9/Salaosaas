
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { Salon, Service, Professional } from '../../types';

type Step = 'LOADING' | 'WELCOME' | 'PHONE' | 'AUTH_CHECK' | 'PASSWORD' | 'REGISTER_NAME' | 'REGISTER_EMAIL' | 'REGISTER_PASSWORD' | 'SERVICES' | 'PROFESSIONAL' | 'TIME' | 'CONFIRM' | 'SUCCESS';

interface Message {
    id: string;
    text: React.ReactNode;
    sender: 'bot' | 'user';
}

const QuickSchedule: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [salon, setSalon] = useState<Salon | null>(null);
    const [step, setStep] = useState<Step>('LOADING');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [userData, setUserData] = useState({ phone: '', email: '', name: '', password: '' });

    const [services, setServices] = useState<Service[]>([]);
    const [selectedService, setSelectedService] = useState<Service | null>(null);

    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [selectedPro, setSelectedPro] = useState<Professional | null>(null);

    const [selectedTime, setSelectedTime] = useState('');
    const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD

    const scrollRef = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);

    // Carregar Salão
    useEffect(() => {
        if (slug && !initialized.current) {
            initialized.current = true;
            api.salons.getBySlug(slug).then(async (data) => {
                setSalon(data);
                setStep('WELCOME');
                addBotMessage(`Olá! Bem-vindo ao *${data.nome}*. ✨`);
                setTimeout(() => {
                    addBotMessage("Sou seu assistente virtual. Vamos agendar seu horário?");
                    setTimeout(() => {
                        addBotMessage("Para começar, por favor digite seu **número de celular** (com DDD).");
                        setStep('PHONE');
                    }, 600);
                }, 800);

                // Preload Services
                api.services.getBySalon(data.id).then(setServices);
                // Preload Pros
                api.professionals.getBySalon(data.id).then(setProfessionals);
            }).catch(() => {
                addBotMessage("Ops! Salão não encontrado.");
            });
        }
    }, [slug]);

    // Auto-scroll
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, step]); // Scroll também quando mudar passo

    const addBotMessage = (text: React.ReactNode) => {
        setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'bot' }]);
    };

    const addUserMessage = (text: string) => {
        setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'user' }]);
    };

    const handleSend = async () => {
        if (!inputValue.trim()) return;
        const text = inputValue.trim();
        setInputValue('');
        addUserMessage(text);
        processInput(text);
    };

    const processInput = async (text: string) => {
        switch (step) {
            case 'PHONE':
                setUserData(prev => ({ ...prev, phone: text }));
                addBotMessage("Verificando cadastro... 🔍");
                const { data: profiles } = await supabase.from('profiles').select('email').eq('phone', text).maybeSingle();
                if (profiles?.email) {
                    setUserData(prev => ({ ...prev, email: profiles.email }));
                    setTimeout(() => {
                        addBotMessage(`Olá de volta! (${profiles.email})`);
                        addBotMessage("Digite sua **senha** para entrar.");
                        setStep('PASSWORD');
                    }, 1000);
                } else {
                    setTimeout(() => {
                        addBotMessage("Parece que é sua primeira vez aqui! Vamos criar seu cadastro rápido. 🚀");
                        addBotMessage("Qual seu **Nome Completo**?");
                        setStep('REGISTER_NAME');
                    }, 1000);
                }
                break;
            case 'PASSWORD':
                const { error: loginError } = await supabase.auth.signInWithPassword({ email: userData.email, password: text });
                if (loginError) addBotMessage("Senha incorreta. Tente novamente.");
                else {
                    addBotMessage("Login realizado! 🔓");
                    showServices();
                }
                break;
            case 'REGISTER_NAME':
                setUserData(prev => ({ ...prev, name: text }));
                addBotMessage(`Prazer, ${text}! Qual seu melhor **E-mail**?`);
                setStep('REGISTER_EMAIL');
                break;
            case 'REGISTER_EMAIL':
                setUserData(prev => ({ ...prev, email: text }));
                addBotMessage("Escolha uma **senha** segura:");
                setStep('REGISTER_PASSWORD');
                break;
            case 'REGISTER_PASSWORD':
                setUserData(prev => ({ ...prev, password: text }));
                addBotMessage("Criando conta...");
                const { error: signUpError } = await supabase.auth.signUp({
                    email: userData.email, password: text,
                    options: { data: { full_name: userData.name, phone: userData.phone, role: 'client' } }
                });
                if (signUpError) {
                    addBotMessage("Erro: " + signUpError.message);
                    setStep('REGISTER_EMAIL');
                } else {
                    addBotMessage("Conta criada com sucesso! 🎉");
                    showServices();
                }
                break;
            case 'CONFIRM':
                if (text.toLowerCase() === 'sim' || text.toLowerCase() === 'confirmar') {
                    finalizeBooking();
                } else {
                    addBotMessage("Agendamento cancelado. Digite 'sim' para confirmar ou recarregue para recomeçar.");
                }
                break;
        }
    };

    const showServices = () => {
        setStep('SERVICES');
        setTimeout(() => {
            addBotMessage("Selecione o **serviço** desejado:");
        }, 500);
    };

    const handleServiceSelect = (service: Service) => {
        setSelectedService(service);
        addUserMessage(service.name);
        setStep('PROFESSIONAL');
        setTimeout(() => {
            addBotMessage(`Quem você prefere para realizar **${service.name}**?`);
        }, 500);
    };

    const handleProSelect = (pro: Professional) => {
        setSelectedPro(pro);
        addUserMessage(pro.nome);
        setStep('TIME');
        setTimeout(() => {
            addBotMessage(`Para quando deseja agendar com **${pro.nome}**?`);
            // Gerar dias (Hoje e Amanhã)
            const today = new Date().toISOString().split('T')[0];
            setSelectedDate(today);
        }, 500);
    };

    const handleTimeSelect = (time: string) => {
        setSelectedTime(time);
        addUserMessage(`Às ${time}`);
        setStep('CONFIRM');
        setTimeout(() => {
            addBotMessage(`📝 **Resumo do Agendamento:**\n\n• **Serviço:** ${selectedService?.name}\n• **Profissional:** ${selectedPro?.nome}\n• **Data:** ${selectedDate}\n• **Horário:** ${time}\n• **Valor:** R$ ${selectedService?.price},00\n\nConfirma o agendamento? (Sim/Não)`);
        }, 500);
    };

    const finalizeBooking = async () => {
        addBotMessage("Processando agendamento...");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !selectedService || !selectedPro || !salon) return;

        const { error } = await api.appointments.create({
            client_id: user.id,
            salon_id: salon.id,
            date: selectedDate,
            time: selectedTime,
            status: 'pending',
            services: selectedService, // A API espera array ou objeto stringify? Types diz Service[] ou JSON. Ajustando...
            professional_id: selectedPro.id,
            valor: selectedService.price,
            duration_minutes: selectedService.duration_minutes || 60
        } as any);

        if (error) {
            addBotMessage("Erro ao agendar: " + error.message);
        } else {
            setStep('SUCCESS');
            addBotMessage("✅ **Agendamento Confirmado!**\n\nTe esperamos lá! Você receberá um lembrete um dia antes.");
        }
    };

    // Generate Slots Mock (Simplificado para MVP)
    const generateSlots = () => {
        return ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    };

    const renderMessageText = (text: string) => {
        return <span dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, '<b class="text-gold-400 font-bold">$1</b>').replace(/\n/g, '<br/>') }} />;
    };

    return (
        <div className="flex flex-col h-screen bg-[#0f0f10] text-white font-sans overflow-hidden">
            {/* Header Premium */}
            <header className="px-6 py-4 bg-surface-dark/95 backdrop-blur-xl border-b border-white/5 flex items-center justify-between shadow-2xl z-20">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        {salon?.logo_url ? (
                            <img src={salon.logo_url} className="w-10 h-10 rounded-full object-cover border border-gold-500 shadow-gold-glow" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gold-gradient flex items-center justify-center font-bold text-black border border-gold-500 shadow-gold-glow">{salon?.nome?.[0]}</div>
                        )}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0f0f10] rounded-full animate-pulse"></div>
                    </div>
                    <div>
                        <h1 className="font-display font-bold text-sm tracking-wide text-white">{salon?.nome || 'Carregando...'}</h1>
                        <p className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">Concierge Online</p>
                    </div>
                </div>
                <button onClick={() => navigate('/')} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center active:scale-90 transition-all">
                    <span className="material-symbols-outlined text-sm text-slate-400">close</span>
                </button>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-40 scrollbar-hide">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                        {msg.sender === 'bot' && (
                            <div className="w-8 h-8 rounded-xl bg-surface-dark border border-white/10 flex items-center justify-center text-gold-500 mr-3 shrink-0 shadow-lg">
                                <span className="material-symbols-outlined text-sm">smart_toy</span>
                            </div>
                        )}
                        <div className={`max-w-[85%] px-5 py-4 rounded-2xl shadow-xl text-sm leading-relaxed relative group ${msg.sender === 'user'
                                ? 'bg-gold-gradient text-background-dark font-medium rounded-tr-sm'
                                : 'bg-surface-dark border border-white/5 text-slate-200 rounded-tl-sm'
                            }`}>
                            {typeof msg.text === 'string' ? renderMessageText(msg.text) : msg.text}
                        </div>
                    </div>
                ))}

                {/* UI Interativa baseada no passo */}
                <div className="animate-fade-in pl-11 pr-2">
                    {step === 'SERVICES' && (
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            {services.map(svc => (
                                <button key={svc.id} onClick={() => handleServiceSelect(svc)}
                                    className="bg-surface-dark border border-white/10 rounded-2xl p-3 text-left hover:border-gold-500 hover:shadow-gold-glow transition-all active:scale-95 group overflow-hidden relative">
                                    <div className="absolute inset-0 bg-gold-500/0 group-hover:bg-gold-500/5 transition-colors"></div>
                                    <div className="h-24 bg-black/40 rounded-xl mb-3 overflow-hidden relative">
                                        {svc.image_url ? (
                                            <img src={svc.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/20"><span className="material-symbols-outlined text-3xl">content_cut</span></div>
                                        )}
                                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg">
                                            <p className="text-[10px] text-white font-bold">{svc.duration_minutes || 60} min</p>
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-white text-xs mb-1 truncate">{svc.name}</h3>
                                    <p className="text-gold-400 font-extrabold text-xs">R$ {svc.price}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 'PROFESSIONAL' && (
                        <div className="grid grid-cols-3 gap-3 mt-2">
                            {professionals.map(pro => (
                                <button key={pro.id} onClick={() => handleProSelect(pro)}
                                    className="bg-surface-dark border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-3 hover:border-gold-500 transition-all active:scale-95 group">
                                    <img src={pro.image || `https://i.pravatar.cc/150?u=${pro.id}`} className="w-14 h-14 rounded-full border-2 border-white/10 group-hover:border-gold-500 transition-colors object-cover" />
                                    <span className="text-xs font-bold text-white text-center leading-tight">{pro.nome}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 'TIME' && (
                        <div className="mt-2 text-white">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Horários Disponíveis ({new Date().toLocaleDateString('pt-BR')}):</p>
                            <div className="grid grid-cols-4 gap-2">
                                {generateSlots().map(slot => (
                                    <button key={slot} onClick={() => handleTimeSelect(slot)}
                                        className="py-3 bg-surface-dark border border-white/10 rounded-xl text-xs font-bold hover:bg-gold-500 hover:text-black hover:border-gold-500 transition-all active:scale-90">
                                        {slot}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'CONFIRM' && (
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => finalizeBooking()} className="flex-1 bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-transform uppercase text-xs tracking-widest">
                                Confirmar Agendamento
                            </button>
                            <button onClick={() => setStep('WELCOME')} className="px-6 bg-red-500/10 text-red-500 font-bold border border-red-500/20 rounded-xl active:scale-95 transition-transform uppercase text-xs tracking-widest">
                                Cancelar
                            </button>
                        </div>
                    )}
                    {step === 'SUCCESS' && (
                        <button onClick={() => window.location.reload()} className="w-full mt-4 bg-white/10 text-white font-bold py-4 rounded-xl uppercase text-xs tracking-widest border border-white/10 active:scale-95">
                            Novo Agendamento
                        </button>
                    )}
                </div>

                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            {['PHONE', 'PASSWORD', 'REGISTER_NAME', 'REGISTER_EMAIL', 'REGISTER_PASSWORD'].includes(step) && (
                <div className="p-4 bg-surface-dark/80 backdrop-blur-xl border-t border-white/5 fixed bottom-0 w-full z-30 safe-area-bottom animate-slide-up">
                    <div className="relative">
                        <input
                            type={step.includes('PASSWORD') ? 'password' : 'text'}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={step === 'PHONE' ? "Digite seu celular (apenas números)..." : "Digite sua resposta..."}
                            autoFocus
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl pl-5 pr-14 py-4 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-gold-500/50 transition-all shadow-inner"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            className="absolute right-2 top-2 w-10 h-10 bg-gold-500 rounded-xl flex items-center justify-center shadow-lg shadow-gold-500/20 active:scale-90 transition-all disabled:opacity-0 disabled:scale-50 text-black"
                        >
                            <span className="material-symbols-outlined text-lg">arrow_upward</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
export default QuickSchedule;
