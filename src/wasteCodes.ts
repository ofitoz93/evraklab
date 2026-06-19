export interface WasteCode {
  code: string;
  name: string;
  desc?: string;
}

export const WASTE_CODES: WasteCode[] = [
  {
    "code": "01",
    "name": "MADENLERİN ARANMASI, ÇIKARILMASI, İŞLETİLMESİ, FİZİKİ VE KİMYASAL İŞLEME TABİ TUTULMASI SIRASINDA ORTAYA ÇIKAN ATIKLAR",
    "desc": ""
  },
  {
    "code": "01 01",
    "name": "Maden Kazılarından Kaynaklanan Atıklar",
    "desc": ""
  },
  {
    "code": "01 01 01",
    "name": "Metalik maden kazılarından kaynaklanan atıklar",
    "desc": ""
  },
  {
    "code": "01 01 02",
    "name": "Metalik olmayan maden kazılarından kaynaklanan atıklar",
    "desc": ""
  },
  {
    "code": "01 03",
    "name": "Metalik Minerallerin Fiziki ve Kimyasal Olarak İşlenmesinden Kaynaklanan Atıklar",
    "desc": ""
  },
  {
    "code": "01 03 04*",
    "name": "Sülfürlü cevherlerin işlenmesinden kaynaklanan asit üretici maden atıkları",
    "desc": "A"
  },
  {
    "code": "01 03 05*",
    "name": "Tehlikeli madde içeren diğer maden atıkları",
    "desc": "M"
  },
  {
    "code": "01 03 06",
    "name": "01 03 04 ve 01 03 05 dışındaki diğer maden atıkları",
    "desc": ""
  },
  {
    "code": "01 03 07*",
    "name": "Metalik minerallerin fiziki ve kimyasal işlenmesinden kaynaklanan tehlikeli maddeler içeren diğer atıklar",
    "desc": "M"
  },
  {
    "code": "01 03 08",
    "name": "01 03 07 dışındaki diğer tozumsu ve pudramsı atıklar",
    "desc": ""
  },
  {
    "code": "01 03 09",
    "name": "01 03 10 dışındaki alüminyum oksit üretiminden çıkan kırmızı çamur",
    "desc": ""
  },
  {
    "code": "01 03 10*",
    "name": "01 03 07 dışındaki alüminyum oksit üretiminden çıkan tehlikeli maddeler içeren kırmızı çamur",
    "desc": "M"
  },
  {
    "code": "01 03 99",
    "name": "Başka bir şekilde tanımlanmamış atıklar",
    "desc": ""
  },
  {
    "code": "01 04",
    "name": "Metalik Olmayan Minerallerin Fiziki ve Kimyasal İşlemlerinden Kaynaklanan Atıklar",
    "desc": ""
  },
  {
    "code": "01 04 07*",
    "name": "Metalik olmayan minerallerin fiziki ve kimyasal işlenmesinden k",
    "desc": ""
  },
  {
    "code": "13 02 08*",
    "name": "Diğer motor, şanzıman ve yağlama yağları",
    "desc": "A"
  },
  {
    "code": "15 01 01",
    "name": "Kağıt ve karton ambalaj",
    "desc": ""
  },
  {
    "code": "15 01 02",
    "name": "Plastik ambalaj",
    "desc": ""
  },
  {
    "code": "15 01 03",
    "name": "Ahşap ambalaj",
    "desc": ""
  },
  {
    "code": "15 01 04",
    "name": "Metalik ambalaj",
    "desc": ""
  },
  {
    "code": "15 01 06",
    "name": "Karışık ambalaj",
    "desc": ""
  },
  {
    "code": "15 01 07",
    "name": "Cam ambalaj",
    "desc": ""
  },
  {
    "code": "15 01 10*",
    "name": "Tehlikeli maddelerin kalıntılarını içeren ya da tehlikeli maddelerle kontamine olmuş ambalajlar",
    "desc": "A"
  },
  {
    "code": "15 02 02*",
    "name": "Tehlikeli maddelerle kirlenmiş emiciler, filtre malzemeleri, temizleme bezleri, koruyucu giysiler",
    "desc": "M"
  },
  {
    "code": "16",
    "name": "LİSTEDE BAŞKA BİR ŞEKİLDE BELİRTİLMEMİŞ ATIKLAR",
    "desc": ""
  },
  {
    "code": "16 01",
    "name": "Çeşitli Taşıma Türlerindeki (İş Makineleri Dahil) Ömrünü Tamamlamış Araçlar ve Ömrünü Tamamlamış Araçların Sökülmesi ile Araç Bakımından (13, 14, 16 06 ve 16 08 hariç) Kaynaklanan Atıklar",
    "desc": ""
  },
  {
    "code": "16 01 03",
    "name": "Ömrünü tamamlamış lastikler",
    "desc": ""
  },
  {
    "code": "16 01 04*",
    "name": "Ömrünü tamamlamış araçlar",
    "desc": "A"
  },
  {
    "code": "16 01 06",
    "name": "Sıvı ya da tehlikeli maddeler içermeyen ömrünü tamamlamış araçlar",
    "desc": ""
  },
  {
    "code": "16 01 07*",
    "name": "Yağ filtreleri",
    "desc": "A"
  },
  {
    "code": "16 01 08*",
    "name": "Cıva içeren parçalar",
    "desc": "M"
  },
  {
    "code": "16 01 09*",
    "name": "PCB içeren parçalar",
    "desc": "M"
  },
  {
    "code": "16 01 10*",
    "name": "Patlayıcı parçalar (örneğin hava yastıkları)",
    "desc": "A"
  },
  {
    "code": "16 01 11*",
    "name": "Asbest içeren fren balataları",
    "desc": "M"
  },
  {
    "code": "16 01 12",
    "name": "16 01 11 dışındaki fren balataları",
    "desc": ""
  },
  {
    "code": "16 01 13*",
    "name": "Fren sıvıları",
    "desc": "A"
  },
  {
    "code": "16 01 14*",
    "name": "Tehlikeli maddeler içeren antifriz sıvıları",
    "desc": "M"
  },
  {
    "code": "16 01 15",
    "name": "16 01 14 dışındaki antifriz sıvıları",
    "desc": ""
  },
  {
    "code": "16 01 16",
    "name": "Sıvılaştırılmış gaz tankları",
    "desc": ""
  },
  {
    "code": "16 01 17",
    "name": "Demir metaller",
    "desc": ""
  },
  {
    "code": "16 01 18",
    "name": "Demir olmayan metaller",
    "desc": ""
  },
  {
    "code": "16 01 19",
    "name": "Plastik",
    "desc": ""
  },
  {
    "code": "16 01 20",
    "name": "Cam",
    "desc": ""
  },
  {
    "code": "16 01 21*",
    "name": "16 01 07’den 16 01 11’e ve 16 01 13 ile 16 01 14 dışındaki tehlikeli parçalar",
    "desc": "M"
  },
  {
    "code": "16 01 22",
    "name": "Başka bir şekilde tanımlanmamış parçalar",
    "desc": ""
  },
  {
    "code": "16 01 99",
    "name": "Başka bir şekilde tanımlanmamış atıklar",
    "desc": ""
  },
  {
    "code": "16 02",
    "name": "Elektrikli ve Elektronik Ekipman Atıkları",
    "desc": ""
  },
  {
    "code": "16 02 09*",
    "name": "PCB’ler içeren transformatörler ve kapasitörler",
    "desc": "A"
  },
  {
    "code": "16 02 10*",
    "name": "16 02 09 dışındaki PCB içeren ya da PCB ile kontamine olmuş ıskarta ekipmanlar",
    "desc": "A"
  },
  {
    "code": "16 02 11*",
    "name": "Kloroflorokarbon, HCFC, HFC içeren ıskarta ekipmanlar",
    "desc": "A"
  },
  {
    "code": "16 02 12*",
    "name": "Serbest asbest içeren ıskarta ekipman",
    "desc": "A"
  },
  {
    "code": "16 02 13*",
    "name": "16 02 09’dan 16 02 12’ye kadar olanların dışındaki tehlikeli parçalar (3) içeren ıskarta ekipmanlar",
    "desc": "A"
  },
  {
    "code": "16 02 14",
    "name": "16 02 09’dan 16 02 13’e kadar olanların dışındaki ıskarta ekipmanlar",
    "desc": ""
  },
  {
    "code": "16 02 15*",
    "name": "Iskarta ekipmanlardan çıkart",
    "desc": ""
  },
  {
    "code": "17 01 01",
    "name": "Beton",
    "desc": ""
  },
  {
    "code": "17 04 05",
    "name": "Demir ve çelik",
    "desc": ""
  },
  {
    "code": "17 05 04",
    "name": "17 05 03 dışındaki toprak ve taşlar",
    "desc": ""
  },
  {
    "code": "18 01 03*",
    "name": "Enfeksiyonu önlemek amacı ile toplanması ve bertarafı özel işleme tabi olan atıklar (Tıbbi Atıklar)",
    "desc": "A"
  },
  {
    "code": "20 01 01",
    "name": "Kağıt ve karton",
    "desc": ""
  },
  {
    "code": "20 01 40",
    "name": "Metaller",
    "desc": ""
  },
  {
    "code": "20 03 01",
    "name": "Karışık belediye atıkları (Evsel Atık)",
    "desc": ""
  }
];

