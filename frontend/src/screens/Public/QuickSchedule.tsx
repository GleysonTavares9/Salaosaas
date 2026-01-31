
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { Salon, Service, Appointment } from '../../types';

// Tipos para o fluxo
type Step = 'LOADING' | 'WELCOME' | 'PHONE' | 'AUTH_CHECK' | 'PASSWORD' | 'REGISTER_NAME' | 'REGISTER_EMAIL' | 'REGISTER_PASSWORD' | 'SERVICES' | 'TIME' | 'CONFIRM' | 'SUCCESS';

interface Message {
    id: string;
    text: React.ReactNode;
    sender: 'bot' | 'user';
    type?: 'text' | 'options' | 'services' | 'time';
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
    const [selectedServices, setSelectedServices] = useState<Service[]>([]);
    const [selectedTime, setSelectedTime] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Carregar Salão
    useEffect(() => {
        if (slug) {
            api.salons.getBySlug(slug).then(async (data) => {
                setSalon(data);
                setStep('WELCOME');
                addBotMessage(`Olá! Bem-vindo ao *${data.nome}*. ✂️`);
                setTimeout(() => {
                    addBotMessage("Vamos agendar seu horário? Para começar, digite seu **número de celular** (com DDD).");
                    setStep('PHONE');
                }, 800);

                // Carregar serviços em background
                api.services.getBySalon(data.id).then(setServices);
            }).catch(() => {
                addBotMessage("Ops! Não encontramos este salão.");
            });
        }
    }, [slug]);

