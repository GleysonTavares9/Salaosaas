
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Salon, ViewRole, Expense } from '../../types';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

interface TasksProps {
    salon: Salon;
    role: ViewRole;
}

const categoryIcons: Record<string, string> = {
    'Luz': 'lightbulb',
    'Água': 'water_drop',
    'Aluguel': 'home',
    'Salários': 'payments',
    'Produtos': 'inventory_2',
    'Internet': 'wifi',
    'Marketing': 'campaign',
    'Manutenção': 'build',
    'Outros': 'more_horiz'
};

const categoryColors: Record<string, string> = {
    'Luz': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    'Água': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    'Aluguel': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    'Salários': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    'Produtos': 'text-pink-400 bg-pink-400/10 border-pink-400/20',
    'Internet': 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
    'Marketing': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    'Manutenção': 'text-rose-400 bg-rose-400/10 border-rose-400/20',
    'Outros': 'text-slate-400 bg-slate-400/10 border-slate-400/20'
};

const Tasks: React.FC<TasksProps> = ({ salon, role }) => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    const [newExpense, setNewExpense] = useState({
        description: '',
        amount: '',
        category: 'Outros',
        date: new Date().toISOString().split('T')[0],
        status: 'paid' as 'paid' | 'pending'
    });

    const categories = Object.keys(categoryIcons);

    useEffect(() => {
        if (salon?.id) {
            fetchExpenses();
        }
    }, [salon?.id]);

    const fetchExpenses = async () => {
        if (!salon?.id) return;
        try {
            setIsLoading(true);
            const data = await api.expenses.getBySalon(salon.id);
            setExpenses(data);
        } catch (error) {
            console.error(error);
            showToast("Erro ao carregar despesas.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newExpense.description || !newExpense.amount) {
            showToast("Preencha todos os campos.", "info");
            return;
        }

        if (!salon?.id) {
            showToast("Unidade não identificada.", "error");
            return;
        }

        try {
            await api.expenses.create({
                salon_id: salon.id,
                description: newExpense.description,
                amount: Number(newExpense.amount),
                category: newExpense.category,
                date: newExpense.date,
                status: newExpense.status
            });

            showToast("Lançamento confirmado!", "success");
            setShowAddModal(false);
            setNewExpense({
                description: '',
                amount: '',
                category: 'Outros',
                date: new Date().toISOString().split('T')[0],
                status: 'paid'
            });
            fetchExpenses();
        } catch (error: any) {
            console.error("Expense Create Error:", error);
            const msg = error.message || "Erro ao registrar. Verifique se o banco de dados foi atualizado.";
            showToast(msg, "error");
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (!window.confirm("Deseja excluir este registro de saída?")) return;
        try {
            await api.expenses.delete(id);
            setExpenses(prev => prev.filter(e => e.id !== id));
            showToast("Registro excluído com sucesso.", "success");
        } catch (error) {
            showToast("Erro ao excluir.", "error");
        }
    };

    const totals = useMemo(() => {
        return expenses.reduce((acc, curr) => {
            if (curr.status === 'paid') acc.paid += Number(curr.amount);
            else acc.pending += Number(curr.amount);
            return acc;
        }, { paid: 0, pending: 0 });
    }, [expenses]);

    if (isLoading && expenses.length === 0) {
        return (
            <div className="flex-1 bg-background-dark flex items-center justify-center">
                <div className="size-12 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background-dark relative overflow-hidden pb-20">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-[300px] lg:w-[500px] h-[300px] lg:h-[500px] bg-primary/5 blur-[80px] lg:blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

            <header className="sticky top-0 z-[100] bg-background-dark/80 backdrop-blur-3xl border-b border-white/5 px-4 lg:px-12 py-6 lg:py-8">
                <div className="max-w-none w-full flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-0">
                    <div className="flex items-center gap-4 lg:gap-8 w-full sm:w-auto">
                        <button onClick={() => navigate('/pro')} className="size-10 lg:size-14 rounded-xl lg:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all shrink-0">
                            <span className="material-symbols-outlined font-black">arrow_back</span>
                        </button>
                        <div className="min-w-0">
                            <h1 className="font-display font-black text-white italic tracking-[0.1em] lg:tracking-[0.2em] uppercase leading-none text-lg lg:text-3xl truncate">
                                Saídas de Caixa
                            </h1>
                            <p className="text-[7px] lg:text-[10px] text-primary font-black uppercase tracking-[0.3em] lg:tracking-[0.4em] mt-2 lg:mt-3 opacity-80 leading-none truncate">Gestão de Passivos Elite</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="w-full sm:w-auto gold-gradient text-background-dark px-6 lg:px-10 py-3 lg:py-4 rounded-[12px] lg:rounded-[20px] flex items-center justify-center gap-2 lg:gap-4 shadow-gold active:scale-95 transition-all group overflow-hidden relative"
                    >
                        <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        <span className="material-symbols-outlined font-black text-lg lg:text-xl">add_card</span>
                        <span className="text-[9px] lg:text-[11px] font-black uppercase tracking-widest whitespace-nowrap">Novo Lançamento</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth px-4 lg:px-12 py-8 lg:py-12">
                <div className="max-w-none w-full space-y-10 lg:space-y-16">

                    {/* Totals Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-10">
                        <div className="bg-surface-dark/40 border border-white/5 p-6 lg:p-8 rounded-[24px] lg:rounded-[40px] backdrop-blur-3xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 lg:p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-4xl lg:text-6xl text-emerald-500">check_circle</span>
                            </div>
                            <p className="text-[8px] lg:text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] lg:tracking-[0.4em] mb-3 lg:mb-4 italic">Total Liquidado</p>
                            <h2 className="text-2xl lg:text-4xl font-display font-black text-white italic tracking-tighter">
                                R$ {totals.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h2>
                            <div className="mt-4 h-1 w-12 bg-emerald-500/40 rounded-full"></div>
                        </div>

                        <div className="bg-amber-500/5 border border-amber-500/10 p-6 lg:p-8 rounded-[24px] lg:rounded-[40px] backdrop-blur-3xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 lg:p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-4xl lg:text-6xl text-amber-500">pending_actions</span>
                            </div>
                            <p className="text-[8px] lg:text-[10px] text-amber-500/60 font-black uppercase tracking-[0.3em] lg:tracking-[0.4em] mb-3 lg:mb-4 italic">Contas à Pagar</p>
                            <h2 className="text-2xl lg:text-4xl font-display font-black text-amber-500 italic tracking-tighter">
                                R$ {totals.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h2>
                            <div className="mt-4 h-1 w-12 bg-amber-500/40 rounded-full"></div>
                        </div>

                        <div className="hidden lg:block bg-white/5 border border-white/5 p-6 lg:p-8 rounded-[24px] lg:rounded-[40px] backdrop-blur-3xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 lg:p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-4xl lg:text-6xl text-primary font-black italic tracking-tighter leading-none opacity-20">A</span>
                            </div>
                            <p className="text-[8px] lg:text-[10px] text-slate-600 font-black uppercase tracking-[0.3em] lg:tracking-[0.4em] mb-3 lg:mb-4 italic">Volume Mensal</p>
                            <h2 className="text-2xl lg:text-4xl font-display font-black text-white italic tracking-tighter">
                                {expenses.length} <span className="text-xs font-black uppercase opacity-40">Registros</span>
                            </h2>
                            <div className="mt-4 h-1 w-12 bg-primary/40 rounded-full"></div>
                        </div>
                    </div>

                    {/* Expenses List */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 px-2">
                            <div className="h-0.5 w-8 bg-primary"></div>
                            <h3 className="text-[9px] lg:text-[11px] font-black text-primary uppercase tracking-[0.4em] lg:tracking-[0.6em]">Extrato Financeiro</h3>
                        </div>

                        {/* DESKTOP TABLE */}
                        <div className="hidden sm:block bg-surface-dark/20 rounded-[24px] lg:rounded-[40px] border border-white/5 overflow-hidden backdrop-blur-2xl shadow-2xl">
                            <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-white/[0.01]">
                                            <th className="p-6 text-[9px] lg:text-[11px] font-black text-primary uppercase tracking-[0.3em] italic">Timeline</th>
                                            <th className="p-6 text-[9px] lg:text-[11px] font-black text-primary uppercase tracking-[0.3em] italic">Descrição</th>
                                            <th className="p-6 text-[9px] lg:text-[11px] font-black text-primary uppercase tracking-[0.3em] italic">Serviço/Categoria</th>
                                            <th className="p-6 text-[9px] lg:text-[11px] font-black text-primary uppercase tracking-[0.3em] italic text-right">Valor</th>
                                            <th className="p-6 text-[9px] lg:text-[11px] font-black text-primary uppercase tracking-[0.3em] italic text-center">Status</th>
                                            <th className="p-6"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {expenses.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-24 text-center">
                                                    <div className="space-y-4 opacity-20">
                                                        <span className="material-symbols-outlined text-6xl font-black">receipt_long</span>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.5em]">Sem lançamentos ativos</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            expenses.map(expense => (
                                                <tr key={expense.id} className="hover:bg-white/[0.02] transition-all group">
                                                    <td className="p-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] lg:text-[12px] font-black text-white italic tracking-tighter">
                                                                {new Date(expense.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()}
                                                            </span>
                                                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1 italic">
                                                                {new Date(expense.date).getFullYear()}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`size-10 rounded-xl flex items-center justify-center border shrink-0 ${categoryColors[expense.category] || categoryColors['Outros']}`}>
                                                                <span className="material-symbols-outlined text-lg font-black">
                                                                    {categoryIcons[expense.category] || categoryIcons['Outros']}
                                                                </span>
                                                            </div>
                                                            <span className="text-[11px] lg:text-[14px] font-display font-black text-white uppercase italic tracking-tight group-hover:text-primary transition-all">
                                                                {expense.description}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <span className={`px-3 py-1.5 rounded-full text-[8px] lg:text-[9px] font-black uppercase tracking-[0.15em] border ${categoryColors[expense.category] || categoryColors['Outros']}`}>
                                                            {expense.category.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="p-6 text-right">
                                                        <span className="text-lg lg:text-xl font-display font-black text-white italic leading-none">
                                                            R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        <div className="flex justify-center">
                                                            <span className={`px-3 py-1.5 rounded-lg text-[8px] lg:text-[9px] font-black uppercase tracking-widest border transition-all ${expense.status === 'paid'
                                                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                                                                }`}>
                                                                {expense.status === 'paid' ? 'LIQUIDADO' : 'À PAGAR'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-6 text-right w-20">
                                                        <button
                                                            onClick={() => handleDeleteExpense(expense.id)}
                                                            className="size-9 rounded-xl bg-red-500/5 text-red-500/40 border border-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">delete</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* MOBILE LIST */}
                        <div className="sm:hidden space-y-4">
                            {expenses.length === 0 ? (
                                <div className="p-20 text-center opacity-20 border border-white/5 rounded-3xl bg-surface-dark/10">
                                    <span className="material-symbols-outlined text-5xl mb-4">receipt_long</span>
                                    <p className="text-[9px] font-black uppercase tracking-widest">Sem lançamentos</p>
                                </div>
                            ) : (
                                expenses.map(expense => (
                                    <div key={expense.id} className="bg-surface-dark/40 border border-white/5 rounded-2xl p-4 flex items-center gap-4 relative group active:scale-[0.98] transition-all">
                                        <div className={`size-12 rounded-xl flex items-center justify-center border shrink-0 ${categoryColors[expense.category] || categoryColors['Outros']}`}>
                                            <span className="material-symbols-outlined text-xl font-black">{categoryIcons[expense.category] || categoryIcons['Outros']}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="text-[11px] font-display font-black text-white uppercase italic truncate">
                                                    {expense.description}
                                                </h4>
                                                <span className="text-[12px] font-display font-black text-white italic shrink-0 ml-2">
                                                    R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">
                                                    {new Date(expense.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border ${expense.status === 'paid' ? 'text-emerald-500 border-emerald-500/20' : 'text-amber-500 border-amber-500/20'
                                                    }`}>
                                                    {expense.status === 'paid' ? 'OK' : 'PENDENTE'}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteExpense(expense.id)}
                                            className="size-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 border border-red-500/20"
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Modal de Lançamento Responsivo */}
            {showAddModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-6 bg-background-dark/95 backdrop-blur-3xl animate-fade-in overflow-y-auto no-scrollbar">
                    <div className="relative bg-surface-dark border border-white/10 rounded-[32px] lg:rounded-[48px] w-full max-w-lg my-auto overflow-hidden shadow-3xl animate-scale-in">
                        <div className="absolute top-0 left-0 w-full h-1 gold-gradient"></div>

                        <div className="p-8 lg:p-12 space-y-10 lg:space-y-12">
                            <div className="flex justify-between items-center bg-black/20 -mx-8 -mt-8 p-8 border-b border-white/5">
                                <div>
                                    <h2 className="text-xl lg:text-3xl font-display font-black text-white uppercase italic tracking-tight leading-none">Novo Registro</h2>
                                    <p className="text-[8px] lg:text-[10px] text-primary font-black uppercase tracking-[0.4em] mt-3 lg:mt-4 opacity-80">Timeline de Passivos</p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="size-10 lg:size-14 rounded-xl lg:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all active:scale-90 bg-black/40">
                                    <span className="material-symbols-outlined text-xl lg:text-2xl font-black">close</span>
                                </button>
                            </div>

                            <form onSubmit={handleAddExpense} className="space-y-6 lg:space-y-8">
                                <div className="space-y-2 lg:space-y-3">
                                    <label className="text-[8px] lg:text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">Descrição do Gasto</label>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            value={newExpense.description}
                                            onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                                            placeholder="Ex: Aluguel Fevereiro"
                                            className="w-full bg-black/40 border-2 border-white/5 rounded-xl lg:rounded-2xl p-4 lg:p-6 text-white text-xs lg:text-sm font-black tracking-widest placeholder:text-slate-800 placeholder:font-black focus:border-primary outline-none transition-all shadow-inner"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2 lg:space-y-3">
                                        <label className="text-[8px] lg:text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">Valor de Saída</label>
                                        <div className="relative group">
                                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-primary font-display font-black italic text-sm lg:text-base">R$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={newExpense.amount}
                                                onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                                                placeholder="0,00"
                                                className="w-full bg-black/40 border-2 border-white/5 rounded-xl lg:rounded-2xl p-4 lg:p-6 pl-12 lg:pl-16 text-white text-lg lg:text-xl font-display font-black italic focus:border-primary outline-none transition-all shadow-inner"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2 lg:space-y-3">
                                        <label className="text-[8px] lg:text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">Categoria</label>
                                        <div className="relative">
                                            <select
                                                value={newExpense.category}
                                                onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
                                                className="w-full bg-black/40 border-2 border-white/5 rounded-xl lg:rounded-2xl p-4 lg:p-6 text-white text-[10px] lg:text-xs font-black uppercase tracking-[0.15em] focus:border-primary outline-none transition-all shadow-inner appearance-none cursor-pointer"
                                            >
                                                {categories.map(c => <option key={c} value={c} className="bg-surface-dark text-white p-4 font-black">{c.toUpperCase()}</option>)}
                                            </select>
                                            <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-primary pointer-events-none font-black text-lg">expand_more</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2 lg:space-y-3">
                                        <label className="text-[8px] lg:text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">Data do Pagamento</label>
                                        <input
                                            type="date"
                                            value={newExpense.date}
                                            onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                                            className="w-full bg-black/40 border-2 border-white/5 rounded-xl lg:rounded-2xl p-4 lg:p-6 text-white text-xs lg:text-sm font-black tracking-widest focus:border-primary outline-none transition-all shadow-inner uppercase"
                                        />
                                    </div>
                                    <div className="space-y-2 lg:space-y-3">
                                        <label className="text-[8px] lg:text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">Status do Fluxo</label>
                                        <div className="flex bg-black/40 p-1.5 rounded-xl lg:rounded-2xl border-2 border-white/5 shadow-inner">
                                            <button
                                                type="button"
                                                onClick={() => setNewExpense({ ...newExpense, status: 'paid' })}
                                                className={`flex-1 py-3 lg:py-4 rounded-lg lg:rounded-xl text-[8px] lg:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${newExpense.status === 'paid' ? 'gold-gradient text-background-dark shadow-gold-sm' : 'text-slate-600'}`}
                                            >
                                                <span className="material-symbols-outlined font-black text-xs lg:text-sm">check_circle</span>
                                                LIQUIDADO
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewExpense({ ...newExpense, status: 'pending' })}
                                                className={`flex-1 py-3 lg:py-4 rounded-lg lg:rounded-xl text-[8px] lg:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${newExpense.status === 'pending' ? 'bg-white/10 text-white' : 'text-slate-600'}`}
                                            >
                                                <span className="material-symbols-outlined font-black text-xs lg:text-sm">schedule</span>
                                                À PAGAR
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" className="w-full gold-gradient text-background-dark py-5 lg:py-7 rounded-2xl lg:rounded-3xl text-[10px] lg:text-xs font-black uppercase tracking-[0.4em] shadow-gold-sm hover:brightness-110 transition-all active:scale-[0.98] mt-4 group relative overflow-hidden">
                                    <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                                    Confirmar Lançamento Elite
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tasks;
