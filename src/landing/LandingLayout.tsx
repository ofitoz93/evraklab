import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, LogIn, Mail, Phone, LayoutDashboard } from 'lucide-react';
import { supabase } from '../supabaseClient';

const NAV_LINKS: { to: string; label: string }[] = [
  { to: '/', label: 'Ana Sayfa' },
  { to: '/#ozellikler', label: 'Özellikler' },
  { to: '/hakkimizda', label: 'Hakkımızda' },
  { to: '/fiyatlandirma', label: 'Fiyatlandırma' },
  { to: '/iletisim', label: 'İletişim' },
];

// Giriş sonrası navbar'daki (App.tsx NavBarContent) logo + wordmark ile birebir
// aynı görünüm — marka tutarlılığı için pazarlama sayfalarında da bu kullanılır.
function BrandMark({ logoUrl, textSize = 'text-2xl' }: { logoUrl: string | null; textSize?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex items-center justify-center w-8 h-8 bg-gradient-to-br from-[#0e2a47] to-[#1a4066] rounded-lg shadow-sm text-white overflow-hidden shrink-0">
        {logoUrl ? (
          <img src={logoUrl} className="w-full h-full object-contain p-0.5" alt="Logo" />
        ) : (
          <LayoutDashboard size={18} />
        )}
      </div>
      <div className={`${textSize} font-extrabold tracking-tight flex items-baseline select-none`}>
        <span className="text-[#0e2a47] dark:text-white">EVRAK</span>
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2ca58d] to-[#84cc16]">
          LAB
        </span>
      </div>
    </div>
  );
}

function LandingHeader() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname === to;
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 md:px-8">
        <Link to="/" className="flex items-center shrink-0 hover:opacity-90 transition-opacity">
          <BrandMark logoUrl={logoUrl} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                isActive(link.to)
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            to="/login"
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <LogIn size={16} /> Giriş Yap
          </Link>
          <Link
            to="/register"
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700"
          >
            Ücretsiz Kayıt Ol <ArrowRight size={15} />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Menüyü aç/kapat"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
                  isActive(link.to)
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                    : 'text-gray-700 dark:text-slate-200'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-slate-800">
              <Link
                to="/login"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 dark:border-slate-700 dark:text-slate-200"
              >
                <LogIn size={16} /> Giriş Yap
              </Link>
              <Link
                to="/register"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20"
              >
                Ücretsiz Kayıt Ol <ArrowRight size={15} />
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function LandingFooter() {
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('email_settings')
      .select('key, value')
      .in('key', ['contact_email', 'contact_phone', 'system_logo_url'])
      .then(({ data }) => {
        (data || []).forEach((row: any) => {
          if (row.key === 'contact_email') setContactEmail(row.value || '');
          if (row.key === 'contact_phone') setContactPhone(row.value || '');
          if (row.key === 'system_logo_url') setLogoUrl(row.value || null);
        });
      });
  }, []);

  return (
    <footer className="border-t border-gray-100 bg-gray-50 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
        <div>
          <div className="mb-3">
            <BrandMark logoUrl={logoUrl} textSize="text-xl" />
          </div>
          <p className="text-sm leading-relaxed text-gray-500 dark:text-slate-400">
            Evrak, mevzuat ve çevre danışmanlığı süreçlerinizi tek panelden yönetin.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Ürün</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/#ozellikler" className="text-gray-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400">Özellikler</Link></li>
            <li><Link to="/fiyatlandirma" className="text-gray-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400">Fiyatlandırma</Link></li>
            <li><Link to="/register" className="text-gray-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400">Ücretsiz Kayıt Ol</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Şirket</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/hakkimizda" className="text-gray-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400">Hakkımızda</Link></li>
            <li><Link to="/iletisim" className="text-gray-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400">İletişim</Link></li>
            <li><Link to="/login" className="text-gray-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400">Giriş Yap</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">İletişim</h4>
          <ul className="space-y-2.5 text-sm">
            {contactEmail && (
              <li>
                <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 text-gray-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400">
                  <Mail size={15} className="shrink-0" /> {contactEmail}
                </a>
              </li>
            )}
            {contactPhone && (
              <li>
                <a href={`tel:${contactPhone}`} className="flex items-center gap-2 text-gray-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400">
                  <Phone size={15} className="shrink-0" /> {contactPhone}
                </a>
              </li>
            )}
            {!contactEmail && !contactPhone && (
              <li className="text-gray-400 dark:text-slate-500">
                <Link to="/iletisim" className="hover:text-blue-600 dark:hover:text-blue-400">İletişim sayfasına git</Link>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-100 px-4 py-5 dark:border-slate-800">
        <p className="text-center text-xs text-gray-400 dark:text-slate-500">
          © {new Date().getFullYear()} EvrakLab. Tüm hakları saklıdır.
        </p>
      </div>
    </footer>
  );
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900 dark:bg-slate-900 dark:text-slate-100">
      <LandingHeader />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
