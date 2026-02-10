
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { Salon, Service, Professional, Appointment } from '../../types';
import Checkout from '../Client/Checkout';

type Step = 'LOADING' | 'WELCOME' | 'PHONE' | 'AUTH_CHECK' | 'PASSWORD' | 'REGISTER_NAME' | 'REGISTER_EMAIL' | 'REGISTER_PASSWORD' | 'SERVICES' | 'PROFESSIONAL' | 'DATE' | 'TIME' | 'CONFIRM' | 'CHECKOUT' | 'SUCCESS';

interface Message {
    id: string;
    text: React.ReactNode;
    sender: 'bot' | 'user';
}

const auraGold = "#ecd3a5";
const auraGoldDark = "#c1a571";

const DAY_KEY_MAP: { [key: string]: string } = {
    'segunda-feira': 'monday',
    'terça-feira': 'tuesday',
    'quarta-feira': 'wednesday',
    'quinta-feira': 'thursday',
    'sexta-feira': 'friday',
    'sábado': 'saturday',
    'domingo': 'sunday',
    'monday': 'monday',
    'tuesday': 'tuesday',
    'wednesday': 'wednesday',
    'thursday': 'thursday',
    'friday': 'friday',
    'saturday': 'saturday',
    'sunday': 'sunday'
};

const renderText = (text: string) => <span dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, `<b style="color: ${auraGold}">$1</b>`).replace(/\n/g, '<br/>') }} />;

const TypewriterText = React.memo(({ text }: { text: string }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < text.length) {
            const char = text[currentIndex];

            // Super rápido - quase instantâneo
            let nextDelay = 8; // Base ultra rápida (8ms)

            // Pausas mínimas apenas para legibilidade
            if (char === '.' || char === '!' || char === '?') nextDelay = 150; // Pausa curta
            else if (char === ',') nextDelay = 60; // Micro-pausa
            else if (char === '\n') nextDelay = 100; // Quebra de linha

            // Variação mínima (0-5ms)
            const variance = Math.floor(Math.random() * 5);

            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + char);
                setCurrentIndex(prev => prev + 1);
            }, nextDelay + variance);

            return () => clearTimeout(timeout);
        }
    }, [currentIndex, text]);

    return useMemo(() => renderText(displayedText), [displayedText]);
}, (prevProps, nextProps) => prevProps.text === nextProps.text);

const TypingIndicator = () => (
    <div className="flex justify-start animate-fade-in">
        <div className="bg-[#1c1c1f] px-5 sm:px-5 lg:px-5 py-4 sm:py-4 lg:py-4 rounded-[24px] rounded-tl-sm border border-[#c1a571]/20 shadow-[#c1a571]/5 flex gap-1 lg:gap-1 items-center">
            <div className="w-1.5 h-1.5 bg-[#ecd3a5] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1.5 h-1.5 bg-[#ecd3a5] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1.5 h-1.5 bg-[#ecd3a5] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
    </div>
);

