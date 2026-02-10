import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import {
  UserPlus,
  Mail,
  Lock,
  User,
  ArrowRight,
  Phone,
  X, // Kapatma ikonu
  FileText, // Belge ikonu
  ShieldCheck // Güvenlik ikonu
} from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  
  // Form State'leri
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  // Modal (Pencere) Kontrol State'leri
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // --- GOOGLE GİRİŞİ ---
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      alert('Google giriş hatası: ' + error.message);
    }
  };

  // --- KAYIT OLMA İŞLEMİ ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms) {
      alert('Lütfen üye olmak için Kullanım Sözleşmesini onaylayın.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
          },
        },
      });

      if (error) throw error;

      // Yedek Profil Kaydı (Trigger çalışmazsa diye)
      if (data?.user) {
        await new Promise((r) => setTimeout(r, 1000));
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName,
          phone: phone,
          email: email,
          updated_at: new Date(),
        });
      }

      alert('✅ Kayıt başarılı! Giriş yapabilirsiniz.');
      navigate('/');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- MODAL İÇERİKLERİ (HUKUKİ METİNLER) ---
  const TermsContent = (
    <div className="space-y-4 text-sm text-gray-600">
      <h3 className="font-bold text-gray-800 text-lg">1. Hizmetin Tanımı</h3>
      <p>
        Bu sözleşme, "Evrak Takip Sistemi" (bundan sonra "Sistem" olarak anılacaktır) ile kullanıcı arasındaki kullanım şartlarını belirler. Sistem, kullanıcıların kurumsal veya bireysel belgelerini dijital ortamda saklamasına, takibini yapmasına ve hatırlatma almasına olanak tanır.
      </p>

      <h3 className="font-bold text-gray-800 text-lg">2. Kullanıcı Sorumlulukları</h3>
      <p>
        Kullanıcı, sisteme yüklediği belgelerin yasallığından ve doğruluğundan bizzat sorumludur. Sistemin amacı dışında, yasa dışı veya zararlı içerik barındıran dosyaların yüklenmesi yasaktır. Kullanıcı hesap güvenliğini sağlamakla yükümlüdür.
      </p>

      <h3 className="font-bold text-gray-800 text-lg">3. Hizmet Sürekliliği</h3>
      <p>
        Sistem yönetimi, teknik arızalar, bakım çalışmaları veya mücbir sebeplerden kaynaklanan kesintilerden sorumlu tutulamaz. Ancak veri kaybını önlemek için gerekli yedekleme ve güvenlik önlemleri alınmaktadır.
      </p>

      <h3 className="font-bold text-gray-800 text-lg">4. Abonelik ve İptal</h3>
      <p>
        Premium üyelikler, belirlenen süre sonunda otomatik olarak yenilenmez. Kullanıcı dilediği zaman hesabını silebilir veya üyeliğini sonlandırabilir.
      </p>
    </div>
  );

  const PrivacyContent = (
    <div className="space-y-4 text-sm text-gray-600">
      <h3 className="font-bold text-gray-800 text-lg">1. Toplanan Veriler</h3>
      <p>
        Kayıt esnasında Ad-Soyad, E-posta ve Telefon numarası bilgileriniz toplanmaktadır. Ayrıca sisteme yüklediğiniz belgeler, şifreli sunucularımızda saklanmaktadır.
      </p>

      <h3 className="font-bold text-gray-800 text-lg">2. Verilerin Kullanımı</h3>
      <p>
        Telefon numaranız ve e-posta adresiniz, sadece belge hatırlatmaları, sistem bildirimleri ve güvenlik doğrulamaları için kullanılır. Verileriniz asla üçüncü taraf reklam firmalarıyla paylaşılmaz.
      </p>

      <h3 className="font-bold text-gray-800 text-lg">3. Veri Güvenliği</h3>
      <p>
        Tüm verileriniz SSL sertifikası ile korunmakta olup, veritabanımızda yüksek güvenlik standartları (Encryption) uygulanmaktadır.
      </p>
    </div>
  );

  // --- ORTAK MODAL BİLEŞENİ ---
  const Modal = ({ title, content, onClose, onAccept }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[80vh] animate-fadeIn">
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-blue-600" size={24} />
            {title}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition">
            <X size={24} className="text-gray-500" />
          </button>
        </div>
        
        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto">
          {content}
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition"
          >
            Kapat
          </button>
          <button 
            onClick={() => {
              onAccept(); // Tiki işaretle
              onClose();  // Pencereyi kapat
            }}
            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <ShieldCheck size={18} />
            Okudum, Kabul Ediyorum
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      
      {/* --- MODALLAR --- */}
      {showTermsModal && (
        <Modal 
          title="Kullanım Sözleşmesi" 
          content={TermsContent} 
          onClose={() => setShowTermsModal(false)} 
          onAccept={() => setAcceptedTerms(true)}
        />
      )}

      {showPrivacyModal && (
        <Modal 
          title="Gizlilik Politikası" 
          content={PrivacyContent} 
          onClose={() => setShowPrivacyModal(false)} 
          onAccept={() => setAcceptedTerms(true)}
        />
      )}

      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center mb-6">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
            <UserPlus size={32} />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-800">
            Hesap Oluştur
          </h2>
          <p className="text-gray-500 text-sm mt-2">Hemen aramıza katılın</p>
        </div>

        {/* Google Login Butonu */}
        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full mb-6 flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Google ile Kayıt Ol
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">
              veya e-posta ile
            </span>
          </div>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              İsim Soyisim
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                required
                placeholder="Adınız Soyadınız"
                className="w-full pl-10 p-3 rounded border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Telefon Numarası
            </label>
            <div className="relative">
              <Phone
                className="absolute left-3 top-3 text-gray-400"
                size={18}
              />
              <input
                type="tel"
                required
                placeholder="05XX XXX XX XX"
                className="w-full pl-10 p-3 rounded border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              E-Posta
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="email"
                required
                placeholder="ornek@email.com"
                className="w-full pl-10 p-3 rounded border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Şifre
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="password"
                required
                minLength={6}
                placeholder="******"
                className="w-full pl-10 p-3 rounded border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* SÖZLEŞME ONAY KUTUSU (GÜNCELLENMİŞ) */}
          <div className="flex items-start gap-3 pt-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="relative flex items-center h-5 mt-0.5">
              <input
                id="terms"
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="w-4 h-4 border border-gray-300 rounded text-blue-600 focus:ring-3 focus:ring-blue-300 cursor-pointer"
              />
            </div>
            <label
              htmlFor="terms"
              className="text-xs text-gray-600 select-none leading-relaxed"
            >
              <button 
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="font-bold text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
              >
                Kullanım Sözleşmesi
              </button>
              'ni ve{' '}
              <button 
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="font-bold text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
              >
                Gizlilik Politikası
              </button>
              'nı okudum ve kabul ediyorum.
            </label>
          </div>

          <button
            disabled={loading || !acceptedTerms}
            className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg ${
              loading || !acceptedTerms
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white transform hover:-translate-y-0.5'
            }`}
          >
            {loading ? 'Kaydediliyor...' : 'Kayıt Ol'} <ArrowRight size={18} />
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          Zaten hesabın var mı?{' '}
          <Link to="/" className="text-blue-600 font-bold hover:underline">
            Giriş Yap
          </Link>
        </div>
      </div>
    </div>
  );
}