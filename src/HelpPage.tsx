import React from 'react';
import {
  HelpCircle,
  FileText,
  MessageCircle,
  Plus,
  Eye,
  Edit,
  Trash2,
  Bell,
  Download,
  Upload,
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
} from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="max-w-6xl mx-auto py-10 px-4 pb-24">
      {/* BAŞLIK VE GİRİŞ */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center p-3 bg-blue-50 text-blue-600 rounded-2xl mb-4 shadow-sm">
          <HelpCircle size={40} />
        </div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-3">
          Sistem Kullanım Rehberi
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          EvrakLab ekosistemini en verimli şekilde kullanmanız için
          hazırladığımız detaylı kılavuz. Modüller, üyelik tipleri ve işlem
          adımları hakkında her şey burada.
        </p>
      </div>

      {/* 1. SİMGELER SÖZLÜĞÜ (GRID YAPISI) */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
          <Search size={24} className="text-gray-400" /> Arayüz ve Simgeler
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <IconCard
            icon={<Eye size={20} />}
            color="text-blue-500"
            bg="bg-blue-50"
            title="Görüntüle"
            desc="Belge detaylarını ve tarihçesini açar."
          />
          <IconCard
            icon={<Edit size={20} />}
            color="text-orange-500"
            bg="bg-orange-50"
            title="Düzenle"
            desc="Belge bilgilerini veya tarihini günceller."
          />
          <IconCard
            icon={<Trash2 size={20} />}
            color="text-red-500"
            bg="bg-red-50"
            title="Silme"
            desc="Kaydı kalıcı olarak sistemden kaldırır."
          />
          <IconCard
            icon={<Download size={20} />}
            color="text-gray-600"
            bg="bg-gray-100"
            title="İndir"
            desc="Dosyayı cihazınıza indirir."
          />
          <IconCard
            icon={<CheckCircle size={20} />}
            color="text-green-500"
            bg="bg-green-50"
            title="Aktif"
            desc="Belgenin süresi geçerli ve sorunsuz."
          />
          <IconCard
            icon={<AlertTriangle size={20} />}
            color="text-red-500"
            bg="bg-red-50"
            title="Süresi Doldu"
            desc="Belgenin yenilenmesi gerekiyor."
          />
          <IconCard
            icon={<Clock size={20} />}
            color="text-yellow-500"
            bg="bg-yellow-50"
            title="Yaklaşıyor"
            desc="Son 30 gün içine girmiş belgeler."
          />
          <IconCard
            icon={<Info size={20} />}
            color="text-purple-500"
            bg="bg-purple-50"
            title="Detay"
            desc="İlgili alan hakkında ipucu verir."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
        {/* 2. EVRAK YÖNETİMİ & BİLDİRİMLER */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-10 -mt-10 opacity-50"></div>
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 relative z-10">
              <FileText className="text-blue-600" /> Evrak İşlemleri
            </h3>
            <ul className="space-y-4 text-gray-600 relative z-10">
              <li className="flex gap-3">
                <span className="bg-blue-100 text-blue-700 font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs flex-shrink-0">
                  1
                </span>
                <span>
                  <strong className="text-gray-800">Belge Yükleme:</strong>{' '}
                  "Evraklar" sayfasındaki{' '}
                  <span className="font-bold text-blue-600">+ Yeni Belge</span>{' '}
                  butonuna tıklayın. Dosyanızı sürükleyin, belge türünü ve{' '}
                  <u>son geçerlilik tarihini</u> seçin.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="bg-blue-100 text-blue-700 font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs flex-shrink-0">
                  2
                </span>
                <span>
                  <strong className="text-gray-800">Otomatik Takip:</strong>{' '}
                  Sistem, girdiğiniz tarihi baz alarak geri sayım başlatır.
                  Süresi yaklaşan evraklar listede sarı, geçenler kırmızı ile
                  işaretlenir.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="bg-blue-100 text-blue-700 font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs flex-shrink-0">
                  3
                </span>
                <span>
                  <strong className="text-gray-800">Arşivleme:</strong> İşi
                  biten ama silmek istemediğiniz belgeleri "Arşivle" seçeneği
                  ile ana listenizden kaldırabilirsiniz.
                </span>
              </li>
            </ul>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-10 -mt-10 opacity-50"></div>
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 relative z-10">
              <Bell className="text-red-500" /> Bildirim Merkezi
            </h3>
            <p className="text-gray-600 mb-4 text-sm relative z-10">
              Sağ üstteki çan simgesi, sistemin sizinle konuştuğu yerdir. Burada
              şunlar yer alır:
            </p>
            <div className="grid grid-cols-1 gap-3 relative z-10">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <Clock size={18} className="text-yellow-600 mt-1" />
                <div className="text-sm text-gray-600">
                  <strong className="block text-gray-800">
                    Süre Hatırlatmaları
                  </strong>
                  Belgenizin süresinin dolmasına 30, 15 ve 3 gün kala otomatik
                  uyarı düşer.
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <MessageSquare size={18} className="text-blue-600 mt-1" />
                <div className="text-sm text-gray-600">
                  <strong className="block text-gray-800">Ekip & Sohbet</strong>
                  Şirket içi sohbetten gelen yeni mesajlar ve yönetici
                  duyuruları burada görünür.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. ÜYELİK TİPLERİ VE FARKLARI */}
        <div className="bg-gray-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full -mr-20 -mt-20 blur-3xl opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600 rounded-full -ml-20 -mb-20 blur-3xl opacity-20"></div>

          <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 relative z-10">
            <Crown className="text-yellow-400" /> Üyelik Tipleri ve Farklar
          </h3>

          <div className="space-y-6 relative z-10">
            {/* Normal */}
            <div className="flex gap-4 border-b border-gray-700 pb-4">
              <div className="bg-gray-700 p-2 rounded-lg h-fit">
                <Users className="text-gray-300" />
              </div>
              <div>
                <h4 className="font-bold text-lg">Normal Kullanıcı</h4>
                <p className="text-gray-400 text-sm mt-1">
                  Sistemi denemek için temel özellikler. Sınırlı sayıda belge
                  yükleme hakkı vardır. Hatırlatmalar sadece panel üzerinden
                  yapılır.
                </p>
              </div>
            </div>

            {/* Bireysel Premium */}
            <div className="flex gap-4 border-b border-gray-700 pb-4">
              <div className="bg-blue-900/50 p-2 rounded-lg h-fit">
                <Star className="text-blue-400" />
              </div>
              <div>
                <h4 className="font-bold text-lg text-blue-400">
                  Bireysel Premium
                </h4>
                <p className="text-gray-300 text-sm mt-1">
                  Sınırsız belge yükleme hakkı. E-posta ve SMS ile gelişmiş
                  hatırlatma servisi. Öncelıklı destek hizmeti. Bireysel çalışan
                  profesyoneller içindir.
                </p>
              </div>
            </div>

            {/* Kurumsal Premium */}
            <div className="flex gap-4">
              <div className="bg-purple-900/50 p-2 rounded-lg h-fit">
                <Building className="text-purple-400" />
              </div>
              <div>
                <h4 className="font-bold text-lg text-purple-400">
                  Kurumsal (Şirket)
                </h4>
                <p className="text-gray-300 text-sm mt-1">
                  Kendi dijital ofisinizi kurun. Personel ekleyebilir, görev
                  atayabilir ve tüm ekibin belgelerini tek panelden
                  yönetebilirsiniz. Şirket içi özel sohbet modülü açılır.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. KURUMSAL YÖNETİM & EKİP & SOHBET */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-3xl p-8 md:p-12 border border-purple-100 mb-16">
        <div className="text-center mb-10">
          <span className="bg-purple-100 text-purple-700 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            Yöneticiler İçin
          </span>
          <h2 className="text-3xl font-black text-gray-900 mt-4">
            Kurumsal Yönetim Paneli
          </h2>
          <p className="text-gray-600 mt-2">
            Şirket sahibi veya yöneticisiyseniz "Ekip" sayfasında
            yapabilecekleriniz.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Ekip Kurma */}
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
              <Plus size={24} />
            </div>
            <h4 className="font-bold text-gray-800 text-lg mb-2">
              Personel Atama & Davet
            </h4>
            <p className="text-sm text-gray-600">
              Ekip sayfasına gidin. Yeni üye eklemek için personelin e-posta
              adresini girin. Sistem otomatik olarak o kişiyi şirketinize
              bağlar. Dilediğiniz zaman personeli çıkarabilir veya yetkisini
              (Şef/Personel) değiştirebilirsiniz.
            </p>
          </div>

          {/* Merkezi Kontrol */}
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
              <Shield size={24} />
            </div>
            <h4 className="font-bold text-gray-800 text-lg mb-2">
              Merkezi Belge Kontrolü
            </h4>
            <p className="text-sm text-gray-600">
              Yönetici olarak, ekibinizdeki herkesin yüklediği belgeleri
              görebilirsiniz. Hangi personelin belgesinin süresi dolmuş, kim
              eksik yükleme yapmış tek ekrandan denetleyebilirsiniz.
            </p>
          </div>

          {/* Şirket Sohbeti */}
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
              <MessageSquare size={24} />
            </div>
            <h4 className="font-bold text-gray-800 text-lg mb-2">
              Özel Şirket Sohbeti
            </h4>
            <p className="text-sm text-gray-600">
              Sadece şirket çalışanlarına özel, WhatsApp benzeri bir sohbet
              alanıdır. Duyurular yapmak, belge istemek veya hızlı iletişim
              kurmak için kullanılır. Mesajlar şifreli ve güvenlidir.
            </p>
          </div>
        </div>
      </div>

      {/* 5. DESTEK BİLGİSİ */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-blue-600 text-white p-8 rounded-3xl shadow-lg">
        <div className="flex items-center gap-6 mb-6 md:mb-0">
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
            <MessageCircle size={32} className="text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Hala sorularınız mı var?</h3>
            <p className="text-blue-100">
              Destek ekibimiz 7/24 size yardımcı olmaya hazır.
            </p>
          </div>
        </div>
        <a
          href="/support"
          className="px-8 py-3 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition shadow-md"
        >
          Destek Talebi Oluştur
        </a>
      </div>
    </div>
  );
}

// Yardımcı Bileşen: İkon Kartı
function IconCard({ icon, color, bg, title, desc }: any) {
  return (
    <div className="flex flex-col items-center text-center p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
      <div className={`p-3 rounded-full ${bg} ${color} mb-3`}>{icon}</div>
      <h4 className="font-bold text-gray-800 text-sm">{title}</h4>
      <p className="text-xs text-gray-500 mt-1 leading-snug">{desc}</p>
    </div>
  );
}
