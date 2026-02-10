import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { Link } from 'react-router-dom';
import {
  FileText,
  AlertTriangle,
  Clock,
  PieChart,
  Activity,
  Scissors,
  FilePlus,
  Download,
  ArrowRight,
  Building,
  User,
  Briefcase, // Şahsi/Kurumsal ayrımı için ikon
} from 'lucide-react';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, expired: 0, warning: 0 });
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [userName, setUserName] = useState('');
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      // 1. Profil ve Yetki Bilgisi Çekme
      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'full_name, role, org_role, organization_id, organization:organizations(name), permissions'
        )
        .eq('id', session.user.id)
        .single();

      setUserName(profile?.full_name || 'Kullanıcı');
      setOrgName(profile?.organization?.name || null);

      const userId = session.user.id;
      const role = profile?.role || 'normal';
      const orgRole = profile?.org_role; // Şirket içi rol (owner, chief, staff)
      const myOrgId = profile?.organization_id;
      const permissions = profile?.permissions || {};

      // 2. Temel Sorgu Hazırlığı
      let query = supabase
        .from('documents')
        .select('*, uploader:profiles(full_name)') // Yükleyen kişinin ismini de alalım
        .eq('is_archived', false);

      // --- KRİTİK YETKİ MANTIĞI ---

      if (role === 'admin') {
        // ADMIN: Her şeyi görür (Filtre yok)
      } else {
        // KULLANICI / YÖNETİCİ MANTIĞI

        // Yönetici mi? (Rolü premium_corporate veya org_role owner ise)
        const isOwner = role === 'premium_corporate' || orgRole === 'owner';

        // Görme yetkisi olan Şef mi?
        const isAuthorizedChief =
          (role === 'corporate_chief' || orgRole === 'chief') &&
          permissions.can_view_team_docs;

        if (myOrgId && (isOwner || isAuthorizedChief)) {
          // YÖNETİCİ veya YETKİLİ ŞEF İSE:
          // "Belgeyi ben yükledim" (Şahsi veya Kurumsal) VEYA "Belge benim şirketime ait"
          query = query.or(
            `uploader_id.eq.${userId},organization_id.eq.${myOrgId}`
          );
        } else {
          // STANDART PERSONEL veya NORMAL KULLANICI İSE:
          // Sadece kendi yüklediği belgeleri görür.
          query = query.eq('uploader_id', userId);
        }
      }

      const { data: docs, error } = await query;

      if (!error && docs) {
        // İstatistik Hesaplama
        let exp = 0;
        let warn = 0;
        const now = new Date().getTime();

        docs.forEach((doc) => {
          if (!doc.is_indefinite && doc.application_deadline) {
            const date = new Date(doc.application_deadline).getTime();
            const diffDay = Math.ceil((date - now) / (1000 * 3600 * 24));

            if (diffDay < 0) exp++;
            else if (diffDay <= 30) warn++;
          }
        });

        setStats({
          total: docs.length,
          expired: exp,
          warning: warn,
        });

        // Son Eklenenler (Tarihe göre yeniden eskiye sırala ve ilk 5'i al)
        const sorted = docs
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, 5);
        setRecentDocs(sorted);
      }
    }
    setLoading(false);
  };

  if (loading)
    return (
      <div className="p-10 text-center text-gray-500 dark:text-gray-400">
        Panel hazırlanıyor...
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* BAŞLIK */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <PieChart className="text-blue-600" /> Kontrol Paneli
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Hoş geldin,{' '}
            <span className="font-bold text-gray-800 dark:text-gray-200">
              {userName}
            </span>
            .
            {orgName && (
              <span className="ml-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-bold">
                <Building size={10} className="inline mr-1" />
                {orgName}
              </span>
            )}
          </p>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-xs text-gray-400 font-mono">
            {new Date().toLocaleDateString('tr-TR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* İSTATİSTİK KARTLARI (Kişisel + Yetki Varsa Şirket Toplamı) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-blue-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-bl-full -mr-4 -mt-4 transition group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase mb-2">
              Toplam Belge
            </div>
            <div className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">
              {stats.total}
            </div>
            <Link
              to="/documents"
              className="mt-4 inline-flex items-center gap-1 text-sm text-blue-600 font-bold hover:underline"
            >
              Listeye Git <ArrowRight size={14} />
            </Link>
          </div>
          <FileText
            className="absolute bottom-4 right-4 text-blue-100 dark:text-slate-700"
            size={48}
          />
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-red-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-bl-full -mr-4 -mt-4 transition group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase mb-2">
              Süresi Geçen
            </div>
            <div className="text-4xl font-extrabold text-red-600 dark:text-red-400">
              {stats.expired}
            </div>
            <div className="text-xs text-red-400 mt-2 font-medium">
              Acil müdahale gerekli
            </div>
          </div>
          <AlertTriangle
            className="absolute bottom-4 right-4 text-red-100 dark:text-slate-700"
            size={48}
          />
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-orange-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 dark:bg-orange-900/20 rounded-bl-full -mr-4 -mt-4 transition group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase mb-2">
              Yaklaşan (30 Gün)
            </div>
            <div className="text-4xl font-extrabold text-orange-500 dark:text-orange-400">
              {stats.warning}
            </div>
            <div className="text-xs text-orange-400 mt-2 font-medium">
              Takip edilmeli
            </div>
          </div>
          <Clock
            className="absolute bottom-4 right-4 text-orange-100 dark:text-slate-700"
            size={48}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* SOL: SON EKLENEN BELGELER */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
            <Activity className="text-gray-400" size={20} /> Son Eklenen
            Belgeler
          </h2>
          <div className="space-y-3">
            {recentDocs.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                Görüntülenecek belge yok.
              </div>
            ) : (
              recentDocs.map((doc) => {
                // Belge Kurumsal mı Şahsi mi kontrolü
                const isCorporate = !!doc.organization_id;

                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg transition border border-transparent hover:border-gray-100 dark:hover:border-slate-600"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isCorporate
                            ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}
                      >
                        {isCorporate ? (
                          <Building size={20} />
                        ) : (
                          <User size={20} />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          {doc.title}
                          {/* Eğer yönetici ise ve belge başkasınınsa, kimin olduğunu göster */}
                          {isCorporate && doc.uploader && (
                            <span className="text-[10px] font-normal text-gray-400 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                              {doc.uploader.full_name}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          {isCorporate ? 'Kurumsal Belge' : 'Şahsi Belge'} •{' '}
                          {new Date(doc.created_at).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                    </div>
                    <Link
                      to={`/documents/${doc.id}`}
                      className="text-xs font-bold text-gray-500 hover:text-blue-600 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 rounded-lg transition"
                    >
                      Detay
                    </Link>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-6 text-center">
            <Link
              to="/documents"
              className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Tüm Belgeleri Görüntüle
            </Link>
          </div>
        </div>

        {/* SAĞ: HIZLI ARAÇLAR (GELECEK İÇİN YER TUTUCU) */}
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl shadow-lg p-6 h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

            <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Scissors size={20} /> Hızlı Araçlar
            </h2>
            <p className="text-indigo-200 text-xs mb-6">
              PDF işlemleri ve dönüştürücüler çok yakında.
            </p>

            <div className="space-y-3">
              <button
                disabled
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 transition cursor-not-allowed opacity-70 group"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg">
                  <Scissors size={16} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-sm">PDF Böl</div>
                  <div className="text-[10px] text-indigo-300">
                    Sayfaları ayırın
                  </div>
                </div>
                <div className="ml-auto text-[10px] bg-indigo-950 px-2 py-0.5 rounded text-indigo-300">
                  Yakında
                </div>
              </button>

              <button
                disabled
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 transition cursor-not-allowed opacity-70 group"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center shadow-lg">
                  <FilePlus size={16} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-sm">PDF Birleştir</div>
                  <div className="text-[10px] text-teal-200">
                    Dosyaları birleştirin
                  </div>
                </div>
                <div className="ml-auto text-[10px] bg-teal-950 px-2 py-0.5 rounded text-teal-300">
                  Yakında
                </div>
              </button>

              <button
                disabled
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 transition cursor-not-allowed opacity-70 group"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shadow-lg">
                  <Download size={16} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-sm">Format Çevirici</div>
                  <div className="text-[10px] text-orange-200">
                    JPG to PDF vb.
                  </div>
                </div>
                <div className="ml-auto text-[10px] bg-orange-950 px-2 py-0.5 rounded text-orange-300">
                  Yakında
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
