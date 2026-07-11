import type { TourDefinition, TourStep } from '../types';

const steps: TourStep[] = [
  {
    id: 'overview',
    title: 'Bu Pencere Nereden Açılır?',
    body: 'Evraklar listesindeki her satırın sağındaki mor “Personele İlet / Sor” ikonuna tıklandığında açılır. Sadece kurumsal belgelerde ve yönetici/şef gibi yetkili rollerde görünür.',
  },
  {
    id: 'doc-info',
    title: '“Seçilen Belge” Bilgi Kutusu',
    body: 'Hangi belgeyi ilettiğinizi hatırlatır — yanlış belge hakkında mesaj göndermeyi önler.',
  },
  {
    id: 'f-kime',
    title: '“Kime Gönderilecek?” Seçici',
    body: 'İki seçenek: “Genel Sohbet (Tüm Ekip)” ile herkese duyurabilir, ya da açılır listeden tek bir personeli seçerek ona özel mesaj gönderebilirsiniz.',
  },
  {
    id: 'f-not',
    title: '“Notunuz (İsteğe Bağlı)”',
    body: 'Sorunuzu ya da talimatınızı buraya yazarsınız — örneğin “bu evrağın yenilenmesi gerekiyor, durum nedir?” gibi. Boş bırakılabilir.',
  },
  {
    id: 'f-gonder',
    title: '“Gönder” Butonu',
    body: 'Tıklandığında mesaj, seçtiğiniz kişiye özel bildirim olarak ya da genel sohbete düşer; gönderim sırasında buton “Gönderiliyor...” yazısına döner.',
  },
];

function ForwardDocStage() {
  return (
    <div className="flex items-center justify-center min-h-[360px]">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 border border-gray-100 dark:border-slate-700">
        <div data-tour="overview" className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2 text-sm">
            ⇄ Belgeyi İlet
          </h3>
          <span className="text-gray-400">✕</span>
        </div>

        <div data-tour="doc-info" className="bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/30 rounded-lg p-2.5 mb-3">
          <div className="text-[10px] font-bold uppercase text-purple-500 dark:text-purple-400 mb-0.5">
            Seçilen Belge
          </div>
          <div className="font-bold text-sm text-gray-800 dark:text-gray-100">ISG Risk Değerlendirme Raporu</div>
        </div>

        <div data-tour="f-kime" className="mb-3">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
            Kime Gönderilecek?
          </label>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2.5 py-1.5 text-sm">
            📢 Genel Sohbet (Tüm Ekip) ▾
          </div>
        </div>

        <div data-tour="f-not" className="mb-4">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
            Notunuz (İsteğe Bağlı)
          </label>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2.5 py-2 text-xs text-gray-400 min-h-[3.2rem]">
            Örn: Bu evrağın yenilenmesi gerekiyor, durum nedir?
          </div>
        </div>

        <div data-tour="f-gonder" className="w-full text-center py-2.5 rounded-lg bg-purple-600 text-white font-bold text-sm">
          ➤ Gönder
        </div>
      </div>
    </div>
  );
}

const tour: TourDefinition = {
  id: 'forwardDoc',
  title: 'Personele Sor / Belgeyi İlet',
  steps,
  StageComponent: ForwardDocStage,
};

export default tour;
