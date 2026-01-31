
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
    const [selectedServices, setSelectedServices] = useState<Service[]>([]); // Multiselect

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
                    addBotMessage("Vamos agendar seu horário? ⏳");
                    setTimeout(() => {
                        addBotMessage("Para começar, digite seu **número de celular**.");
                        setStep('PHONE');
                    }, 800);
                }, 800);

                // Preload
                api.services.getBySalon(data.id).then(setServices);
                api.professionals.getBySalon(data.id).then(setProfessionals);
            }).catch(() => {
                addBotMessage("Ops! Salão não encontrado.");
            });
        }
    }, [slug]);

    // Auto-scroll
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, step, selectedServices]);

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
                addBotMessage("Verificando... 🔍");
                const { data: profiles } = await supabase.from('profiles').select('email').eq('phone', text).maybeSingle();
                if (profiles?.email) {
                    setUserData(prev => ({ ...prev, email: profiles.email }));
                    setTimeout(() => {
                        addBotMessage(`Olá de volta! Digite sua **senha** para entrar.`);
                        setStep('PASSWORD');
                    }, 800);
                } else {
                    setTimeout(() => {
                        addBotMessage("Vi que é sua primeira vez! Qual seu **Nome**?");
                        setStep('REGISTER_NAME');
                    }, 800);
                }
                break;
            case 'PASSWORD':
                const { error: loginError } = await supabase.auth.signInWithPassword({ email: userData.email, password: text });
                if (loginError) addBotMessage("Senha incorreta.");
                else {
                    addBotMessage("Login realizado! 🔓");
                    showServices();
                }
                break;
            case 'REGISTER_NAME':
                setUserData(prev => ({ ...prev, name: text }));
                addBotMessage(`Prazer, ${text}! Informe seu **E-mail**?`);
                setStep('REGISTER_EMAIL');
                break;
            case 'REGISTER_EMAIL':
                setUserData(prev => ({ ...prev, email: text }));
                addBotMessage("Crie uma **senha**:");
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
                    addBotMessage("Conta criada! 🎉");
                    showServices();
                }
                break;
            case 'CONFIRM':
                if (text.toLowerCase() === 'sim' || text.toLowerCase() === 'confirmar') finalizeBooking();
                else addBotMessage("Agendamento cancelado.");
                break;
        }
    };

    const showServices = () => {
        setStep('SERVICES');
        setTimeout(() => {
            addBotMessage("Selecione os **serviços** que deseja realizar:");
        }, 500);
    };

    const toggleService = (service: Service) => {
        setSelectedServices(prev => {
            const exists = prev.find(s => s.id === service.id);
            if (exists) return prev.filter(s => s.id !== service.id);
            return [...prev, service];
        });
    };

    const confirmServices = () => {
        if (selectedServices.length === 0) return;
        const names = selectedServices.map(s => s.name).join(', ');
        addUserMessage(names);
        setStep('PROFESSIONAL');
        setTimeout(() => {
            addBotMessage(`Quem deve realizar o atendimento?`);
        }, 500);
    };

    const handleProSelect = (pro: Professional) => {
        setSelectedPro(pro);
        addUserMessage(pro.name);
        setStep('TIME');
        setTimeout(() => {
            addBotMessage(`Ótimo! Para qual **data e horário**?`);
            const today = new Date().toISOString().split('T')[0];
            setSelectedDate(today);
        }, 500);
    };

    const handleTimeSelect = (time: string) => {
        setSelectedTime(time);
        addUserMessage(`Às ${time}`);
        setStep('CONFIRM');
        const total = selectedServices.reduce((acc, s) => acc + s.price, 0);
        setTimeout(() => {
            addBotMessage(`📝 **Resumo:**\n\n• **Serviços:** ${selectedServices.map(s => s.name).join(', ')}\n• **Profissional:** ${selectedPro?.name}\n• **Horário:** ${time}\n• **Total:** R$ ${total},00\n\nConfirmar? (Sim)`);
        }, 500);
    };

    const finalizeBooking = async () => {
        addBotMessage("Agendando...");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || selectedServices.length === 0 || !selectedPro || !salon) return;

        const { error } = await api.appointments.create({
            client_id: user.id,
            salon_id: salon.id,
            date: selectedDate,
            time: selectedTime,
            status: 'pending',
            service_names: selectedServices.map(s => s.name).join(', '),
            professional_id: selectedPro.id,
            valor: selectedServices.reduce((acc, s) => acc + s.price, 0),
            duration_min: selectedServices.reduce((acc, s) => acc + (s.duration_min || 60), 0)
        } as any);

        if (error) {
            addBotMessage("Erro: " + error.message);
        } else {
            setStep('SUCCESS');
            addBotMessage("✅ **Confirmado!**");
        }
    };

    const generateSlots = () => ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

    const renderMessageText = (text: string) => <span dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, '<b class="text-gold-400 font-bold">$1</b>').replace(/\n/g, '<br/>') }} />;

    return (
        <div className="flex flex-col h-screen bg-[#0f0f10] text-white font-sans overflow-hidden">
            {/* Header Ultra Minimal */}
            <header className="px-6 py-4 bg-surface-dark/95 backdrop-blur-xl border-b border-white/5 flex items-center justify-between shadow-2xl z-20">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        {salon?.logo_url ? <img src={salon.logo_url} className="w-10 h-10 rounded-full object-cover border border-gold-500 shadow-gold-glow" /> : <div className="w-10 h-10 rounded-full bg-gold-gradient" />}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0f0f10]"></div>
                    </div>
                    <div>
                        <h1 className="font-bold text-sm tracking-wide">{salon?.nome || 'Carregando...'}</h1>
                        <p className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">Online</p>
                    </div>
                </div>
                <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full"><span className="material-symbols-outlined text-sm">close</span></button>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-48 scrollbar-hide">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                        {msg.sender === 'bot' && <div className="w-8 h-8 rounded-xl bg-surface-dark border border-white/10 flex items-center justify-center text-gold-500 mr-3 shadow-lg shrink-0"><span className="material-symbols-outlined text-sm">smart_toy</span></div>}
                        <div className={`max-w-[85%] px-5 py-3 rounded-2xl shadow-xl text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-gold-gradient text-black font-bold rounded-tr-sm' : 'bg-surface-dark border border-white/10 text-slate-200 rounded-tl-sm'}`}>
                            {typeof msg.text === 'string' ? renderMessageText(msg.text) : msg.text}
                        </div>
                    </div>
                ))}

                {/* Steps Visuals */}
                <div className="pl-11 pr-2 animate-fade-in space-y-4">
                    {step === 'SERVICES' && (
                        <div className="grid grid-cols-2 gap-3">
                            {services.map(svc => {
                                const isSelected = selectedServices.some(s => s.id === svc.id);
                                return (
                                    <button key={svc.id} onClick={() => toggleService(svc)}
                                        className={`relative rounded-2xl p-3 text-left transition-all active:scale-95 overflow-hidden group border ${isSelected ? 'bg-gold-500/20 border-gold-500 shadow-gold-glow' : 'bg-surface-dark border-white/10'}`}>
                                        <div className="h-24 bg-black/40 rounded-xl mb-3 overflow-hidden">
                                            {svc.image ? <img src={svc.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/20"><span className="material-symbols-outlined text-3xl">content_cut</span></div>}
                                        </div>
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-white text-xs truncate max-w-[80%]">{svc.name}</h3>
                                            {isSelected && <span className="material-symbols-outlined text-gold-500 text-sm">check_circle</span>}
                                        </div>
                                        <p className="text-gold-400 font-extrabold text-xs mt-1">R$ {svc.price}</p>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {step === 'PROFESSIONAL' && (
                        <div className="grid grid-cols-3 gap-3">
                            {professionals.map(pro => (
                                <button key={pro.id} onClick={() => handleProSelect(pro)}
                                    className="bg-surface-dark border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-3 hover:border-gold-500 transition-all active:scale-95 group">
                                    <img src={pro.image || `https://i.pravatar.cc/150?u=${pro.id}`} className="w-14 h-14 rounded-full border-2 border-white/10 group-hover:border-gold-500 object-cover" />
                                    <span className="text-xs font-bold text-white text-center leading-tight">{pro.name}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 'TIME' && (
                        <div className="grid grid-cols-4 gap-2">
                            {generateSlots().map(slot => (
                                <button key={slot} onClick={() => handleTimeSelect(slot)}
                                    className="py-3 bg-surface-dark border border-white/10 rounded-xl text-xs font-bold hover:bg-gold-500 hover:text-black transition-all">
                                    {slot}
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 'SUCCESS' && <button onClick={() => window.location.reload()} className="w-full bg-white/10 py-4 rounded-xl font-bold uppercase text-xs">Novo Agendamento</button>}
                </div>

                <div ref={scrollRef} />
            </div>

            {/* Fixed Bottom Action / Input */}
            <div className="p-4 bg-[#0f0f10]/95 backdrop-blur-xl border-t border-white/10 fixed bottom-0 w-full z-30 safe-area-bottom">
                {step === 'SERVICES' && selectedServices.length > 0 ? (
                    <button onClick={confirmServices} className="w-full bg-gold-gradient text-black font-black py-4 rounded-xl shadow-gold-glow animate-pulse active:scale-95 text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                        Continuar ({selectedServices.length})
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                ) : ['PHONE', 'PASSWORD', 'REGISTER_NAME', 'REGISTER_EMAIL', 'REGISTER_PASSWORD', 'CONFIRM'].includes(step) ? (
                    <div className="flex gap-2">
                        <input type={step.includes('PASSWORD') ? 'password' : 'text'}
                            value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={step === 'PHONE' ? "Digite seu celular..." : "Sua resposta..."}
                            autoFocus
                            className="flex-1 bg-surface-dark border border-white/20 rounded-xl px-4 py-4 text-white text-sm focus:border-gold-500 focus:outline-none"
                        />
                        <button onClick={handleSend} disabled={!inputValue.trim()} className="bg-gold-500 text-black w-14 rounded-xl flex items-center justify-center disabled:opacity-50 font-bold shadow-lg">
                            <span className="material-symbols-outlined">send</span>
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
export default QuickSchedule;
