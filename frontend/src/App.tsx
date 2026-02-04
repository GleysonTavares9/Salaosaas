
// Luxe Aura Premium - v1.0.1 - Deploy Automático Ativo
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ViewRole, Appointment, Service, Salon, Product, Professional, GalleryItem } from './types.ts';
import BottomNav from './components/BottomNav.tsx';
import AIConcierge from './components/AIConcierge.tsx';
import { api } from './lib/api.ts';
import { supabase } from './lib/supabase.ts';
import { SplashScreen } from '@capacitor/splash-screen';

// Screens
import QuickSchedule from './screens/Public/QuickSchedule';
import Landing from './screens/Public/Landing.tsx';
import Discovery from './screens/Client/Discovery.tsx';
import SalonPage from './screens/Client/SalonPage.tsx';
import SelectService from './screens/Client/SelectService.tsx';
import ChooseTime from './screens/Client/ChooseTime.tsx';
import Checkout from './screens/Client/Checkout.tsx';
import MyAppointments from './screens/Client/MyAppointments.tsx';
import Profile from './screens/Client/Profile.tsx';
import ProductShowcase from './screens/Client/ProductShowcase.tsx';
import Evaluation from './screens/Client/Evaluation.tsx';
import Gallery from './screens/Client/Gallery.tsx';
import Dashboard from './screens/Pro/Dashboard.tsx';
import Schedule from './screens/Pro/Schedule.tsx';
import ServiceCatalog from './screens/Pro/ServiceCatalog.tsx';
import AdminBookings from './screens/Pro/AdminBookings.tsx';
import BusinessSetup from './screens/Pro/BusinessSetup.tsx';
import TeamManagement from './screens/Pro/TeamManagement.tsx';
import OperatingHours from './screens/Pro/OperatingHours.tsx';
import ProductCatalog from './screens/Pro/ProductCatalog.tsx';
import Analytics from './screens/Pro/Analytics.tsx';
import AuthClient from './screens/Auth/AuthClient.tsx';
import ChatList from './screens/Chat/ChatList.tsx';
import ChatRoom from './screens/Chat/ChatRoom.tsx';
import PartnerLogin from './screens/Auth/PartnerLogin.tsx';
import PartnerRegister from './screens/Auth/PartnerRegister.tsx';
import UserRegister from './screens/Auth/UserRegister.tsx';
import ResetPassword from './screens/Auth/ResetPassword.tsx';
import SaaSMaster from './screens/Pro/SaaSMaster.tsx';
import Billing from './screens/Pro/Billing.tsx';
import PrivacyPolicy from './screens/Public/PrivacyPolicy.tsx';
import TermsOfUse from './screens/Public/TermsOfUse.tsx';
import { ToastProvider, useToast } from './contexts/ToastContext.tsx';

