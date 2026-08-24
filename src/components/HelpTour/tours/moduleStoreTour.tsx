import type { ReactNode } from 'react';
import type { TourDefinition, TourStep } from '../types';

const steps: TourStep[] = [
  {
    id: 'entry',
    title: 'Mağaza Nereden Açılır?',
    body: 'Panelin üst kısmındaki "Ekstra Paket & Modül Mağazası" butonuna tıklayarak açılır. Sadece Şirket Yöneticileri ve Şirket Sahipleri satın alma/iptal işlemi yapabilir; diğer roller mağazayı sadece görüntüleyebilir.',
  },
  {
    id: 'card',
    title: 'Modül Kartı',
    body: 'Her ekstra modülün simgesi, kategorisi, kısa açıklaması ve aylık fiyatı bir kartta gösterilir. Fiyatlar admin tarafından "Modül Ayarları"ndan belirlenir ve güncellenebilir.',
  },
  {
    id: 'sub',
    title: 'Alt Modül Kavramı (Yeni)',
    body: 'Bazı modüller bir üst modülün "alt modülü" olarak tanımlanabilir. Örneğin "Mevzuat Talepleri", "Mevzuat Takip" modülünün alt modülü yapılırsa mağazada ayrıca listelenmez — üst modül satın alındığında otomatik olarak açılır ve bir üst modülün kartında "📦 Dahil olan alt modüller" notuyla belirtilir.',
  },
  {
    id: 'preview',
    title: '“Önizle — Nasıl Çalışır?” (Yeni)',
    body: 'Bazı modüllerde bu buton bulunur; satın almadan önce modülün ekranlarını ve ne işe yaradığını kısa bir önizleme penceresinde gösterir.',
  },
  {
    id: 'add',
    title: '“Paketime Ekle” Butonu',
    body: 'Tıklandığında modül hemen aktifleşmez — güvenli ödeme adımına yönlendirilirsiniz. Aktivasyon, ödeme onaylandıktan sonra otomatik gerçekleşir.',
  },
  {
    id: 'checkout',
    title: 'PayTR ile Güvenli Ödeme (Yeni)',
    body: 'Fatura adresi girildikten sonra PayTR\'ın güvenli ödeme ekranı açılır. Modül, yalnızca PayTR ödemeyi onayladığında (sunucu tarafı bildirim ile) otomatik olarak aktif edilir — sayfa kapatılsa bile ödeme onaylanınca modül açılır.',
  },
  {
    id: 'active',
    title: 'Aktif Modül ve İptal',
    body: 'Satın alınan modül sabit 1 aylık bir dönem için aktiftir; üye olunan ve bitiş tarihi kart üzerinde gösterilir. "Modülü Şimdi Kapat" ile istediğiniz zaman iptal edebilirsiniz — iptal ödeme gerektirmez ve modül anında paketinizden çıkar.',
  },
];

function Chip({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'emerald' | 'purple' }) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
    purple: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
  };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>;
}

function ModuleStoreStage() {
  return (
    <div className="flex items-center justify-center min-h-[460px]">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 border border-gray-100 dark:border-slate-700 space-y-4">
        <div data-tour="entry" className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-3">
          <span className="font-bold text-sm text-gray-700 dark:text-gray-200">🛍️ Ekstra Paket & Modül Mağazası</span>
          <span className="text-gray-400">✕</span>
        </div>

        <div
          data-tour="card"
          className="rounded-2xl border border-purple-200 dark:border-purple-900 p-4 space-y-2 bg-purple-50/30 dark:bg-purple-950/10"
        >
          <div className="flex justify-between items-start">
            <div className="p-2 bg-purple-100 dark:bg-purple-950/40 rounded-xl">📜</div>
            <div className="text-right">
              <span className="text-base font-black text-purple-900 dark:text-purple-300">₺250</span>
              <span className="text-[10px] text-gray-400 block font-bold">/ Ay</span>
            </div>
          </div>
          <div className="font-bold text-sm text-gray-900 dark:text-white">Mevzuat Takip</div>
          <Chip tone="purple">Yasal Uyum & Takip</Chip>
          <p className="text-xs text-gray-500 dark:text-gray-400">Yasal mevzuat ve standart takibi</p>

          <div data-tour="sub" className="text-[10px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 rounded-lg px-2 py-1.5">
            📦 Dahil olan alt modüller: Mevzuat Talepleri
          </div>

          <button data-tour="preview" className="w-full text-center py-2 rounded-xl border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-400 text-xs font-bold">
            👁 Önizle — Nasıl Çalışır?
          </button>

          <button data-tour="add" className="w-full bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs">
            + Paketime Ekle (₺250/Ay)
          </button>
        </div>

        <div data-tour="checkout" className="rounded-xl border border-gray-200 dark:border-slate-700 p-3 space-y-2">
          <div className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">💳 PayTR Güvenli Ödeme</div>
          <div className="h-7 rounded-lg bg-gray-100 dark:bg-slate-900 text-[10px] flex items-center px-2 text-gray-400">Fatura adresi...</div>
          <div className="h-7 rounded-lg bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">Ödemeye Geç</div>
        </div>

        <div data-tour="active" className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 px-3 py-2">
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">✓ Paketinizde Aktif — Bitiş: 21.09.2026</span>
          <span className="text-[10px] font-bold text-red-500">Kapat</span>
        </div>
      </div>
    </div>
  );
}

const tour: TourDefinition = {
  id: 'moduleStore',
  title: 'Ekstra Modül Mağazası',
  steps,
  StageComponent: ModuleStoreStage,
};

export default tour;
