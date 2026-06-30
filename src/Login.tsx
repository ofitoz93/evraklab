import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Link, useNavigate } from 'react-router-dom'; // Yönlendirme için Link eklendi
import { Shield, Mail, Lock, LogIn, ArrowRight } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Recovery / Password Creation / Setup States
  const [isRecovery, setIsRecovery] = useState(false);
  const [isSetupPassword, setIsSetupPassword] = useState(false);
  const [loginTab, setLoginTab] = useState<'consultant' | 'client'>('consultant');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    // Listen for Supabase password recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Check URL query parameters or hash as fallback
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('type') === 'recovery' || window.location.hash.includes('type=recovery')) {
      setIsRecovery(true);
    } else if (searchParams.get('type') === 'setup-password') {
      setIsSetupPassword(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      alert('Şifreniz başarıyla oluşturuldu! Sisteme giriş yapıyorsunuz...');
      setIsRecovery(false);
      navigate('/');
    } catch (err: any) {
      alert('Şifre güncellenirken hata oluştu: ' + err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSetupPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      alert('Şifreler uyuşmuyor.');
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const emailParam = searchParams.get('email');
    const tokenParam = searchParams.get('token');

    if (!emailParam || !tokenParam) {
      alert('Kurulum bilgileri eksik veya geçersiz.');
      return;
    }

    setSavingPassword(true);
    try {
      // 1. Sign out any current session
      await supabase.auth.signOut();

      // 2. Login with temp token (current password)
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: emailParam.trim(),
        password: tokenParam.trim(),
      });

      if (loginErr) throw loginErr;

      // 3. Update to chosen password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) throw updateErr;

      // 4. Invalidate setup token via RPC function
      await supabase.rpc('clear_client_login_token', { p_email: emailParam });

      alert('Şifreniz başarıyla kuruldu! Müşteri panelinize yönlendiriliyorsunuz...');
      setIsSetupPassword(false);
      navigate('/client-panel');
    } catch (err: any) {
      alert('Şifre kurulurken hata: ' + err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  useEffect(() => {
    supabase
      .from('email_settings')
      .select('value')
      .eq('key', 'system_logo_url')
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.value) setLogoUrl(data.value);
      });
  }, []);

  // --- GOOGLE İLE GİRİŞ ---
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin, // Giriş yapınca ana sayfaya döner
        },
      });
      if (error) throw error;
    } catch (error: any) {
      alert('Google giriş hatası: ' + error.message);
    }
  };

  // --- E-POSTA İLE GİRİŞ ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (loginTab === 'client') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profile?.role === 'client') {
          navigate('/client-panel');
        } else {
          await supabase.auth.signOut();
          throw new Error('Bu giriş alanı sadece müşterilere özeldir.');
        }
      } else {
        navigate('/');
      }
    } catch (error: any) {
      alert('Giriş başarısız: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900 p-4 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-slate-700">
        
        {isSetupPassword ? (
          <div>
            <div className="text-center mb-8">
              <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
                <Lock size={32} />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white">
                Şifre Kurulumu
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                Hesabınız için kalıcı giriş şifrenizi oluşturun
              </p>
            </div>

            <form onSubmit={handleSetupPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  Yeni Şifre
                </label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
                  <input
                    type="password"
                    placeholder="En az 6 karakter..."
                    className="w-full pl-10 p-3 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  Yeni Şifre (Tekrar)
                </label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
                  <input
                    type="password"
                    placeholder="Şifreyi tekrar yazın..."
                    className="w-full pl-10 p-3 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                disabled={savingPassword}
                className="w-full bg-blue-600 dark:bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg shadow-blue-600/20"
              >
                {savingPassword ? 'Şifre Kaydediliyor...' : 'Şifreyi Kaydet ve Giriş Yap'}
              </button>
            </form>
          </div>
        ) : isRecovery ? (
          <div>
            <div className="text-center mb-8">
              <div className="bg-teal-100 dark:bg-teal-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-teal-600 dark:text-teal-400">
                <Lock size={32} />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white">
                Şifre Yenileme
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                Hesabınız için yeni giriş şifrenizi belirleyin
              </p>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  Yeni Şifre
                </label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
                  <input
                    type="password"
                    placeholder="En az 6 karakter..."
                    className="w-full pl-10 p-3 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                disabled={savingPassword}
                className="w-full bg-teal-600 dark:bg-teal-500 text-white font-bold py-3 rounded-xl hover:bg-teal-700 dark:hover:bg-teal-650 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg shadow-teal-600/20"
              >
                {savingPassword ? 'Şifre Kaydediliyor...' : 'Şifreyi Kaydet ve Giriş Yap'}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400 overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} className="w-full h-full object-contain p-2" alt="Logo" />
                ) : (
                  <Shield size={32} />
                )}
              </div>
              <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white">
                EvrakLab Portal
              </h2>
            </div>

            {/* Portal Seçim Sekmeleri */}
            <div className="flex border-b border-gray-150 dark:border-slate-700 mb-6">
              <button
                type="button"
                onClick={() => setLoginTab('consultant')}
                className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition-all ${
                  loginTab === 'consultant'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                    : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
                }`}
              >
                Danışman / Personel
              </button>
              <button
                type="button"
                onClick={() => setLoginTab('client')}
                className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition-all ${
                  loginTab === 'client'
                    ? 'border-teal-600 text-teal-600 dark:border-teal-500 dark:text-teal-400'
                    : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
                }`}
              >
                Müşteri Girişi
              </button>
            </div>

            {loginTab === 'consultant' && (
              <>
                <button
                  onClick={handleGoogleLogin}
                  type="button"
                  className="w-full mb-6 flex items-center justify-center gap-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 font-semibold py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Google ile Giriş Yap
                </button>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400">
                      veya e-posta ile
                    </span>
                  </div>
                </div>
              </>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  E-Posta
                </label>
                <div className="relative">
                  <Mail size={20} className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
                  <input
                    type="email"
                    placeholder="ornek@email.com"
                    className="w-full pl-10 p-3 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  Şifre
                </label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
                  <input
                    type="password"
                    placeholder="******"
                    className="w-full pl-10 p-3 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                disabled={loading}
                className={`w-full text-white font-bold py-3 rounded-xl transition duration-200 flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg ${
                  loginTab === 'client'
                    ? 'bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 shadow-teal-600/20'
                    : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-blue-600/20'
                }`}
              >
                {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'} <LogIn size={18} />
              </button>
            </form>

            {loginTab === 'consultant' && (
              <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400 font-medium">
                Hesabın yok mu?{' '}
                <Link
                  to="/register"
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline inline-flex items-center gap-1 transition-all hover:gap-2 ml-1"
                >
                  Hemen Kayıt Ol <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