    // Auto-scroll
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const addBotMessage = (text: React.ReactNode, type: Message['type'] = 'text') => {
        setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'bot', type }]);
    };

    const addUserMessage = (text: string) => {
        setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'user' }]);
    };

    const handleSend = async () => {
        if (!inputValue.trim()) return;
        const text = inputValue.trim();
        setInputValue('');
        addUserMessage(text);

        // Processar entrada baseado no passo atual
        switch (step) {
            case 'PHONE':
                setUserData(prev => ({ ...prev, phone: text }));
                setStep('AUTH_CHECK');
                addBotMessage("Verificando seu cadastro...", 'text');

                // Verificar se usuário existe por telefone (Simulação ou via API se possível)
                // Aqui vamos tentar achar pelo telefone na tabela profiles (se RLS permitir)
                // Se não conseguir ler, vamos assumir novo ou pedir email.

                // Estratégia Híbrida:
                // Tentar buscar usuario com esse telefone.
                const { data: profiles } = await supabase.from('profiles').select('email').eq('phone', text).maybeSingle();

                if (profiles?.email) {
                    setUserData(prev => ({ ...prev, email: profiles.email }));
                    setTimeout(() => {
                        addBotMessage(`Olá novamente! Encontrei seu cadastro (${profiles.email}).`);
                        addBotMessage("Por favor, digite sua **senha** para continuar.");
                        setStep('PASSWORD');
                    }, 1000);
                } else {
                    setTimeout(() => {
                        addBotMessage("Ainda não temos seu cadastro com este número. Vamos criar rapidinho? 🚀");
                        addBotMessage("Qual seu **Nome Completo**?");
                        setStep('REGISTER_NAME');
                    }, 1000);
                }
                break;

            case 'PASSWORD':
                // Tentar login
                const { error: loginError } = await supabase.auth.signInWithPassword({
                    email: userData.email,
                    password: text
                });

                if (loginError) {
                    addBotMessage("Senha incorreta. Tente novamente.");
                } else {
                    addBotMessage("Login realizado com sucesso! 🔓");
                    showServices();
                }
                break;

            case 'REGISTER_NAME':
                setUserData(prev => ({ ...prev, name: text }));
                addBotMessage(`Prazer, ${text}! Agora, qual seu **E-mail**?`);
                setStep('REGISTER_EMAIL');
                break;

            case 'REGISTER_EMAIL':
                setUserData(prev => ({ ...prev, email: text }));
                addBotMessage("Crie uma **senha** segura para acessar seus agendamentos:");
                setStep('REGISTER_PASSWORD');
                break;

            case 'REGISTER_PASSWORD':
                setUserData(prev => ({ ...prev, password: text }));
                addBotMessage("Criando sua conta...");

                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: userData.email,
                    password: text,
                    options: {
                        data: {
                            full_name: userData.name,
                            phone: userData.phone,
                            role: 'client'
                        }
                    }
                });

                if (signUpError) {
                    addBotMessage("Erro ao criar conta: " + signUpError.message);
                    addBotMessage("Tente outro email ou senha.");
                    setStep('REGISTER_EMAIL'); // Volta pro email?
                } else {
                    addBotMessage("Conta criada! 🎉");
                    // Atualizar tabela profiles com telefone se necessário (trigger deve fazer isso)
                    // Tentar login automatico (signUp já loga as vezes)
                    showServices();
                }
                break;

            case 'SERVICES':
                // Botão de texto não faz nada aqui, user deve clicar nos cards
                addBotMessage("Por favor, selecione um serviço clicando nos cards acima.");
                break;
        }
    };

    const showServices = () => {
        setStep('SERVICES');
        setTimeout(() => {
            addBotMessage("Qual serviço você gostaria de agendar hoje? 💇‍♂️💅");
            // Add Services UI Message
        }, 500);
    };

    const handleServiceSelect = (service: Service) => {
        setSelectedServices([service]);
        addUserMessage(`Quero ${service.name}`);
        setStep('TIME');
        setTimeout(() => {
            addBotMessage(`Ótima escolha! Para quando seria o **${service.name}**?`);
            addBotMessage("Digite a data e hora desejada (Ex: Amanhã as 14h) ou selecione abaixo:", 'text');
            // Idealmente aqui mostrariamos slots, mas vou simplificar para texto ou lista fixa
        }, 500);
    };

    const handleTimeSelection = (timeSlot: string) => {
        setSelectedTime(timeSlot);
        addUserMessage(timeSlot);
        setStep('CONFIRM');
        setTimeout(() => {
            addBotMessage(`Confirmando: **${selectedServices[0].name}** para **${timeSlot}**. Posso agendar? (Digite "Sim")`);
        }, 500);
    };

    // Custom Render for complex messages
    const renderMessageContent = (msg: Message) => {
        if (typeof msg.text === 'string') {
            return <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />;
        }
        return msg.text;
    };

    return (
        <div className="flex flex-col h-screen bg-[#121214] text-white font-sans overflow-hidden">
            {/* Header simplificado */}
            <header className="p-4 bg-surface-dark border-b border-white/5 flex items-center gap-3 shadow-md z-10">
                {salon?.logo_url && <img src={salon.logo_url} className="w-10 h-10 rounded-full object-cover border border-gold-500/50" />}
                <div>
                    <h1 className="font-bold text-lg leading-tight">{salon?.nome || 'Carregando...'}</h1>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs text-green-500 font-bold tracking-wider">ONLINE AGORA</span>
                    </div>
                </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                        {msg.sender === 'bot' && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-background-dark font-bold text-xs mr-2 shrink-0 shadow-lg">
                                AI
                            </div>
                        )}
                        <div className={`max-w-[85%] p-4 rounded-2xl shadow-xl text-sm leading-relaxed ${msg.sender === 'user'
                                ? 'bg-gradient-to-r from-gold-600 to-gold-500 text-white rounded-tr-sm'
                                : 'bg-surface-dark border border-white/10 text-slate-200 rounded-tl-sm'
                            }`}>
                            {renderMessageContent(msg)}
                        </div>
                    </div>
                ))}

                {/* Service Grid Render */}
                {step === 'SERVICES' && (
                    <div className="grid grid-cols-2 gap-3 mt-2 animate-fade-in">
                        {services.map(svc => (
                            <button
                                key={svc.id}
                                onClick={() => handleServiceSelect(svc)}
                                className="bg-surface-dark border border-white/10 rounded-xl p-3 text-left hover:border-gold-500/50 transition-all active:scale-95 group"
                            >
                                <div className="h-20 bg-black/20 rounded-lg mb-2 overflow-hidden">
                                    {svc.image_url ? (
                                        <img src={svc.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/10 text-2xl">✂️</div>
                                    )}
                                </div>
                                <h3 className="font-bold text-white text-xs mb-1 truncate">{svc.name}</h3>
                                <p className="text-gold-500 font-black text-xs">R$ {svc.price},00</p>
                            </button>
                        ))}
                    </div>
                )}

                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-surface-dark/90 backdrop-blur-lg border-t border-white/5 fixed bottom-0 w-full z-20 safe-area-bottom">
                <div className="flex gap-2 relative">
                    <input
                        type={step === 'PASSWORD' || step === 'REGISTER_PASSWORD' ? 'password' : 'text'}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={step === 'PHONE' ? "Digite seu celular..." : "Digite sua mensagem..."}
                        className="flex-1 bg-black/30 border border-white/10 rounded-full px-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50 transition-colors shadow-inner"
                        disabled={step === 'SERVICES'}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim()}
                        className="bg-gold-500 text-background-dark w-14 h-14 rounded-full flex items-center justify-center font-bold shadow-lg shadow-gold-500/20 active:scale-90 transition-all disabled:opacity-50 disabled:scale-100"
                    >
                        <span className="material-symbols-outlined">send</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
export default QuickSchedule;
