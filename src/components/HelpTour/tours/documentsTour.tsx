import type { TourDefinition, TourStep } from '../types';

const steps: TourStep[] = [
  {
    id: 'overview',
    title: 'Genel Bakış: İstatistik Kartları',
    body: 'Sayfanın en üstünde üç kart yer alır: Toplam Belge, süresi geçmiş belge sayısı ve önümüzdeki 30 gün içinde süresi dolacak belgelerin sayısı. Bu kartlar tıklanmaz, sadece anlık durumu özetler.',
  },
  {
    id: 'btn-rapor',
    title: '“Yeni Rapor Oluştur” Butonu',
    body: 'Bu butona tıklandığında yeni bir çevre/uyumluluk raporu oluşturma formu açılır. İSG, çevre danışmanlığı gibi periyodik raporları buradan başlatırsın.',
  },
  {
    id: 'btn-belge',
    title: '“Yeni Belge Ekle” Butonu',
    body: 'Sisteme yeni bir evrak yüklemek için kullanılır — dosya seçip belge türünü, lokasyonu ve son geçerlilik tarihini girdiğin ekrana yönlendirir.',
  },
  {
    id: 'btn-gorus',
    title: '“Görüş” Butonu',
    body: 'Danışman rolündeki kullanıcılar için görünür; bir görüş/mütalaa yazısı oluşturma formunu açar. Sadece yetkili roller (admin, danışman, kurumsal yönetici/şef/personel) bu butonu görür.',
  },
  {
    id: 'filters',
    title: 'Filtreleme Paneli',
    body: 'Ara kutusu belge adına, yükleyen kişiye (adminler için firma adına da) göre arama yapar. Tür, Lokasyon ve Personel açılır menüleri listeyi daraltır — Personel filtresi yalnızca yönetici rollerine görünür.',
  },
  {
    id: 'filter-scope',
    title: '“Kapsam” Seçici',
    body: 'Tümü / Şahsi Evraklarım / Kurumsal Evraklar arasında geçiş yaparak sadece kendi yüklediğin belgeleri ya da tüm şirketin belgelerini görebilirsin. Şirkete bağlı belge yoksa bu seçici hiç görünmez.',
  },
  {
    id: 'status-col',
    title: 'Durum Rozetleri Ne Anlama Gelir?',
    body: 'Yeşil “GÜNCEL” süresine çok var (ya da aylık rapor) demektir; turuncu “KRİTİK” son 30 gün içinde bittiğini; kırmızı “SÜRESİ GEÇTİ” son tarihin geçtiğini; yeşil “SÜRESİZ” ise belgenin zaten süresiz olduğunu gösterir.',
  },
  {
    id: 'tag-scope',
    title: '“KURUMSAL / ŞAHSİ” Etiketi',
    body: 'Mavi “KURUMSAL” etiketi belgenin şirket adına, mor “ŞAHSİ” etiketi ise kişisel hesabına ait olduğunu gösterir. Adminler ayrıca hangi firmaya ait olduğunu da görür.',
  },
  {
    id: 'tag-wet',
    title: '“Islak İmzalı” Etiketi',
    body: 'Bu etiket göründüğünde, o rapora ait ıslak imzalı (fiziksel imzalı, taranmış) dosya zaten yüklenmiş demektir — etikete tıklayınca doğrudan o dosyayı açar.',
  },
  {
    id: 'act-forward',
    title: '“Personele İlet / Sor” İkonu',
    body: 'Sadece kurumsal belgelerde ve yönetici rollerinde görünür. Tıklandığında bir pencere açılır: belgeyi genel şirket sohbetine ya da tek bir personele özel not ile iletebilirsin.',
  },
  {
    id: 'act-wetsig',
    title: '“Islak İmzalı Rapor Yükle” İkonu',
    body: 'Sadece bir rapora bağlı belgelerde görünür. Fiziksel olarak imzalanıp taranmış dosyayı buradan sisteme yüklersin; yüklendikten sonra satırda “Islak İmzalı” etiketi belirir.',
  },
  {
    id: 'act-archive',
    title: '“Arşiv” İkonu',
    body: 'O belgenin geçmiş versiyonlarını (yenilenen eski kayıtları) listeleyen bir pencere açar. Buradan eski dosyaları indirebilir veya düzenleyebilirsin.',
  },
  {
    id: 'act-preview',
    title: '“Önizle” İkonu',
    body: 'Belgeyi indirmeden, sayfadan ayrılmadan hızlıca önizlemeni sağlar. Rapora bağlı belgelerde doğrudan PDF görüntüleme/indirme bağlantısı da burada çıkar.',
  },
  {
    id: 'act-renew',
    title: '“Yenile” İkonu',
    body: 'Süresi dolan ya da yaklaşan bir belgeyi güncellemek için kullanılır: yeni tarihleri ve gerekirse yeni dosyayı girip “Güncelle” dersin — eski kayıt otomatik arşive taşınır.',
  },
  {
    id: 'act-edit',
    title: '“Düzenle” İkonu',
    body: 'Belgenin başlığı, türü, lokasyonu gibi bilgilerini güncellemek için düzenleme sayfasını açar.',
  },
  {
    id: 'act-delete',
    title: '“Sil” İkonu',
    body: 'Belgeyi kalıcı olarak siler — tıkladığında önce bir onay penceresi çıkar, yanlışlıkla silmeyi engeller.',
  },
];

