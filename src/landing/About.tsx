import React from 'react';
import { Link } from 'react-router-dom';
import { Target, ShieldCheck, Sparkles, Users2, ArrowRight } from 'lucide-react';
import LandingLayout from './LandingLayout';

const VALUES: { icon: React.ElementType; title: string; desc: string }[] = [
  {
    icon: Target,
    title: 'Odak',
    desc: 'Genel amaçlı bir doküman yönetim aracı değil; evrak, mevzuat ve çevre danışmanlığı süreçlerine özel olarak tasarlıyoruz.',
  },
  {
    icon: ShieldCheck,
    title: 'Güvenilirlik',
    desc: 'Bir belgenin veya bir yönetmelik değişikliğinin gözden kaçması, ciddi maliyetlere yol açabilir. Sistemimizi bu riski azaltmak için kuruyoruz.',
  },
  {
    icon: Sparkles,
    title: 'Sadelik',
    desc: 'Karmaşık süreçleri, ekibinizin günlük olarak kolayca kullanabileceği sade bir arayüze indirgiyoruz.',
  },
  {
    icon: Users2,
    title: 'Birlikte Büyüme',
    desc: 'Kullanıcılarımızdan aldığımız geri bildirimlerle sistemi sürekli geliştiriyoruz.',
  },
];

export default function About() {
  return (
    <LandingLayout>
      <section className="bg-gray-50 py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">Hakkımızda</h1>
          <p className="mx-auto mt-5 text-lg leading-relaxed text-gray-600 dark:text-slate-300">
            EvrakLab, çevre danışmanlığı firmalarının ve sanayi/üretim işletmelerinin evrak, mevzuat ve saha
            süreçlerini Excel tabloları, WhatsApp grupları ve dağınık e-posta yazışmaları arasında değil; tek bir
            sistemde, düzenli ve takip edilebilir şekilde yönetmesi için geliştirildi.
          </p>
        </div>
      </section>

      <section className="bg-white py-16 dark:bg-slate-950">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">Neden EvrakLab?</h2>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-slate-300">
                Çevre danışmanlığı firmaları onlarca müşteriyi, yüzlerce belge son kullanma tarihini ve sürekli
                değişen mevzuatı takip etmek zorunda. Bu takibi manuel yöntemlerle sürdürmek hem zaman kaybettiriyor
                hem de kritik bir belgenin veya bir yönetmelik değişikliğinin gözden kaçma riskini artırıyor.
                EvrakLab, bu takibi otomatikleştirerek hem danışmanlık firmalarının hem de onların müşterisi olan
                sanayi/üretim işletmelerinin işini kolaylaştırmayı hedefler.
              </p>
            </div>
            <div>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">Misyonumuz</h2>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-slate-300">
                Evrak ve mevzuat takibini, danışman ile müşterisi arasında ortak, şeffaf ve her an erişilebilir bir
                sürece dönüştürmek. Sistemimizi, kullanan ekiplerin gerçek ihtiyaçlarına göre sürekli geliştirmeye
                devam ediyoruz.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-16 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <h2 className="mb-10 text-center text-2xl font-extrabold text-gray-900 dark:text-white">Değerlerimiz</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <v.icon size={22} />
                </div>
                <h3 className="mb-1.5 text-base font-bold text-gray-900 dark:text-white">{v.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500 dark:text-slate-400">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 text-center dark:bg-slate-950">
        <div className="mx-auto max-w-2xl px-4 md:px-8">
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Ekibinizle birlikte deneyin</h2>
          <p className="mt-3 text-gray-500 dark:text-slate-400">
            EvrakLab'i kendi süreçlerinizde görmek için ücretsiz kayıt olun.
          </p>
          <Link
            to="/register"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
          >
            Ücretsiz Kayıt Ol <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </LandingLayout>
  );
}
