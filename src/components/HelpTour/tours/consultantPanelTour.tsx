import type { TourDefinition, TourStageProps, TourStep } from '../types';

const steps: TourStep[] = [
  {
    id: 'overview',
    title: 'Genel Bakış: Aynı Ekran, Üç Rol',
    body: 'Yönetici, Şef ve Danışman/Personel aynı paneli kullanır; sadece sayfa başlığı ve görünen modüller role göre değişir. Bu rehber tüm modülleri Yönetici gözünden anlatıyor, rol farklarını ayrıca özetliyor.',
  },
  {
    id: 'nav',
    title: 'İki Katmanlı Navigasyon',
    body: 'Üstteki kapsül butonlar 7 ana “Modül”dür. Bir modüle tıklandığında altında o modülün alt sekmeleri açılır. Kırmızı rozetli “Aksiyon Takip” gibi bazı modüller bekleyen iş sayısını gösterir.',
  },
  {
    id: 'mod-operations',
    title: '“Operasyon & İşletmeler” Modülü',
    body: 'Müşteri işletmelerinizin listesi, saha QR denetim noktaları ve atık yönetimi kayıtları buradadır — günlük operasyonun ana giriş noktası.',
  },
  {
    id: 'mod-compliance',
    title: '“Yasal Uyum & Takip” Modülü',
    body: 'Mevzuat havuzunu işletmelere atadığınız, takip ettiğiniz ve personelin yöneticisinden yeni mevzuat talep ettiği yerdir.',
  },
  {
    id: 'mod-actions',
    title: '“Aksiyon Takip” Modülü',
    body: 'Bir işletmeye atanan görevlerin oluşturulup tamamlanmasını, onay/düzeltme akışını yönettiğiniz yer. Kırmızı rozet okunmamış yeni aksiyon sayısını gösterir.',
  },
  {
    id: 'mod-docs',
    title: '“Dokümantasyon” Modülü',
    body: 'Aylık/yıllık raporlar, işletme başına zorunlu belge durumu, müşteriden gelen evrak talepleri, görüş yazıları ve standart belge/şablon tanımları burada toplanır.',
  },
  {
    id: 'mod-finance',
    title: '“Finans & Maliyet” Modülü — Sadece Yönetici',
    body: 'Finansal özet, müşteri ödeme takvimi ve gider kayıtları. Bu modül Şef ve Danışman rollerine hiç gösterilmez — sadece firma sahibi görür.',
  },
  {
    id: 'mod-hr',
    title: '“İnsan Kaynakları” Modülü',
    body: 'Ekip üyelerini yönetme, premium koltuk atama ve çalışan değerlendirmeleri burada yapılır.',
  },
  {
    id: 'mod-settings',
    title: '“Sistem & Ayarlar” Modülü — Sadece Yönetici',
    body: 'Şirket adı, logo, iletişim bilgileri gibi kurumsal ayarlar. Bu da Şef ve Danışman rollerinden gizlidir.',
  },
  {
    id: 'role-table',
    title: 'Rol Farkları Özeti',
    body: 'Yönetici tüm yetkilere sahiptir. Şef’in birçok kritik yetkisi (işletme oluşturma/silme, ekip yönetimi) varsayılan olarak kapalıdır. Danışman/Personel ise sadece atandığı işletmeleri görür ve Finans/Ayarlar/Ekip Yönetimi modüllerine erişemez.',
  },
  {
    id: 'feat-matrix',
    title: 'Öne Çıkan Özellik: Zorunlu Belge Matrisi',
    body: 'Tüm işletmelerin zorunlu belge durumunu tek tabloda gösteren bir uyumluluk haritası: GEÇERLİ, EKSİK, SÜRESİ GEÇTİ, MUAF. Hücreye tıklayınca detay/muafiyet penceresi açılır.',
  },
  {
    id: 'feat-quota',
    title: 'Öne Çıkan Özellik: Kota Göstergeleri',
    body: 'İş Günü Kotası, danışmanın ayda kaç gün saha ziyareti yapabileceğini gösterir; Depolama Kotası ise firmanın ortak dosya alanı kullanımını gösterir.',
  },
  {
    id: 'feat-qr',
    title: 'Öne Çıkan Özellik: Saha QR Denetimleri',
    body: 'Fiziksel denetim noktaları için QR kod üretip yazdırırsınız; sahadaki personel QR’ı okutup formu doldurur, sonuçları “Yanıtları Gör” ile takip edersiniz.',
  },
  {
    id: 'feat-calendar',
    title: 'Öne Çıkan Özellik: Ziyaret Takvimi',
    body: 'Saha ziyaretlerini takvim üzerinde planlar, personelin talep ettiği yeni ziyaret veya değişiklik taleplerini onaylar/reddedersiniz.',
  },
];