export interface MethodCode {
  code: string;
  name: string;
}

export const RECOVERY_CODES: MethodCode[] = [
  { code: 'R1', name: 'R1: Enerji üretimi amacıyla esas olarak yakıt olarak veya başka şekillerde kullanılması' },
  { code: 'R2', name: 'R2: Solventlerin (çözücülerin) geri kazanımı/ıslahı' },
  { code: 'R3', name: 'R3: Solvent olarak kullanılmayan organik maddelerin geri kazanımı/ıslahı (kompost ve diğer biyolojik dönüşüm prosesleri dahil)' },
  { code: 'R4', name: 'R4: Metallerin ve metal bileşiklerinin geri kazanımı/ıslahı' },
  { code: 'R5', name: 'R5: Diğer anorganik maddelerin geri kazanımı/ıslahı' },
  { code: 'R6', name: 'R6: Asitlerin veya bazların rejenerasyonu (yeniden üretilmesi)' },
  { code: 'R7', name: 'R7: Kirliliğin azaltılmasında kullanılan bileşenlerin geri kazanılması' },
  { code: 'R8', name: 'R8: Katalizör bileşenlerinin geri kazanılması' },
  { code: 'R9', name: 'R9: Yağların yeniden rafine edilmesi veya diğer yeniden kullanımları' },
  { code: 'R10', name: 'R10: Ekolojik iyileştirme veya tarım yararına sonuç verecek şekilde arazi ıslahı' },
  { code: 'R11', name: 'R11: R1 ila R10 maddelerinin işlemlerinden elde edilecek atıkların kullanılması' },
  { code: 'R12', name: 'R12: Atıkların R1 ila R11 arasındaki işlemlerden herhangi birine tabi tutulmak üzere değişimi' },
  { code: 'R13', name: 'R13: R1 ila R12 işlemlerinden herhangi birine tabi tutuluncaya kadar atıkların depolanması (atığın üretildiği alandaki geçici depolama hariç)' }
];

