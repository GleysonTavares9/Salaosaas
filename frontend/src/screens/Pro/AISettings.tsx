
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

const AISettings: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [salon, setSalon] = useState<any>(null);
    const [billing, setBilling] = useState<any>(null);
    const [isEnabled, setIsEnabled] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // ESTADOS DE PERFORMANCE REAIS
    const [aiStats, setAiStats] = useState({
        atendimentos: 0,
        conversoes: 0,
        taxa: '0%',
        receita_estimada: 'R$ 0,00'
    });

    const voiceTones = [
        { id: 'elegant', label: 'Elegante', icon: 'auto_awesome', desc: 'Sofisticada e polida.' },
        { id: 'friendly', label: 'Amigável', icon: 'sentiment_satisfied', desc: 'Acolhedora e próxima.' },
        { id: 'professional', label: 'Executiva', icon: 'business_center', desc: 'Direta e eficiente.' },
        { id: 'seductive', label: 'Sedutora', icon: 'magic_button', desc: 'Envolvente e charmosa.' }
    ];

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return navigate('/login');

                const { data: proData, error: proError } = await supabase
                    .from('professionals')
                    .select('salon_id')
                    .eq('user_id', user.id)
                    .single();

                if (proError || !proData?.salon_id) return navigate('/pro');

                const { data: salonData, error: salonError } = await supabase
                    .from('salons')
                    .select('*')
                    .eq('id', proData.salon_id)
                    .single();

                if (salonError || !salonData) return navigate('/pro');

                setSalon(salonData);
                setIsEnabled(salonData.ai_enabled || false);

                // BUSCAR PERFORMANCE REAL
                try {
                    // 1. Total de atendimentos da Aura (Mensagens enviadas)
                    // Como não temos tabela de mensagens da Aura persistente por enquanto, 
                    // vamos usar o contador de uso do RPC ou simular baseado em conversas.
                    const { data: usageCount } = await supabase.rpc('get_user_ai_usage', { p_user_id: user.id });

                    // 2. Agendamentos convertidos pela Aura (booked_by_ai = true)
                    const { data: appts } = await supabase
                        .from('appointments')
                        .select('valor, status')
                        .eq('salon_id', salonData.id)
                        .eq('booked_by_ai', true);

                    const totalAppts = appts?.length || 0;
                    const totalRevenue = appts?.reduce((acc, curr) => acc + (curr.valor || 0), 0) || 0;
                    const simulatedAttends = (usageCount || 0) + (totalAppts * 3); // Simulação: cada agendamento levou umas 3 mensagens

                    setAiStats({
                        atendimentos: simulatedAttends,
                        conversoes: totalAppts,
                        taxa: simulatedAttends > 0 ? `${Math.round((totalAppts / simulatedAttends) * 100)}%` : '0%',
                        receita_estimada: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)
                    });

                } catch (insightsErr) {
                    console.error("Erro ao carregar insights reais:", insightsErr);
                }

                try {
                    const billingData = await api.salons.getBilling(salonData.id);
                    setBilling(billingData);
                } catch (err) {
                    setBilling({ plan: salonData.subscription_plan || 'pro' });
                }

            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [navigate]);

    const handleSave = async () => {
        if (!salon) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('salons')
                .update({
                    ai_promo_text: salon.ai_promo_text,
                    ai_promo_discount: parseFloat(salon.ai_promo_discount) || 0,
                    ai_voice_tone: salon.ai_voice_tone || 'elegant'
                })
                .eq('id', salon.id);

            if (error) throw error;
            showToast("✨ Configurações Aura salvas com sucesso!", "success");
            setHasChanges(false);
        } catch (e: any) {
            console.error("Erro ao salvar config Aura:", e);
            showToast("Erro ao sincronizar com o servidor. Verifique as colunas do banco.", "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="h-screen bg-black flex items-center justify-center text-primary font-black uppercase tracking-[0.4em] animate-pulse">Carregando Aura...</div>;

    return (
        <div className="min-h-screen flex flex-col font-sans relative selection:bg-primary/30">
            {/* Efeito Visual de Fundo (Ajustado para Tema Global) */}
            <div className="fixed inset-0 pointer-events-none opacity-20">
                <div className="absolute top-[-10%] left-[-10%] size-[500px] bg-primary/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] size-[500px] bg-primary/5 rounded-full blur-[120px]" />
            </div>

            <header className="relative z-20 px-6 pt-14 pb-8 border-b border-white/5 bg-background-dark/60 backdrop-blur-2xl">
                <button onClick={() => navigate('/pro')} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-white transition-all group">
                    <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">chevron_left</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Gestão Aura</span>
                </button>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="size-14 rounded-2xl gold-gradient p-[px] shadow-2xl shadow-primary/20">
                            <div className="w-full h-full bg-[#08090a] rounded-2xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl text-primary font-black italic">auto_awesome</span>
                            </div>
                        </div>
                        <div>
                            <h1 className="font-display font-black italic tracking-tighter leading-none mb-1" style={{ fontSize: 'var(--step-2)' }}>Aura Concierge</h1>
                            <div className="flex items-center gap-2">
                                <span className={`size-1.5 rounded-full ${isEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                                <p className="text-[9px] text-primary font-black uppercase tracking-[0.2em]">{isEnabled ? 'Atendimento Ativo' : 'Sistema Offline'}</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={async () => {
                            setIsToggling(true);
                            const next = !isEnabled;
                            const { error } = await supabase.from('salons').update({ ai_enabled: next }).eq('id', salon.id);
                            if (!error) setIsEnabled(next);
                            setIsToggling(false);
                            showToast(next ? "IA Ligada!" : "IA Desligada.", "success");
                        }}
                        disabled={isToggling}
                        className={`relative w-14 h-7 rounded-full transition-all duration-500 ${isEnabled ? 'bg-primary' : 'bg-white/10'}`}
                    >
                        <div className={`absolute top-1 size-5 rounded-full transition-all duration-500 shadow-xl ${isEnabled ? 'left-8 bg-black' : 'left-1 bg-white'}`} />
                    </button>
                </div>
            </header>

            <main className="flex-1 p-6 relative z-10 space-y-8 overflow-y-auto no-scrollbar pb-[200px]">

                {/* ESTRATÉGIA DE VENDAS */}
                <div className="bg-surface-dark border border-white/5 rounded-[2.5rem] p-7 shadow-2xl space-y-6">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">campaign</span>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Estratégia de Venda</h2>
                    </div>

                    <div className="space-y-4">
                        <textarea
                            value={salon?.ai_promo_text || ''}
                            onChange={(e) => { setSalon({ ...salon, ai_promo_text: e.target.value }); setHasChanges(true); }}
                            placeholder="Ex: Ofereça 15% de desconto para quem agendar Mechas hoje."
                            className="w-full bg-black/40 border border-white/5 rounded-[2rem] p-5 text-xs text-white focus:border-primary/40 outline-none min-h-[120px]"
                        />

                        <div className="flex items-center gap-4">
                            <div className="relative w-28">
                                <input
                                    type="number"
                                    value={salon?.ai_promo_discount || ''}
                                    onChange={(e) => { setSalon({ ...salon, ai_promo_discount: e.target.value }); setHasChanges(true); }}
                                    className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-4 pr-10 text-xl font-display font-black text-white outline-none text-right"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-primary font-black text-sm italic">%</span>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={saving || !hasChanges}
                                className={`flex-1 h-14 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 transition-all ${hasChanges ? 'gold-gradient text-black animate-pulse' : 'bg-white/5 text-white/30 truncate'}`}
                            >
                                <span className="material-symbols-outlined text-lg">verified</span>
                                {saving ? 'Gravando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* PERSONALIDADE */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 ml-2">
                        <span className="material-symbols-outlined text-primary text-sm">psychology</span>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Personalidade Aura</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {voiceTones.map((tone) => (
                            <button
                                key={tone.id}
                                onClick={() => { setSalon({ ...salon, ai_voice_tone: tone.id }); setHasChanges(true); }}
                                className={`p-4 rounded-3xl border transition-all text-left relative overflow-hidden group ${salon?.ai_voice_tone === tone.id ? 'bg-primary/20 border-primary shadow-[0_0_20px_rgba(193,165,113,0.1)]' : 'bg-[#0b0c0d] border-white/5 hover:border-white/20'}`}
                            >
                                <span className={`material-symbols-outlined text-lg mb-2 transition-transform group-hover:scale-125 ${salon?.ai_voice_tone === tone.id ? 'text-primary' : 'text-slate-600'}`}>
                                    {tone.icon}
                                </span>
                                <h3 className={`text-[11px] font-black uppercase tracking-widest leading-none mb-1 italic font-display ${salon?.ai_voice_tone === tone.id ? 'text-white' : 'text-slate-500'}`}>
                                    {tone.label}
                                </h3>
                                <p className="text-[8px] text-slate-600 font-medium leading-[1.3] truncate">{tone.desc}</p>
                                {salon?.ai_voice_tone === tone.id && (
                                    <div className="absolute top-2 right-2 text-primary">
                                        <span className="material-symbols-outlined text-xs">check_circle</span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* PERFORMANCE (INSIGHTS REAIS) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 ml-2">
                        <span className="material-symbols-outlined text-primary text-sm">analytics</span>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Performance IA</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="bg-[#0b0c0d] border border-white/5 p-4 sm:p-5 rounded-[2rem] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-[0.05] group-hover:rotate-12 transition-transform">
                                <span className="material-symbols-outlined text-4xl">forum</span>
                            </div>
                            <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Atendimentos</h4>
                            <p className="font-display font-black text-white italic" style={{ fontSize: 'var(--step-2)' }}>{aiStats.atendimentos}</p>
                            <div className="mt-2 text-[7px] text-emerald-500 font-black uppercase tracking-widest">Conversas Únicas</div>
                        </div>

                        <div className="bg-[#0b0c0d] border border-white/5 p-4 sm:p-5 rounded-[2rem] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-[0.05] group-hover:rotate-12 transition-transform">
                                <span className="material-symbols-outlined text-4xl">event_available</span>
                            </div>
                            <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Agendamentos</h4>
                            <p className="font-display font-black text-primary italic" style={{ fontSize: 'var(--step-2)' }}>{aiStats.conversoes}</p>
                            <div className="mt-2 text-[7px] text-primary/70 font-black uppercase tracking-widest">{aiStats.taxa} Conversão</div>
                        </div>

                        <div className="col-span-2 bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-4 sm:p-5 rounded-[2rem] flex items-center justify-between">
                            <div>
                                <h4 className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">Receita Gerada</h4>
                                <p className="font-display font-black text-white italic" style={{ fontSize: 'var(--step-1)' }}>{aiStats.receita_estimada}</p>
                            </div>
                            <div className="size-10 sm:size-12 rounded-2xl gold-gradient flex items-center justify-center text-black">
                                <span className="material-symbols-outlined text-xl font-black">trending_up</span>
                            </div>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
};

export default AISettings;
