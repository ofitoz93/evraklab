import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield } from 'lucide-react';

export default function ClientLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const autoLogin = async () => {
      const email = searchParams.get('email');
      const token = searchParams.get('token');

      if (!email || !token) {
        setErrorMsg('Geçersiz giriş bağlantısı. Lütfen size iletilen bağlantıyı tam olarak kopyalayıp yapıştırın.');
        return;
      }

      try {
        // Sign out any active session first to prevent conflicts
        await supabase.auth.signOut();

        // Perform passwordless auto login using the token as password
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: token.trim(),
        });

        if (error) throw error;

        // Redirect to Client Panel
        navigate('/client-panel');
      } catch (err: any) {
        console.error(err);
        setErrorMsg('Giriş yapılamadı: ' + (err.message || 'Bağlantı geçerliliğini yitirmiş olabilir.'));
      }
    };

    autoLogin();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md text-center space-y-6">
        <div className="bg-teal-500/10 text-teal-400 w-16 h-16 rounded-full flex items-center justify-center mx-auto border border-teal-500/10">
          <Shield size={32} />
        </div>

        {errorMsg ? (
          <div className="space-y-4">
            <h3 className="text-rose-500 font-extrabold text-lg">Giriş Hatası</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
            <button 
              onClick={() => navigate('/login')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl text-xs font-bold transition"
            >
              Giriş Ekranına Git
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
            <h3 className="text-white font-bold text-base">Güvenli Oturum Başlatılıyor</h3>
            <p className="text-xs text-slate-500">Lütfen bekleyin, Müşteri Panelinize yönlendiriliyorsunuz...</p>
          </div>
        )}
      </div>
    </div>
  );
}
