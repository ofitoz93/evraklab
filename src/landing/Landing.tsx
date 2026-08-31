import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Gavel,
  Trash2,
  QrCode,
  ClipboardList,
  Users,
  Wallet,
  CloudUpload,
  BellRing,
  ArrowRight,
  CheckCircle2,
  Building2,
  Factory,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import LandingLayout from './LandingLayout';

export const FEATURES: { icon: React.ElementType; title: string; desc: string }[] = [
  { icon: FileText, title: 'Evrak Takibi ve Arşivleme', desc: 'Tüm belgelerinizi tek yerde saklayın, son kullanma tarihlerini kaçırmayın.' },
  { icon: Gavel, title: 'Mevzuat Takibi', desc: 'Resmi Gazete otomatik taranır, ilgili yönetmelik değişiklikleri size otomatik yansır.' },
  { icon: Trash2, title: 'Atık Yönetimi', desc: 'Atık kodlarını ve süreçlerini uçtan uca izleyin.' },
  { icon: QrCode, title: 'Saha Denetimi (QR)', desc: 'Sahadaki denetim formlarını QR kodla mobil üzerinden doldurun, merkeze anında düşsün.' },
  { icon: ClipboardList, title: 'Rapor ve Görüş Yazısı', desc: 'Aylık/yıllık çevre raporlarını ve görüş yazılarını standart şablonlarla hızlıca hazırlayın.' },
  { icon: Users, title: 'Müşteri Portföyü Yönetimi', desc: 'Danışmanlık firmaları için hizmet verilen tüm işletmeleri ve ekip atamalarını tek yerden yönetin.' },
  { icon: Wallet, title: 'Finans Takibi', desc: 'Müşteri ödemelerini ve giderlerinizi tek ekrandan izleyin.' },
  { icon: CloudUpload, title: 'Esnek Depolama', desc: 'EvrakLab sunucusunda veya kendi Google Drive\'ınızda, tercihinize göre saklayın.' },
  { icon: BellRing, title: 'Otomatik Hatırlatmalar', desc: 'Süresi dolan belgeler için otomatik e-posta uyarısı alın, hiçbir şey gözden kaçmasın.' },
];

