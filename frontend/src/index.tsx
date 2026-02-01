
import React, { Component, ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import 'leaflet/dist/leaflet.css';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Fixed: Explicitly using 'React.Component' with generic types and declaring the state property to ensure 'this.props' and 'this.state' are correctly recognized by TypeScript.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public props!: ErrorBoundaryProps;
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Error Catch:", error, errorInfo);
  }

  render() {
    // Fixed: 'this.state' is now correctly recognized as part of the React.Component instance.
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-background-dark text-white p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-danger mb-6">sentiment_broken</span>
          <h1 className="text-xl font-display font-bold mb-2">Ops! Falha na Montagem.</h1>
          <p className="text-sm text-slate-400 mb-6">Encontramos um problema ao iniciar a interface.</p>
          <pre className="text-[10px] text-left text-slate-500 bg-surface-dark p-4 rounded-xl overflow-auto w-full max-h-40 border border-white/5 mb-6">
            {/* Fixed: Correctly accessing state.error. */}
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-primary text-background-dark font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg active:scale-95 transition-all"
          >
            Reiniciar Aplicativo
          </button>
        </div>
      );
    }

    return this.props.children || null;
  }
}

const container = document.getElementById('root');
const loader = document.getElementById('app-loader');

// Supress Recharts defaultProps warning (known issue with React 18+)
const error = console.error;
console.error = (...args: any[]) => {
  if (/defaultProps/.test(args[0])) return;
  error(...args);
};

if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );

    // Ocultar o loader apenas quando o React estiver pronto e a animação "respirar" um pouco
    setTimeout(() => {
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
          if (loader.parentNode) loader.parentNode.removeChild(loader);
        }, 800);
      }
    }, 2500);

  } catch (error) {
    console.error("Erro fatal na montagem:", error);
    if (loader) {
      loader.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 20px;">Falha Crítica na Inicialização.</p>';
    }
  }
}