const QuickSchedule: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const location = useLocation();

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
    const [userAppointments, setUserAppointments] = useState<Appointment[]>([]);
    const [showMyAppointments, setShowMyAppointments] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [userData, setUserData] = useState({ phone: '', name: '', email: '', password: '' });
    const [bookingDraft, setBookingDraft] = useState<any>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [botQueue, setBotQueue] = useState<React.ReactNode[]>([]);
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);
    const [showElements, setShowElements] = useState(false);

    // Drag to scroll refs
    const servicesScrollRef = useRef<HTMLDivElement>(null);
    const proScrollRef = useRef<HTMLDivElement>(null);
    const dateScrollRef = useRef<HTMLDivElement>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);

    // Optimized handlers with useCallback
    const fetchUserAppointments = async (userId: string, salonId: string) => {
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select('*')
                .eq('client_id', userId)
                .eq('salon_id', salonId)
                .in('status', ['pending', 'confirmed'])
                .order('date', { ascending: true });
            if (!error) setUserAppointments(data || []);
        } catch (err) { }
    };

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    }, []);

    const checkIsClosed = (salonData: Salon | null, d: Date): boolean => {
        if (!salonData?.horario_funcionamento) return false;

        const dayNamePT = d.toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase(); // segunda-feira
        const dayNameEN = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(); // monday

        // Tenta várias chaves possíveis que podem estar no JSON
        const keys = [
            dayNameEN, // monday
            dayNamePT, // segunda-feira
            dayNamePT.replace('-feira', ''), // segunda
            dayNamePT.replace('-feira', '').normalize("NFD").replace(/[\u0300-\u036f]/g, "") // terca
        ];

        for (const key of keys) {
            if (salonData.horario_funcionamento[key]) {
                return salonData.horario_funcionamento[key].closed === true;
            }
        }
        return false;
    };

    const setupDragScroll = (ref: React.RefObject<HTMLDivElement>) => {
        let isDown = false;
        let startX: number;
        let scrollLeft: number;

        return {
            onMouseDown: (e: React.MouseEvent) => {
                isDown = true;
                if (!ref.current) return;
                startX = e.pageX - ref.current.offsetLeft;
                scrollLeft = ref.current.scrollLeft;
            },
            onMouseLeave: () => {
                isDown = false;
            },
            onMouseUp: () => {
                isDown = false;
            },
            onMouseMove: (e: React.MouseEvent) => {
                if (!isDown || !ref.current) return;
                e.preventDefault();
                const x = e.pageX - ref.current.offsetLeft;
                const walk = (x - startX) * 2;
                ref.current.scrollLeft = scrollLeft - walk;
            }
        };
    };

    const servicesDrag = setupDragScroll(servicesScrollRef);
    const proDrag = setupDragScroll(proScrollRef);
    const dateDrag = setupDragScroll(dateScrollRef);


    useEffect(() => {
        if (!slug || initialized.current) return;
        initialized.current = true;

        // Limpa o estado antes de buscar novo salão
        setSalon(null);

        api.salons.getBySlug(slug.toLowerCase())
            .then(data => {
                if (!data) {
                    console.warn("Aura: Unidade não encontrada para o slug:", slug);
                    addBotMessage("Ops! Não encontramos esta unidade ou o link expirou. 😕");
                    setTimeout(() => navigate('/explore'), 3000);
                    return;
                }

                setSalon(data);
                setStep('WELCOME');
                addBotMessage(`Olá! Bem-vindo ao *${data.nome}*. ✨`);

                // Checar se já existe sessão ativa para pular login
                supabase.auth.getSession().then(async ({ data: { session } }) => {
                    const params = new URLSearchParams(location.search);
                    const isFromAI = params.get('promo') === 'true' && sessionStorage.getItem('aura_promo_verified') === 'true';
                    const serviceId = params.get('serviceId');

                    if (session?.user) {
                        fetchUserAppointments(session.user.id, data.id);
                        const profileData = session.user.user_metadata;
                        const firstName = (profileData?.full_name || 'Usuário').split(' ')[0];
                        setUserData({
                            phone: profileData?.phone || '',
                            name: profileData?.full_name || '',
                            email: session.user.email || '',
                            password: ''
                        });

                        setTimeout(async () => {
                            addBotMessage(`Olá **${firstName}**! ✨`);

                            if (isFromAI) {
                                // Buscar serviços
                                const svcs = await api.services.getBySalon(data.id);

                                if (serviceId) {
                                    const targetSvc = svcs.find(s => s.id === serviceId);
                                    if (targetSvc) {
                                        setSelectedServices([targetSvc]);
                                        addBotMessage(`Como você escolheu **${targetSvc.name}** na nossa conversa, já preparei seu checkout com desconto.`);
                                        addBotMessage("Com qual profissional você deseja agendar?");
                                        setStep('PROFESSIONAL');
                                        return;
                                    }
                                }

                                // Fallback: se não tem serviceId mas é da IA, seleciona o primeiro
                                if (svcs && svcs.length > 0) {
                                    setSelectedServices([svcs[0]]);
                                    addBotMessage(`Já deixei o ritual **${svcs[0].name}** preparado para você.`);
                                    addBotMessage("Com qual profissional você deseja agendar?");
                                    setStep('PROFESSIONAL');
                                } else {
                                    setStep('SERVICES');
                                }
                            } else {
                                addBotMessage("Como você já está logado, vamos direto escolher seus rituais de hoje.");
                                setStep('SERVICES');
                            }
                        }, 1000);
                    } else {
                        setTimeout(() => {
                            addBotMessage("Vamos realizar seu agendamento. Digite seu **celular** para começar.");
                            setStep('PHONE');
                        }, 600);
                    }
                });

                // Carregar dados complementares
                api.services.getBySalon(data.id).then(setServices);
                api.professionals.getBySalon(data.id).then(setProfessionals);
            })
            .catch(err => {
                console.error("Erro QuickSchedule:", err);
                addBotMessage("Ocorreu um erro ao carregar as informações da unidade. Tente novamente mais tarde.");
            });
    }, [slug]);

    // Salva a URL atual para retornar após login
    useEffect(() => {
        if (slug) {
            localStorage.setItem('quickScheduleReturn', `/q/${slug}`);
        }
    }, [slug]);

    // Pre-fill from Query Params (AI Integration)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const serviceId = params.get('serviceId');
        const proId = params.get('proId');
        const date = params.get('date');
        const time = params.get('time');

        if (serviceId && services.length > 0) {
            const svc = services.find(s => s.id === serviceId);
            if (svc) setSelectedServices([svc]);
        }
        if (proId && professionals.length > 0) {
            const pro = professionals.find(p => p.id === proId);
            if (pro) setSelectedPro(pro);
        }
        if (date) setSelectedDate(date);
        if (time) setSelectedTime(time);

        // Se houver pré-preenchimento completo, pula para a confirmação
        if (serviceId && proId && date && time) {
            setStep('CONFIRM');
        }
    }, [services, professionals]);

    useEffect(() => {
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, [messages, step]);

    const addBotMessage = (text: React.ReactNode) => {
        setBotQueue(prev => [...prev, text]);
    };

    useEffect(() => {
        if (!isProcessingQueue && botQueue.length > 0) {
            const processNext = async () => {
                setIsProcessingQueue(true);
                const text = botQueue[0];
                setBotQueue(prev => prev.slice(1));

                // 1. Mostrar os 3 pontinhos (Pensando) - Rápido
                setIsTyping(true);
                const dotsTime = typeof text === 'string' ? Math.min(text.length * 3, 300) : 200;
                await new Promise(r => setTimeout(r, dotsTime));
                setIsTyping(false);

                // 2. Adicionar a mensagem à lista (Inicia Typewriter)
                setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, text, sender: 'bot' }]);

                // 3. ESPERAR o typewriter terminar antes da próxima mensagem
                if (typeof text === 'string') {
                    // Calcula tempo total de digitação (8ms por letra + pausas)
                    const pauses = (text.match(/[.!?]/g) || []).length * 150 + (text.match(/[,]/g) || []).length * 60;
                    const totalTypingTime = (text.length * 8) + pauses + 100; // Tempo real do typewriter
                    await new Promise(r => setTimeout(r, totalTypingTime));
                } else {
                    await new Promise(r => setTimeout(r, 400));
                }

                setIsProcessingQueue(false);
            };
            processNext();
        } else if (!isProcessingQueue && botQueue.length === 0) {
            // APENAS quando a fila acabou, mostra os elementos (serviços, etc)
            setShowElements(true);
        }
    }, [botQueue, isProcessingQueue]);

    const addUserMessage = (text: string) => setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, text, sender: 'user' }]);


    const handleSend = async () => {
        if (!inputValue.trim()) return;
        const text = inputValue.trim();
        setInputValue('');

        // Se for um passo de senha, mascaramos a mensagem no chat
        const displayPath = ['PASSWORD', 'REGISTER_PASSWORD'].includes(step)
            ? '•'.repeat(Math.min(text.length, 12))
            : text;

        addUserMessage(displayPath);
        setShowElements(false); // Esconde elementos ao enviar nova mensagem

        switch (step) {
            case 'PHONE': {
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
            }

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

            case 'PASSWORD': {
                const { data: { user }, error: loginError } = await supabase.auth.signInWithPassword({
                    email: userData.email, password: text
                });
                if (loginError) {
                    addBotMessage("Senha incorreta. Tente novamente:");
                    return;
                }
                const profile = user?.user_metadata;
                const firstName = (profile?.full_name || userData.name).split(' ')[0];
                addBotMessage(`Excelente, **${firstName}**!`);

                const params = new URLSearchParams(location.search);
                const serviceId = params.get('serviceId');

                if (serviceId) {
                    // Se temos um serviço vindo da IA, selecionamos e pulamos
                    const svcs = await api.services.getBySalon(salon.id);
                    const targetSvc = svcs.find(s => s.id === serviceId);
                    if (targetSvc) {
                        setSelectedServices([targetSvc]);
                        addBotMessage(`Como você escolheu o ritual **${targetSvc.name}** na nossa conversa, já deixei ele pronto.`);
                        addBotMessage("Com qual profissional você deseja agendar?");
                        setStep('PROFESSIONAL');
                        return;
                    }
                }

                addBotMessage("Vamos aos rituais de hoje.");
                setStep('SERVICES');
                break;
            }

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
                        addBotMessage("Por favor, digite sua senha para entrar:");
                        setStep('PASSWORD');
                    } else {
                        addBotMessage("Ops! " + signUpError.message);
                    }
                } else {
                    setUserData(prev => ({ ...prev, password: text }));
                    addBotMessage("Conta criada com sucesso! ✨🚀");

                    setTimeout(async () => {
                        const params = new URLSearchParams(location.search);
                        const serviceId = params.get('serviceId');

                        if (serviceId && salon) {
                            const svcs = await api.services.getBySalon(salon.id);
                            const targetSvc = svcs.find(s => s.id === serviceId);
                            if (targetSvc) {
                                setSelectedServices([targetSvc]);
                                addBotMessage(`Como você escolheu **${targetSvc.name}** na nossa conversa, já deixei tudo pronto.`);
                                addBotMessage("Com qual profissional você deseja agendar?");
                                setStep('PROFESSIONAL');
                                return;
                            }
                        }

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
        setShowElements(false); // Esconde UI enquanto bot fala
        const selectedNames = selectedServices.map(s => s.name).join(', ');
        addUserMessage(selectedNames);
        addBotMessage(`Perfeito! Você escolheu: **${selectedNames}**.\n\nCom qual profissional você deseja agendar?`);
        setStep('PROFESSIONAL');
    };

    const confirmPro = () => {
        if (!selectedPro) return;
        setShowElements(false);
        addUserMessage(selectedPro.name);
        addBotMessage("Para quando deseja agendar?");
        setStep('DATE');
    };

    const confirmDate = async () => {
        if (!selectedDate) return;
        const d = new Date(selectedDate + 'T12:00:00');
        const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', weekday: 'long' });
        setShowElements(false); // Esconde UI enquanto bot fala
        addUserMessage(label);
        addBotMessage(`Ótimo! Agora escolha o melhor **horário** para ${label.toLowerCase()}:`);
        setStep('TIME');

        if (!selectedPro) return;

        // 1. Calcular Duração Total
        const totalDuration = selectedServices.reduce((acc, s) => acc + (s.duration_min || 30), 0);

        // 2. Calcular agora em minutos (para o caso de ser HOJE)
        const today = new Date();
        const nowMin = today.getHours() * 60 + today.getMinutes() + 10;

        try {
            const { data, error: rpcError } = await supabase.rpc('get_available_slots_rpc', {
                p_pro_id: selectedPro.id,
                p_date: selectedDate,
                p_duration_min: totalDuration,
                p_client_now_min: nowMin
            });

            if (rpcError) throw rpcError;

            const slots = data?.slots || [];
            setAvailableSlots(slots);

            if (slots.length === 0) {
                addBotMessage("Poxa, não encontrei horários disponíveis para este dia. 😕");
            }
        } catch (err) {
            console.error("RPC Error:", err);
            addBotMessage("Eita, tive um probleminha ao checar a agenda deste dia. 😕 Escolha outra data ou tente novamente.");
            // Não avança o passo se der erro, permite escolher outra data
        }
    };

    const confirmTime = () => {
        if (!selectedTime) return;
        setShowElements(false);
        addUserMessage(selectedTime);

        const params = new URLSearchParams(location.search);
        const isFromAI = params.get('promo') === 'true' && sessionStorage.getItem('aura_promo_verified') === 'true';
        const discountPercentage = (isFromAI && salon?.ai_enabled && salon?.ai_promo_discount) ? salon.ai_promo_discount : 0;

        const subtotal = selectedServices.reduce((acc, s) => acc + s.price, 0);
        const tax = subtotal * 0.05;
        const baseTotalWithTax = subtotal + tax;
        const discountValue = baseTotalWithTax * (discountPercentage / 100);
        const finalTotal = Math.max(0, baseTotalWithTax - discountValue);

        const serviceNames = selectedServices.map(s => s.name).join(', ');

        const [year, month, day] = selectedDate.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const dateFormatted = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', weekday: 'long' });

        addBotMessage(`Por favor, confira os detalhes:\n\n` +
            `🗓️ **Data:** ${dateFormatted} às **${selectedTime}**\n` +
            `👤 **Profissional:** ${selectedPro?.name}\n` +
            `✂️ **Serviços:** ${serviceNames}\n` +
            `💰 **Total:** ${discountPercentage > 0 ? `<s>R$ ${baseTotalWithTax.toFixed(2)}</s> **R$ ${finalTotal.toFixed(2)}**` : `R$ ${baseTotalWithTax.toFixed(2)}`}\n\n` +
            `Tudo certo?`);

        setStep('CONFIRM');
    };

    const finalize = async () => {
        setShowElements(false);
        addUserMessage("Sim, confirmar!");

        const params = new URLSearchParams(location.search);
        const isFromAI = params.get('promo') === 'true' && sessionStorage.getItem('aura_promo_verified') === 'true';
        const discountPercentage = (isFromAI && salon?.ai_enabled && salon?.ai_promo_discount) ? salon.ai_promo_discount : 0;

        const subtotal = selectedServices.reduce((acc, s) => acc + s.price, 0);
        const tax = subtotal * 0.05;
        const baseTotalWithTax = subtotal + tax;
        const discountValue = baseTotalWithTax * (discountPercentage / 100);
        const finalTotal = Math.max(0, baseTotalWithTax - discountValue);

        // Se o salão tem checkout integrado, mandamos para o Step CHECKOUT
        if (salon?.mp_public_key) {
            setBookingDraft({
                salonId: salon.id,
                salonName: salon.nome,
                services: selectedServices,
                products: [],
                professionalId: selectedPro?.id,
                professionalName: selectedPro?.name,
                date: selectedDate,
                time: selectedTime,
                total: finalTotal,
                discount_applied: discountPercentage
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
                valor: finalTotal,
                duration_min: selectedServices.reduce((acc, s) => acc + (s.duration_min || 60), 0),
                booked_by_ai: isFromAI
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
        <div className="bg-[#0a0a0b] h-[100dvh] w-full flex items-center justify-center p-0 lg:p-12 overflow-hidden fixed inset-0">
            <div className="w-full max-w-[1200px] h-full lg:h-[90vh] bg-[#121214] lg:rounded-[48px] border border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden relative font-sans pt-[env(safe-area-inset-top)]">

                {/* Header Premium Aura */}
                <div className="px-6 sm:px-6 lg:px-6 py-5 sm:py-5 lg:py-5 bg-[#18181b] border-b border-white/5 flex items-center justify-between z-10 shrink-0">
                    <div className="flex items-center gap-3 lg:gap-3">
                        <div className="relative">
                            <img src={salon?.logo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${salon?.nome || 'Salon'}`} className="w-11 h-11 rounded-full border-2 object-cover transition-colors" style={{ borderColor: auraGold }} />
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#18181b]"></div>
                        </div>
                        <div>
                            <h1 className="font-bold text-white leading-tight" style={{ fontSize: 'var(--step-1)' }}>{salon?.nome || 'Carregando...'}</h1>
                            <div className="flex items-center gap-1 lg:gap-1.5 mt-0.5">
                                <span className="font-black uppercase tracking-[0.1em]" style={{ color: auraGold, fontSize: '9px' }}>LUXE CONCIERGE</span>
                                <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                                <span className="text-[9px] text-green-500 font-bold uppercase">Online</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 lg:gap-4">
                        {userAppointments.length > 0 && (
                            <button
                                onClick={() => setShowMyAppointments(true)}
                                className="size-10 sm:size-12 lg:size-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-primary animate-pulse"
                            >
                                <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                            </button>
                        )}
                        {step === 'CHECKOUT' && (
                            <button onClick={() => setStep('CONFIRM')} className="text-white/50 hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* MyAppointments Drawer Compact */}
                {showMyAppointments && (
                    <div className="absolute inset-0 z-[60] flex items-end">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMyAppointments(false)}></div>
                        <div className="w-full bg-[#1c1c1f] rounded-t-[40px] border-t border-white/10 p-8 sm:p-8 lg:p-8 shadow-2xl relative z-70 animate-fade-in-up">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="font-display font-black italic text-white text-xl uppercase tracking-widest text-primary">Meus Agendamentos</h3>
                                <button onClick={() => setShowMyAppointments(false)} className="size-10 sm:size-12 lg:size-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="space-y-4 max-h-[50vh] overflow-y-auto no-scrollbar pb-10">
                                {userAppointments.map(appt => (
                                    <div key={appt.id} className="bg-white/5 border border-white/5 rounded-3xl p-5 sm:p-5 lg:p-5 flex items-center justify-between group">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">{appt.date} • {appt.time}</p>
                                            <p className="text-sm font-bold text-white uppercase">{appt.service_names}</p>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest italic">{appt.status === 'confirmed' ? '✅ Confirmado' : '⏳ Aguardando'}</p>
                                        </div>
                                        <div className="size-10 sm:size-12 lg:size-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                            <span className="material-symbols-outlined">check_circle</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

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
                <div className="flex-1 overflow-y-auto p-4 sm:p-4 lg:p-4 sm:p-6 sm:p-6 lg:p-6 space-y-5 scrollbar-hide bg-[#121214]">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                            <div className={`max-w-[90%] lg:max-w-[60%] px-5 py-4 rounded-[24px] leading-relaxed shadow-xl ${msg.sender === 'bot'
                                ? 'bg-[#1c1c1f] text-slate-100 rounded-tl-sm border border-[#c1a571]/20 shadow-[#c1a571]/5'
                                : `text-black font-bold rounded-tr-sm`
                                }`} style={{
                                    ...(msg.sender === 'user' ? { background: `linear-gradient(135deg, ${auraGold} 0%, ${auraGoldDark} 100%)` } : {}),
                                    fontSize: 'var(--step-0)'
                                }}>
                                {typeof msg.text === 'string'
                                    ? (msg.sender === 'bot' ? <TypewriterText text={msg.text} /> : renderText(msg.text))
                                    : msg.text}
                            </div>
                        </div>
                    ))}

                    {isTyping && <TypingIndicator />}

                    {/* Elements */}
                    <div className="pb-4">
                        {showElements && step === 'SERVICES' && (
                            <>
                                <div
                                    ref={servicesScrollRef}
                                    {...servicesDrag}
                                    className="mt-4 flex overflow-x-auto gap-6 pb-6 no-scrollbar px-1 cursor-grab active:cursor-grabbing select-none"
                                >
                                    {services.map(svc => {
                                        const isSelected = selectedServices.some(s => s.id === svc.id);
                                        return (
                                            <div key={svc.id} onClick={() => toggleService(svc)}
                                                className={`shrink-0 w-40 lg:w-56 bg-[#1c1c1f] rounded-[24px] lg:rounded-[32px] border-2 p-3 lg:p-4 flex flex-col gap-3 lg:gap-4 cursor-pointer transition-all active:scale-95 ${isSelected ? 'shadow-[0_10px_30px_rgba(193,165,113,0.15)] bg-[#c1a571]/10' : 'border-white/5'}`}
                                                style={{ borderColor: isSelected ? auraGold : 'transparent' }}>
                                                <div className="h-28 lg:h-40 w-full bg-black/40 rounded-2xl lg:rounded-[24px] overflow-hidden relative">
                                                    {svc.image ? <img src={svc.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/10 text-3xl lg:text-4xl">✂️</div>}
                                                    {isSelected && <div className="absolute top-2 lg:top-3 right-2 lg:right-3 rounded-full p-1 lg:p-1.5" style={{ backgroundColor: auraGold }}><span className="material-symbols-outlined text-[8px] lg:text-[10px] text-black font-black">check</span></div>}
                                                </div>
                                                <div className="px-1">
                                                    <h3 className="font-bold text-[11px] lg:text-sm truncate text-white mb-0.5 lg:mb-1 uppercase tracking-tight">{svc.name}</h3>
                                                    <p className="font-black text-xs lg:text-base" style={{ color: auraGold }}>R$ {svc.price}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex items-center justify-center gap-2 lg:gap-2 pb-2 opacity-40 animate-pulse">
                                    <span className="material-symbols-outlined text-xs text-white">swipe_left</span>
                                    <span className="text-[9px] uppercase tracking-[0.2em] text-slate-300 font-black">Deslize para ver mais</span>
                                    <span className="material-symbols-outlined text-xs text-white">swipe_right</span>
                                </div>
                            </>
                        )}

                        {showElements && step === 'PROFESSIONAL' && (
                            <div
                                ref={proScrollRef}
                                {...proDrag}
                                className="mt-4 flex overflow-x-auto gap-5 lg:gap-5 pb-4 scrollbar-hide px-1 sm:px-1 lg:px-1 cursor-grab active:cursor-grabbing select-none"
                            >
                                {professionals.map(pro => (
                                    <div key={pro.id} onClick={() => setSelectedPro(pro)} className="shrink-0 flex flex-col items-center gap-3 lg:gap-3 cursor-pointer active:scale-95 transition-transform p-1 sm:p-1 lg:p-1">
                                        <div className={`size-14 sm:size-16 lg:size-20 rounded-[28px] p-1 sm:p-1 lg:p-1 border-2 transition-all ${selectedPro?.id === pro.id ? 'shadow-xl' : 'border-white/5'}`} style={{ borderColor: selectedPro?.id === pro.id ? auraGold : 'transparent' }}>
                                            <img src={pro.image || `https://api.dicebear.com/7.x/initials/svg?seed=${pro.name}`} className="w-full h-full rounded-[22px] object-cover" />
                                        </div>
                                        <div className="text-center">
                                            <p className={`text-[10px] font-black uppercase tracking-widest transition-colors ${selectedPro?.id === pro.id ? 'text-primary' : 'text-white'}`}>{pro.name.split(' ')[0]}</p>
                                            <p className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter mt-1">{pro.role}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {showElements && step === 'DATE' && (
                            <div
                                ref={dateScrollRef}
                                {...dateDrag}
                                className="mt-4 flex overflow-x-auto gap-3 lg:gap-3 pb-4 scrollbar-hide px-1 sm:px-1 lg:px-1 cursor-grab active:cursor-grabbing select-none"
                            >
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
                                    .map(offset => {
                                        const d = new Date();
                                        d.setDate(d.getDate() + offset);

                                        const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
                                        const dayName = d.toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase();
                                        const dayShort = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
                                        const dayNum = d.getDate();
                                        const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();

                                        const key = DAY_KEY_MAP[dayName] || dayName;
                                        // Usamos a função robusta checkIsClosed e também o key map como fallback
                                        const isClosed = checkIsClosed(salon, d);
                                        const label = offset === 0 ? 'Hoje' : offset === 1 ? 'Amanhã' : `${dayShort}, ${dayNum} ${monthLabel}`;

                                        return { dateStr, dayShort, dayNum, monthLabel, isClosed, label };
                                    })
                                    .filter(d => !d.isClosed) // Remove dias fechados do fluxo do bot
                                    .map((d, index) => {
                                        const isSelected = selectedDate === d.dateStr;
                                        // O primeiro item (Hoje) ou o item selecionado ganham o destaque Aura
                                        const isHighlight = isSelected || (index === 0 && !selectedDate);

                                        return (
                                            <button
                                                key={d.dateStr}
                                                onClick={() => setSelectedDate(d.dateStr)}
                                                className={`shrink-0 flex flex-col items-center justify-center w-[72px] h-[88px] rounded-[24px] transition-all borderActive active:scale-95 ${isSelected
                                                    ? 'text-black shadow-lg shadow-[#c1a571]/20 scale-105'
                                                    : 'bg-[#121214] border border-white/10 text-slate-500 hover:border-[#c1a571]/50 hover:text-white'
                                                    }`}
                                                style={isHighlight ? { background: `linear-gradient(135deg, ${auraGold} 0%, ${auraGoldDark} 100%)`, border: 'none' } : {}}
                                            >
                                                <span className={`text-[8px] font-black uppercase tracking-[0.2em] mb-0.5 ${isHighlight ? 'text-black/70' : 'text-slate-500'}`}>
                                                    {index === 0 ? 'HOJE' : index === 1 ? 'AMANHÃ' : d.dayShort}
                                                </span>
                                                <div className="flex items-baseline gap-0 lg:gap-0.5">
                                                    <span className={`text-xl font-display font-black italic tracking-tighter ${isHighlight ? 'text-black' : 'text-white'}`}>
                                                        {d.dayNum}
                                                    </span>
                                                    <span className={`text-[8px] font-black uppercase italic tracking-widest ${isHighlight ? 'text-black/80' : 'text-slate-500'}`}>
                                                        {d.monthLabel}
                                                    </span>
                                                </div>
                                            </button>
                                        )
                                    })
                                }
                            </div>
                        )}

                        {showElements && step === 'TIME' && (
                            <div className="mt-4 grid grid-cols-4 md:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5 gap-2 lg:gap-3 px-1">
                                {availableSlots.map(slot => (
                                    <button key={slot} onClick={() => setSelectedTime(slot)} className={`py-3 sm:py-3 lg:py-3.5 border rounded-2xl text-[10px] font-black transition-all active:scale-95 uppercase tracking-widest text-center ${selectedTime === slot ? 'gold-gradient text-black' : 'bg-[#1c1c1f] border-white/5 text-slate-400 hover:text-white'}`}>
                                        {slot}
                                    </button>
                                ))}
                                {availableSlots.length === 0 && (
                                    <div className="col-span-4 p-8 sm:p-8 lg:p-8 text-center bg-white/5 rounded-3xl border border-white/5">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sem horários para esta data</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 'SUCCESS' && (
                            <div className="mt-6 space-y-3 animate-fade-in px-1 sm:px-1 lg:px-1">
                                <button onClick={handleWhatsAppNotification} className="w-full bg-[#25D366] text-white font-black py-4 sm:py-4 lg:py-4 rounded-2xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 lg:gap-2 shadow-lg shadow-green-500/20 active:scale-95 transition-all">
                                    <svg className="size-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.025 3.23l-.693 2.536 2.603-.683c.894.49 1.83.749 2.828.75h.003c3.181 0 5.77-2.587 5.77-5.767 0-3.18-2.585-5.766-5.768-5.766zm3.321 8.201c-.137.385-.689.702-1.032.744-.312.039-.718.063-1.15-.078-.291-.096-.649-.221-1.115-.421-1.99-.854-3.268-2.885-3.367-3.018-.098-.133-.715-.951-.715-1.815a1.86 1.86 0 0 1 .59-1.402c.191-.184.412-.231.547-.231.134 0 .268.001.385.006.12.005.281-.045.44.331.166.388.564 1.369.613 1.468.049.1.082.216.016.348-.063.133-.122.216-.245.351-.122.134-.257.299-.366.402-.121.116-.247.243-.106.485.14.241.624 1.031 1.341 1.67.925.823 1.701 1.077 1.943 1.197.242.12.385.101.528-.063.142-.164.613-.715.777-.951.164-.236.327-.197.551-.115.222.083 1.411.666 1.652.784s.403.177.461.278c.058.1.058.58-.137.965z" /></svg>
                                    Notificar no WhatsApp
                                </button>
                                <button onClick={() => window.location.reload()} className="w-full bg-gold-gradient text-black font-black py-4 sm:py-4 lg:py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all" style={{ background: `linear-gradient(135deg, ${auraGold} 0%, ${auraGoldDark} 100%)` }}>
                                    Novo Agendamento
                                </button>
                            </div>
                        )}
                    </div>
                    <div ref={scrollRef} />
                </div>

                {/* Bottom Footer */}
                <div className="p-6 lg:p-10 bg-[#18181b]/95 backdrop-blur-xl border-t border-white/5 z-20 shrink-0 flex justify-center">
                    <div className="w-full max-w-[600px]">
                        {step === 'SERVICES' && (
                            <button onClick={confirmServices} disabled={selectedServices.length === 0} className="w-full text-black font-black py-5 lg:py-6 rounded-[32px] shadow-[0_20px_50px_rgba(193,165,113,0.2)] uppercase text-xs lg:text-sm tracking-[0.2em] disabled:opacity-30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3" style={{ background: `linear-gradient(135deg, ${auraGold} 0%, ${auraGoldDark} 100%)` }}>
                                CONTINUAR {selectedServices.length > 0 && `(${selectedServices.length})`}
                                <span className="material-symbols-outlined text-lg">arrow_forward</span>
                            </button>
                        )}
                        {showElements && step === 'PROFESSIONAL' && (
                            <div className="flex gap-4">
                                <button onClick={() => setStep('SERVICES')} className="size-14 lg:size-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                                    <span className="material-symbols-outlined">undo</span>
                                </button>
                                <button onClick={confirmPro} disabled={!selectedPro} className="flex-1 text-black font-black py-5 lg:py-6 rounded-[32px] shadow-[0_20px_50px_rgba(193,165,113,0.2)] uppercase text-xs lg:text-sm tracking-[0.2em] disabled:opacity-30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3" style={{ background: `linear-gradient(135deg, ${auraGold} 0%, ${auraGoldDark} 100%)` }}>
                                    ESCOLHER PROFISSIONAL
                                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                </button>
                            </div>
                        )}
                        {showElements && step === 'DATE' && (
                            <div className="flex gap-4">
                                <button onClick={() => setStep('PROFESSIONAL')} className="size-14 lg:size-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                                    <span className="material-symbols-outlined">undo</span>
                                </button>
                                <button onClick={confirmDate} disabled={!selectedDate} className="flex-1 text-black font-black py-5 lg:py-6 rounded-[32px] shadow-[0_20px_50px_rgba(193,165,113,0.2)] uppercase text-xs lg:text-sm tracking-[0.2em] disabled:opacity-30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3" style={{ background: `linear-gradient(135deg, ${auraGold} 0%, ${auraGoldDark} 100%)` }}>
                                    ESCOLHER DATA
                                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                </button>
                            </div>
                        )}
                        {showElements && step === 'TIME' && (
                            <div className="flex gap-4">
                                <button onClick={() => setStep('DATE')} className="size-14 lg:size-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                                    <span className="material-symbols-outlined">undo</span>
                                </button>
                                <button onClick={confirmTime} disabled={!selectedTime} className="flex-1 text-black font-black py-5 lg:py-6 rounded-[32px] shadow-[0_20px_50px_rgba(193,165,113,0.2)] uppercase text-xs lg:text-sm tracking-[0.2em] disabled:opacity-30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3" style={{ background: `linear-gradient(135deg, ${auraGold} 0%, ${auraGoldDark} 100%)` }}>
                                    REVISAR AGENDAMENTO
                                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                </button>
                            </div>
                        )}
                        {showElements && step === 'CONFIRM' && (
                            <div className="flex gap-4">
                                <button onClick={() => setStep('TIME')} className="size-14 lg:size-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                                    <span className="material-symbols-outlined">undo</span>
                                </button>
                                <button onClick={finalize} className="flex-1 bg-emerald-500 text-white font-black py-5 lg:py-6 rounded-[32px] shadow-[0_20px_50px_rgba(16,185,129,0.2)] uppercase text-xs lg:text-sm tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all">
                                    FINALIZAR AGORA
                                </button>
                            </div>
                        )}
                        {['PHONE', 'AUTH_CHECK', 'PASSWORD', 'REGISTER_NAME', 'REGISTER_EMAIL', 'REGISTER_PASSWORD'].includes(step) && (
                            <div className="flex gap-4 relative">
                                <input type={step.includes('PASSWORD') ? 'password' : 'text'}
                                    value={inputValue}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Digite aqui..."
                                    autoFocus
                                    className="flex-1 bg-[#0a0a0b] border border-white/10 rounded-[24px] px-6 py-5 lg:py-6 text-white text-sm focus:outline-none placeholder-slate-600 transition-colors"
                                    style={inputValue ? { borderColor: auraGold } : {}}
                                />
                                <button onClick={handleSend} disabled={!inputValue.trim()} className="w-16 lg:w-20 rounded-[24px] flex items-center justify-center shadow-lg disabled:opacity-30 hover:scale-[1.05] active:scale-95 transition-all" style={{ backgroundColor: auraGold }}>
                                    <span className="material-symbols-outlined text-black font-black text-2xl">arrow_upward</span>
                                </button>
                            </div>
                        )}
                        {['WELCOME', 'LOADING', 'SUCCESS'].includes(step) && <div className="h-4 w-full flex items-center justify-center"><div className="w-20 h-1.5 bg-white/5 rounded-full"></div></div>}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default QuickSchedule;
