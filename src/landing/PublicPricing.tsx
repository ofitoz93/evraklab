import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Star, User, Building, ArrowRight, HardDrive } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LandingLayout from './LandingLayout';

// Admin panelindeki "Fiyatlandırma" sekmesinden (pricing_settings tablosu) veri
// gelene kadar veya tablo boşken kullanılan yedek değerler — bkz. Pricing.tsx.
const DEFAULT_SUBSCRIPTION_PLANS: Record<string, Record<number, { old: number; price: number; label: string }>> = {
  individual_standard: {
    1: { old: 250, price: 99, label: 'Aylık' },
    3: { old: 750, price: 279, label: '3 Aylık' },
    6: { old: 1500, price: 499, label: '6 Aylık' },
    12: { old: 3000, price: 849, label: '1 Yıllık' },
  },
  corporate: {
    1: { old: 500, price: 199, label: 'Aylık' },
    3: { old: 1500, price: 567, label: '3 Aylık' },
    6: { old: 3000, price: 1074, label: '6 Aylık' },
    12: { old: 6000, price: 1788, label: '1 Yıllık' },
  },
};

const DEFAULT_STORAGE_PACKAGES = [
  { size_gb: 0.5, label: '500 MB Ekstra', override_price: 100 },
  { size_gb: 1, label: '1 GB Ekstra', override_price: 190 },
];

const calcStoragePackagePrice = (pkg: any, storagePricing: any) => {
  if (pkg.override_price !== null && pkg.override_price !== undefined && pkg.override_price !== '') {
    return Number(pkg.override_price);
  }
  const cost = Number(storagePricing.supabase_cost_usd_per_gb) || 0;
  const rate = Number(storagePricing.usd_try_rate) || 0;
  const margin = Number(storagePricing.profit_margin_percent) || 0;
  return Math.round(Number(pkg.size_gb) * cost * rate * (1 + margin / 100) * 100) / 100;
};

export default function PublicPricing() {
  const [subscriptionPlans, setSubscriptionPlans] = useState(DEFAULT_SUBSCRIPTION_PLANS);
  const [storagePackages, setStoragePackages] = useState<any[]>(DEFAULT_STORAGE_PACKAGES);
  const [storagePricing, setStoragePricing] = useState<any>({});
  const [selectedPlan, setSelectedPlan] = useState<'individual' | 'corporate'>('individual');
  const [duration, setDuration] = useState(12);

  useEffect(() => {
    supabase
      .from('pricing_settings')
      .select('*')
      .then(({ data }) => {
        (data || []).forEach((row: any) => {
          if (row.key === 'subscription_plans') setSubscriptionPlans(row.value);
          if (row.key === 'storage_pricing') {
            setStoragePricing(row.value);
            if (row.value?.packages) setStoragePackages(row.value.packages);
          }
        });
      });
  }, []);

  const planKey = selectedPlan === 'individual' ? 'individual_standard' : 'corporate';
  const pricingTable = subscriptionPlans[planKey] || DEFAULT_SUBSCRIPTION_PLANS[planKey];

  return (
    <LandingLayout>
      <section className="bg-gray-50 py-16 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">Fiyatlandırma</h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-slate-300">
            İhtiyacınıza uygun paketi seçin, dakikalar içinde başlayın.
          </p>
        </div>
      </section>

      <section className="bg-white py-14 dark:bg-slate-950">
        <div className="mx-auto max-w-5xl px-4 md:px-8">
          <div className="mb-10 flex justify-center">
            <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setSelectedPlan('individual')}
                className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold transition-all ${
                  selectedPlan === 'individual'
                    ? 'bg-white text-blue-600 shadow dark:bg-slate-900'
                    : 'text-gray-500 dark:text-slate-400'
                }`}
              >
                <User size={16} /> Bireysel
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlan('corporate')}
                className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold transition-all ${
                  selectedPlan === 'corporate'
                    ? 'bg-white text-purple-600 shadow dark:bg-slate-900'
                    : 'text-gray-500 dark:text-slate-400'
                }`}
              >
                <Building size={16} /> Kurumsal
              </button>
            </div>
          </div>

          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              {selectedPlan === 'individual' ? 'Bireysel Premium Paket' : 'Kurumsal Şirket Paketi'}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-gray-500 dark:text-slate-400">
              {selectedPlan === 'individual'
                ? 'Sınırsız hatırlatma ve 500 MB depolama.'
                : 'Ekip yönetimi, sohbet ve 1 GB ortak depolama.'}
            </p>
          </div>

          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 3, 6, 12].map((d) => {
              const info = pricingTable[d];
              if (!info) return null;
              const monthlyCost = (info.price / d).toFixed(2);
              const discountPercent = info.old > 0 ? Math.round(((info.old - info.price) / info.old) * 100) : 0;
              return (
                <div
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`relative flex cursor-pointer flex-col justify-between rounded-2xl border-2 p-4 transition-all ${
                    duration === d
                      ? 'z-10 scale-105 border-blue-600 bg-blue-50 shadow-lg dark:bg-blue-950/20'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900'
                  }`}
                >
                  {d === 12 && (
                    <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                      <Star size={12} fill="white" /> EN AVANTAJLI
                    </div>
                  )}
                  <div className="mb-2 text-center">
                    <h4 className="text-lg font-bold text-gray-800 dark:text-white">{info.label}</h4>
                    {discountPercent > 0 && (
                      <span className="mt-1 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-extrabold text-green-700 dark:bg-green-950/40 dark:text-green-400">
                        %{discountPercent} İNDİRİM
                      </span>
                    )}
                  </div>
                  <div className="my-2 text-center">
                    {info.old > info.price && (
                      <div className="text-sm text-gray-400 line-through decoration-red-400 decoration-2">{info.old} TL</div>
                    )}
                    <div className="text-3xl font-black text-gray-900 dark:text-white">{info.price} TL</div>
                    <div className="mt-1 text-sm font-semibold text-blue-600 dark:text-blue-400">{monthlyCost} TL / Ay</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700"
            >
              Ücretsiz Kayıt Ol <ArrowRight size={18} />
            </Link>
            <p className="mt-3 text-xs text-gray-400 dark:text-slate-500">
              Kayıt olduktan sonra bu paketlerden dilediğinizi satın alabilirsiniz.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-14 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <div className="mb-8 text-center">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <HardDrive size={22} />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Ek Depolama</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500 dark:text-slate-400">
              Paketinizin varsayılan kotası yetmezse, kalıcı ek depolama alanı satın alabilirsiniz.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {storagePackages.map((pkg: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-slate-200">
                  <CheckCircle size={16} className="text-blue-600 dark:text-blue-400" /> {pkg.label}
                </div>
                <div className="text-lg font-black text-gray-900 dark:text-white">
                  {calcStoragePackagePrice(pkg, storagePricing)} TL
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
