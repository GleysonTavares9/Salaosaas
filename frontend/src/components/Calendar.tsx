import React, { useState } from 'react';

interface CalendarProps {
    selectedDate: string;
    onDateSelect: (date: string) => void;
    bookedDates?: Record<string, number>;
}

const Calendar: React.FC<CalendarProps> = ({ selectedDate, onDateSelect, bookedDates = {} }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const monthName = currentMonth.toLocaleString('pt-BR', { month: 'long' });

    const days = [];
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    // Padding for start of month
    for (let i = 0; i < startDay; i++) {
        days.push(<div key={`empty-${i}`} className="size-10 sm:size-12 lg:size-10"></div>);
    }

    for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const isSelected = dateStr === selectedDate;
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        const bookingCount = bookedDates[dateStr] || 0;
        const hasBooking = bookingCount > 0;

        days.push(
            <button
                key={d}
                onClick={() => onDateSelect(dateStr)}
                title={hasBooking ? `${bookingCount} atendimento${bookingCount > 1 ? 's' : ''}` : undefined}
                className={`size-10 sm:size-12 lg:size-10 rounded-xl flex flex-col items-center justify-center text-[10px] font-black uppercase transition-all relative
          ${isSelected ? 'bg-primary text-background-dark shadow-lg scale-110' :
                        isToday ? 'border border-primary text-primary' : 'text-white/60 hover:bg-white/5'}`}
            >
                {d}
                {hasBooking && !isSelected && (
                    <div className="absolute bottom-1 size-1 bg-primary rounded-full"></div>
                )}
            </button>
        );
    }

    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    return (
        <div className="bg-surface-dark/80 backdrop-blur-xl border border-white/5 rounded-2xl sm:rounded-3xl lg:rounded-[32px] p-6 sm:p-6 lg:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-sm font-black text-white italic uppercase tracking-tighter text-capitalize">
                    {monthName} <span className="text-primary text-[10px] ml-1">{year}</span>
                </h3>
                <div className="flex gap-2 lg:gap-2">
                    <button onClick={handlePrevMonth} className="size-8 rounded-lg bg-white/5 flex items-center justify-center text-white active:scale-90 transition-all">
                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                    </button>
                    <button onClick={handleNextMonth} className="size-8 rounded-lg bg-white/5 flex items-center justify-center text-white active:scale-90 transition-all">
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 lg:gap-1 mb-2">
                {weekDays.map((wd, idx) => (
                    <div key={`${wd}-${idx}`} className="size-10 sm:size-12 lg:size-10 flex items-center justify-center text-[8px] font-black text-slate-600 uppercase">
                        {wd}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1 lg:gap-1">
                {days}
            </div>
        </div>
    );
};

export default Calendar;