function ModCard({
  tourId,
  title,
  tabs,
  locked,
}: {
  tourId: string;
  title: string;
  tabs: string[];
  locked?: boolean;
}) {
  return (
    <div
      data-tour={tourId}
      className={`rounded-xl border p-3 mb-2.5 ${
        locked
          ? 'border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20'
          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">{title}</h3>
        {locked && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-200 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Sadece Yönetici
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <span
            key={t}
            className="text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1 text-gray-700 dark:text-gray-300"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConsultantPanelStage({ roleLabel }: TourStageProps) {
  const title = roleLabel ?? 'Yönetici Paneli';
  return (
    <div className="text-sm">
      <div data-tour="overview" className="mb-3">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Rol'e göre "Şef Paneli" ya da "Danışman İşlemleri" olarak da görünür
        </p>
      </div>

      <div data-tour="nav" className="flex flex-wrap gap-1.5 mb-4">
        <span className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-blue-600 text-white">
          Operasyon &amp; İşletmeler
        </span>
        <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-gray-400">
          Yasal Uyum &amp; Takip
        </span>
        <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-gray-400 flex items-center gap-1">
          Aksiyon Takip
          <span className="bg-rose-600 text-white text-[10px] font-bold rounded-full px-1.5">3</span>
        </span>
        <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-gray-400">
          Dokümantasyon
        </span>
        <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-gray-400 flex items-center gap-1">
          Finans &amp; Maliyet 🔒
        </span>
        <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-gray-400">
          İnsan Kaynakları
        </span>
        <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-gray-400 flex items-center gap-1">
          Sistem &amp; Ayarlar 🔒
        </span>
      </div>

      <ModCard tourId="mod-operations" title="📋 Operasyon & İşletmeler" tabs={['Hizmet Verilen İşletmeler', 'Saha QR Denetimleri', 'Atık Yönetimi']} />
      <ModCard tourId="mod-compliance" title="⚖ Yasal Uyum & Takip" tabs={['Mevzuat Takip', 'Mevzuat Talepleri']} />
      <ModCard tourId="mod-actions" title="✅ Aksiyon Takip" tabs={['Bekleyen Aksiyonlar', 'Tamamlanan Aksiyonlar']} />
      <ModCard
        tourId="mod-docs"
        title="📄 Dokümantasyon"
        tabs={['Aylık & Yıllık Raporlar', 'Zorunlu Belge Matrisi', 'Evrak Talepleri', 'Görüşler', 'Belge & Şablon Tanımları']}
      />
      <ModCard tourId="mod-finance" title="💰 Finans & Maliyet" tabs={['Finansal Özet', 'Müşteri Ödemeleri', 'Gider Yönetimi']} locked />
      <ModCard tourId="mod-hr" title="👥 İnsan Kaynakları" tabs={['Ekip Yönetimi', 'Çalışan Değerlendirmeleri']} />
      <ModCard tourId="mod-settings" title="⚙ Sistem & Ayarlar" tabs={['Şirket Ayarları']} locked />

      <div data-tour="role-table" className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden my-3">
        <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-900 text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">
          <span>Yetki</span>
          <span>Yönetici</span>
          <span>Şef</span>
          <span>Danışman</span>
        </div>
        {[
          ['Tüm işletmeleri görüntüleme', '✓', '✓', 'Atanan'],
          ['İşletme oluşturma / silme', '✓', 'İzne bağlı', '✕'],
          ['Finans & Maliyet', '✓', '✕', '✕'],
          ['Şirket Ayarları', '✓', '✕', '✕'],
          ['Ekip Yönetimi', '✓', 'İzne bağlı', '✕'],
        ].map((row) => (
          <div
            key={row[0]}
            className="grid grid-cols-4 gap-2 px-3 py-2 text-xs border-t border-gray-100 dark:border-slate-700"
          >
            <span className="text-gray-700 dark:text-gray-300">{row[0]}</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{row[1]}</span>
            <span className={row[2] === '✕' ? 'font-bold text-rose-600 dark:text-rose-400' : 'font-semibold text-orange-600 dark:text-orange-400'}>
              {row[2]}
            </span>
            <span className={row[3] === '✓' ? 'font-bold text-emerald-600 dark:text-emerald-400' : row[3] === '✕' ? 'font-bold text-rose-600 dark:text-rose-400' : 'font-semibold text-orange-600 dark:text-orange-400'}>
              {row[3]}
            </span>
          </div>
        ))}
      </div>

      <div data-tour="feat-matrix" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 mb-2.5">
        <h3 className="font-bold text-sm mb-2">🧯 Zorunlu Belge Matrisi</h3>
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="grid grid-cols-4 gap-2 px-2.5 py-1.5 bg-gray-50 dark:bg-slate-900 text-[10px] font-bold text-gray-500 dark:text-gray-400">
            <span>İşletme</span>
            <span>İSG Raporu</span>
            <span>Çevre İzni</span>
            <span>Atık Beyanı</span>
          </div>
          <div className="grid grid-cols-4 gap-2 px-2.5 py-1.5 text-xs border-t border-gray-100 dark:border-slate-700 items-center">
            <span>Merkez Fabrika</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-center">
              GEÇERLİ
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 text-center">
              EKSİK
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-center">
              MUAF
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 px-2.5 py-1.5 text-xs border-t border-gray-100 dark:border-slate-700 items-center">
            <span>Ankara Şube</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 text-center">
              SÜRESİ GEÇTİ
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-center">
              GEÇERLİ
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-center">
              GEÇERLİ
            </span>
          </div>
        </div>
      </div>

      <div data-tour="feat-quota" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 mb-2.5">
        <h3 className="font-bold text-sm mb-2">📊 Kota Göstergeleri</h3>
        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>İş Günü Kotası</span>
              <span>11 / 16 gün</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: '69%' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Depolama Kotası (Firma Ortak Alanı)</span>
              <span>3.2 / 10 GB</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: '32%' }} />
            </div>
          </div>
        </div>
      </div>

      <div data-tour="feat-qr" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 mb-2.5">
        <h3 className="font-bold text-sm mb-2">📷 Saha QR Denetimleri</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-12 h-12 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 flex items-center justify-center text-xl">
            ▦
          </div>
          <div className="flex-1 min-w-[140px]">
            <div className="font-semibold text-xs">Merkez Fabrika — Depo Girişi</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">12 yanıt toplandı</div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-300">
            👁 Yanıtları Gör
          </span>
        </div>
      </div>

      <div data-tour="feat-calendar" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm">📅 Ziyaret Takvimi</h3>
          <span className="text-xs font-semibold px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-300">
            ＋ Yeni Ziyaret Planla
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['P', 'S', 'Ç', 'P', 'C', 'C', 'P'].map((d, i) => (
            <div
              key={i}
              className={`aspect-square rounded-md flex items-center justify-center text-xs border ${
                i === 2
                  ? 'bg-blue-600 text-white font-bold border-blue-600'
                  : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const tour: TourDefinition = {
  id: 'consultantPanel',
  title: 'Yönetici / Şef / Danışman Paneli',
  steps,
  StageComponent: ConsultantPanelStage,
};

export default tour;
