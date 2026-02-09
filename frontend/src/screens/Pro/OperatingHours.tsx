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
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca', label: 'Terça-feira' },
  { key: 'quarta', label: 'Quarta-feira' },
  { key: 'quinta', label: 'Quinta-feira' },
  { key: 'sexta', label: 'Sexta-feira' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' }
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
      console.warn("Save Operating Hours aborted: Missing salon.id", { salon });
      showToast("Unidade não identificada. Tente recarregar a página.", "error");
      return;
    }
    setIsLoading(true);
    try {
      const updated = await api.salons.update(salon.id, { horario_funcionamento: hours });
      onSave(updated);
      showToast('Horários de funcionamento atualizados!', 'success');
      navigate('/pro');
    } catch (error: any) {
      console.error(error);
      showToast('Erro ao salvar horários: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto h-full no-scrollbar">
      <header className="p-6 pt-16 flex items-center justify-between sticky top-0 bg-background-dark/60 backdrop-blur-xl z-50 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="text-white size-10 flex items-center justify-center rounded-full border border-white/5 active:scale-95 transition-all">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-display text-xl font-black text-white italic tracking-tight uppercase">Horários</h1>
        <button onClick={handleSave} disabled={isLoading} className="text-primary font-black text-[10px] uppercase tracking-[0.2em] bg-primary/10 px-4 py-2 rounded-xl border border-primary/20 shadow-lg active:scale-95 transition-all">
          {isLoading ? 'Salvando...' : 'Salvar'}
        </button>
      </header>

      <main className="p-6 space-y-6 pb-40 max-w-[450px] mx-auto animate-fade-in">
        <div className="bg-surface-dark border border-white/5 rounded-[40px] p-8 shadow-2xl space-y-6">
          <div>
            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-2">Configuração Semanal</h3>
            <p className="text-xs text-slate-500">Defina os horários de funcionamento da sua unidade</p>
          </div>

          <div className="space-y-4">
            {DAYS_OF_WEEK.map(({ key, label }) => {
              const dayData = hours[key] || { closed: true, open: '09:00', close: '18:00' };
              return (
                <div key={key} className="bg-background-dark rounded-3xl p-5 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-bold text-sm">{label}</span>
                    <button
                      onClick={() => toggleDay(key)}
                      className={`relative w-14 h-7 rounded-full transition-all ${!dayData.closed ? 'bg-primary' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 size-5 rounded-full bg-white shadow-lg transition-all ${!dayData.closed ? 'left-8' : 'left-1'}`} />
                    </button>
                  </div>

                  {!dayData.closed && (
                    <div className="grid grid-cols-2 gap-4 animate-fade-in">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Abertura</label>
                        <input
                          type="time"
                          value={dayData.open}
                          onChange={(e) => updateTime(key, 'open', e.target.value)}
                          className="w-full bg-surface-dark border border-white/10 rounded-2xl p-3 text-white text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Fechamento</label>
                        <input
                          type="time"
                          value={dayData.close}
                          onChange={(e) => updateTime(key, 'close', e.target.value)}
                          className="w-full bg-surface-dark border border-white/10 rounded-2xl p-3 text-white text-sm outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={handleSave} disabled={isLoading} className="w-full gold-gradient text-background-dark py-6 rounded-[32px] font-black uppercase tracking-[0.4em] text-[13px] shadow-[0_20px_50px_rgba(193,165,113,0.3)] active:scale-95 transition-all">
          {isLoading ? 'Salvando...' : 'Sincronizar Horários'}
        </button>
      </main>
    </div>
  );
};

export default OperatingHours;