export const DISPOSAL_CODES: MethodCode[] = [
  { code: 'D1', name: 'D1: Toprak altında veya üstünde depolama (örneğin düzenli depolama vb.)' },
  { code: 'D2', name: 'D2: Arazi ıslahı (örneğin sıvı veya çamur atıkların toprakta biyolojik bozunmaya tabi tutulması vb.)' },
  { code: 'D3', name: 'D3: Derine enjeksiyon (örneğin pompalanabilir atıkların kuyulara, tuz domlarına veya doğal şaftlara enjeksiyonu vb.)' },
  { code: 'D4', name: 'D4: Yüzey göletleme (örneğin sıvı veya çamur atıkların havuzlarda, lagünlerde depolanması vb.)' },
  { code: 'D5', name: 'D5: Özel mühendislik gerektiren düzenli depolama (çevreden ve birbirlerinden izole edilmiş, üzeri örtülmüş sızdırmaz bölmelere yerleştirme vb.)' },
  { code: 'D6', name: 'D6: Sualtı ortamları hariç olmak üzere su kütlelerine boşaltım' },
  { code: 'D7', name: 'D7: Deniz/okyanus tabanı dahil sualtı ortamlarına boşaltım' },
  { code: 'D8', name: 'D8: D1 ila D7 ve D9 ila D12 işlemlerinden herhangi biriyle atılan nihai bileşik veya karışımların oluşmasına neden olan biyolojik işlemler' },
  { code: 'D9', name: 'D9: D1 ila D8 ve D10 ila D12 işlemlerinden herhangi biriyle atılan nihai bileşik veya karışımların oluşmasına neden olan fiziksel-kimyasal işlemler (örneğin buharlaştırma, kurutma, kalsinasyon vb.)' },
  { code: 'D10', name: 'D10: Karada yakma' },
  { code: 'D11', name: 'D11: Denizde yakma' },
  { code: 'D12', name: 'D12: Nihai depolama (örneğin bir madende konteynerlerin yerleştirilmesi vb.)' },
  { code: 'D13', name: 'D13: D1 ila D12 işlemlerinden herhangi birine tabi tutulmadan önce harmanlama veya karıştırma' },
  { code: 'D14', name: 'D14: D1 ila D13 işlemlerinden herhangi birine tabi tutulmadan önce yeniden paketleme' },
  { code: 'D15', name: 'D15: D1 ila D14 işlemlerinden herhangi birine tabi tutuluncaya kadar depolama (atığın üretildiği alandaki geçici depolama hariç)' }
];
