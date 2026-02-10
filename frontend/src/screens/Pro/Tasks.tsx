import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Task {
    id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'completed';
    dueDate: string;
}

const Tasks: React.FC = () => {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([
        {
            id: '1',
            title: 'Finalizar Curadoria Capilar',
            description: 'Revisar produtos da linha Aura para a cliente Maria.',
            priority: 'high',
            status: 'pending',
            dueDate: 'Hoje, 18:00',
        },
        {
            id: '2',
            title: 'Estoque de Ativos',
            description: 'Repor ampolas de tratamento hidratante.',
            priority: 'medium',
            status: 'pending',
            dueDate: 'Amanhã',
        },
        {
            id: '3',
            title: 'Reunião VIP',
            description: 'Alinhamento com a equipe sobre novos rituais.',
            priority: 'low',
            status: 'completed',
            dueDate: 'Ontem',
        },
    ]);

    const PriorityBadge = ({ priority }: { priority: string }) => {
        const colors = {
            high: 'text-red-500 bg-red-500/10 border-red-500/20',
            medium: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
            low: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        };
        return (
            <span className={`px-3 sm:px-3 lg:px-3 py-1 sm:py-1 lg:py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${colors[priority as keyof typeof colors]}`}>
                {priority}
            </span>
        );
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background-dark relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-full max-w-[500px] h-auto min-h-[500px] bg-primary/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

            {/* FIXED HEADER - Mobile & Desktop adaptation */}
            <header className="sticky top-0 z-50 bg-background-dark/90 backdrop-blur-3xl border-b border-white/5 px-4 sm:px-4 lg:px-4 lg:px-12 sm:px-12 lg:px-12 py-3 sm:py-3 lg:py-3 lg:py-10 sm:py-10 lg:py-10">
                <div className="max-w-full max-w-[1400px] mx-auto w-full flex items-center justify-between">
                    <div className="flex flex-col">
                        <h1 className="font-display font-black text-white italic tracking-[0.2em] uppercase leading-none text-base lg:text-3xl lg:text-3xl">
                            Central de Tarefas
                        </h1>
                        <p className="text-[7px] lg:text-[10px] text-primary font-black uppercase tracking-[0.4em] mt-2 lg:mt-3 opacity-80 leading-none">Gestão de Fluxo Elite</p>
                    </div>

                    {/* Desktop "+ Nova Tarefa" Button in Top Header */}
                    <button className="hidden lg:flex gold-gradient text-background-dark px-8 sm:px-8 lg:px-8 py-4 sm:py-4 lg:py-4 rounded-[20px] items-center gap-4 lg:gap-4 shadow-gold active:scale-95 transition-all group overflow-hidden relative">
                        <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                        <span className="material-symbols-outlined font-black">add</span>
                        <span className="text-[11px] font-black uppercase tracking-widest">Nova Tarefa</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth px-4 lg:px-8 py-6 lg:py-10">
                <div className="max-w-[1400px] mx-auto w-full space-y-8 lg:space-y-12 pb-40">

                    {/* Mobile Button */}
                    <button className="lg:hidden w-full gold-gradient text-background-dark p-4 rounded-2xl flex items-center justify-center gap-3 shadow-gold active:scale-95 transition-all mb-4">
                        <span className="material-symbols-outlined text-xl font-black">add_task</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Nova Tarefa</span>
                    </button>

                    {/* Tasks Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
                        {tasks.map((task) => (
                            <div
                                key={task.id}
                                className={`group relative bg-surface-dark/40 rounded-3xl border border-white/5 p-6 shadow-2xl transition-all hover:border-primary/30 backdrop-blur-3xl overflow-hidden flex flex-col justify-between h-full min-h-[220px] ${task.status === 'completed' ? 'opacity-60 grayscale' : ''}`}
                            >
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <PriorityBadge priority={task.priority} />
                                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{task.dueDate}</span>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className={`font-display text-lg lg:text-xl font-black text-white italic tracking-tighter uppercase group-hover:text-primary transition-colors ${task.status === 'completed' ? 'line-through' : ''}`}>
                                            {task.title}
                                        </h3>
                                        <p className="text-[9px] lg:text-[10px] text-slate-500 font-medium leading-relaxed italic line-clamp-3">
                                            {task.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`size-8 rounded-lg flex items-center justify-center border transition-all ${task.status === 'completed' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500' : 'bg-white/5 border-white/10 text-slate-700'}`}>
                                            <span className="material-symbols-outlined text-lg font-black">
                                                {task.status === 'completed' ? 'check_circle' : 'radio_button_unchecked'}
                                            </span>
                                        </div>
                                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">
                                            {task.status === 'completed' ? 'Concluída' : 'Em Aberto'}
                                        </span>
                                    </div>

                                    <button className="size-8 rounded-lg bg-white/5 border border-white/10 text-slate-500 flex items-center justify-center hover:text-white transition-all">
                                        <span className="material-symbols-outlined text-base">more_vert</span>
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Empty State Card */}
                        <div className="hidden lg:flex group relative bg-background-dark/20 border-2 border-dashed border-white/5 rounded-3xl p-8 items-center justify-center text-center cursor-pointer hover:border-primary/30 transition-all hover:bg-surface-dark/20">
                            <div className="space-y-4">
                                <div className="size-14 rounded-full bg-white/5 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-3xl text-slate-800">add</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-700">Adicionar Tarefa</p>
                                    <p className="text-[8px] text-slate-800 font-bold uppercase tracking-widest mt-2">Criar nova demanda</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Tasks;
