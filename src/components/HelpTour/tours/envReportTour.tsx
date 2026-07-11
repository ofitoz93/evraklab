import type { TourDefinition, TourStep } from '../types';

const steps: TourStep[] = [
  {
    id: 'overview',
    title: 'Genel Bakış: Adım Adım Sihirbaz',
    body: 'Rapor formu 4 adımlık bir sihirbazdır (aylık raporda), üstteki ilerleme çubuğu hangi adımda olduğunu gösterir. Danışman rolündeyseniz önce işletme seçersiniz; şahsi danışman iseniz bu alan atlanır.',
  },
  {
    id: 'f-isletme',
    title: '“Hizmet Verilen İşletme” Seçimi',
    body: 'Raporun hangi müşteri/işletme adına oluşturulacağını seçtiğiniz zorunlu alan. Seçim yapılmadan “İleri” butonuna basıldığında uyarı çıkar.',
  },
  {
    id: 'f-tur',
    title: '“Rapor Türü” Seçimi',
    body: 'Aylık Değerlendirme Raporu ya da Yıllık İç Tetkik Raporu seçilir — bu seçim bir sonraki adımlarda hangi form şablonunun açılacağını belirler.',
  },
  {
    id: 'f-tarih',
    title: '“Rapor (Ziyaret) Tarihi”',
    body: 'Sahaya gidilen/raporun düzenlendiği tarihtir. Bu tarih, raporun geçerlilik süresinin (aylık için +1 ay, yıllık için +1 yıl) otomatik hesaplanmasında kullanılır.',
  },
  {
    id: 'f-saat',
    title: '“Aylık Ziyaret Saati”',
    body: 'Sadece aylık raporlarda görünür. Ziyaretin öğleden önce mi sonra mı yoksa tüm gün mü sürdüğünü işaretlersiniz; tam gün ziyaretlerde ikisini de işaretlemeniz önerilir.',
  },
  {
    id: 'f-onceki',
    title: '“Önceki Verileri Çek” Butonu',
    body: 'Sadece danışman rolüne açıktır. Aynı işletmenin aynı türdeki bir önceki raporunun verilerini forma otomatik doldurur.',
  },
  {
    id: 'f-manuel',
    title: 'Manuel Dosya Yükleme Seçeneği',
    body: 'Bu kutuyu işaretlerseniz sistem formunu doldurmak yerine, hazır bir PDF/Word/görsel raporu doğrudan dosya olarak yükleyebilirsiniz — tüm form adımları atlanır.',
  },
  {
    id: 'f-sections',
    title: 'Rapor İçerik Bölümleri (2-4. Adımlar)',
    body: 'Aylık raporda A’dan G’ye harflendirilmiş bölümler (İşletme Bilgileri, Su/Hava/Atık Yönetimi, GFB işlemleri, şikayetler, eğitimler, sonuç ve ekler); yıllık raporda 1’den 11’e numaralı daha kapsamlı bir bölüm seti doldurulur.',
  },
  {
    id: 'f-ekler',
    title: '“Ekler” Bölümü',
    body: 'Saha fotoğrafı, ölçüm sonucu gibi destekleyici dosyaları buradan rapora ekler, gerekirse çöp kutusu ikonuyla kaldırırsınız.',
  },
  {
    id: 'f-geri',
    title: '“Geri” Butonu',
    body: 'Bir önceki adıma döner; ilk adımdayken pasif hâle gelir.',
  },
  {
    id: 'f-ileri',
    title: '“İleri” Butonu / “Raporu Kaydet ve Tamamla”',
    body: 'Ara adımlarda “İleri” ile devam edilir; son adımda buton “Raporu Kaydet ve Tamamla”ya dönüşür. Kaydedildiğinde geçerlilik tarihi otomatik hesaplanır, Evraklar listesine karşılık gelen bir belge kaydı otomatik oluşturulur.',
  },
];

function EnvReportStage() {
  return (
    <div className="text-sm">
      <div data-tour="overview" className="flex items-center justify-between mb-2">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Yeni Rapor Oluştur</h2>
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">Adım 1 / 4</span>
      </div>
      <div data-tour="overview" className="flex gap-1.5 mb-4">
        <span className="flex-1 h-1.5 rounded-full bg-blue-600" />
        <span className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-slate-700" />
        <span className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-slate-700" />
        <span className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-slate-700" />
      </div>

      <div data-tour="f-isletme" className="mb-3">
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
          Hizmet Verilen İşletme *
        </label>
        <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2.5 py-1.5 text-sm">
          Merkez Fabrika A.Ş. ▾
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div data-tour="f-tur">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Rapor Türü *</label>
          <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2.5 py-1.5 text-sm">
            Aylık Değerlendirme Raporu ▾
          </div>
        </div>
        <div data-tour="f-tarih">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
            Rapor (Ziyaret) Tarihi *
          </label>
          <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2.5 py-1.5 text-sm">
            11.07.2026 📅
          </div>
        </div>
      </div>

      <div data-tour="f-saat" className="mb-3">
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Aylık Ziyaret Saati</label>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-blue-600 text-white text-[10px] flex items-center justify-center">✓</span>
            Öğleden Önce
          </span>
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <span className="w-4 h-4 rounded border border-gray-300 dark:border-slate-600" />
            Öğleden Sonra
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <span data-tour="f-onceki" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200">
          ↻ Önceki Verileri Çek
        </span>
        <span data-tour="f-manuel" className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          <span className="w-4 h-4 rounded border border-gray-300 dark:border-slate-600" />
          Sistem Formu Yerine Manuel Dosya (PDF) Yüklemek İstiyorum
        </span>
      </div>

      <div data-tour="f-sections" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-3 mb-4">
        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">
          Adım 2-4: Rapor İçerik Bölümleri (Aylık şablon örneği)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
          {['A İşletme Bilgileri', 'B.1 Su ve Atıksu', 'B.2 Hava Yönetimi', 'B.3 Atık Yönetimi', 'C GFB / Çevre İzni', 'D Şikayetler', 'E Eğitimler', 'F Sonuç ve Öneriler'].map((s) => (
            <div key={s} className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5">
              {s}
            </div>
          ))}
        </div>
      </div>

      <div data-tour="f-ekler" className="mb-4">
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">G — Ekler</label>
        <div className="flex gap-2">
          <div className="w-16 h-16 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col items-center justify-center text-[10px] text-gray-500 dark:text-gray-400 relative">
            📄
            <span>saha-foto.jpg</span>
            <span className="absolute top-1 right-1.5 text-rose-500">✕</span>
          </div>
          <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 flex flex-col items-center justify-center text-[10px] text-gray-500 dark:text-gray-400">
            ＋<span>Dosya Ekle</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-slate-700">
        <span data-tour="f-geri" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200">
          ← Geri
        </span>
        <span data-tour="f-ileri" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white">
          İleri →
        </span>
      </div>
    </div>
  );
}

const tour: TourDefinition = {
  id: 'envReport',
  title: 'Yeni Rapor Oluştur',
  steps,
  StageComponent: EnvReportStage,
};

export default tour;
