import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  AlertTriangle,
  Plus,
  ArrowRight,
  HardDrive,
  CheckCircle,
  TrendingUp,
  Cloud,
  Loader,
  MapPin,
  User,
  Infinity, // Süresiz ikonu
  Building,
  AlertCircle,
  File,
} from 'lucide-react';

// Boyut formatlama (Byte -> MB/GB)
function formatBytes(bytes: number, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [stats, setStats] = useState({
    totalDocs: 0,
    expiringSoon: 0,
    expired: 0,
  });
  const [storage, setStorage] = useState({
    used: 0,
    limit: 0,
    percent: 0,
    isCorporate: false,
  });
  const [recentDocs, setRecentDocs] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // 1. Profil ve Yetki Bilgisi
        const { data: profile } = await supabase
          .from('profiles')
          .select(
            'id, full_name, role, permissions, storage_limit, storage_used, organization_id, organization:organizations(storage_limit, storage_used)'
          )
          .eq('id', session.user.id)
          .single();

        if (profile) {
          setUserName(profile.full_name);
          const isCorp = !!profile.organization_id;

          // --- A. DEPOLAMA HESABI ---
          let usedBytes = 0;
          if (isCorp) {
            const { data: orgUsage } = await supabase.rpc(
              'get_org_storage_usage',
              { org_id: profile.organization_id }
            );
            usedBytes = orgUsage || 0;
          } else {
            const { data: userUsage } = await supabase.rpc(
              'get_user_storage_usage',
              { target_user_id: session.user.id }
            );
            usedBytes = userUsage || 0;
          }

          const limit = isCorp
            ? profile.organization?.storage_limit
            : profile.storage_limit;
          const finalLimit = limit || (isCorp ? 1073741824 : 10485760);

          setStorage({
            used: usedBytes,
            limit: finalLimit,
            percent: Math.min(100, (usedBytes / finalLimit) * 100),
            isCorporate: isCorp,
          });

          // --- B. BELGE SORGUSU ---
          let query = supabase
            .from('documents')
            .select(
              `
                    *,
                    uploader:profiles!uploader_id(full_name),
                    type_def:user_definitions!type_def_id(label),
                    location_def:user_definitions!location_def_id(label)
                  `
            )
            .eq('is_archived', false); // Sadece aktifler

          if (isCorp) {
            const isOwner = profile.role === 'premium_corporate';
            const hasViewPerm =
              profile.permissions &&
              profile.permissions.can_view_team_docs === true;

            if (isOwner || hasViewPerm) {
              // Yönetici: Şirkete ait + Kendi yükledikleri
              query = query.or(
                `organization_id.eq.${profile.organization_id},uploader_id.eq.${session.user.id}`
              );
            } else {
              // Personel: Sadece kendi yükledikleri
              query = query.eq('uploader_id', session.user.id);
            }
          } else {
            // Bireysel
            query = query.eq('uploader_id', session.user.id);
          }

          const { data: docs, error: docError } = await query.order(
            'created_at',
            { ascending: false }
          );

          if (docError) console.error('Belge hatası:', docError.message);

          if (docs) {
            // İSTATİSTİK HESAPLAMA
            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const totalDocs = docs.length;
            let expiredCount = 0;
            let expiringSoonCount = 0;

            docs.forEach((d) => {
              if (d.is_indefinite) return;

              const targetDateStr = d.son_tarih || d.expiry_date;
              if (!targetDateStr) return;

              const targetDate = new Date(targetDateStr);
              if (isNaN(targetDate.getTime())) return;

              targetDate.setHours(0, 0, 0, 0);
              const diffTime = targetDate.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              if (diffDays < 0) expiredCount++;
              else if (diffDays <= 30) expiringSoonCount++;
            });

            setStats({
              totalDocs,
              expired: expiredCount,
              expiringSoon: expiringSoonCount,
            });

            setRecentDocs(docs.slice(0, 10));
          }
        }
      }
    } catch (error) {
      console.error('Dashboard hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStorageColor = () => {
    if (storage.percent > 90) return 'bg-red-500';
    if (storage.percent > 70) return 'bg-orange-500';
    return 'bg-blue-600';
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500 dark:text-gray-400">
        <Loader className="animate-spin mb-2" />
        Veriler Yükleniyor...
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 pb-24">
      {/* BAŞLIK */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-2">
            Merhaba, {userName} <span className="text-2xl">👋</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Evrak işlerini bugün de kontrol altında tutuyoruz.
          </p>
        </div>
        <Link
          to="/documents/add"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition flex items-center gap-2"
        >
          <Plus size={20} /> Yeni Belge Ekle
        </Link>
      </div>

      {/* İSTATİSTİK KARTLARI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {/* Toplam Belge */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col justify-between transition hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <FileText size={24} />
            </div>
            <span className="text-xs font-bold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 px-2 py-1 rounded-lg">
              Toplam
            </span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-gray-800 dark:text-white">
              {stats.totalDocs}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Görüntülenen Belge
            </p>
          </div>
        </div>

        {/* Yaklaşan */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col justify-between transition hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-xl">
              <Clock size={24} />
            </div>
            <span className="text-xs font-bold bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-lg">
              30 Gün
            </span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-gray-800 dark:text-white">
              {stats.expiringSoon}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Süresi Yaklaşan
            </p>
          </div>
        </div>

        {/* Dolan */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col justify-between transition hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
              <AlertTriangle size={24} />
            </div>
            <span className="text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-1 rounded-lg">
              Dikkat
            </span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-gray-800 dark:text-white">
              {stats.expired}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Süresi Dolan
            </p>
          </div>
        </div>

        {/* DEPOLAMA KARTI */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black p-6 rounded-2xl shadow-lg text-white flex flex-col justify-between relative overflow-hidden ring-1 ring-white/10">
          <Cloud
            className="absolute -right-4 -top-4 text-white opacity-5"
            size={100}
          />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
              <HardDrive size={24} className="text-blue-300" />
            </div>
            <Link
              to="/pricing"
              className="text-xs font-bold bg-blue-600/90 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition shadow-lg"
            >
              Yükselt
            </Link>
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-end mb-2">
              <div>
                <h3 className="text-xl font-bold tracking-tight">
                  {formatBytes(storage.used)}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Kullanılan Alan
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Limit</span>
                <span className="text-sm font-bold">
                  {formatBytes(storage.limit)}
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden border border-white/5">
              <div
                className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)] ${getStorageColor()}`}
                style={{ width: `${storage.percent}%` }}
              ></div>
            </div>
            <div className="text-[10px] text-right mt-2 text-slate-400 font-medium flex items-center justify-end gap-1">
              {storage.isCorporate ? (
                <Building size={10} />
              ) : (
                <User size={10} />
              )}
              {storage.isCorporate ? 'Şirket Kotası' : 'Bireysel Kota'}
            </div>
          </div>
        </div>
      </div>

      {/* SON İŞLEMLER TABLOSU */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <TrendingUp
              size={20}
              className="text-blue-600 dark:text-blue-400"
            />{' '}
            Son İşlemler
          </h2>
          <Link
            to="/documents"
            className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition"
          >
            Tümünü Gör <ArrowRight size={16} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-gray-400 dark:text-gray-500 text-xs uppercase border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                <th className="p-4 font-bold tracking-wider">
                  Belge Türü / Adı
                </th>
                <th className="p-4 font-bold hidden md:table-cell tracking-wider">
                  Lokasyon
                </th>
                <th className="p-4 font-bold hidden lg:table-cell tracking-wider">
                  Yükleyen
                </th>
                <th className="p-4 font-bold text-right tracking-wider">
                  Durum (Son Başvuru)
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {recentDocs.length > 0 ? (
                recentDocs.map((doc) => {
                  // --- DURUM HESAPLAMA ---
                  const isIndefinite = doc.is_indefinite || false;
                  const dateStr = doc.son_tarih || doc.expiry_date;

                  let statusBadge = null;
                  let subText = '';

                  if (isIndefinite) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600">
                        <Infinity size={12} /> SÜRESİZ
                      </span>
                    );
                    subText = 'Bitiş Yok';
                  } else if (dateStr && !isNaN(new Date(dateStr).getTime())) {
                    const targetDate = new Date(dateStr);
                    const now = new Date();

                    // Saatleri sıfırla (Tam gün farkı için)
                    targetDate.setHours(0, 0, 0, 0);
                    now.setHours(0, 0, 0, 0);

                    const diffTime = targetDate.getTime() - now.getTime();
                    const diffDays = Math.ceil(
                      diffTime / (1000 * 60 * 60 * 24)
                    );

                    const dateFormatted =
                      targetDate.toLocaleDateString('tr-TR');

                    if (diffDays < 0) {
                      // SÜRESİ GEÇTİ
                      statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50">
                          <AlertCircle size={12} /> SÜRESİ GEÇTİ (
                          {Math.abs(diffDays)} GÜN)
                        </span>
                      );
                      subText = `Son Başvuru: ${dateFormatted}`;
                    } else if (diffDays <= 30) {
                      // YAKLAŞIYOR
                      statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900/50">
                          <Clock size={12} /> YAKLAŞIYOR ({diffDays} GÜN)
                        </span>
                      );
                      subText = `Son Başvuru: ${dateFormatted}`;
                    } else {
                      // GÜNCEL
                      statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-green-50 text-green-600 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50">
                          <CheckCircle size={12} /> GÜNCEL ({diffDays} GÜN)
                        </span>
                      );
                      subText = `Son Başvuru: ${dateFormatted}`;
                    }
                  } else {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-gray-50 text-gray-400 border border-gray-200 dark:bg-slate-700 dark:text-gray-500 dark:border-slate-600">
                        BELİRSİZ
                      </span>
                    );
                    subText = '-';
                  }

                  return (
                    <tr
                      key={doc.id}
                      className="border-b border-gray-50 dark:border-slate-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition group"
                    >
                      {/* 1. Belge Türü (Koyu) ve Dosya Adı (Silik) */}
                      <td className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hidden sm:block">
                            <File size={18} />
                          </div>
                          <div className="flex flex-col">
                            {/* Ana Başlık: Belge Türü */}
                            <span className="font-bold text-gray-800 dark:text-gray-200 uppercase text-xs sm:text-sm mb-0.5 tracking-wide">
                              {doc.type_def?.label ||
                                doc.kategori ||
                                'GENEL BELGE'}
                            </span>
                            {/* Alt Bilgi: Dosya Adı */}
                            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                              <FileText size={10} className="sm:hidden" />
                              <span
                                className="truncate max-w-[180px] sm:max-w-[250px]"
                                title={doc.belge_adi || doc.title}
                              >
                                {doc.belge_adi || doc.title || 'Dosyasız Kayıt'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Lokasyon */}
                      <td className="p-4 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium text-xs bg-gray-100 dark:bg-slate-700 px-2.5 py-1.5 rounded-md w-fit">
                          <MapPin size={12} className="text-gray-400" />
                          {doc.location_def?.label || 'Belirtilmemiş'}
                        </div>
                      </td>

                      {/* 3. Yükleyen */}
                      <td className="p-4 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs font-bold border border-blue-200 dark:border-blue-800">
                            {doc.uploader?.full_name?.charAt(0) || (
                              <User size={12} />
                            )}
                          </div>
                          <span className="truncate max-w-[140px] text-sm font-medium text-gray-600 dark:text-gray-300">
                            {doc.uploader?.full_name || 'Bilinmiyor'}
                          </span>
                        </div>
                      </td>

                      {/* 4. Durum (Badge) ve Tarih */}
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          {statusBadge}
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                            {subText}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="p-12 text-center text-gray-400 dark:text-gray-500"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-full mb-3">
                        <FileText size={32} className="opacity-30" />
                      </div>
                      <p className="font-medium">Henüz işlem yapılmamış.</p>
                      <Link
                        to="/documents/add"
                        className="text-blue-600 dark:text-blue-400 text-xs font-bold mt-2 hover:underline"
                      >
                        İlk Belgeyi Yükle
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
