import type { TourDefinition, TourStep } from '../types';

const steps: TourStep[] = [
  {
    id: 'overview',
    title: 'Genel Bakış ve Kota Rozeti',
    body: 'Sayfa başlığı “Yeni Belge Yükle”dir. Sağ üstteki rozet, premium olmayan hesaplarda kaç belge hakkınız kaldığını (X / 3) gösterir.',
  },
  {
    id: 'f-premium',
    title: 'Premium Süresi Dolduğunda',
    body: 'Kurumsal abonelik süresi dolmuşsa bu uyarı belirir ve “Paketi Yenile” bağlantısına yönlendirir; yenilenmeden kurumsal belge eklenemez.',
  },
  {
    id: 'f-kapsam',
    title: '“Belge Kapsamı”: Kurumsal / Şahsi',
    body: 'Belgenin şirket adına mı yoksa kişisel hesabınıza mı kaydedileceğini seçersiniz. Şahsi yükleme izni olmayan personelde bu seçenek soluk görünür.',
  },
  {
    id: 'f-tur',
    title: '“Belge Türü” Seçimi',
    body: 'Zorunlu alandır — hangi tür evrak olduğunu seçersiniz. Yanındaki “Yönet” butonuyla yeni belge türü tanımlayabilir ya da mevcutları silebilirsiniz.',
  },
  {
    id: 'f-lokasyon',
    title: '“Lokasyon” Seçimi',
    body: 'Belgenin hangi işletme/şube ile ilişkili olduğunu belirler; listede olmayan bir yer için “+ Yeni Lokasyon Ekle…” seçeneğiyle anında yeni bir lokasyon tanımlayabilirsiniz.',
  },
  {
    id: 'f-alinma',
    title: '“Alınma Tarihi” (Zorunlu)',
    body: 'Belgenin alındığı/düzenlendiği tarih — Belge Türü ile birlikte zorunlu iki alandan biridir, boş bırakılırsa kayıt engellenir.',
  },
  {
    id: 'f-suresiz',
    title: '“Bu Belge Süresizdir” Kutusu',
    body: 'İşaretlenirse belgenin süresi hiç dolmaz kabul edilir ve aşağıdaki Bitiş/Son Başvuru tarihleri devre dışı kalır.',
  },
  {
    id: 'f-tarihler',
    title: '“Bitiş Tarihi” ve “Son Başvuru”',
    body: 'Süresiz değilse doldurulur. Evraklar listesindeki GÜNCEL/KRİTİK/SÜRESİ GEÇTİ rozetleri bu iki tarihe göre hesaplanır.',
  },
  {
    id: 'f-bildirim',
    title: '“Bildirim Ayarı” (Premium)',
    body: 'Süre dolmadan kaç gün önce hatırlatma e-postası gönderileceğini belirler; yalnızca premium hesaplarda aktiftir.',
  },
  {
    id: 'f-aciklama',
    title: '“Açıklama / Notlar”',
    body: 'Belgeyle ilgili serbest metin not alanı — zorunlu değildir, ekip içi hatırlatma için kullanılır.',
  },
  {
    id: 'f-dosya',
    title: 'Dosya Yükleme Alanı',
    body: 'PDF, Word ya da görsel dosyayı sürükleyip bırakabilir ya da tıklayıp seçebilirsiniz. Dosya boyutu limiti premium hesaplarda 50 MB, ücretsiz hesaplarda 1 MB’dir.',
  },
  {
    id: 'f-kaydet',
    title: '“Belgeyi Kaydet” Butonu',
    body: 'Aynı lokasyon + belge türü için zaten aktif bir kayıt varsa sistem sizi uyarır ve isterseniz doğrudan “Yenile” akışına yönlendirir.',
  },
];

function AddDocumentStage() {
  return (
    <div className="text-sm">
      <div data-tour="overview" className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Yeni Belge Yükle</h2>
        <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
          Kota: 2 / 3
        </span>
      </div>

      <div data-tour="f-premium" className="flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 text-xs font-semibold flex-wrap">
        <span>⚠ Premium süresi doldu! Kurumsal belge eklemek için yenileme yapın.</span>
        <span className="px-2 py-1 rounded-md bg-blue-600 text-white text-xs font-bold">Paketi Yenile</span>
      </div>

      <div data-tour="f-kapsam" className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg border-2 border-blue-600 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-blue-600" /> KURUMSAL
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 flex items-center gap-2 opacity-60">
          <span className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-slate-600" /> ŞAHSİ
        </div>
      </div>

      <div data-tour="f-tur" className="flex gap-2 items-end mb-3">
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Belge Türü *</label>
          <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2.5 py-1.5">
            İSG Risk Değerlendirmesi ▾
          </div>
        </div>
        <span className="px-2.5 py-1.5 rounded-md text-xs font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400">
          Yönet
        </span>
      </div>

      <div data-tour="f-lokasyon" className="flex gap-2 items-end mb-3">
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Lokasyon</label>
          <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2.5 py-1.5">
            Merkez Fabrika <span className="opacity-60">(+ Yeni Lokasyon Ekle…)</span> ▾
          </div>
        </div>
        <span className="px-2.5 py-1.5 rounded-md text-xs font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400">
          Yönet
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div data-tour="f-alinma">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Alınma Tarihi *</label>
          <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2.5 py-1.5">
            11.07.2026
          </div>
        </div>
        <div data-tour="f-suresiz">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">&nbsp;</label>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-4 h-4 rounded bg-blue-600 text-white text-[10px] flex items-center justify-center">✓</span>
            Bu belge süresizdir
          </div>
        </div>
      </div>

      <div data-tour="f-tarihler" className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Bitiş Tarihi</label>
          <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2.5 py-1.5 text-gray-400">
            —
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Son Başvuru</label>
          <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2.5 py-1.5 text-gray-400">
            —
          </div>
        </div>
      </div>

      <div data-tour="f-bildirim" className="mb-3">
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Bildirim Ayarı (Premium)</label>
        <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2.5 py-1.5">
          30 gün kala başla
        </div>
      </div>

      <div data-tour="f-aciklama" className="mb-3">
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Açıklama / Notlar</label>
        <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2.5 py-1.5 text-gray-400">
          Örn: 2026 yılı risk değerlendirme raporu…
        </div>
      </div>

      <div data-tour="f-dosya" className="rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 p-5 text-center text-gray-500 dark:text-gray-400 mb-4">
        <div className="font-bold text-gray-700 dark:text-gray-200 text-sm">Belgeyi Buraya Sürükleyin veya Tıklayın</div>
        <div className="text-xs mt-1">PDF, Word, Resim (Max 50 MB)</div>
      </div>

      <div className="flex justify-end">
        <span data-tour="f-kaydet" className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white">
          Belgeyi Kaydet
        </span>
      </div>
    </div>
  );
}

const tour: TourDefinition = {
  id: 'addDocument',
  title: 'Yeni Belge Yükle',
  steps,
  StageComponent: AddDocumentStage,
};

export default tour;