export default function Landing() {
  return (
    <LandingLayout>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gray-50 dark:bg-slate-900">
        <div
          className="pointer-events-none absolute -top-32 right-[-10%] h-[32rem] w-[32rem] rounded-full opacity-20 blur-3xl"
          style={{ background: 'linear-gradient(135deg, #7e14ff, #47bfff)' }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400">
              <CheckCircle2 size={13} /> Evrak, mevzuat ve çevre danışmanlığı yönetimi
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white md:text-5xl">
              Evrak ve mevzuat takibinizi
              <span className="bg-gradient-to-r from-[#7e14ff] to-[#47bfff] bg-clip-text text-transparent"> tek panelden </span>
              yönetin
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600 dark:text-slate-300">
              EvrakLab; belge son kullanma tarihlerini, Resmi Gazete'deki mevzuat değişikliklerini,
              saha denetimlerini ve müşteri portföyünüzü Excel ve WhatsApp yerine tek bir sistemde toplar.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/register"
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700"
              >
                Ücretsiz Kayıt Ol <ArrowRight size={18} />
              </Link>
              <Link
                to="/fiyatlandirma"
                className="rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-base font-bold text-gray-700 transition-colors hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Fiyatlandırmayı İncele
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* NEDEN EVRAKLAB */}
      <section className="border-y border-gray-100 bg-white py-12 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 sm:grid-cols-3 md:px-8">
          {[
            { title: 'Zaman Kazandırır', desc: 'Tekrarlayan takip işlerini otomatikleştirir, elle takip ihtiyacını ortadan kaldırır.' },
            { title: 'Hata Riskini Azaltır', desc: 'Süresi dolan bir belge ya da mevzuat değişikliği artık gözden kaçmaz.' },
            { title: 'Tek Panelden Yönetim', desc: 'Ekip, müşteri, evrak ve rapor süreçleri aynı yerde birleşir.' },
          ].map((item) => (
            <div key={item.title} className="text-center sm:text-left">
              <h3 className="mb-1.5 text-base font-bold text-gray-900 dark:text-white">{item.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500 dark:text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* EKİP ŞEFFAFLIĞI — firma sahibinin danışman/personel takibi */}
      <section className="bg-white py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                <Eye size={13} /> Firma Sahipleri İçin
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white">
                Danışmanlarınızın ne yaptığını her an görün
              </h2>
              <p className="mt-4 text-gray-600 dark:text-slate-300">
                EvrakLab'in en güçlü yanlarından biri, firma sahiplerine ekibindeki danışmanları ve personeli
                yakından takip etme imkanı sunmasıdır. Hangi danışman hangi müşteriyle ilgileniyor, hangi evrakı
                takip ediyor, hangi görevi ne zaman tamamladı — hepsi tek panelden şeffaf şekilde görünür.
              </p>
              <ul className="mt-6 space-y-4">
                {[
                  { icon: ClipboardList, text: 'Her göreve/aksiyona hangi danışmanın atandığını, durumunu ve tamamlanma tarihini görün.' },
                  { icon: FileText, text: 'Bir evrakı kimin yüklediğini, kimin takip ettiğini kayıt altında tutun — hiçbir sorumluluk gözden kaçmaz.' },
                  { icon: Users, text: 'Danışman bazında hangi müşteri portföyünün atandığını ve iş yükünü tek bakışta karşılaştırın.' },
                  { icon: ShieldCheck, text: 'Müşterilerinizden gelen değerlendirmelerle ekibinizin performansını ölçün.' },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <item.icon size={16} />
                    </div>
                    <p className="text-sm leading-relaxed text-gray-600 dark:text-slate-300">{item.text}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Ekip Aktivitesi</h3>
                <span className="text-xs text-gray-400 dark:text-slate-500">Bugün</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Ahmet Y.</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">ABC Kimya için atık raporu yükledi</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Tamamlandı</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Elif K.</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">XYZ Tekstil saha denetimini gerçekleştirdi</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">İncelemede</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Mert D.</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">3 müşteri için mevzuat uyum kontrolü yaptı</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">Devam Ediyor</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ÖZELLİKLER */}
      <section id="ozellikler" className="bg-gray-50 py-20 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Tüm süreçleriniz için tek sistem</h2>
            <p className="mt-3 text-gray-500 dark:text-slate-400">
              Evrak takibinden mevzuat izlemeye, saha denetiminden finans takibine kadar ihtiyacınız olan her şey.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <f.icon size={22} />
                </div>
                <h3 className="mb-1.5 text-base font-bold text-gray-900 dark:text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500 dark:text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KİMLER İÇİN */}
      <section className="bg-white py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Kimler için?</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 p-8 dark:border-slate-800">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                <Building2 size={24} />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Çevre Danışmanlığı Firmaları</h3>
              <p className="text-sm leading-relaxed text-gray-500 dark:text-slate-400">
                Hizmet verdiğiniz tüm müşterileri, ekip atamalarını, raporları ve görüş yazılarını tek panelden
                yönetin; müşteri başına Excel/WhatsApp takibine son verin.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 p-8 dark:border-slate-800">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                <Factory size={24} />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Sanayi / Üretim Firmaları</h3>
              <p className="text-sm leading-relaxed text-gray-500 dark:text-slate-400">
                Kendi tesisinizin evrak, mevzuat uyumu, atık yönetimi ve saha denetimlerini danışmanınızla
                birlikte aynı panelden takip edin.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FİYAT TEASER */}
      <section className="bg-gray-50 py-16 dark:bg-slate-950">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Size uygun paketi seçin</h2>
          <p className="mx-auto mt-3 max-w-xl text-gray-500 dark:text-slate-400">
            Bireysel kullanımdan kurumsal ekiplere kadar ölçeklenen, şeffaf fiyatlandırma.
          </p>
          <Link
            to="/fiyatlandirma"
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Fiyatlandırmayı Gör <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* KAPANIŞ CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#7e14ff] to-[#47bfff] py-16">
        <div className="relative mx-auto max-w-3xl px-4 text-center md:px-8">
          <h2 className="text-3xl font-extrabold text-white">Hemen ücretsiz kayıt olun</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">
            Kurulum gerektirmez, dakikalar içinde başlayın.
          </p>
          <Link
            to="/register"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-gray-900 shadow-lg transition-transform hover:scale-[1.02]"
          >
            Ücretsiz Kayıt Ol <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </LandingLayout>
  );
}
