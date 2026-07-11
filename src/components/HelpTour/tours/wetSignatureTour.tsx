import type { TourDefinition, TourStep } from '../types';

const steps: TourStep[] = [
  {
    id: 'overview',
    title: 'Bu Pencere Nereden Açılır?',
    body: 'Evraklar listesinde, bir rapora bağlı belgelerin satırında beliren kehribar renkli kalem ikonuna tıklandığında açılır. Sıradan belgelerde bu ikon görünmez.',
  },
  {
    id: 'doc-info',
    title: '“Seçilen Rapor” Bilgi Kutusu',
    body: 'Hangi raporun ıslak imzalı nüshasını yüklediğinizi gösterir, karışıklığı önler.',
  },
  {
    id: 'howto',
    title: '“Nasıl Yapılır?” Talimat Kutusu',
    body: 'Dört adımı özetler: raporu indirip yazdırma, ilgili kişilere imzalatma, taratıp dijitalleştirme, ve son olarak buradan yükleme.',
  },
  {
    id: 'f-dosya',
    title: 'Dosya Seçim Alanı',
    body: 'PDF, JPG ya da PNG formatında taranmış/fotoğraflanmış imzalı dosyayı buradan seçip yüklersiniz; yükleme sırasında buton “Yükleniyor...” durumuna geçer.',
  },
  {
    id: 'f-sonuc',
    title: 'Yükleme Sonrası: “Islak İmzalı” Etiketi',
    body: 'Yükleme tamamlandığında, Evraklar listesinde o satırda yeşil “Islak İmzalı” etiketi belirir — etikete tıklandığında doğrudan yüklenen dosyayı açar.',
  },
];

function WetSignatureStage() {
  return (
    <div className="flex items-center justify-center min-h-[420px]">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 border border-gray-100 dark:border-slate-700">
        <div data-tour="overview" className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2 text-sm">
            ✎ Islak İmzalı Rapor Yükle
          </h3>
          <span className="text-gray-400">✕</span>
        </div>

        <div data-tour="doc-info" className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30 rounded-lg p-2.5 mb-3 text-xs text-blue-700 dark:text-blue-400">
          <span className="font-bold">Seçilen Rapor:</span> Aylık Faaliyet Raporu — Haziran 2026
        </div>

        <div data-tour="howto" className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-3 mb-4 text-amber-700 dark:text-amber-400">
          <div className="font-bold text-xs mb-1.5">Nasıl yapılır?</div>
          <ol className="list-decimal list-inside space-y-1 text-[11px]">
            <li>Raporu indirin veya "Görüntüle" sayfasından yazdırın</li>
            <li>İlgili kişilere ıslak imzalattırın</li>
            <li>İmzalı raporu taratıp/fotoğrafını çekip dijitalleştirin</li>
            <li>Aşağıdan seçerek yükleyin</li>
          </ol>
        </div>

        <div data-tour="f-dosya" className="rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/10 p-5 text-center text-amber-700 dark:text-amber-400 mb-3">
          <div className="text-lg mb-1">📤</div>
          <div className="font-bold text-sm">Islak İmzalı Dosyayı Seçin</div>
          <div className="text-[11px] opacity-80 mt-0.5">PDF, JPG, PNG desteklenir</div>
        </div>

        <div data-tour="f-sonuc">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            ✓ Islak İmzalı
          </span>
        </div>
      </div>
    </div>
  );
}

const tour: TourDefinition = {
  id: 'wetSignature',
  title: 'Islak İmzalı Yükleme',
  steps,
  StageComponent: WetSignatureStage,
};

export default tour;
