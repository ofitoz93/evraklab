import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import LandingLayout from './LandingLayout';
import { FEATURES } from './Landing';

export default function Features() {
  return (
    <LandingLayout>
      <section className="bg-gray-50 py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">Özellikler</h1>
          <p className="mx-auto mt-5 text-lg leading-relaxed text-gray-600 dark:text-slate-300">
            Evrak takibinden mevzuat izlemeye, saha denetiminden finans takibine kadar ihtiyacınız olan her şey
            tek panelde.
          </p>
        </div>
      </section>

      <section className="bg-white py-16 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
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

      <section className="bg-gray-50 py-16 text-center dark:bg-slate-900">
        <div className="mx-auto max-w-2xl px-4 md:px-8">
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Hemen ücretsiz kayıt olun</h2>
          <p className="mt-3 text-gray-500 dark:text-slate-400">
            Kurulum gerektirmez, dakikalar içinde başlayın.
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
