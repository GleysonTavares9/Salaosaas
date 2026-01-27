
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

const Evaluation: React.FC = () => {
  const { id } = useParams(); // appointment ID
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [appointment, setAppointment] = useState<any>(null);

  useEffect(() => {
    const fetchAppointment = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setAppointment(data);
      } catch (error) {
        console.error('Error fetching appointment:', error);
        alert('Erro ao carregar agendamento');
        navigate('/my-appointments');
      }
    };
    fetchAppointment();
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return alert("Por favor, selecione uma nota.");
    if (!appointment) return alert("Agendamento não encontrado");

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      await api.reviews.create({
        appointment_id: appointment.id,
        salon_id: appointment.salon_id,
        professional_id: appointment.professional_id,
        client_id: user.id,
        rating,
        comment: comment.trim() || undefined
      });

      setIsSuccess(true);
      setTimeout(() => navigate('/my-appointments'), 2000);
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Erro ao enviar avaliação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex-1 bg-background-dark flex flex-col items-center justify-center p-10 text-center animate-fade-in">
        <div className="size-24 rounded-full gold-gradient flex items-center justify-center shadow-[0_0_50px_rgba(193,165,113,0.3)] mb-8">
          <span className="material-symbols-outlined text-5xl text-background-dark font-black">verified</span>
        </div>
        <h2 className="text-3xl font-display font-black text-white italic mb-2">Aura Verified</h2>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-widest leading-relaxed">Obrigado! Sua avaliação impacta diretamente <br /> no ranking de excelência da nossa rede.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background-dark min-h-screen flex flex-col p-8 overflow-y-auto no-scrollbar">
      <header className="pt-8 pb-12 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
          <span className="material-symbols-outlined">close</span>
        </button>
        <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Avaliar Experiência</span>
      </header>

      <main className="flex-1 flex flex-col items-center max-w-sm mx-auto w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-display font-black text-white italic tracking-tighter mb-4 leading-none">Sua <span className="text-primary">Opinião</span> <br /> é Arte.</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">O quão excepcional foi seu atendimento?</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-12">
          {/* STAR RATING INTERATIVO */}
          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="transition-all active:scale-90"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
              >
                <span className={`material-symbols-outlined text-5xl ${star <= (hover || rating) ? 'text-primary fill-1' : 'text-slate-800'
                  }`}>
                  star
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Detalhes do Atendimento</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Como foi o resultado? Recomendaria o profissional?"
                className="w-full bg-surface-dark border border-white/5 rounded-[32px] p-6 text-white text-sm outline-none focus:border-primary/50 transition-all shadow-inner h-40 resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || rating === 0}
            className="w-full gold-gradient text-background-dark font-black py-5 rounded-2xl shadow-2xl uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
          >
            {isSubmitting ? (
              <div className="size-5 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div>
            ) : (
              'Finalizar Avaliação'
            )}
          </button>
        </form>
      </main>
    </div>
  );
};

export default Evaluation;
