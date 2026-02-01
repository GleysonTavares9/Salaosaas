
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { Salon, Service, Professional, Appointment } from '../../types';
import Checkout from '../Client/Checkout';

type Step = 'LOADING' | 'WELCOME' | 'PHONE' | 'AUTH_CHECK' | 'PASSWORD' | 'REGISTER_NAME' | 'REGISTER_EMAIL' | 'REGISTER_PASSWORD' | 'SERVICES' | 'PROFESSIONAL' | 'TIME' | 'CONFIRM' | 'CHECKOUT' | 'SUCCESS';

interface Message {
    id: string;
    text: React.ReactNode;
    sender: 'bot' | 'user';
}

const QuickSchedule: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();

    // Data
    const [salon, setSalon] = useState<Salon | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);

    // Selection
    const [selectedServices, setSelectedServices] = useState<Service[]>([]);
    const [selectedPro, setSelectedPro] = useState<Professional | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedTime, setSelectedTime] = useState('');
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);

    // UI
    const [step, setStep] = useState<Step>('LOADING');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [userData, setUserData] = useState({ phone: '', name: '', email: '', password: '' });
    const [bookingDraft, setBookingDraft] = useState<any>(null);
    const [isTyping, setIsTyping] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);

    // Dourado Aura Color (Based on official #ecd3a5 and #c1a571)
    const auraGold = "#ecd3a5";
    const auraGoldDark = "#c1a571";

    useEffect(() => {
        if (!slug || initialized.current) return;
        initialized.current = true;

        api.salons.getBySlug(slug.toLowerCase())
            .then(data => {
                if (!data) throw new Error("Unidade não encontrada.");
                setSalon(data);
                setStep('WELCOME');
                addBotMessage(`Olá! Bem-vindo ao *${data.nome}*. ✨`);
                setTimeout(() => {
                    addBotMessage("Vamos realizar seu agendamento. Digite seu **celular** para começar.");
                    setStep('PHONE');
                }, 600);
                api.services.getBySalon(data.id).then(setServices);
                api.professionals.getBySalon(data.id).then(setProfessionals);
            })
            .catch(err => {
                console.error("Erro QuickSchedule:", err);
                addBotMessage("Ops! Não encontramos esta unidade ou o link expirou. 😕");
                setTimeout(() => navigate('/explore'), 3000);
            });
    }, [slug]);

    useEffect(() => {
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, [messages, step]);

    const addBotMessage = (text: React.ReactNode) => {
        setIsTyping(true);
        // Simular tempo de digitação baseado no comprimento do texto
        const typingTime = typeof text === 'string' ? Math.min(Math.max(text.length * 15, 600), 2000) : 1000;

        setTimeout(() => {
            setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, text, sender: 'bot' }]);
            setIsTyping(false);
        }, typingTime);
    };

    const addUserMessage = (text: string) => setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, text, sender: 'user' }]);

    const renderText = (text: string) => <span dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, `<b style="color: ${auraGold}">$1</b>`).replace(/\n/g, '<br/>') }} />;

    const TypewriterText: React.FC<{ text: string }> = ({ text }) => {
        const [displayedText, setDisplayedText] = useState('');
        const [currentIndex, setCurrentIndex] = useState(0);

        useEffect(() => {
            if (currentIndex < text.length) {
                const char = text[currentIndex];

                // Cálculo de atraso "Humano"
                let nextDelay = 35; // Base: 35ms por letra

                if (char === '.' || char === '!' || char === '?') nextDelay = 700; // Fim de frase: Pausa longa
                else if (char === ',') nextDelay = 300; // Vírgula: Pausa média
                else if (char === '\n') nextDelay = 500; // Quebra de linha: Pausa

                // Adiciona um pouco de aleatoriedade (5-15ms) para não ser perfeito
                const variance = Math.floor(Math.random() * 15);

                const timeout = setTimeout(() => {
                    setDisplayedText(prev => prev + char);
                    setCurrentIndex(prev => prev + 1);
                }, nextDelay + variance);

                return () => clearTimeout(timeout);
            }
        }, [currentIndex, text]);

        return renderText(displayedText);
    };

    const TypingIndicator = () => (
        <div className="flex justify-start animate-fade-in">
            <div className="bg-[#1c1c1f] px-5 py-4 rounded-[24px] rounded-tl-sm border border-[#c1a571]/20 shadow-[#c1a571]/5 flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-[#ecd3a5] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-[#ecd3a5] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-[#ecd3a5] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
        </div>
    );

    const handleSend = async () => {
        if (!inputValue.trim()) return;
        const text = inputValue.trim();
        setInputValue('');
        addUserMessage(text);

        switch (step) {
            case 'PHONE':
                const contact = text.trim();
                const isEmail = contact.includes('@');
                setUserData({ ...userData, phone: isEmail ? '' : contact.replace(/\D/g, ''), email: isEmail ? contact : '' });

                addBotMessage("Verificando...");

                // RPC Otimizada: 1 única consulta para Telefone ou E-mail
                const { data: profile } = await supabase.rpc('get_profile_by_contact', { p_contact: contact });

                if (profile && profile.id) {
                    setUserData(prev => ({ ...prev, email: profile.email, name: profile.full_name }));
                    const firstName = (profile.full_name || 'Usuário').split(' ')[0];
                    setTimeout(() => {
                        addBotMessage(`Olá **${firstName}**! Que bom te ver. ✨`);
                        addBotMessage("Digite sua **senha** para entrar:");
                        setStep('PASSWORD');
                    }, 400);
                } else if (isEmail) {
                    setTimeout(() => {
                        addBotMessage("Seja bem-vindo! Qual seu **Nome completo**?");
                        setStep('REGISTER_NAME');
                    }, 400);
                } else {
                    setTimeout(() => {
                        addBotMessage("Não achei seu celular. Para garantir, qual seu **e-mail**?");
                        setStep('AUTH_CHECK');
                    }, 400);
                }
                break;

            case 'AUTH_CHECK':
                const emailCheck = text.toLowerCase().trim();
                setUserData(prev => ({ ...prev, email: emailCheck }));

                // Consulta consolidada
                const { data: secondProfile } = await supabase.rpc('get_profile_by_contact', { p_contact: emailCheck });

                if (secondProfile) {
                    setUserData(prev => ({ ...prev, name: secondProfile.full_name }));
                    setTimeout(() => {
                        addBotMessage(`Ah, agora encontrei você! ✨`);
                        addBotMessage("Digite sua **senha**:");
                        setStep('PASSWORD');
                    }, 400);
                } else {
                    setTimeout(() => {
                        addBotMessage("Seja bem-vindo! Qual seu **Nome completo**?");
                        setStep('REGISTER_NAME');
                    }, 400);
                }
                break;

            case 'PASSWORD':
                const { error: loginError } = await supabase.auth.signInWithPassword({ email: userData.email, password: text });
                if (loginError) {
                    addBotMessage("Senha incorreta. Tente novamente ou peça ajuda ao suporte.");
                } else {
                    addBotMessage(`Excelente, **${(userData.name || '').split(' ')[0] || 'que bom te ver'}**! Vamos aos rituais de hoje.`);
                    setTimeout(() => {
                        addBotMessage("Selecione os serviços abaixo:");
                        setStep('SERVICES');
                    }, 400);
                }
                break;

            case 'REGISTER_NAME':
                setUserData(prev => ({ ...prev, name: text }));
                // Como já temos o e-mail do AUTH_CHECK, pedimos a senha
                addBotMessage(`Prazer, **${text.split(' ')[0]}**! Agora para finalizar, crie uma **senha**:`);
                setStep('REGISTER_PASSWORD');
                break;

            case 'REGISTER_PASSWORD':
                addBotMessage("Registrando sua conta...");
                // Usamos o texto direto para a senha para evitar delay de estado
                const { error: signUpError } = await supabase.auth.signUp({
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
                    // Se o erro for de usuário já cadastrado, capturamos e redirecionamos para senha
                    if (signUpError.message.toLowerCase().includes('already registered') || signUpError.status === 422) {
                        addBotMessage("Identifiquei que você já possui cadastro com este e-mail.");
                        addBotMessage("Por favor, digite sua **senha** para entrar:");
                        setStep('PASSWORD');
                    } else {
                        addBotMessage("Ops! " + signUpError.message);
                    }
                } else {
                    setUserData(prev => ({ ...prev, password: text }));
                    addBotMessage("Conta criada com sucesso! ✨🚀");
                    setTimeout(() => {
                        addBotMessage("Agora, selecione os serviços desejados:");
                        setStep('SERVICES');
                    }, 600);
                }
                break;
        }
    };

    const toggleService = (svc: Service) => {
        setSelectedServices(prev => {
            const exists = prev.find(s => s.id === svc.id);
            if (exists) return prev.filter(s => s.id !== svc.id);
            return [...prev, svc];
        });
    };

    const confirmServices = () => {
        if (selectedServices.length === 0) return;
        addUserMessage(selectedServices.map(s => s.name).join(', '));
        addBotMessage("Com qual profissional você deseja agendar?");
        setStep('PROFESSIONAL');
    };

    const handleProSelect = async (pro: Professional) => {
        setSelectedPro(pro);
        addUserMessage(pro.name);
        addBotMessage("Para quando deseja agendar?");

        const today = new Date();
        // Data formatada localmente YYYY-MM-DD para evitar erro de fuso UTC
        const localDateStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
        // Minutos passados desde o início do dia no relógio do usuário
        const nowMin = today.getHours() * 60 + today.getMinutes() + 10;

        setSelectedDate(localDateStr);
        setStep('TIME');

        // 1. Calcular Duração Total
        const totalDuration = selectedServices.reduce((acc, s) => acc + (s.duration_min || 30), 0);

        // 2. Buscar agendamentos e calcular slots via RPC (Otimizado com Timezone Local)
        const { data, error: rpcError } = await supabase.rpc('get_available_slots_rpc', {
            p_pro_id: pro.id,
            p_date: localDateStr,
            p_duration_min: totalDuration,
            p_client_now_min: nowMin
        });

        if (rpcError) {
            console.error("RPC Error:", rpcError);
            addBotMessage("Erro ao consultar agenda. Tente novamente.");
            return;
        }

        const slots = data?.slots || [];

        setAvailableSlots(slots);
        if (slots.length === 0) {
            addBotMessage("Nenhum horário disponível para a duração total dos serviços selecionados hoje. 😕");
        }
    };

    const handleTimeSelect = (time: string) => {
        setSelectedTime(time);
        addUserMessage(time);
        const total = selectedServices.reduce((acc, s) => acc + s.price, 0);
        addBotMessage(`Confirma o agendamento de **${selectedServices.length} serviço(s)** com **${selectedPro?.name}** para às **${time}**?\nTotal: R$ ${total},00`);
        setStep('CONFIRM');
    };

    const finalize = async () => {
        addUserMessage("Sim, confirmar!");

        // Verificar se tem Checkout (Pagamento Online) habilitado
        const isMpEnabled = !!(salon?.mp_public_key && salon.mp_public_key.length > 10 && !salon.mp_public_key.includes('@'));

        if (isMpEnabled) {
            setBookingDraft({
                salonId: salon?.id,
                salonName: salon?.nome,
                services: selectedServices,
                products: [],
                date: selectedDate,
                time: selectedTime,
                professionalId: selectedPro?.id,
                professionalName: selectedPro?.name
            });
            setStep('CHECKOUT');
            return;
        }

        addBotMessage("Finalizando seu agendamento...");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !selectedPro || !salon) return;
        try {
            await api.appointments.create({
                client_id: user.id, salon_id: salon.id, date: selectedDate, time: selectedTime, status: 'pending',
                service_names: selectedServices.map(s => s.name).join(', '),
                professional_id: selectedPro.id,
                valor: selectedServices.reduce((acc, s) => acc + s.price, 0),
                duration_min: selectedServices.reduce((acc, s) => acc + (s.duration_min || 60), 0)
            } as any);
            setStep('SUCCESS');
            addBotMessage("✅ **Agendamento Confirmado!**\nEstamos te esperando!");
        } catch (e: any) { addBotMessage("Erro: " + e.message); }
    };

    const handleWhatsAppNotification = () => {
        if (!salon || !selectedPro) return;
        const servicesText = selectedServices.map(s => `• *${s.name}*`).join('\n');
        const text = `Olá! Acabei de realizar um agendamento via *Luxe Concierge*.\n\n🏛️ *Local:* ${salon.nome}\n✂️ *Rituais:*\n${servicesText}\n📅 *Data:* ${selectedDate}\n⏰ *Hora:* ${selectedTime}\n👤 *Profissional:* ${selectedPro.name}\n\n_Aguardo o atendimento!_ ✨`;
        const phoneNumber = salon.telefone?.replace(/\D/g, '') || '55';
        window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <div className="bg-[#0a0a0b] h-[100dvh] w-full flex items-center justify-center p-0 sm:p-6 overflow-hidden fixed inset-0 sm:relative">
            <div className="w-full max-w-[440px] h-full sm:h-[90vh] bg-[#121214] sm:rounded-[40px] border border-white/5 shadow-2xl flex flex-col overflow-hidden relative font-sans pt-[env(safe-area-inset-top)]">

                {/* Header Premium Aura */}
                <div className="px-6 py-5 bg-[#18181b] border-b border-white/5 flex items-center justify-between z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <img src={salon?.logo_url || 'https://via.placeholder.com/50'} className="w-11 h-11 rounded-full border-2 object-cover transition-colors" style={{ borderColor: auraGold }} />
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#18181b]"></div>
                        </div>
                        <div>
                            <h1 className="font-bold text-base text-white leading-tight">{salon?.nome || 'Carregando...'}</h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] font-black uppercase tracking-[0.1em]" style={{ color: auraGold }}>LUXE CONCIERGE</span>
                                <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                                <span className="text-[9px] text-green-500 font-bold uppercase">Online</span>
                            </div>
                        </div>
                    </div>
                    {step === 'CHECKOUT' && (
                        <button onClick={() => setStep('CONFIRM')} className="text-white/50 hover:text-white transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    )}
                </div>

                {/* Checkout Overlay */}
                {step === 'CHECKOUT' && salon && (
                    <div className="absolute inset-x-0 bottom-0 top-[84px] z-[50] bg-[#121214] overflow-y-auto">
                        <Checkout
                            bookingDraft={bookingDraft}
                            salons={[salon]}
                            onConfirm={(appt: Appointment) => {
                                setStep('SUCCESS');
                                addBotMessage("✅ **Pagamento Realizado e Agendamento Confirmado!**\nEstamos te esperando!");
                            }}
                            setBookingDraft={setBookingDraft}
                        />
                    </div>
                )}

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide bg-[#121214]">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                            <div className={`max-w-[85%] px-5 py-4 rounded-[24px] text-sm leading-relaxed shadow-xl ${msg.sender === 'bot'
                                ? 'bg-[#1c1c1f] text-slate-100 rounded-tl-sm border border-[#c1a571]/20 shadow-[#c1a571]/5'
                                : `text-black font-bold rounded-tr-sm`
                                }`} style={msg.sender === 'user' ? { background: `linear-gradient(135deg, ${auraGold} 0%, ${auraGoldDark} 100%)` } : {}}>
                                {typeof msg.text === 'string'
                                    ? (msg.sender === 'bot' ? <TypewriterText text={msg.text} /> : renderText(msg.text))
                                    : msg.text}
                            </div>
                        </div>
                    ))}

                    {isTyping && <TypingIndicator />}

                    {/* Elements */}
                    <div className="pb-4">
                        {step === 'SERVICES' && (
                            <>
                                <div className="mt-4 flex overflow-x-auto gap-4 pb-4 scrollbar-hide px-1">
                                    {services.map(svc => {
                                        const isSelected = selectedServices.some(s => s.id === svc.id);
                                        return (
                                            <div key={svc.id} onClick={() => toggleService(svc)}
                                                className={`shrink-0 w-44 bg-[#1c1c1f] rounded-[24px] border-2 p-3 flex flex-col gap-3 cursor-pointer transition-all active:scale-95 ${isSelected ? 'shadow-lg bg-[#c1a571]/10' : 'border-white/5'}`}
                                                style={{ borderColor: isSelected ? auraGold : 'transparent' }}>
                                                <div className="h-28 w-full bg-black/40 rounded-2xl overflow-hidden relative">
                                                    {svc.image ? <img src={svc.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/10 text-3xl">✂️</div>}
                                                    {isSelected && <div className="absolute top-2 right-2 rounded-full p-1" style={{ backgroundColor: auraGold }}><span className="material-symbols-outlined text-xs text-black font-black">check</span></div>}
                                                </div>
                                                <div className="px-1">
                                                    <h3 className="font-bold text-xs truncate text-white mb-1">{svc.name}</h3>
                                                    <p className="font-black text-sm" style={{ color: auraGold }}>R$ {svc.price}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex items-center justify-center gap-2 pb-2 opacity-40 animate-pulse">
                                    <span className="material-symbols-outlined text-xs text-white">swipe_left</span>
                                    <span className="text-[9px] uppercase tracking-[0.2em] text-slate-300 font-black">Deslize para ver mais</span>
                                    <span className="material-symbols-outlined text-xs text-white">swipe_right</span>
                                </div>
                            </>
                        )}

                        {step === 'PROFESSIONAL' && (
                            <div className="mt-4 flex overflow-x-auto gap-5 pb-4 scrollbar-hide px-1">
                                {professionals.map(pro => (
                                    <div key={pro.id} onClick={() => handleProSelect(pro)} className="shrink-0 flex flex-col items-center gap-3 cursor-pointer active:scale-95 transition-transform p-1">
                                        <div className="relative">
                                            <img src={pro.image || `https://i.pravatar.cc/150?u=${pro.id}`} className="w-16 h-16 rounded-full border-2 object-cover" style={{ borderColor: 'rgba(255,255,255,0.05)' }} />
                                        </div>
                                        <span className="text-xs font-bold text-white text-center truncate max-w-[90px]">{pro.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {step === 'TIME' && (
                            <div className="mt-4 grid grid-cols-4 gap-3">
                                {availableSlots.map(slot => (
                                    <button key={slot} onClick={() => handleTimeSelect(slot)} className="py-3.5 bg-[#1c1c1f] border border-white/5 rounded-2xl text-xs font-bold text-slate-300 hover:text-black transition-all active:scale-90" style={{ '--hover-bg': auraGold } as any} onMouseEnter={e => e.currentTarget.style.backgroundColor = auraGold} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        {slot}
                                    </button>
                                ))}
                            </div>
                        )}

                        {step === 'SUCCESS' && (
                            <div className="mt-6 space-y-3 animate-fade-in">
                                <button onClick={handleWhatsAppNotification} className="w-full bg-[#25D366] text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 active:scale-95 transition-all">
                                    <svg className="size-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.025 3.23l-.693 2.536 2.603-.683c.894.49 1.83.749 2.828.75h.003c3.181 0 5.77-2.587 5.77-5.767 0-3.18-2.585-5.766-5.768-5.766zm3.321 8.201c-.137.385-.689.702-1.032.744-.312.039-.718.063-1.15-.078-.291-.096-.649-.221-1.115-.421-1.99-.854-3.268-2.885-3.367-3.018-.098-.133-.715-.951-.715-1.815a1.86 1.86 0 0 1 .59-1.402c.191-.184.412-.231.547-.231.134 0 .268.001.385.006.12.005.281-.045.44.331.166.388.564 1.369.613 1.468.049.1.082.216.016.348-.063.133-.122.216-.245.351-.122.134-.257.299-.366.402-.121.116-.247.243-.106.485.14.241.624 1.031 1.341 1.67.925.823 1.701 1.077 1.943 1.197.242.12.385.101.528-.063.142-.164.613-.715.777-.951.164-.236.327-.197.551-.115.222.083 1.411.666 1.652.784s.403.177.461.278c.058.1.058.58-.137.965z" /></svg>
                                    Notificar no WhatsApp
                                </button>
                                <button onClick={() => window.location.reload()} className="w-full bg-gold-gradient text-black font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all" style={{ background: `linear-gradient(135deg, ${auraGold} 0%, ${auraGoldDark} 100%)` }}>
                                    Novo Agendamento
                                </button>
                            </div>
                        )}
                    </div>
                    <div ref={scrollRef} />
                </div>

                {/* Bottom Footer */}
                <div className="p-6 bg-[#18181b]/95 backdrop-blur-xl border-t border-white/5 z-20 shrink-0">
                    {step === 'SERVICES' && (
                        <button onClick={confirmServices} disabled={selectedServices.length === 0} className="w-full text-black font-black py-4 rounded-2xl shadow-xl uppercase text-xs tracking-[0.2em] disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center gap-2" style={{ background: `linear-gradient(135deg, ${auraGold} 0%, ${auraGoldDark} 100%)` }}>
                            CONTINUAR {selectedServices.length > 0 && `(${selectedServices.length})`}
                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                    )}
                    {step === 'CONFIRM' && (
                        <button onClick={finalize} className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl uppercase text-xs tracking-[0.2em] active:scale-95 transition-all">
                            CONFIRMAR AGENDAMENTO
                        </button>
                    )}
                    {['PHONE', 'AUTH_CHECK', 'PASSWORD', 'REGISTER_NAME', 'REGISTER_EMAIL', 'REGISTER_PASSWORD'].includes(step) && (
                        <div className="flex gap-3 relative">
                            <input type={step.includes('PASSWORD') ? 'password' : 'text'}
                                value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
                                placeholder="Digite aqui..."
                                autoFocus
                                className="flex-1 bg-[#0a0a0b] border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none placeholder-slate-600 transition-colors"
                                style={inputValue ? { borderColor: auraGold } : {}}
                            />
                            <button onClick={handleSend} disabled={!inputValue.trim()} className="w-14 rounded-2xl flex items-center justify-center shadow-lg disabled:opacity-30 active:scale-95 transition-all" style={{ backgroundColor: auraGold }}>
                                <span className="material-symbols-outlined text-black font-black">arrow_upward</span>
                            </button>
                        </div>
                    )}
                    {['WELCOME', 'LOADING', 'PROFESSIONAL', 'TIME', 'SUCCESS'].includes(step) && <div className="h-4 w-full flex items-center justify-center"><div className="w-12 h-1 bg-white/5 rounded-full"></div></div>}
                </div>
            </div>
        </div>
    );
};
export default QuickSchedule;
