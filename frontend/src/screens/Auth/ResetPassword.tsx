
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);
    const [showPassword, setShowPassword] = useState(false);

    React.useEffect(() => {
        const checkSession = async () => {
            const { data } = await api.supabase.auth.getSession();

            if (!data.session) {
                // Tenta aguardar um pouco caso o Supabase esteja processando o hash da URL
                setTimeout(async () => {
                    const { data: secondCheck } = await api.supabase.auth.getSession();
                    if (!secondCheck.session) {
                        showToast("Sessão expirada ou inválida. Solicite um novo link.", "error");
                        navigate('/login');
                    } else {
                        setIsVerifying(false);
                    }
                }, 1500);
            } else {
                setIsVerifying(false);
            }
        };
        checkSession();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const { data } = await api.supabase.auth.getSession();
        if (!data.session) {
            showToast("Sessão de recuperação não encontrada. Tente clicar no link do e-mail novamente.", "error");
            navigate('/login');
            return;
        }

        if (password !== confirmPassword) {
            showToast("As senhas não coincidem.", "error");
            return;
        }

        if (password.length < 6) {
            showToast("A senha deve ter pelo menos 6 caracteres.", "error");
            return;
        }

        setIsLoading(true);
        try {
            await api.auth.updatePassword(password);
            showToast("Senha atualizada com sucesso! Faça login agora.", "success");
            navigate('/login');
        } catch (error: any) {
            console.error("Update Password Error:", error);
            showToast("Erro ao atualizar senha: " + (error.message || "Tente novamente."), "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative flex-1 flex flex-col h-full overflow-y-auto no-scrollbar">
            <div className="absolute inset-0 z-0">
                <img
                    src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200"
                    className="w-full h-full object-cover opacity-20 grayscale"
                    alt="Office Background"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-background-dark via-transparent to-background-dark"></div>
            </div>

            <header className="relative z-10 p-8 sm:p-8 lg:p-8 flex items-center justify-between">
                <button onClick={() => navigate('/login')} className="size-10 sm:size-12 lg:size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                    <span className="material-symbols-outlined">close</span>
                </button>
                <div className="px-4 sm:px-4 lg:px-4 py-2 sm:py-2 lg:py-2 rounded-xl bg-primary/10 border border-primary/20">
                    <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Nova Senha Aura</span>
                </div>
            </header>

            <main className="relative z-10 flex-1 flex flex-col justify-center px-8 sm:px-8 lg:px-8 pb-20">
                <div className="space-y-2 mb-10 text-center">
                    <h1 className="text-4xl lg:text-4xl font-display font-black text-white italic tracking-tighter leading-none">Definir <br /> <span className="text-primary uppercase">Nova Senha.</span></h1>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-4 text-center">Digite sua nova credencial de acesso.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 max-w-sm mx-auto w-full">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nova Senha</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-surface-dark border border-white/5 rounded-2xl py-5 sm:py-5 lg:py-5 px-6 sm:px-6 lg:px-6 text-white text-sm outline-none focus:border-primary/50 transition-all shadow-inner"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500"
                            >
                                <span className="material-symbols-outlined">
                                    {showPassword ? 'visibility' : 'visibility_off'}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-surface-dark border border-white/5 rounded-2xl py-5 sm:py-5 lg:py-5 px-6 sm:px-6 lg:px-6 text-white text-sm outline-none focus:border-primary/50 transition-all shadow-inner"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full gold-gradient text-background-dark font-black py-5 sm:py-5 lg:py-5 rounded-2xl shadow-2xl uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 lg:gap-3 active:scale-95 transition-all mt-4"
                    >
                        {isLoading ? (
                            <div className="size-5 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div>
                        ) : (
                            <>
                                Atualizar Senha
                                <span className="material-symbols-outlined font-black">save</span>
                            </>
                        )}
                    </button>
                </form>
            </main>

            {isVerifying && (
                <div className="fixed inset-0 z-[100] bg-background-dark/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 sm:p-8 lg:p-8 animate-fade-in">
                    <div className="size-14 sm:size-16 lg:size-20 rounded-full bg-primary/10 border-2 border-primary border-t-transparent animate-spin mb-6"></div>
                    <h2 className="text-2xl lg:text-2xl font-display font-black text-white italic tracking-tighter mb-2">Validando Link...</h2>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] text-center max-w-xs">Aguarde um momento enquanto preparamos seu acesso seguro.</p>
                </div>
            )}
        </div>
    );
};

export default ResetPassword;
