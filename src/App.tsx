import React, { useEffect, useState, createContext, useContext } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { supabase } from './supabaseClient';
import {
  LogOut,
  LayoutDashboard,
  Crown,
  FileText,
  Bell,
  Settings as SettingsIcon,
  Users,
  Clock,
  AlertTriangle,
  Building,
  MessageCircle,
  MessageSquare,
  Sun,
  Moon,
  HelpCircle,
  Menu, // Hamburger Menü
  X, // Kapatma İkonu
} from 'lucide-react';

// Sayfa Importları
import Login from './Login';
import Register from './Register';
import Documents from './Documents';
import AddDocument from './AddDocument';
import DocumentDetail from './DocumentDetail';
import EditDocument from './EditDocument';
import CompanyPanel from './CompanyPanel';
import Pricing from './Pricing';
import AdminPanel from './AdminPanel';
import Settings from './Settings';
import Notifications from './Notifications';
import Support from './Support';
import Dashboard from './Dashboard';
import TeamChat from './TeamChat';
import HelpPage from './HelpPage';

// --- THEME CONTEXT ---
type Theme = 'light' | 'dark';
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
    return 'light';
  });
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// --- NAVBAR COMPONENT ---
function NavBarContent({
  session,
  userRole,
  handleLogout,
  daysLeft,
  isPremium,
  subEndDate,
  hasCompany,
  userOrgId,
}: any) {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadTicketCount, setUnreadTicketCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Mobil Menü State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { theme, toggleTheme } = useTheme();

  // Sayfa değişince mobil menüyü kapat
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const fetchUnreadChatCount = async () => {
    if (!userOrgId) return;
    const { data, error } = await supabase.rpc('get_unread_count', {
      user_uid: session.user.id,
      org_uid: userOrgId,
    });
    if (!error) setUnreadChatCount(data);
  };

  useEffect(() => {
    if (session && userOrgId) {
      fetchUnreadNotifications();
      fetchUnreadTickets();
      fetchUnreadChatCount();

      const chatChannel = supabase
        .channel(`nav_chat_listener_${session.user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'company_messages' },
          () => fetchUnreadChatCount()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'message_reads' },
          () => fetchUnreadChatCount()
        )
        .subscribe();

      const ticketSub = supabase
        .channel('public:tickets_navbar')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tickets',
            filter: `user_id=eq.${session.user.id}`,
          },
          () => fetchUnreadTickets()
        )
        .subscribe();
      const notifSub = supabase
        .channel('public:notifications_navbar')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${session.user.id}`,
          },
          () => fetchUnreadNotifications()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(chatChannel);
        supabase.removeChannel(ticketSub);
        supabase.removeChannel(notifSub);
      };
    }
  }, [session, location.pathname, userOrgId]);

  const fetchUnreadNotifications = async () => {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false);
    setUnreadCount(count || 0);
  };
  const fetchUnreadTickets = async () => {
    if (window.location.pathname === '/support') {
      setUnreadTicketCount(0);
      return;
    }
    const { count } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('has_unread_messages', true);
    setUnreadTicketCount(count || 0);
  };
  const canViewTeam =
    isPremium ||
    userRole === 'admin' ||
    (userRole === 'normal' && !!subEndDate);
  const canExtend =
    userRole === 'premium_individual' || userRole === 'premium_corporate';
  const isStaff =
    userRole === 'corporate_staff' || userRole === 'corporate_chief';

  return (
    <nav className="sticky top-0 z-50 px-4 py-3 shadow-sm border-b transition-colors duration-300 bg-white border-gray-200 dark:bg-slate-900 dark:border-slate-800">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* --- SOL TARA: LOGO ve HAMBURGER --- */}
        <div className="flex items-center gap-4">
          {/* Mobil Menü Butonu (Mobilde görünür) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-gray-600 dark:text-gray-300 focus:outline-none"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* LOGO: EVRAKLAB */}
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-center gap-1.5">
              <div className="relative flex items-center justify-center w-8 h-8 bg-gradient-to-br from-[#0e2a47] to-[#1a4066] rounded-lg shadow-sm text-white">
                <LayoutDashboard size={18} />
              </div>
              <div className="text-2xl font-extrabold tracking-tight flex items-baseline select-none">
                <span className="text-[#0e2a47] dark:text-white">EVRAK</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2ca58d] to-[#84cc16]">
                  LAB
                </span>
              </div>
            </div>
          </Link>

          {/* --- MASAÜSTÜ MENÜ LİNKLERİ (lg:flex ile sadece büyük ekranda görünür) --- */}
          <div className="hidden lg:flex gap-5 text-sm font-medium text-gray-600 dark:text-slate-300 ml-6">
            <Link
              to="/documents"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-1"
            >
              <FileText size={16} /> Evraklar
            </Link>

            {hasCompany && (
              <Link
                to="/chat"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-1 relative"
              >
                <MessageSquare size={16} /> Sohbet
                {unreadChatCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                    {unreadChatCount}
                  </span>
                )}
              </Link>
            )}

            <Link
              to="/notifications"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-1 relative"
            >
              <Bell size={16} /> Bildirimler
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                  {unreadCount}
                </span>
              )}
            </Link>
            {canViewTeam && (
              <Link
                to="/company"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-1"
              >
                <Users size={16} /> Ekip
              </Link>
            )}
            <Link
              to="/support"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-1 relative"
            >
              <MessageCircle size={16} /> Destek
              {unreadTicketCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                  {unreadTicketCount}
                </span>
              )}
            </Link>
            {userRole === 'admin' && (
              <Link
                to="/admin"
                className="text-red-500 hover:text-red-400 transition font-bold"
              >
                Admin
              </Link>
            )}
          </div>
        </div>

        {/* --- SAĞ TARAF: AYARLAR / PROFİL --- */}
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full transition shadow-sm border bg-gray-100 text-gray-600 hover:bg-gray-200 border-transparent dark:bg-slate-800 dark:text-yellow-400 dark:hover:bg-slate-700 dark:border-slate-700"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Masaüstü Premium Butonu */}
          {!isPremium && (
            <Link
              to="/pricing"
              className="hidden sm:flex bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1.5 rounded-full font-bold shadow-md items-center gap-1 text-xs hover:scale-105 transition animate-pulse"
            >
              <Crown size={14} /> Premium
            </Link>
          )}

          {isPremium && (
            <div className="hidden sm:flex items-center gap-2">
              {/* Premium Süre Kartı (Masaüstü) */}
              {daysLeft !== null && (
                <div
                  className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded border transition cursor-default ${
                    daysLeft <= 30
                      ? 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900'
                      : 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900'
                  }`}
                >
                  {daysLeft <= 0 ? (
                    <AlertTriangle size={12} />
                  ) : (
                    <Clock size={12} />
                  )}
                  {daysLeft <= 0 ? 'Süre Doldu' : `${daysLeft} Gün`}
                </div>
              )}
              {/* Premium Badge */}
              <div className="flex items-center bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-full px-1 py-0.5">
                <span className="text-xs font-bold text-yellow-700 dark:text-yellow-500 px-2 flex items-center gap-1">
                  <Crown size={12} /> PREMIUM
                </span>
                {canExtend && (
                  <Link
                    to="/pricing"
                    className="text-[10px] bg-yellow-200 hover:bg-yellow-300 text-yellow-800 px-2 py-0.5 rounded-full font-bold transition"
                  >
                    Uzat
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Ayırıcı Çizgi */}
          <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 hidden sm:block"></div>

          {/* Masaüstü İkonlar (Yardım, Ayarlar, Çıkış) */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/help"
              className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              title="Yardım"
            >
              <HelpCircle size={20} />
            </Link>
            <Link
              to="/settings"
              className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              title="Ayarlar"
            >
              <SettingsIcon size={20} />
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              title="Çıkış Yap"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* --- MOBİL MENÜ (Sadece Mobilde Açılır) --- */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-xl animate-fadeIn z-50">
          <div className="flex flex-col p-4 space-y-4">
            {/* Mobil Premium Bilgisi (Varsa en üstte) */}
            {isPremium && daysLeft !== null && (
              <div
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  daysLeft <= 30
                    ? 'bg-red-50 border-red-200'
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <span className="text-sm font-bold flex items-center gap-2">
                  <Crown size={16} /> Premium Üye
                </span>
                <span className="text-xs font-bold">
                  {daysLeft <= 0 ? 'Süre Doldu' : `${daysLeft} Gün Kaldı`}
                </span>
              </div>
            )}

            <Link
              to="/documents"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium"
            >
              <FileText size={20} /> Evraklar
            </Link>

            {hasCompany && (
              <Link
                to="/chat"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium"
              >
                <MessageSquare size={20} /> Sohbet
                {unreadChatCount > 0 && (
                  <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {unreadChatCount} Yeni
                  </span>
                )}
              </Link>
            )}

            <Link
              to="/notifications"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium"
            >
              <Bell size={20} /> Bildirimler
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadCount} Yeni
                </span>
              )}
            </Link>

            {canViewTeam && (
              <Link
                to="/company"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium"
              >
                <Users size={20} /> Ekip Yönetimi
              </Link>
            )}

            <Link
              to="/pricing"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium"
            >
              <Crown size={20} className="text-yellow-600" /> Paketler & Üyelik
            </Link>

            <Link
              to="/support"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium"
            >
              <MessageCircle size={20} /> Destek
            </Link>

            <div className="border-t border-gray-200 dark:border-slate-800 pt-2 mt-2"></div>

            <Link
              to="/help"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium"
            >
              <HelpCircle size={20} /> Yardım & Kılavuz
            </Link>

            <Link
              to="/settings"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium"
            >
              <SettingsIcon size={20} /> Ayarlar
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 font-medium w-full text-left"
            >
              <LogOut size={20} /> Çıkış Yap
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

// --- ANA UYGULAMA İÇERİĞİ ---
function AppContent() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('normal');
  const [subEndDate, setSubEndDate] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [userOrgId, setUserOrgId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        supabase.rpc('check_and_downgrade_subscriptions').then(() => {
          fetchUserData(session.user.id);
        });
      } else {
        setLoading(false);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserData(session.user.id);
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'role, organization_id, subscription_end_date, organization:organizations(subscription_end_date)'
      )
      .eq('id', userId)
      .single();
    if (profile) {
      setUserRole(profile.role);
      setUserOrgId(profile.organization_id);
      let finalDate = null;
      if (profile.organization)
        finalDate = profile.organization.subscription_end_date;
      else finalDate = profile.subscription_end_date;
      setSubEndDate(finalDate);
      const now = new Date();
      let active = false;
      if (profile.role === 'admin') active = true;
      else if (finalDate && new Date(finalDate) > now) active = true;
      setIsPremium(active);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserRole('normal');
    setIsPremium(false);
  };
  const getDaysLeft = () => {
    if (!subEndDate) return null;
    const end = new Date(subEndDate).getTime();
    const now = new Date().getTime();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-slate-400">
        Sistem Yükleniyor...
      </div>
    );

  return (
    <Router>
      <div className="min-h-screen font-sans flex flex-col transition-colors duration-300 bg-gray-50 text-gray-900 dark:bg-slate-900 dark:text-slate-100">
        {session && (
          <NavBarContent
            session={session}
            userRole={userRole}
            handleLogout={handleLogout}
            daysLeft={getDaysLeft()}
            isPremium={isPremium}
            subEndDate={subEndDate}
            hasCompany={!!userOrgId}
            userOrgId={userOrgId}
          />
        )}
        <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
          <Routes>
            {!session ? (
              <>
                <Route path="/" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="*" element={<Navigate to="/" />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/documents/add" element={<AddDocument />} />
                <Route path="/documents/:id" element={<DocumentDetail />} />
                <Route path="/documents/edit/:id" element={<EditDocument />} />
                <Route path="/company" element={<CompanyPanel />} />
                <Route path="/chat" element={<TeamChat />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/support" element={<Support />} />
                <Route path="/help" element={<HelpPage />} />
                <Route
                  path="/admin"
                  element={
                    userRole === 'admin' ? <AdminPanel /> : <Navigate to="/" />
                  }
                />
                <Route path="*" element={<Navigate to="/" />} />
              </>
            )}
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