interface BookingDraft {
  salonId?: string;
  salonName?: string;
  services: Service[];
  products: Product[];
  professionalId?: string;
  professionalName?: string;
  date?: string;
  time?: string;
}

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const scrollContainer = document.querySelector('.flex-1.overflow-y-auto');
    if (scrollContainer) scrollContainer.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<ViewRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [salons, setSalons] = useState<Salon[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>({ services: [], products: [] });
  const [isEmailConfirmed, setIsEmailConfirmed] = useState<boolean>(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isMaster, setIsMaster] = useState<boolean>(false);
  const { showToast } = useToast();

  const fetchSalons = async (userId?: string, userRole?: string, masterStatus?: boolean) => {
    try {
      // Helper para Timeout de Rede (Aumentado para 15s para conexões oscilantes)
      const withTimeout = <T,>(promise: PromiseLike<T> | Promise<T>, ms = 15000): Promise<T> => {
        return Promise.race([
          Promise.resolve(promise),
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout na conexão")), ms))
        ]);
      };

      if (masterStatus) {
        const all = await withTimeout(api.salons.getAll());
        setSalons(all || []);
      } else if (userId && (userRole === 'admin' || userRole === 'pro')) {
        const { data: proData, error: proError } = await withTimeout(supabase
          .from('professionals')
          .select('salon_id')
          .eq('user_id', userId)
          .maybeSingle());

        if (proError) {
          setSalons([]);
          return;
        }

        if (proData?.salon_id) {
          const mySalon = await withTimeout(api.salons.getById(proData.salon_id));
          setSalons(mySalon ? [mySalon] : []);
        } else {
          setSalons([]);
        }
      } else {
        const publicSalons = await withTimeout(api.salons.getAll());
        setSalons(publicSalons || []);
      }
    } catch (err: any) {
      // Falha silenciosa em produção (Retry automático pelo Supabase)
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {

    // 1. Sincronização Inicial e Realtime
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {

      const hashPath = window.location.hash.replace('#', '').split('?')[0];
      const winPath = window.location.pathname;

      // URL Healing
      if (winPath.startsWith('/q/') && !window.location.hash.startsWith('#/q/')) {
        const slugFromPath = winPath.split('/q/')[1];
        if (slugFromPath) {
          window.location.replace(`/#/q/${slugFromPath}`);
          return;
        }
      }

      if (session) {
        const uId = session.user.id;

        // EVITA LOOP: Se o usuário logado for o mesmo e já temos dados, não sincroniza de novo.
        if (uId === currentUserId && salons.length > 0) {
          setIsLoading(false);
          return;
        }

        // Watchdog: Força saída do loading se o servidor demorar demais (>15s)
        const watchdog = setTimeout(() => {
          setIsLoading(current => {
            if (current) {
              return false;
            }
            return false;
          });
        }, 15000);

        try {
          if (uId !== currentUserId) {
            setSalons([]);
            setAppointments([]);
          }

          const uRole = session.user.user_metadata.role || 'client';
          setRole(uRole);
          setCurrentUserId(uId);
          setIsEmailConfirmed(!!session.user.email_confirmed_at);
          setUserEmail(session.user.email || null);

          // Sincronismo do Master (Background)
          if (uRole !== 'client') {
            const checkMaster = async () => {
              try {
                const { data } = await supabase.from('profiles').select('is_master').eq('id', uId).maybeSingle();
                if (data?.is_master) {
                  setIsMaster(true);
                  fetchSalons(uId, uRole, true);
                }
              } catch (e) {
              }
            };
            checkMaster();
          }

          // Busca dados da unidade logada
          await fetchSalons(uId, uRole, false);

          // Navegação Automática
          const isHome = ['', '/', '/explore', '/discovery', '/login', '/register', '/login-user'].includes(hashPath);
          if ((uRole === 'admin' || uRole === 'pro') && isHome) {
            navigate('/pro', { replace: true });
          }
        } catch (err) {
        } finally {
          clearTimeout(watchdog);
        }
      }
      else {
        // Modo Visitante
        setRole(null);
        setCurrentUserId(null);
        setIsMaster(false);

        // Watchdog Visitante
        const guestWatchdog = setTimeout(() => {
          setIsLoading(false);
        }, 10000);

        try {
          await fetchSalons();
        } finally {
          clearTimeout(guestWatchdog);
          setIsLoading(false);
        }
      }

      setIsLoading(false);
      SplashScreen.hide();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (currentUserId && role === 'client') {
      api.appointments.getByClient(currentUserId).then(setAppointments);
    } else if (currentUserId && (role === 'admin' || role === 'pro')) {
      // Para Admin e Pro, primeiro precisamos garantir que temos o salon_id correto
      const fetchData = async () => {
        try {
          const { data: proData } = await supabase
            .from('professionals')
            .select('id, salon_id')
            .eq('user_id', currentUserId)
            .maybeSingle();

          if (proData) {
            if (role === 'admin') {
              // Admin vê todos do salão
              const data = await api.appointments.getBySalon(proData.salon_id);
              setAppointments(data);
            } else {
              // Pro vê apenas os seus, usando o ID da tabela 'professionals'
              const data = await api.appointments.getByProfessional(proData.id);
              setAppointments(data);
            }
          }
        } catch (err) {
        }
      };
      fetchData();
    }
  }, [currentUserId, role, salons]);

  const handleUpdateSalon = (updatedSalon: Salon) => {
    setSalons(prev => {
      if (prev.length === 0) return [updatedSalon];
      const exists = prev.some(s => s.id === updatedSalon.id);
      if (!exists) return [updatedSalon, ...prev];
      return prev.map(s => s.id === updatedSalon.id ? updatedSalon : s);
    });
  };

  const handleLogin = async (selectedRole: ViewRole, userId?: string) => {
    // Para clientes, forçamos a navegação para a home após o login
    if (selectedRole === 'client') {
      navigate('/', { replace: true });
    }
    // Para Admin/Pro, o onAuthStateChange já faz o redirecionamento para /pro
  };

  const handleLogout = async () => {
    // 1. Limpa os estados locais IMEDIATAMENTE para a UI reagir na hora
    setRole(null);
    setCurrentUserId(null);
    setIsMaster(false);
    setSalons([]);
    setAppointments([]);

    // 2. Navega para a home IMEDIATAMENTE
    navigate('/', { replace: true });

    // 3. Comunica ao Supabase em background (não trava o usuário)
    try {
      await api.auth.signOut();
    } catch (e) {
      console.error("Logout silencioso:", e);
    }
  };

  const updateAppointmentStatus = async (id: string, status: Appointment['status']) => {
    try {
      await api.appointments.updateStatus(id, status);
      setAppointments(prev => prev.map(appt =>
        appt.id === id ? { ...appt, status } : appt
      ));
    } catch (error: any) {
      // Falha silenciosa ou log interno
    }
  };

  const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
    try {
      const updated = await api.appointments.update(id, updates);
      setAppointments(prev => prev.map(appt =>
        appt.id === id ? { ...appt, ...updated } : appt
      ));
    } catch (error: any) {
      // Falha silenciosa
    }
  };

  const addAppointment = (appt: Appointment) => {
    setAppointments(prev => [appt, ...prev]);
  };

  const isFullView = ['/', '/login', '/login-user', '/register', '/register-user'].includes(location.pathname);
  const isChat = location.pathname.startsWith('/chat/');
  const isSalon = location.pathname.startsWith('/salon/');
  const isQuickSchedule = location.pathname.startsWith('/q/');
  const isGallery = location.pathname === '/gallery';
  const isBookingFlow = ['/select-service', '/choose-time', '/checkout'].includes(location.pathname);

  const shouldShowNav = !isFullView && !isChat && !isSalon && !isGallery && !isBookingFlow && !isQuickSchedule;
  const shouldShowAI = role === 'client' && !isQuickSchedule;

  // Loading Screen
  if (isLoading) {
    return (
      <div className="flex-1 bg-background-dark min-h-screen flex flex-col items-center justify-center">
        <div className="size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-pulse">
          Carregando experiência premium...
        </p>
      </div>
    );
  }

  const resendEmail = async () => {
    if (userEmail) {
      await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
      });
      showToast('Link de confirmação enviado para seu e-mail!', 'success');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-full bg-background-dark">
      <ScrollToTop />

      {/* Native Email Confirmation Banner */}
      {currentUserId && !isEmailConfirmed && (
        <div className="mobile-constrained top-[env(safe-area-inset-top)] border-b border-primary/30 p-4 px-6 flex items-center justify-between animate-fade-in z-[1001] bg-background-dark/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-xl">mark_email_unread</span>
            <div>
              <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none mb-1">Confirmação Pendente</p>
              <p className="text-[8px] text-primary/80 font-bold uppercase tracking-tighter">Verifique seu e-mail para ativar todas as funções.</p>
            </div>
          </div>
          <button
            onClick={resendEmail}
            className="bg-primary text-background-dark text-[7px] font-black px-4 py-2 rounded-lg uppercase tracking-widest shadow-lg active:scale-95 transition-all"
          >
            Reenviar Link
          </button>
        </div>
      )}

      <div className={`flex-1 flex flex-col min-h-0 ${shouldShowNav ? 'pb-24' : ''}`}>
        <Routes>
          <Route path="/q/:slug" element={<QuickSchedule />} />
          <Route path="/" element={<Landing salons={salons} />} />
          <Route path="/explore" element={<Discovery salons={salons} role={role} />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/login-user" element={<AuthClient onLogin={async (role, uid) => handleLogin(role, uid)} />} />
          <Route path="/register-user" element={<UserRegister onRegister={async (role, uid) => handleLogin(role, uid)} />} />
          <Route path="/login" element={<PartnerLogin onLogin={async (role, uid) => handleLogin(role, uid)} />} />
          <Route path="/register" element={<PartnerRegister onRegister={async (role, uid) => handleLogin(role, uid)} />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfUse />} />
          <Route path="/salon/:slug" element={<SalonPage salons={salons} role={role} setBookingDraft={setBookingDraft} />} />
          <Route path="/my-appointments" element={<MyAppointments appointments={appointments} onCancelAppointment={(id) => updateAppointmentStatus(id, 'canceled')} />} />
          <Route path="/profile" element={<Profile onLogout={handleLogout} />} />
          <Route path="/messages" element={<ChatList userId={currentUserId} />} />
          <Route path="/chat/:id" element={<ChatRoom userId={currentUserId} />} />
          <Route path="/products" element={<ProductShowcase bookingDraft={bookingDraft} setBookingDraft={setBookingDraft} salons={salons} role={role} />} />
          <Route path="/evaluate/:id" element={<Evaluation />} />
          <Route path="/select-service" element={<SelectService bookingDraft={bookingDraft} setBookingDraft={setBookingDraft} role={role} />} />
          <Route path="/choose-time" element={<ChooseTime bookingDraft={bookingDraft} setBookingDraft={setBookingDraft} />} />

          {/* Checkout protegida */}
          <Route path="/checkout" element={
            role === 'client'
              ? <Checkout bookingDraft={bookingDraft} salons={salons} onConfirm={addAppointment} setBookingDraft={setBookingDraft} />
              : <Navigate to="/login-user" replace />
          } />

          {/* Rotas Administrativas Protegidas */}
          <Route path="/pro" element={
            (role === 'admin' || role === 'pro')
              ? <Dashboard role={role} salon={salons[0]} userId={currentUserId} appointments={appointments} isMaster={isMaster} />
              : <Navigate to="/login" replace />
          } />

          <Route path="/pro/schedule" element={
            (role === 'admin' || role === 'pro')
              ? <Schedule appointments={appointments} salon={salons[0]} onUpdateStatus={updateAppointmentStatus} />
              : <Navigate to="/login" replace />
          } />

          <Route path="/pro/admin-bookings" element={
            (role === 'admin' || role === 'pro')
              ? <AdminBookings
                appointments={appointments}
                role={role}
                salon={salons[0]}
                userId={currentUserId}
                onUpdateStatus={updateAppointmentStatus}
                onUpdateAppointment={updateAppointment}
                onDeleteAppointment={(id) => setAppointments(prev => prev.filter(a => a.id !== id))}
              />
              : <Navigate to="/login" replace />
          } />

          <Route path="/pro/analytics" element={
            (role === 'admin' || role === 'pro')
              ? <Analytics appointments={appointments} role={role} salon={salons[0]} userId={currentUserId} />
              : <Navigate to="/login" replace />
          } />

          {/* Rotas exclusivas do Administrador */}
          <Route path="/pro/team" element={role === 'admin' ? <TeamManagement salon={salons[0]} /> : <Navigate to="/login" replace />} />
          <Route path="/pro/catalog" element={role === 'admin' ? <ServiceCatalog salon={salons[0]} /> : <Navigate to="/login" replace />} />
          <Route path="/pro/products" element={role === 'admin' ? <ProductCatalog salon={salons[0]} /> : <Navigate to="/login" replace />} />
          <Route path="/pro/business-setup" element={role === 'admin' ? <BusinessSetup salon={salons[0]} userId={currentUserId} onSave={handleUpdateSalon} /> : <Navigate to="/login" replace />} />
          <Route path="/pro/operating-hours" element={role === 'admin' ? <OperatingHours salon={salons[0]} userId={currentUserId} onSave={handleUpdateSalon} /> : <Navigate to="/login" replace />} />
          <Route path="/pro/billing" element={
            (role === 'admin' || role === 'pro')
              ? <Billing />
              : <Navigate to="/login" replace />
          } />

          <Route path="/pro/master" element={isMaster ? <SaaSMaster /> : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {shouldShowNav && <BottomNav role={role} />}
      {shouldShowAI && <AIConcierge />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </Router>
  );
};

export default App;
