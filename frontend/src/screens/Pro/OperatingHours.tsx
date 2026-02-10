import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Salon } from '../../types';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

interface OperatingHoursProps {
  salon: Salon | undefined;
  onSave: (salon: Salon) => void;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

const OperatingHours: React.FC<OperatingHoursProps> = ({ salon, onSave }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [hours, setHours] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (salon?.horario_funcionamento) {
      setHours(salon.horario_funcionamento);
    }
  }, [salon]);

  const toggleDay = (day: string) => {
    setHours((prev: any) => ({
      ...prev,
      [day]: prev[day]?.closed === false ? { ...prev[day], closed: true } : { closed: false, open: '09:00', close: '18:00' }
    }));
  };

  const updateTime = (day: string, field: 'open' | 'close', value: string) => {
    setHours((prev: any) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const handleSave = async () => {
    if (!salon?.id) {
      console.error("Aura: Falha ao salvar - Unidade (salon.id) está undefined", { salon });
      showToast("Ops! Não conseguimos identificar sua unidade. Tente atualizar a página ou fazer login novamente.", "error");
      return;
    }
    setIsLoading(true);
    try {
      const updated = await api.salons.update(salon.id, { horario_funcionamento: hours });
      onSave(updated);
      showToast('Horários de funcionamento atualizados!', 'success');
      navigate('/pro');
    } catch (error: any) {
      console.error("Aura: Erro ao salvar horários:", error);
      showToast('Erro ao salvar horários: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!salon) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background-dark p-8 sm:p-8 lg:p-8">
        <div className="size-10 sm:size-12 lg:size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6"></div>
        <p className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">Sincronizando dados da unidade...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto h-full no-scrollbar">
      <header className="px-4 lg:px-6 pt-2 lg:pt-16 pb-2 lg:pb-6 flex items-center justify-between sticky top-0 bg-background-dark/60 backdrop-blur-xl z-50 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="text-white size-9 lg:size-10 flex items-center justify-center rounded-full border border-white/5 active:scale-95 transition-all">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
        </button>
        <h1 className="font-display text-base lg:text-xl font-black text-white italic tracking-tight uppercase">Horários</h1>
        <button onClick={handleSave} disabled={isLoading} className="text-primary font-black text-[9px] lg:text-[10px] uppercase tracking-[0.2em] bg-primary/10 px-4 sm:px-4 lg:px-4 py-2 sm:py-2 lg:py-2 rounded-xl border border-primary/20 shadow-lg active:scale-95 transition-all">
          {isLoading ? 'Salvando...' : 'Salvar'}
        </button>
      </header>

      <main className="p-6 lg:p-12 space-y-12 pb-40 max-w-[1400px] mx-auto w-full animate-fade-in">
        <div className="bg-surface-dark border border-white/5 rounded-3xl lg:rounded-[40px] p-8 lg:p-12 shadow-2xl space-y-10">
          <div>
            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-2 text-center lg:text-left">Configuração Semanal</h3>
            <p className="text-xs text-slate-500 text-center lg:text-left">Defina os horários de funcionamento da sua unidade</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {DAYS_OF_WEEK.map(({ key, label }) => {
              const dayData = hours[key] || { closed: true, open: '09:00', close: '18:00' };
              return (
                <div key={key} className={`bg-background-dark rounded-3xl p-6 border transition-all ${!dayData.closed ? 'border-primary/20 shadow-lg' : 'border-white/5 opacity-80 hover:opacity-100'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <span className={`font-display font-black uppercase italic tracking-tighter ${!dayData.closed ? 'text-white text-lg' : 'text-slate-600 text-base'}`}>{label}</span>
                    <button
                      onClick={() => toggleDay(key)}
                      className={`relative w-14 h-7 rounded-full transition-all duration-300 ${!dayData.closed ? 'bg-primary' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 size-5 rounded-full shadow-xl transition-all duration-300 ${!dayData.closed ? 'left-8 bg-black' : 'left-1 bg-white'}`} />
                    </button>
                  </div>

                  {!dayData.closed ? (
                    <div className="grid grid-cols-2 gap-4 animate-fade-in">
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block text-center">Abertura</label>
                        <input
                          type="time"
                          value={dayData.open}
                          onChange={(e) => updateTime(key, 'open', e.target.value)}
                          className="w-full bg-surface-dark border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-primary text-center font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block text-center">Fechamento</label>
                        <input
                          type="time"
                          value={dayData.close}
                          onChange={(e) => updateTime(key, 'close', e.target.value)}
                          className="w-full bg-surface-dark border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-primary text-center font-bold"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-[68px] flex items-center justify-center border-2 border-dashed border-white/[0.03] rounded-2xl">
                      <span className="text-[9px] font-black text-slate-800 uppercase tracking-[0.2em]">Unidade Fechada</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="max-w-md mx-auto">
          <button onClick={handleSave} disabled={isLoading} className="w-full gold-gradient text-background-dark py-6 rounded-3xl font-black uppercase tracking-[0.4em] text-[13px] shadow-[0_20px_50px_rgba(193,165,113,0.3)] active:scale-95 transition-all">
            {isLoading ? 'Salvando...' : 'Sincronizar Horários'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default OperatingHours;