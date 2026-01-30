
import React, { createContext, useContext, useState, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toast, setToast] = useState<{ show: boolean; message: string; type: ToastType }>({
        show: false,
        message: '',
        type: 'info',
    });

    const showToast = (message: string, type: ToastType = 'info') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast.show && (
                <div className="fixed inset-x-0 bottom-24 flex justify-center px-6 z-[9999] pointer-events-none">
                    <div className={`
            max-w-[400px] w-full p-5 rounded-[24px] shadow-2xl animate-slide-up 
            flex items-center gap-4 border backdrop-blur-xl pointer-events-auto
            ${toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                            toast.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                                'bg-primary/20 border-primary/30 text-primary'}
          `}>
                        <span className="material-symbols-outlined text-xl">
                            {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
                        </span>
                        <p className="text-[10px] font-black uppercase tracking-widest flex-1 leading-relaxed">
                            {toast.message}
                        </p>
                    </div>
                </div>
            )}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
