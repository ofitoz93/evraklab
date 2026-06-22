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
  HelpCircle,
  Menu,
  X,
  Wrench, // <--- YENİ İKON (İngiliz Anahtarı)
  Briefcase, // Danışmanlık ikonu
  BarChart3,
  Shield,
  User,
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
import Tools from './Tools'; // <--- YENİ ARAÇLAR SAYFASI
import ConsultantPanel from './ConsultantPanel';
import EnvReportForm from './EnvReportForm';
import EnvReportView from './EnvReportView';
import ExternalSignPage from './ExternalSignPage';
import InspectionPage from './InspectionPage';

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
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
    localStorage.setItem('theme', 'light');
  }, []);
  const toggleTheme = () => {
    // Geçici olarak devre dışı
    console.log('Karanlık mod geçici olarak devre dışı.');
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
  isEnvConsultant,
  systemLogoUrl,
}: any) {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadTicketCount, setUnreadTicketCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsNotifOpen(false); // Close dropdown on navigation
  }, [location]);

  const fetchRecentNotifications = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentNotifications(data || []);
  };

  const fetchUnreadChatCount = async () => {
    if (!userOrgId) return;
    const { data, error } = await supabase.rpc('get_unread_count', {
      user_uid: session.user.id,
      org_uid: userOrgId,
    });
    if (!error) setUnreadChatCount(data);
  };

  useEffect(() => {
    if (session) {
      fetchUnreadNotifications();
      fetchUnreadTickets();
      fetchRecentNotifications();

      let chatChannel: any = null;
      if (userOrgId) {
        fetchUnreadChatCount();
        chatChannel = supabase
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
      }

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
          () => {
            fetchUnreadNotifications();
            fetchRecentNotifications();
          }
        )
        .subscribe();

      return () => {
        if (chatChannel) supabase.removeChannel(chatChannel);
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
  const isCorporateUser = ['premium_corporate', 'corporate_chief', 'corporate_staff'].includes(userRole);
  const canViewTeam =
    isPremium ||
    userRole === 'admin' ||
    isCorporateUser ||
    (userRole === 'normal' && !!subEndDate);
  const canExtend =
    userRole === 'premium_individual' || userRole === 'premium_corporate';
  const isStaff =
    userRole === 'corporate_staff' || userRole === 'corporate_chief';

  return (
    <nav className="print-hidden sticky top-0 z-50 px-4 py-3 shadow-sm border-b transition-colors duration-300 bg-white border-gray-200 dark:bg-slate-900 dark:border-slate-800">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-gray-600 dark:text-gray-300 focus:outline-none"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-center gap-1.5">
              <div className="relative flex items-center justify-center w-8 h-8 bg-gradient-to-br from-[#0e2a47] to-[#1a4066] rounded-lg shadow-sm text-white overflow-hidden">
                {systemLogoUrl ? (
                  <img src={systemLogoUrl} className="w-full h-full object-contain p-0.5" alt="Logo" />
                ) : (
                  <LayoutDashboard size={18} />
                )}
              </div>
              <div className="text-2xl font-extrabold tracking-tight flex items-baseline select-none">
                <span className="text-[#0e2a47] dark:text-white">EVRAK</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2ca58d] to-[#84cc16]">
                  LAB
                </span>
              </div>
            </div>
          </Link>

          <div className="hidden lg:flex gap-5 text-sm font-medium text-gray-600 dark:text-slate-300 ml-6">
            <Link
              to="/documents"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-1"
            >
              <FileText size={16} /> Evraklar
            </Link>

            {/* --- ARAÇLAR LİNKİ EKLENDİ --- */}
            <Link
              to="/tools"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-1"
            >
              <Wrench size={16} /> Araçlar
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
             {canViewTeam && (
              <Link
                to="/company"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-1"
              >
                <Users size={16} /> Danışman İşlemleri
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
            {(userRole === 'admin' || isEnvConsultant || userRole === 'premium_corporate' || userRole === 'corporate_chief') && (
              <Link
                to="/consultant"
                className="hover:text-[#2ca58d] dark:hover:text-[#2ca58d] transition flex items-center gap-1 font-bold text-[#2ca58d]"
              >
                <Briefcase size={16} /> {userRole === 'corporate_chief' ? 'Şef Paneli' : 'Yönetici Paneli'}
              </Link>
            )}
            {(userRole === 'admin' || userRole === 'system_admin') && (
              <Link
                to="/admin"
                className="text-red-500 hover:text-red-400 transition font-bold"
              >
                Admin
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
{/* Karanlık mod butonu geçici olarak kaldırıldı */}

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

          <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 hidden sm:block"></div>

          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/help"
              className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              title="Yardım"
            >
              <HelpCircle size={20} />
            </Link>
            <div className="relative">
              <button
                onClick={() => {
                  setIsNotifOpen(!isNotifOpen);
                  if (!isNotifOpen) {
                    fetchRecentNotifications();
                  }
                }}
                className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 relative focus:outline-none flex items-center"
                title="Bildirimler"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-bold px-1 py-0.5 rounded-full animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {isNotifOpen && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)}></div>
                  
                  {/* Dropdown Container */}
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 py-2 z-50 animate-scaleIn">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                      <span className="font-bold text-sm text-gray-800 dark:text-white">Son Bildirimler</span>
                      {unreadCount > 0 && (
                        <button 
                          onClick={async () => {
                            await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id);
                            fetchUnreadNotifications();
                            fetchRecentNotifications();
                          }}
                          className="text-[11px] text-blue-600 hover:underline font-semibold"
                        >
                          Tümünü Okundu Yap
                        </button>
                      )}
                    </div>
                    
                    <div className="max-h-72 overflow-y-auto">
                      {recentNotifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-gray-400">
                          Henüz bir bildiriminiz yok.
                        </div>
                      ) : (
                        recentNotifications.map((n) => (
                          <div 
                            key={n.id} 
                            onClick={async () => {
                              if (!n.is_read) {
                                await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
                                fetchUnreadNotifications();
                                fetchRecentNotifications();
                              }
                              setIsNotifOpen(false);
                            }}
                            className={`px-4 py-3 border-b border-gray-55 dark:border-slate-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${
                              !n.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <span className="font-bold text-xs text-gray-800 dark:text-slate-200 line-clamp-1">{n.title}</span>
                              <span className="text-[9px] text-gray-400 whitespace-nowrap">
                                {new Date(n.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                              {n.message}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    
                    <div className="border-t border-gray-100 dark:border-slate-700 pt-2 px-3 pb-1">
                      <Link
                        to="/notifications"
                        onClick={() => setIsNotifOpen(false)}
                        className="block text-center text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline py-1.5 bg-gray-50 dark:bg-slate-700/30 rounded-lg"
                      >
                        Tümünü Göster
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
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

      {/* --- MOBİL MENÜ --- */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-xl animate-fadeIn z-50">
          <div className="flex flex-col p-4 space-y-4">
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

            {/* Mobil Menüye Araçlar Eklendi */}
            <Link
              to="/tools"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium"
            >
              <Wrench size={20} /> Araçlar
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
                <Users size={20} /> Danışman İşlemleri
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

            {(userRole === 'admin' || isEnvConsultant || userRole === 'premium_corporate' || userRole === 'corporate_chief') && (
              <Link
                to="/consultant"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 font-bold text-[#2ca58d] dark:text-[#2ca58d]"
              >
                <Briefcase size={20} /> {userRole === 'corporate_chief' ? 'Şef Paneli' : 'Yönetici Paneli'}
              </Link>
            )}

            <div className="border-t border-gray-200 dark:border-slate-800 pt-2 mt-2"></div>

            <Link
              to="/help"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium"
            >
              <HelpCircle size={20} /> Yardım & Kılavuz
            </Link>

            {(userRole === 'admin' || userRole === 'system_admin') && (
              <Link
                to="/admin"
                className="flex items-center gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-bold"
              >
                <Shield size={20} /> Admin Paneli
              </Link>
            )}

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

function AppContent() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('normal');
  const [subEndDate, setSubEndDate] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [isEnvConsultant, setIsEnvConsultant] = useState(false);
  const [extraPermissions, setExtraPermissions] = useState<any>({});
  const [systemLogoUrl, setSystemLogoUrl] = useState<string | null>(null);

  // Ad Soyad ve Telefon Zorunluluğu için State'ler
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    fetchSystemLogo();
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

  const fetchSystemLogo = async () => {
    try {
      const { data } = await supabase
        .from('email_settings')
        .select('value')
        .eq('key', 'system_logo_url')
        .maybeSingle();
      if (data && data.value) {
        setSystemLogoUrl(data.value);
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
          link.href = data.value;
        }
      }
    } catch (err) {
      console.error('System logo fetch error:', err);
    }
  };

  const fetchUserData = async (userId: string) => {
    try {
      // Profili doğrudan çek (join kullanmadan - veritabanında FK tanımlanmamış)
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, phone, role, organization_id, subscription_end_date, extra_permissions')
        .eq('id', userId)
        .single();

      // Profil satırı yoksa (örneğin tetikleyici hata verdiyse), otomatik oluştur (Self-healing)
      if (error && error.code === 'PGRST116') {
        console.log('Profil bulunamadı, otomatik oluşturuluyor...');
        const { data: newProf, error: insErr } = await supabase
          .from('profiles')
          .insert([
            {
              id: userId,
              email: session?.user?.email || '',
              role: 'normal',
              full_name: '',
              phone: '',
            }
          ])
          .select()
          .single();
        if (!insErr) {
          profile = newProf as any;
        }
      }

      if (error && !profile) {
        // Fallback: En temel sütunlar
        console.warn('Profil çekilemedi, temel sorgu deneniyor:', error.message);
        let { data: basic, error: e2 } = await supabase
          .from('profiles')
          .select('full_name, phone, role, organization_id, subscription_end_date, extra_permissions')
          .eq('id', userId)
          .single();
        
        if (e2 && e2.code === 'PGRST116') {
          const { data: newProf } = await supabase
            .from('profiles')
            .insert([
              {
                id: userId,
                email: session?.user?.email || '',
                role: 'normal',
                full_name: '',
                phone: '',
              }
            ])
            .select()
            .single();
          basic = newProf as any;
        }

        if (basic) {
          setUserRole(basic.role || 'normal');
          setUserOrgId(basic.organization_id);
          setExtraPermissions(basic.extra_permissions || {});
          const role = basic.role || 'normal';
          const now = new Date();
          let active = false;
          if (role === 'admin' || role === 'system_admin') active = true;
          else if (basic.subscription_end_date && new Date(basic.subscription_end_date) > now) active = true;
          setIsPremium(active);
          setSubEndDate(basic.subscription_end_date);

          // Ad soyad ve Telefon kontrolü
          const noName = !basic.full_name || basic.full_name.trim() === '';
          const noPhone = !basic.phone || basic.phone.trim() === '';
          if (noName || noPhone) {
            setTempName(basic.full_name || '');
            setTempPhone(basic.phone || '');
            setShowNameModal(true);
          }
        }
        return;
      }

      if (profile) {
        const role = profile.role || 'normal';
        setUserRole(role);
        setUserOrgId(profile.organization_id);
        setExtraPermissions(profile.extra_permissions || {});

        // Ad soyad ve Telefon kontrolü
        const noName = !profile.full_name || profile.full_name.trim() === '';
        const noPhone = !profile.phone || profile.phone.trim() === '';
        if (noName || noPhone) {
          setTempName(profile.full_name || '');
          setTempPhone(profile.phone || '');
          setShowNameModal(true);
        }

        // Abonelik tarihini belirle
        let finalDate: string | null = profile.subscription_end_date || null;

        // Şirket çalışanı/yöneticisi ise şirketin abonelik tarihini kullan
        if (profile.organization_id) {
          const { data: company, error: compErr } = await supabase
            .from('organizations')
            .select('subscription_end_date, name, is_environmental_consultant')
            .eq('id', profile.organization_id)
            .single();
          
          if (company?.subscription_end_date) {
            finalDate = company.subscription_end_date;
          }
          if (company?.is_environmental_consultant) {
            setIsEnvConsultant(true);
          }
        }

        setSubEndDate(finalDate);

        // Premium durumu
        const now = new Date();
        let active = false;

        if (role === 'admin' || role === 'system_admin') {
          active = true;
        } else if (finalDate && new Date(finalDate) > now) {
          active = true;
        }
        setIsPremium(active);


      }
    } catch (err: any) {
      console.error('Kullanıcı verisi yüklenirken hata:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) {
      alert('Lütfen adınızı ve soyadınızı giriniz.');
      return;
    }
    if (!tempPhone.trim()) {
      alert('Lütfen telefon numaranızı giriniz.');
      return;
    }
    setSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: tempName.trim(),
          phone: tempPhone.trim()
        })
        .eq('id', session.user.id);
      if (error) throw error;
      setShowNameModal(false);
      alert('Profil bilgileriniz başarıyla güncellendi!');
      fetchUserData(session.user.id);
    } catch (err: any) {
      alert('Hata: ' + err.message);
    } finally {
      setSavingName(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserRole('normal');
    setIsPremium(false);
    setIsEnvConsultant(false);
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
            isEnvConsultant={isEnvConsultant}
            systemLogoUrl={systemLogoUrl}
          />
        )}
        <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
          <Routes>
            {!session ? (
              <>
                <Route path="/" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/consultant/reports/:id" element={<EnvReportView />} />
                <Route path="/sign-report/:token" element={<ExternalSignPage />} />
                <Route path="/inspect/:token" element={<InspectionPage />} />
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
                <Route path="/settings" element={<Settings session={session} />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/support" element={<Support />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/tools" element={<Tools />} />

                <Route
                  path="/consultant"
                  element={
                    (userRole === 'admin' || isEnvConsultant || userRole === 'premium_corporate' || userRole === 'corporate_chief') ? (
                      <ConsultantPanel />
                    ) : (
                      <Navigate to="/" />
                    )
                  }
                />
                <Route
                  path="/consultant/reports/add"
                  element={
                    (userRole === 'admin' || isEnvConsultant || userRole === 'premium_corporate' || userRole === 'corporate_chief') ? (
                      <EnvReportForm />
                    ) : (
                      <Navigate to="/" />
                    )
                  }
                />
                <Route
                  path="/consultant/reports/:id"
                  element={<EnvReportView />}
                />

                <Route
                  path="/admin"
                  element={
                    (userRole === 'admin' || userRole === 'system_admin') ? <AdminPanel /> : <Navigate to="/" />
                  }
                />
                <Route path="/sign-report/:token" element={<ExternalSignPage />} />
                <Route path="/inspect/:token" element={<InspectionPage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </>
            )}
          </Routes>
        </div>
      </div>

      {/* Profil Tamamlama Modalı (Ad Soyad ve Telefon Zorunlu) */}
      {showNameModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 border border-gray-100 dark:border-slate-700 text-center animate-scaleIn">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
              <User size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Profilinizi Tamamlayın
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Sistemi kullanmaya devam edebilmek için lütfen profil bilgilerinizi eksiksiz doldurunuz.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-left text-xs font-bold text-gray-500 mb-1.5 pl-1">Ad Soyad</label>
                <input
                  type="text"
                  placeholder="Ad Soyad"
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-semibold text-lg"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-left text-xs font-bold text-gray-500 mb-1.5 pl-1">Telefon Numarası</label>
                <input
                  type="tel"
                  placeholder="Örn: 05551234567"
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-semibold text-lg"
                  value={tempPhone}
                  onChange={(e) => setTempPhone(e.target.value)}
                />
              </div>
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-blue-100 dark:shadow-none flex items-center justify-center gap-2 mt-2"
              >
                {savingName ? 'Kaydediliyor...' : 'Bilgileri Kaydet ve Devam Et'}
              </button>
            </div>
          </div>
        </div>
      )}
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
