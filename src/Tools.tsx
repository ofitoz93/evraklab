import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  Scissors,
  FileCheck,
  Image,
  Minimize2,
  Lock,
  Unlock,
  Crown,
  AlertCircle,
  Loader,
} from 'lucide-react';

export default function Tools() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [dailyUsage, setDailyUsage] = useState(0);
  const [processingTool, setProcessingTool] = useState<string | null>(null);

  // GÜNLÜK ÜCRETSİZ LİMİT
  const FREE_LIMIT = 2;

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setProfile(data);

      // Bugünün kullanımını veritabanından çek (tool_usages tablosu varsa)
      // Tablo yoksa local state gibi davranır şimdilik.
      // Gerçek kullanım için SQL adımında tabloyu oluşturmalısınız.
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('tool_usages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .gte('created_at', today.toISOString());

      setDailyUsage(count || 0);
    }
    setLoading(false);
  };

  const handleToolClick = async (toolName: string) => {
    if (processingTool) return;

    // 1. Yetki ve Limit Kontrolü
    const isPremium =
      profile?.role.includes('premium') ||
      profile?.role === 'admin' ||
      profile?.org_role === 'owner';

    if (!isPremium && dailyUsage >= FREE_LIMIT) {
      alert(
        `⚠️ Günlük işlem limitiniz (${FREE_LIMIT}) doldu. Sınırsız kullanım için Premium'a geçin.`
      );
      return;
    }

    setProcessingTool(toolName);

    // 2. İşlem Simülasyonu (Buraya gerçek API veya işlem bağlanacak)
    // Şu an sadece veritabanına kayıt atıp işlemi başarılı sayıyoruz.
    setTimeout(async () => {
      // Kullanımı Kaydet
      await supabase.from('tool_usages').insert([
        {
          user_id: profile.id,
          tool_name: toolName,
        },
      ]);

      setDailyUsage((prev) => prev + 1);
      setProcessingTool(null);
      alert(`✅ ${toolName} işlemi başlatıldı! (Demo Modu)`);
    }, 1500);
  };

  const tools = [
    {
      id: 'pdf-split',
      name: 'PDF Böl',
      icon: <Scissors size={32} />,
      desc: 'PDF sayfalarını tek tek ayırın.',
      color: 'text-red-500 bg-red-50',
    },
    {
      id: 'pdf-merge',
      name: 'PDF Birleştir',
      icon: <FileCheck size={32} />,
      desc: 'Birden fazla PDF’i tek dosya yapın.',
      color: 'text-blue-500 bg-blue-50',
    },
    {
      id: 'pdf-compress',
      name: 'PDF Sıkıştır',
      icon: <Minimize2 size={32} />,
      desc: 'Dosya boyutunu optimize edin.',
      color: 'text-green-500 bg-green-50',
    },
    {
      id: 'img-pdf',
      name: 'Resimden PDF',
      icon: <Image size={32} />,
      desc: 'JPG/PNG dosyalarını PDF yapın.',
      color: 'text-purple-500 bg-purple-50',
    },
    {
      id: 'pdf-lock',
      name: 'PDF Şifrele',
      icon: <Lock size={32} />,
      desc: 'Dosyalarınıza şifre koyun.',
      color: 'text-orange-500 bg-orange-50',
    },
    {
      id: 'pdf-unlock',
      name: 'Şifre Kaldır',
      icon: <Unlock size={32} />,
      desc: 'PDF şifresini kaldırın.',
      color: 'text-gray-500 bg-gray-50',
    },
  ];

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;

  const isPremium =
    profile?.role.includes('premium') ||
    profile?.role === 'admin' ||
    profile?.org_role === 'owner';

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 pb-24">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-black text-gray-900 mb-2">
          Pratik PDF Araçları
        </h1>
        <p className="text-gray-500">
          Tüm belge işlemleriniz için hızlı ve güvenli çözümler.
        </p>

        {/* LİMİT BİLGİSİ */}
        <div className="mt-6 inline-flex items-center gap-4 bg-white p-2 pr-6 rounded-full shadow-sm border border-gray-200">
          <div
            className={`p-2 rounded-full ${
              isPremium
                ? 'bg-yellow-100 text-yellow-600'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isPremium ? <Crown size={20} /> : <AlertCircle size={20} />}
          </div>
          <div className="text-left">
            <div className="text-xs font-bold text-gray-400 uppercase">
              GÜNLÜK HAKKINIZ
            </div>
            <div className="text-sm font-bold text-gray-800">
              {isPremium ? (
                <span className="text-yellow-600">SINIRSIZ Erişim</span>
              ) : (
                <span>
                  {dailyUsage} / {FREE_LIMIT} Kullanıldı
                </span>
              )}
            </div>
          </div>
          {!isPremium && (
            <a
              href="/pricing"
              className="text-xs font-bold text-blue-600 hover:underline ml-2"
            >
              Limiti Kaldır
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool.name)}
            disabled={!!processingTool}
            className="group relative bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition text-left flex flex-col gap-4"
          >
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center ${tool.color} group-hover:scale-110 transition`}
            >
              {processingTool === tool.name ? (
                <Loader className="animate-spin" />
              ) : (
                tool.icon
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-800">{tool.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{tool.desc}</p>
            </div>
            {/* Limit Dolduysa Kilit Göster */}
            {!isPremium && dailyUsage >= FREE_LIMIT && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-2xl z-10">
                <Lock className="text-gray-400 mb-2" size={32} />
                <span className="text-xs font-bold text-gray-500">
                  Limit Doldu
                </span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