function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'bad'; children: React.ReactNode }) {
  const cls =
    tone === 'ok'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
      : tone === 'warn'
        ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400';
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md ${cls}`}>
      {children}
    </span>
  );
}

function IconBtn({ tourId, title, children }: { tourId?: string; title: string; children: React.ReactNode }) {
  return (
    <span
      data-tour={tourId}
      title={title}
      className="w-7 h-7 rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs"
    >
      {children}
    </span>
  );
}

function DocumentsStage() {
  return (
    <div className="text-sm">
      <div data-tour="overview" className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
          <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Toplam Belge</div>
          <div className="text-xl font-mono font-bold text-blue-600 dark:text-blue-400">24</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
          <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Süresi Geçen</div>
          <div className="text-xl font-mono font-bold text-rose-600 dark:text-rose-400">3</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
          <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Yaklaşan (30 Gün)</div>
          <div className="text-xl font-mono font-bold text-orange-600 dark:text-orange-400">5</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Evrak Listesi</h2>
        <div className="flex flex-wrap gap-2">
          <span data-tour="btn-rapor" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white">
            ＋ Yeni Rapor Oluştur
          </span>
          <span data-tour="btn-belge" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white">
            ＋ Yeni Belge Ekle
          </span>
          <span data-tour="btn-gorus" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200">
            ✎ Görüş
          </span>
        </div>
      </div>

      <div data-tour="filters" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 mb-4">
        <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2">▾ Filtreleme Seçenekleri</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">
            🔍 Ara...
          </div>
          <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">
            Tüm Türler ▾
          </div>
          <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">
            Tüm Lokasyonlar ▾
          </div>
          <div className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">
            Tüm Personel ▾
          </div>
        </div>
        <div data-tour="filter-scope" className="flex gap-2 mt-2.5">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-600 text-white">Tümü</span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400">
            Şahsi Evraklarım
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400">
            Kurumsal Evraklar
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1.2fr_1.6fr] gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-900 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <div>Belge Türü</div>
          <div>Lokasyon</div>
          <div data-tour="status-col">Durum (Son Başvuru)</div>
          <div className="text-right">İşlemler</div>
        </div>

        <div className="grid grid-cols-[2fr_1fr_1.2fr_1.6fr] gap-2 px-3 py-3 border-t border-gray-100 dark:border-slate-700 items-center">
          <div>
            <div className="font-semibold text-gray-900 dark:text-gray-100 text-[13px]">ISG Risk Değerlendirme Raporu</div>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              <span data-tour="tag-scope" className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                KURUMSAL
              </span>
              <span data-tour="tag-wet" className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                ✓ Islak İmzalı
              </span>
            </div>
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">Merkez Fabrika</div>
          <div>
            <Badge tone="warn">⏱ KRİTİK (12 GÜN)</Badge>
          </div>
          <div className="flex gap-1 justify-end flex-wrap">
            <IconBtn tourId="act-forward" title="Personele İlet / Sor">⇄</IconBtn>
            <IconBtn tourId="act-wetsig" title="Islak İmzalı Rapor Yükle">✎</IconBtn>
            <IconBtn tourId="act-archive" title="Arşiv">🗄</IconBtn>
            <IconBtn tourId="act-preview" title="Önizle">👁</IconBtn>
            <IconBtn tourId="act-renew" title="Yenile">↻</IconBtn>
            <IconBtn tourId="act-edit" title="Düzenle">✎</IconBtn>
            <IconBtn tourId="act-delete" title="Sil">🗑</IconBtn>
          </div>
        </div>

        <div className="grid grid-cols-[2fr_1fr_1.2fr_1.6fr] gap-2 px-3 py-3 border-t border-gray-100 dark:border-slate-700 items-center">
          <div>
            <div className="font-semibold text-gray-900 dark:text-gray-100 text-[13px]">Çevre İzin Belgesi</div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400">
              ŞAHSİ
            </span>
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">Ankara Şube</div>
          <div>
            <Badge tone="ok">✓ GÜNCEL (145 GÜN)</Badge>
          </div>
          <div className="flex gap-1 justify-end flex-wrap">
            <IconBtn title="Arşiv">🗄</IconBtn>
            <IconBtn title="Önizle">👁</IconBtn>
            <IconBtn title="Yenile">↻</IconBtn>
            <IconBtn title="Düzenle">✎</IconBtn>
            <IconBtn title="Sil">🗑</IconBtn>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-3 py-3 border-t border-gray-100 dark:border-slate-700 bg-orange-50 dark:bg-orange-950/20 flex-wrap">
          <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">
            ⚠ Premium süresi doldu! Evrakları görüntülemek için yenileme yapın.
          </p>
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white">Paketi Yenile</span>
        </div>
      </div>
    </div>
  );
}

const tour: TourDefinition = {
  id: 'documents',
  title: 'Evraklar Sayfası',
  steps,
  StageComponent: DocumentsStage,
};

export default tour;
