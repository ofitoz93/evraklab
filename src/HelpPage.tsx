import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  HelpCircle,
  FileText,
  MessageCircle,
  Eye,
  Edit,
  Trash2,
  Bell,
  Download,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  Building,
  Crown,
  MessageSquare,
  Shield,
  Star,
  Search,
  Info,
  Calendar,
  Sparkles,
  ChevronRight,
  UserPlus,
  Check,
  Layers,
  Settings,
  Briefcase,
  Play,
} from 'lucide-react';
import VideoGuideGrid from './components/HelpTour/VideoGuideGrid';
import TourModal from './components/HelpTour/TourModal';
import { ROLE_TOUR_IDS } from './components/HelpTour/tours';
import type { TourId } from './components/HelpTour/types';

export default function HelpPage() {
  const [role, setRole] = useState<string>('normal');
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('normal');
  const [activeTour, setActiveTour] = useState<{ id: TourId; roleLabel?: string } | null>(null);

  const openTour = (id: TourId, roleLabel?: string) => setActiveTour({ id, roleLabel });

  useEffect(() => {
    async function getRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          
          if (!error && profile && profile.role) {
            const userRole = profile.role;
            setRole(userRole);
            if (['premium_corporate', 'corporate_chief', 'admin', 'system_admin'].includes(userRole)) {
              setActiveTab('manager');
            } else if (userRole === 'corporate_staff') {
              setActiveTab('staff');
            } else {
              setActiveTab('normal');
            }
          }
        }
      } catch (err) {
        console.error('Error fetching role in HelpPage:', err);
      } finally {
        setLoading(false);
      }
    }
    getRole();
  }, []);

  const isManager = ['premium_corporate', 'corporate_chief', 'admin', 'system_admin'].includes(role);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-500">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-sm font-medium">Rehber yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 pb-24 dark:text-gray-100">
      {/* BAŞLIK VE GİRİŞ */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-2xl mb-4 shadow-sm">
          <HelpCircle size={40} />
        </div>
        <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-3">
          Sistem Kullanım Rehberi
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          {isManager 
            ? 'EvrakLab ekosistemindeki tüm yetki seviyelerine ait özellikler, modüller ve sistem operasyonları.' 
            : role === 'corporate_staff' 
              ? 'Danışman / saha personeli rolünüze özel atanmış firma yönetimi, akıllı PDF ayrıştırma ve ziyaret takvimi kılavuzu.' 
              : 'EvrakLab ekosistemini en verimli şekilde kullanmanız için hazırladığımız belge takibi ve premium üyelik kılavuzu.'}
        </p>
      </div>

      {/* SEKMELER - Yalnızca Yöneticiler / Firma Sahipleri için */}
      {isManager && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10 bg-gray-100 dark:bg-slate-800 p-2 rounded-2xl max-w-2xl mx-auto border border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('manager')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'manager'
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm border border-purple-100 dark:border-purple-900/30'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-900/50'
            }`}
          >
            <Shield size={18} />
            Yönetici Kılavuzu
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'staff'
                ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm border border-teal-100 dark:border-teal-900/30'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-900/50'
            }`}
          >
            <Briefcase size={18} />
            Danışman Kılavuzu
          </button>
          <button
            onClick={() => setActiveTab('normal')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'normal'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/30'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-900/50'
            }`}
          >
            <Users size={18} />
            Müşteri & Üye Kılavuzu
          </button>
        </div>
      )}

      {/* DİNAMİK İÇERİK SEKSİYONLARI */}
      <div className="mb-16">
        {activeTab === 'manager' && <ManagerHelpSection onOpenTour={openTour} />}
        {activeTab === 'staff' && <StaffHelpSection onOpenTour={openTour} />}
        {activeTab === 'normal' && <NormalHelpSection onOpenTour={openTour} />}
      </div>

      {/* SİMGELER SÖZLÜĞÜ - Tüm Rollere Ortak Arayüz Referansı */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2">
          <Search size={24} className="text-gray-400 dark:text-gray-500" /> Arayüz Simgeleri & Anlamları
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <IconCard
            icon={<Eye size={20} />}
            color="text-blue-500"
            bg="bg-blue-50 dark:bg-blue-950/20"
            title="Görüntüle"
            desc="Belge detaylarını ve tarihçesini açar."
          />
          <IconCard
            icon={<Edit size={20} />}
            color="text-orange-500"
            bg="bg-orange-50 dark:bg-orange-950/20"
            title="Düzenle"
            desc="Belge bilgilerini veya tarihini günceller."
          />
          <IconCard
            icon={<Trash2 size={20} />}
            color="text-red-500"
            bg="bg-red-50 dark:bg-red-950/20"
            title="Silme"
            desc="Kaydı kalıcı olarak sistemden kaldırır."
          />
          <IconCard
            icon={<Download size={20} />}
            color="text-gray-600 dark:text-gray-300"
            bg="bg-gray-100 dark:bg-slate-800"
            title="İndir"
            desc="Dosyayı cihazınıza indirir."
          />
          <IconCard
            icon={<CheckCircle size={20} />}
            color="text-green-500"
            bg="bg-green-50 dark:bg-green-950/20"
            title="Aktif"
            desc="Belgenin süresi geçerli ve sorunsuz."
          />
          <IconCard
            icon={<AlertTriangle size={20} />}
            color="text-red-500"
            bg="bg-red-50 dark:bg-red-950/20"
            title="Süresi Doldu"
            desc="Belgenin yenilenmesi gerekiyor."
          />
          <IconCard
            icon={<Clock size={20} />}
            color="text-yellow-500"
            bg="bg-yellow-50 dark:bg-yellow-950/20"
            title="Yaklaşıyor"
            desc="Son 30 gün içine girmiş belgeler."
          />
          <IconCard
            icon={<Info size={20} />}
            color="text-purple-500"
            bg="bg-purple-50 dark:bg-purple-950/20"
            title="Detay"
            desc="İlgili alan hakkında ipucu verir."
          />
        </div>
      </div>

      {/* DESTEK BİLGİSİ */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8 rounded-3xl shadow-lg border border-blue-500/10">
        <div className="flex items-center gap-6 mb-6 md:mb-0">
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
            <MessageCircle size={32} className="text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Hala sorularınız mı var?</h3>
            <p className="text-blue-100">
              Destek ekibimiz size yardımcı olmaya hazır.
            </p>
          </div>
        </div>
        <a
          href="/support"
          className="px-8 py-3 bg-white text-blue-600 hover:text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition shadow-md"
        >
          Destek Talebi Oluştur
        </a>
      </div>

      {activeTour && (
        <TourModal
          tourId={activeTour.id}
          roleLabel={activeTour.roleLabel}
          onClose={() => setActiveTour(null)}
        />
      )}
    </div>
  );
}

// 1. Müşteri & Normal Üye Özellikleri Rehberi
function NormalHelpSection({ onOpenTour }: { onOpenTour: (id: TourId, roleLabel?: string) => void }) {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Özet Kart */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 border border-blue-100 dark:border-slate-850 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Müşteri & Bireysel Üyelik
          </span>
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Standart Belge & Evrak Yönetimi</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm max-w-xl">
            Sisteme yüklediğiniz her belgenin takibi, yapay zeka ile otomatik verilerin çıkarılması ve süre uyarıları hakkında tüm detaylar.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl shadow-sm border border-blue-50 dark:border-slate-700">
          <Star className="text-yellow-500 fill-yellow-500" size={20} />
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Premium ile Tam Kontrol</span>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <Play className="text-blue-600 dark:text-blue-400" size={20} /> Video Rehberler
        </h3>
        <VideoGuideGrid tourIds={ROLE_TOUR_IDS.normal} onOpenTour={onOpenTour} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sol Kolon: Temel Özellikler */}
        <div className="bg-white dark:bg-slate-850 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full -mr-10 -mt-10 opacity-40"></div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2 relative z-10">
            <FileText className="text-blue-600 dark:text-blue-400" /> Temel Evrak Modülleri
          </h3>
          <ul className="space-y-5 text-gray-600 dark:text-gray-300 relative z-10">
            <li className="flex gap-4">
              <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs flex-shrink-0 mt-0.5">1</span>
              <div>
                <strong className="text-gray-800 dark:text-white">Yapay Zeka (AI) ile Belge Analizi</strong>
                <p className="text-sm text-gray-500 dark:text-gray-405 mt-0.5">
                  "Yeni Belge Ekle" panelinden sürüklediğiniz PDF'lerdeki geçerlilik sürelerini, belge türünü ve unvanları yapay zekamız otomatik okur. Size sadece kontrol edip kaydetmek kalır.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs flex-shrink-0 mt-0.5">2</span>
              <div>
                <strong className="text-gray-800 dark:text-white">Lokasyon ve Dijital Arşiv Yönetimi</strong>
                <p className="text-sm text-gray-500 dark:text-gray-405 mt-0.5">
                  Belgelerinizi fiziksel dolaplara veya dijital kategorilere göre sınıflandırın. İsterseniz yükleme anında yeni bir lokasyon tanımlayabilirsiniz.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs flex-shrink-0 mt-0.5">3</span>
              <div>
                <strong className="text-gray-800 dark:text-white">Arşivleme ve Versiyon Takibi</strong>
                <p className="text-sm text-gray-500 dark:text-gray-405 mt-0.5">
                  Süresi biten veya yenilenmesi gereken belgeleri silmek yerine "Arşiv" durumuna alabilir, belgenin eski versiyonlarını tarihçesiyle güvenle saklayabilirsiniz.
                </p>
              </div>
            </li>
          </ul>
        </div>

        {/* Sağ Kolon: Hatırlatıcılar ve Premium */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-850 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 dark:bg-red-950/10 rounded-full -mr-10 -mt-10 opacity-40"></div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
              <Bell className="text-red-500" /> Bildirim ve Takip Ayarları
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Evraklarınızın süresi dolmadan önce haberdar olmak için şu mekanizmaları kullanabilirsiniz:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                <Clock size={18} className="text-yellow-650 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="block text-gray-800 dark:text-white text-sm">Bireysel Hatırlatma Günleri</strong>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Her belgenin detay sayfasından son gün gelmeden kaç gün önce (30, 15, 3 gün vb.) bildirim düşeceğini kişiselleştirebilirsiniz.
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                <Crown size={18} className="text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="block text-gray-800 dark:text-white text-sm">Premium E-Posta Uyarısı</strong>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Premium üyeler, sistem içi bildirimlerin yanı sıra e-posta kutularına anlık uyarı mailleri de alırlar.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-900 to-purple-950 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <Crown size={22} className="text-yellow-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">Premium Paket Avantajları</span>
              </div>
              <h4 className="text-xl font-bold mb-4">EvrakLab Premium ile Sınırları Kaldırın</h4>
              <ul className="space-y-2.5 text-sm text-indigo-100">
                <li className="flex items-center gap-2">
                  <Check size={16} className="text-green-400 flex-shrink-0" />
                  Sınırsız Evrak ve Dosya Yükleme Kapasitesi
                </li>
                <li className="flex items-center gap-2">
                  <Check size={16} className="text-green-400 flex-shrink-0" />
                  Kritik Sürelerde E-Posta ve SMS Bildirimleri
                </li>
                <li className="flex items-center gap-2">
                  <Check size={16} className="text-green-400 flex-shrink-0" />
                  Yapay Zekalı Evrak Okuma (Limitsiz Analiz)
                </li>
                <li className="flex items-center gap-2">
                  <Check size={16} className="text-green-400 flex-shrink-0" />
                  7/24 Teknik Destek Önceliği
                </li>
              </ul>
              <a href="/pricing" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-white text-indigo-950 font-bold rounded-xl text-xs hover:bg-indigo-50 transition shadow-md">
                Planları İncele <ChevronRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 2. Danışman / Personel Özellikleri Rehberi
function StaffHelpSection({ onOpenTour }: { onOpenTour: (id: TourId, roleLabel?: string) => void }) {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Özet Kart */}
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-slate-800 dark:to-slate-900 border border-teal-100 dark:border-slate-850 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Danışman / Saha Personeli
          </span>
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Danışman Paneli ve Operasyonlar</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm max-w-xl">
            Sorumluluğunuzdaki firmaları izleme, saha ziyaret planları oluşturarak yönetici onayına gönderme ve resmi PDF belgelerini AI ile otomatik ayrıştırma rehberi.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl shadow-sm border border-teal-50 dark:border-slate-700">
          <Briefcase className="text-teal-600 dark:text-teal-400" size={20} />
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Danışman Modülü</span>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <Play className="text-teal-600 dark:text-teal-400" size={20} /> Video Rehberler
        </h3>
        <VideoGuideGrid tourIds={ROLE_TOUR_IDS.staff} roleLabel="Danışman İşlemleri" onOpenTour={onOpenTour} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sol Kolon: Ziyaret Takvimi ve PDF Modülleri */}
        <div className="space-y-6">
          {/* Ziyaret Planlama */}
          <div className="bg-white dark:bg-slate-850 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50/50 dark:bg-teal-900/10 rounded-full -mr-10 -mt-10"></div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
              <Calendar className="text-teal-600 dark:text-teal-400" /> Ziyaret Takvimi Talepleri (Gelecek Ay)
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
              Çalıştığınız firmalara yapacağınız saha ziyaretlerini planlamak ve çakışmaları engellemek için sistem üzerinden <strong>gelecek ayın</strong> günlerine talep gönderebilirsiniz:
            </p>
            <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300 relative z-10">
              <li className="flex gap-2.5">
                <Check size={16} className="text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Gelecek Ay Sınırı:</strong> Ziyaret planlamaları sadece bir sonraki ayın günlerine yapılabilir. Mevcut ayın planları kilitlidir.
                </div>
              </li>
              <li className="flex gap-2.5">
                <Check size={16} className="text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Müşteri Seçimi:</strong> Yalnızca yöneticiniz tarafından yetkilendirildiğiniz (atanmış) firmalar listelenir. Diğer firmalara talep oluşturamazsınız.
                </div>
              </li>
              <li className="flex gap-2.5">
                <Check size={16} className="text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Yönetici Onayı:</strong> Gönderdiğiniz ziyaret planları yöneticinin onay listesine düşer. Yönetici onayladığında takviminizde yeşil renkli olarak aktifleşir.
                </div>
              </li>
            </ul>
          </div>

          {/* Akıllı PDF Ayrıştırıcı */}
          <div className="bg-white dark:bg-slate-850 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 dark:bg-purple-900/10 rounded-full -mr-10 -mt-10"></div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
              <Sparkles className="text-purple-600 dark:text-purple-400" /> Akıllı PDF Mevzuat Ayrıştırıcı
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
              Yönetmelik, kanun, yönerge gibi uzun PDF dosyalarını elle yazmak yerine, PDF okuma servisiyle hiyerarşik yapıya dönüştürün:
            </p>
            <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300 relative z-10">
              <li className="flex gap-2.5">
                <Check size={16} className="text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>PDF Yükleme:</strong> İlgili resmi PDF dosyasını sürükleyip bırakarak yükleme panelini tetikleyin.
                </div>
              </li>
              <li className="flex gap-2.5">
                <Check size={16} className="text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Hiyerarşik Maddeler:</strong> AI (Gemini) arka planda metni tarayarak Madde 1, Madde 2 başlıklarını ve altlarındaki a), b), c) bentlerini otomatik tespit eder.
                </div>
              </li>
              <li className="flex gap-2.5">
                <Check size={16} className="text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Form Önizleme:</strong> Ayrıştırılan maddeler "Özel Mevzuat Ekle" formuna otomatik olarak doldurulur. Onayladıktan sonra tek tıkla kaydedebilirsiniz.
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Sağ Kolon: Atanmış Firmalar ve İletişim */}
        <div className="space-y-6">
          {/* Yetkilendirme */}
          <div className="bg-white dark:bg-slate-850 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Users className="text-teal-600 dark:text-teal-400" /> Atanmış Firmalarınız ve Güvenlik
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
              Danışman rolündeki kullanıcılar, veri güvenliği gereği sadece kendilerine atanan müşteri firmaların verilerine erişebilir:
            </p>
            <div className="p-4 bg-teal-50/50 dark:bg-teal-950/20 rounded-2xl border border-teal-100 dark:border-teal-900/30 space-y-2.5">
              <div className="text-xs font-bold text-teal-800 dark:text-teal-300">VERİ İZOLASYONU (RLS):</div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Veritabanı düzeyindeki güvenlik politikaları (Row Level Security) sayesinde, size atanmamış herhangi bir şirketin evraklarına veya özel bilgilerine erişim yetkiniz kesinlikle bulunmaz.
              </p>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-4 leading-relaxed">
              Bu firmalara ait Çevre Raporları, Uygunluk Denetimleri, Bildirimler ve Özel Evraklar üzerinde tam düzenleme ve ekleme yetkisine sahipsiniz.
            </p>
          </div>

          {/* Sohbet */}
          <div className="bg-white dark:bg-slate-850 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full -mr-10 -mt-10"></div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
              <MessageSquare className="text-blue-500 dark:text-blue-400" /> Ekip İçi İletişim (Sohbet)
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed z-10 relative">
              "Sohbet" modülünü kullanarak yöneticiniz ve diğer şeflerinizle gerçek zamanlı görüşebilirsiniz. Bu alanda duyuruları takip edebilir, kritik belgeleri doğrudan mesajlaşma üzerinden talep edip paylaşabilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. Yönetici & Firma Sahibi Özellikleri Rehberi
function ManagerHelpSection({ onOpenTour }: { onOpenTour: (id: TourId, roleLabel?: string) => void }) {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Özet Kart */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 border border-purple-100 dark:border-slate-850 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Yönetici & Firma Sahibi
          </span>
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Tam Yetkili Kurumsal Yönetim Paneli</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm max-w-xl">
            Personel yetkilendirmesi, müşteri atamaları, saha ziyaret onayları ve sistem genelindeki tüm logo, e-posta şablonu ve sunucu ayarlarının yönetimi.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl shadow-sm border border-purple-50 dark:border-slate-700">
          <Shield className="text-purple-600 dark:text-purple-400" size={20} />
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Yönetici Modülü</span>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <Play className="text-purple-600 dark:text-purple-400" size={20} /> Video Rehberler
        </h3>
        <VideoGuideGrid tourIds={ROLE_TOUR_IDS.manager} roleLabel="Yönetici Paneli" onOpenTour={onOpenTour} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Kart 1: Ekip Daveti */}
        <div className="bg-white dark:bg-slate-850 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-4">
              <UserPlus size={24} />
            </div>
            <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Ekip & Personel Yönetimi</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Yönetici panelinden personelinizin e-posta adresini girerek sisteme davet edebilirsiniz. Davet edilen kişilerin yetkilerini (<strong>Danışman Personel</strong> veya <strong>Şef/Yönetici</strong>) belirleyebilir, dilediğinizde hesaplarını askıya alabilirsiniz.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-800 text-xs text-gray-400 dark:text-gray-500">
            Davet kodları otomatik olarak gönderilir.
          </div>
        </div>

        {/* Kart 2: Müşteri Atama */}
        <div className="bg-white dark:bg-slate-850 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-4">
              <Building size={24} />
            </div>
            <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Müşteri & Danışman Eşleştirme</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Danışmanlık verdiğiniz tüm firmaları sisteme kaydedin. Hangi danışmanın hangi firmadan sorumlu olacağını "Atama" modülünden belirleyin. Atanan danışmanlar sadece bu firmaların evraklarını ve ziyaret takvimlerini görebilir.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-800 text-xs text-gray-400 dark:text-gray-500">
            Veri izolasyonu RLS ile sağlanır.
          </div>
        </div>

        {/* Kart 3: Ziyaret Onaylama */}
        <div className="bg-white dark:bg-slate-850 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center mb-4">
              <Calendar size={24} />
            </div>
            <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Saha Ziyaret Onay Mekanizması</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Danışman personelinizin gelecek ay için oluşturduğu saha ziyaret talepleri yöneticinin onay ekranına düşer. Talepleri inceleyerek <strong>Onaylama</strong> veya <strong>Reddetme</strong> işlemlerini gerçekleştirebilirsiniz.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-800 text-xs text-gray-400 dark:text-gray-500">
            Onaylanan talepler ortak takvime işlenir.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Detay 1: Merkezi İzleme */}
        <div className="bg-white dark:bg-slate-850 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-800">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Layers className="text-indigo-600 dark:text-indigo-400" /> Merkezi Evrak Denetimi & Raporlama
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-3">
            Yönetici olarak, şirketiniz bünyesindeki tüm danışmanların ve tüm müşterilerin evrak durumlarını merkezi olarak takip edersiniz:
          </p>
          <ul className="space-y-2.5 text-sm text-gray-600 dark:text-gray-300">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"></div>
              Hangi firmanın belgesi eksik veya süresi dolmuş anında tespit edin.
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"></div>
              Hangi personelin hangi raporları yüklediğini takip edin.
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"></div>
              Zamanı yaklaşan tüm resmi izin ve lisans bildirimlerini tek bir çatı altında izleyin.
            </li>
          </ul>
        </div>

        {/* Detay 2: Logo ve Sistem Ayarları */}
        <div className="bg-white dark:bg-slate-850 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-800">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Settings className="text-purple-600 dark:text-purple-400" /> Sistem Özelleştirmeleri
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
            Sistem yöneticileri ve firma sahipleri, EvrakLab'ı kendi markalarına göre kişiselleştirebilir:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
              <h5 className="font-bold text-sm text-gray-800 dark:text-white mb-1">Logo ve Başlık</h5>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Şirket logosunu sisteme yükleyerek tüm personel ve kullanıcıların sizin markanızla giriş yapmasını sağlayın.
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
              <h5 className="font-bold text-sm text-gray-800 dark:text-white mb-1">Bildirim Ayarları</h5>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sistem genelinde otomatik gönderilecek e-posta şablonlarını, sunucu ve SMTP ayarlarını yapılandırın.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Yardımcı Bileşen: İkon Kartı
function IconCard({ icon, color, bg, title, desc }: any) {
  return (
    <div className="flex flex-col items-center text-center p-4 rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-850 shadow-sm hover:shadow-md transition">
      <div className={`p-3 rounded-full ${bg} ${color} mb-3`}>{icon}</div>
      <h4 className="font-bold text-gray-800 dark:text-white text-sm">{title}</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">{desc}</p>
    </div>
  );
}
