-- "ÇED Durumu" (Çevresel Etki Değerlendirmesi Yönetmeliği EK-1 / EK-2 proje listesi),
-- işletmenin mevcut "Çevre İzin/Lisans Kapsamı" (permit_stage/permit_articles,
-- Çevre İzin ve Lisans Yönetmeliği'ne dayanan, permitArticles.ts içinde duran ayrı
-- bir liste) alanından TAMAMEN BAĞIMSIZ, yeni bir sınıflandırmadır. İkisi karışmasın
-- diye ayrı bir tablo ve ayrı client kolonları kullanıyoruz.
--
-- Liste içeriği admin panelinden (sistem admini) yönetilebilir olsun diye
-- statik bir .ts dosyası yerine veritabanı tablosunda tutuluyor; yeni bir mevzuat
-- değişikliği geldiğinde (bu liste zaten sık güncelleniyor, bkz. "RG-5/3/2026-33187"
-- notları) kod değişikliği/deploy gerekmeden admin panelinden madde eklenebilir.

CREATE TABLE IF NOT EXISTS public.ced_project_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage TEXT NOT NULL CHECK (stage IN ('ek1', 'ek2')),
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (stage, code)
);

ALTER TABLE public.ced_project_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view ced categories" ON public.ced_project_categories;
CREATE POLICY "Authenticated users can view ced categories"
ON public.ced_project_categories FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage ced categories" ON public.ced_project_categories;
CREATE POLICY "Admins manage ced categories"
ON public.ced_project_categories FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- İşletmenin (ve şubelerinin) ÇED durumu
ALTER TABLE public.consultant_clients
  ADD COLUMN IF NOT EXISTS ced_status TEXT DEFAULT 'out_of_scope',
  ADD COLUMN IF NOT EXISTS ced_articles JSONB DEFAULT '[]'::jsonb;

-- ==========================================
-- EK-1: ÇEVRESEL ETKİ DEĞERLENDİRMESİ UYGULANACAK PROJELER LİSTESİ
-- ==========================================
INSERT INTO public.ced_project_categories (stage, code, title, sort_order) VALUES
('ek1', '1', $$Rafineriler; a) Ham petrol rafinerileri, b) 500 ton/gün ve üzeri taşkömürü ve bitümlü maddelerin gazlaştırılması ve sıvılaştırılması projeleri, c) Doğalgaz sıvılaştırma ve gazlaştırma tesisleri$$, 1),
('ek1', '2', $$Termik güç santralleri; a) Toplam ısıl gücü 300 MWt ve daha fazla olan termik güç santralleri ile diğer yakma sistemleri, b) Nükleer güç santralleri veya diğer nükleer tesislerin kurulması veya sökümü (maksimum gücü sürekli termik yük bakımından 1 kilovatı aşmayan araştırma projeleri hariç)$$, 2),
('ek1', '3', $$Nükleer yakıt tesisleri; a) Nükleer yakıtların yeniden işlenmesi, b) Nükleer yakıtların üretimi veya zenginleştirilmesi, c) Radyasyondan arınmış nükleer yakıtların veya sınır değerin üzerinde radyasyon içeren atıkların işlenmesi, ç) Kullanılmış yakıtların nihai bertarafı işlemi, d) Radyoaktif atıkların nihai bertarafı işlemi, e) 10 yıldan fazla depolanması planlanmış kullanılmış yakıtlar ya da üretildiği yerden farklı bir yerde depolanması planlanan radyoaktif atıklar$$, 3),
('ek1', '4', $$Metal endüstri tesisleri; a) Entegre demir ve/veya çelik tesisleri, b) Hurdadan, demirden ve/veya çelikten çelik üreten tesisler (250.000 ton/yıl ve üzeri), c) Demir ve/veya çeliğin ergitildiği ve dökümünün yapıldığı tesisler (Hurda dâhil, 250.000 ton/yıl ve üzeri), ç) Cevherden, konsantreden ya da elektrolitik, kimyasal, metalürjik yöntemlerle üretilen ikincil hammaddelerden demir dışı ham metal üreten tesisler, d) Demir dışı metallerin ergitildiği ve dökümünün yapıldığı tesisler (hurda dâhil, 250.000 ton/yıl ve üzeri), e) Sıcak haddeleme tesisleri (demir/çelik ve demir dışı metaller, 250.000 ton/yıl ve üzeri)$$, 4),
('ek1', '5', $$Asbest içeren ürünleri işleme veya dönüştürme tesisleri$$, 5),
('ek1', '6', $$Fonksiyonel olarak birbirine bağlı çeşitli birimleri kullanarak endüstriyel ölçekte üretim yapan organik ve/veya inorganik kimyasalların üretiminin yapıldığı entegre tesisler$$, 6),
('ek1', '7', $$Basit veya bileşik fosfor, azot ve potasyum bazlı gübrelerin üretiminin yapıldığı entegre tesisler$$, 7),
('ek1', '8', $$Patlayıcı maddelerin üretildiği tesisler$$, 8),
('ek1', '9', $$Yollar ve havaalanları; a) Demiryolu hatları, b) Havaalanları/havalimanları (hava kampüsleri hariç), c) Erişme kontrolü uygulanan karayolları ile bu yollara uzunluğu 20 km ve üzeri şerit eklenmesi ve/veya güzergâhının değiştirilmesi, ç) Mevcut demiryolu güzergâhı korunarak uzunluğu 70 km ve üzeri hat sayısının çoğaltılması$$, 9),
('ek1', '10', $$Su yolları, limanlar ve tersaneler; a) Kıta içi su yollarının yapımı, b) Ticari amaçlı liman, iskele, rıhtım, dolfenler, c) Tersaneler, ç) 24 metre ve üzeri yat/tekne tadilat, imalat, bakım, onarım ve/veya çekek hizmeti veren tesisler, d) 200.000 m3 ve üzeri dip tarama projeleri, e) Yat limanları$$, 10),
('ek1', '11', $$Tehlikeli ve özel işleme tabi atıkların geri kazanımı, bertarafı ve/veya düzenli depolama tesisleri; a) Geri kazanım tesisleri, b) Yakma/kimyasal/biyolojik bertaraf tesisleri, c) Düzenli depolama ile nihai bertaraf tesisleri, ç) Tıbbi atık yakma tesisleri, d) Atık yağ rafinasyon tesisleri$$, 11),
('ek1', '12', $$Tehlikesiz atık geri kazanım, bertaraf ve/veya düzenli depolama tesisleri (Hafriyat toprağı hariç); a) Düzenli depolama ile nihai bertaraf, b) Günlük 100 ton ve üzeri yakma tesisleri, c) Günlük 100 ton ve üzeri geri kazanım/biyobozunur atık işleme tesisleri, ç) Günlük 100 ton ve üzeri hayvansal dışkı yakma/geri kazanım/bertaraf tesisleri$$, 12),
('ek1', '13', $$Göl hacmi 10 milyon m³ ve üzeri olan baraj veya göletler$$, 13),
('ek1', '14', $$Hidroelektrik enerji santralleri$$, 14),
('ek1', '15', $$Atık su arıtma ve derin deniz deşarjı projeleri; a) Kapasitesi 50.000 m³/gün ve üzeri olan atık su arıtma tesisleri, b) Kapasitesi 50.000 m3/gün ve üzeri olan derin deniz deşarjı projeleri$$, 15),
('ek1', '16', $$Hayvan kesim tesisleri; a) Günlük 100 adet ve üzeri büyükbaş ve/veya eşdeğeri küçükbaş hayvan kesimi, b) Günlük 60.000 adet ve üzeri tavuk ve eşdeğeri kanatlı hayvan kesimi$$, 16),
('ek1', '17', $$Hayvan yetiştirme tesisleri; a) 5.000 baş ve üzeri büyükbaş yetiştirme tesisleri, b) 25.000 baş ve üzeri küçükbaş yetiştirme tesisleri, c) 5.000 adet ve üzeri büyükbaş/küçükbaş birlikte yetiştirme, ç) 900 baş ve üzeri domuz besi tesisleri, d) 60.000 adet ve üzeri tavuk/kanatlı yetiştirme tesisleri$$, 17),
('ek1', '18', $$Kültür balıkçılığı projeleri (1.000 ton/yıl ve üzeri üretim)$$, 18),
('ek1', '19', $$Bitkisel ürünlerden 200 ton/gün ve üzeri ham yağ üretimi veya rafinasyon işleminin yapıldığı tesisler$$, 19),
('ek1', '20', $$100.000 litre/gün ve üzeri süt işleme tesisleri$$, 20),
('ek1', '21', $$Üretim kapasitesi 25.000 ton/yıl ve üzeri maya fabrikaları (sadece paketleme yapan tesisler hariç)$$, 21),
('ek1', '22', $$Şeker fabrikaları$$, 22),
('ek1', '23', $$Orman ürünleri ve selüloz tesisleri; a) Selüloz üretim tesisleri, b) Kereste veya benzeri lifli maddelerden kâğıt hamuru üretim tesisleri, c) 60.000 ton/yıl ve üzeri her çeşit kâğıt üretimi yapan tesisler (Atık kâğıt dâhil)$$, 23),
('ek1', '24', $$Yıllık kapasitesi 3.000 ton ve üzeri olan kasar veya boyama birimlerini içeren iplik, kumaş, elyaf (doğal, sentetik) veya halı fabrikaları$$, 24),
('ek1', '25', $$Madencilik projeleri; a) 25 hektar ve üzeri arazi yüzeyinde planlanan açık işletmeler, b) Fiziksel yöntemler hariç cevher zenginleştirme tesisleri ve atık tesisleri, c) 400.000 ton/yıl ve üzeri kırma, eleme, yıkama, kurutma, cevher hazırlama tesisleri$$, 25),
('ek1', '26', $$500 ton/gün ve üzeri ham petrol, 500.000 m³/gün ve üzeri doğal gaz veya kaya gazının çıkarılması$$, 26),
('ek1', '27', $$Petrol, doğalgaz ve kimyasalların 40 km'den uzun ve 600 mm ve üzeri çaplı borularla taşınması$$, 27),
('ek1', '28', $$Çimento fabrikaları$$, 28),
('ek1', '29', $$Toplam kapasitesi 50.000 m³ ve üzeri olan petrol, doğalgaz, petrokimya ve kimyasal maddelerin depolandığı tesisler (perakende satışa hazır ambalajlı ürün depolama hariç)$$, 29),
('ek1', '30', $$2.000 ton/yıl ve üzeri ham deri işleme tesisleri (Konfeksiyon ürünleri hariç)$$, 30),
('ek1', '31', $$İhtisas Organize Sanayi Bölgeleri (Ek-1 veya Ek-2 listelerinde yer alan ve aynı türde üretim/faaliyet yapan tesislerin bir arada bulunduğu projeler)$$, 31),
('ek1', '32', $$Pil ve/veya akümülatör üretim tesisleri (Montaj yapılan tesisler hariç)$$, 32),
('ek1', '33', $$Tarım ilaçlarının ve/veya farmasötik ürünlerin etken maddelerinin üretildiği tesisler (Ar-Ge üretim tesisleri hariç)$$, 33),
('ek1', '34', $$10.000 adet/yıl ve üzerinde motorlu taşıtların üretimi (Kara taşıtları, tarım makinaları, iş makinaları, savunma sanayi taşıtları)$$, 34),
('ek1', '35', $$1.000 adet/yıl ve üzeri demiryolu taşıtlarının üretiminin yapıldığı tesisler$$, 35),
('ek1', '36', $$Motorlu hava taşıtlarının üretimi$$, 36),
('ek1', '37', $$100.000 ton/yıl ve üzeri cam, cam elyafı, taş yünü, cam mozaik ve benzeri üretim tesisleri$$, 37),
('ek1', '38', $$Lastik üretim tesisleri (İç ve dış motorlu taşıt ve uçak lastikleri)$$, 38),
('ek1', '39', $$300.000 ton/yıl ve üzeri seramik ve/veya porselen üretimi yapan tesisler$$, 39),
('ek1', '40', $$250 oda ve üzeri oteller, tatil köyleri, turizm kompleksleri vb.$$, 40),
('ek1', '41', $$a) 15 adet türbin ve üzeri rüzgâr enerji santralleri, b) Denizüstü rüzgâr enerji santralleri$$, 41),
('ek1', '42', $$Jeotermal enerji santralleri$$, 42),
('ek1', '43', $$Güneş enerji santralleri; a) Proje alanı 25 hektar ve üzerinde olan arazi güneş enerji santralleri (çatı/cephe sistemleri hariç), b) Proje alanı 2 hektar ve üzerinde olan yüzer güneş enerji santralleri$$, 43),
('ek1', '44', $$154 kV ve üzeri gerilimde ve 50 km ve üzeri sürekli uzunluktaki elektrik enerjisi iletim hatları$$, 44),
('ek1', '45', $$Yıllık olarak 1.5 milyon ton ve üzerinde karbon yakalama ve jeolojik depolanma projeleri$$, 45),
('ek1', '46', $$Gemi söküm ve/veya gemi geri dönüşümü tesisleri$$, 46),
('ek1', '47', $$50.000 m3/yıl ve üzeri alkollü içecek üretimi$$, 47),
('ek1', '48', $$25.000 ton/yıl ve üzeri salça, ketçap, mayonez ve benzeri sos üretimi yapılan tesisler$$, 48),
('ek1', '49', $$10.000 ton/yıl ve üzeri su ürünleri işleme tesisleri$$, 49),
('ek1', '50', $$Rendering tesisleri$$, 50),
('ek1', '51', $$İşleme kapasitesi 25.000 litre/gün ve üzeri peynir altı suyu işleme tesisleri$$, 51),
('ek1', '52', $$Üretim kapasitesi 100 ton/gün ve üzeri çikolata, çikolatalı ürün, kakao likörü, kakao tozu, kakao yağı gibi kakaolu ürün üretimi yapan tesisler$$, 52),
('ek1', '53', $$Balık unu ve balık yağı işletmeleri$$, 53),
('ek1', '54', $$100 ton/gün ve üzeri hayvansal ürünlerin işlendiği (et, sakatat ve benzeri) tesisler (fiziksel işlem, perakende satış ve su ürünleri hariç)$$, 54)
ON CONFLICT (stage, code) DO NOTHING;

-- ==========================================
-- EK-2: ÇEVRESEL ETKİLERİ ÖN İNCELEME VE DEĞERLENDİRMEYE TABİ PROJELER
-- (Ek-1'deki alt sınırlar bu listede üst sınır olarak alınır)
-- ==========================================
INSERT INTO public.ced_project_categories (stage, code, title, sort_order) VALUES
('ek2', '1', $$50 ton/gün ve üzeri taş kömürü ve bitümlü maddelerin gazlaştırılması ve sıvılaştırılması projeleri$$, 1),
('ek2', '2', $$a) Kimyasalların üretimi ve/veya ara ürünlerinin işlenmesi için projelendirilen tesisler (kimyasal reaksiyonla gerçekleştirilen üretimler), b) Petrol bazlı yağlama maddesi üretim tesisleri, c) Bitkisel ham yağlardan biyodizel üretim tesisleri$$, 2),
('ek2', '3', $$Toplam depolama kapasitesi 500 m³ ve üzeri olan doğalgaz, petrokimya, petrol ve kimyasal maddelerin depolandığı tesisler (perakende satışa hazır ambalajlı ürün depolama hariç)$$, 3),
('ek2', '4', $$a) Tarım ilaçları, farmasötik ürünler (Aşı/serum üretimi hariç) ve bitki gelişim düzenleyicilerin üretildiği tesisler, b) Boya ve cilaların (Reçine ünitesini ihtiva eden) tesisler, c) Günlük kapasitesi 1 ton ve üzeri elastomer esaslı ürünlerin (Vulkanizasyon içeren) işleme tesisleri$$, 4),
('ek2', '5', $$Atık Geri Kazanım ve/veya Bertaraf Tesisleri (hafriyat toprağı hariç); a) Tıbbi atıkların fiziksel/kimyasal işleme tesisleri, b) Atıkların fiziksel yöntemlerle geri kazanıldığı tesisler, c) Bitkisel atık yağdan biyodizel üretimi, ç) Tehlikeli atık ara depolama tesisleri, d) Günlük 100 tonun altında tehlikesiz atık/belediye atığı yakma tesisleri, e) 1 ton/gün ve üzeri tehlikesiz atık/belediye atığı geri kazanım ve biyobozunur atık işleme tesisleri, f) 1 ton/gün ve üzeri hayvansal dışkı yakma/geri kazanım/bertaraf tesisleri$$, 5),
('ek2', '6', $$a) Hammadde üretim ünitesini içeren deterjan üretimi yapan tesisler, b) Kapasitesi 2 ton/gün ve daha büyük olan sabun üretimi yapan tesisler (kimyasal reaksiyonla gerçekleştirilen üretimler)$$, 6),
('ek2', '7', $$Kapasitesi 500 ton ve üzeri olan patlayıcı madde depolama tesisleri$$, 7),
('ek2', '8', $$Metal endüstrisi (1000 ton/yıl ve üzeri); a) Hurda demir/çelikten çelik üreten tesisler, b) Demir/çeliğin ergitildiği ve dökümünün yapıldığı tesisler (hurda dâhil), c) Demir dışı metallerin ergitildiği ve dökümünün yapıldığı tesisler (hurda dâhil), ç) Sıcak haddeleme tesisleri, d) Soğuk haddeleme tesisleri (Tel çekme hariç)$$, 8),
('ek2', '9', $$Tank/havuz hacminin 5 m³ ve üzeri olduğu, elektrolitik veya kimyasal bir proses kullanılarak metal veya plastik maddelerin yüzeylerinin metalle kaplandığı ve/veya yüzey temizleme işleminin yapıldığı tesisler$$, 9),
('ek2', '10', $$Tekstil tesisleri; a) Boyama veya kasar işlemi yapan iplik/kumaş/elyaf/halı fabrikaları, b) Yün veya tiftiğin ovalanması/yağının alınması/ağartmasının yapıldığı endüstriyel tesisler, c) Denim (Kot) veya konfeksiyon ürünleri yıkama tesisleri, ç) Baskı sonrası kumaş yıkama işlemi içeren tesisler$$, 10),
('ek2', '11', $$Cam, cam elyafı, taş yünü, cam mozaik ve benzeri üretim tesisleri$$, 11),
('ek2', '12', $$Orman Ürünleri ve Selüloz Tesisleri; a) Her çeşit kâğıt üretim tesisleri (Atık kâğıt dâhil), b) 600 m3/günün üzerinde ağaç bazlı panel üretim tesisleri, c) Ağaç/ağaç ürünleri kullanarak mobilya üreten tesisler (3600 m3/yıl ve üzeri)$$, 12),
('ek2', '13', $$Lastik kaplama tesisleri (Soğuk lastik kaplama hariç)$$, 13),
('ek2', '14', $$Ham deri işleme tesisleri (Konfeksiyon ürünleri hariç)$$, 14),
('ek2', '15', $$Motorlu taşıtların üretimi (Kara taşıtları, tarım makinaları, iş makinaları, savunma sanayi taşıtları)$$, 15),
('ek2', '16', $$İçten yanmalı motor üretimi (montaj yapılan tesisler hariç)$$, 16),
('ek2', '17', $$Demiryolu taşıtlarının üretiminin yapıldığı tesisler (Ek-1'de yer almayan)$$, 17),
('ek2', '18', $$Çimento bazlı yapı elemanları ve/veya hazır beton tesisleri; a) Gazbeton blokları, çimento esaslı levha üretimi, b) 100 m3/saat ve üzeri hazır beton tesisleri, c) 5 ton/saat ve üzeri çimento/bağlayıcı madde ile şekillendirilmiş malzeme üretimi$$, 18),
('ek2', '19', $$1.000 ton/yıl ve üzeri tuğla ve/veya kiremit üretimi yapan tesisler$$, 19),
('ek2', '20', $$1.000 ton/yıl ve üzeri seramik ve/veya porselen üretimi yapan tesisler$$, 20),
('ek2', '21', $$a) Klinker öğütme tesisleri, b) 5 ton/gün ve üzeri mikronize öğütme tesisleri (maden ruhsat sahaları dışında)$$, 21),
('ek2', '22', $$Asfalt plent tesisleri$$, 22),
('ek2', '23', $$Anfo üretimi$$, 23),
('ek2', '24', $$Tuzun çıkarıldığı ve/veya işlendiği tesisler (Eleme, paketleme hariç)$$, 24),
('ek2', '25', $$Yıllık 1.000 ton ve üzeri fosfor, azot ve potasyum bazlı basit veya bileşik gübrelerin her türlü üretimi (organomineral nitelikli olanlar dâhil)$$, 25),
('ek2', '26', $$Bitkisel ve hayvansal ürünlerin üretimi; a) 5 ton/yıl ve üzeri bitkisel ham/rafine yağ üretimi, b) Nişasta üretimi/türevleri, c) 1.000 m³/yıl ve üzeri sirke üretimi, ç) 1.000 m3/yıl ve üzeri suma/malt üretimi, d) 1.500 ton/yıl ve üzeri zeytin işleme, e) 1.000 ton/yıl ve üzeri sigara/tütün mamulleri üretimi, f) Maya fabrikaları, g) 5 m³/yıl ve üzeri alkollü içecek üretimi, ğ) 1.000 m3/yıl ve üzeri alkolsüz içecek üretimi, h) 1.000 ton/yıl ve üzeri salça/ketçap/mayonez/sos üretimi, ı) 100 ton/yıl ve üzeri hayvansal yağ eritme, i) 30 ton/yıl ve üzeri su ürünleri işleme, j) 10.000 litre/gün ve üzeri süt işleme, k) 20 ton/gün ve üzeri bitkisel/hayvansal katı yağ üretimi, l) 30 ton/yıl ve üzeri kültür balıkçılığı, m) 40 milyon adet/yıl ve üzeri balık kuluçkahaneleri, n) Günlük 20 adet ve üzeri büyükbaş/küçükbaş hayvan kesimi, o) Günlük 1.000 adet ve üzeri tavuk/kanatlı kesimi, ö) 10 ton/gün ve üzeri likit yumurta üretimi, p) 10 ton/gün ve üzeri hayvansal ürün işleme, r) 10.000 litre/gün ve üzeri peynir altı suyu işleme, s) 5 ton/gün ve üzeri şekerleme/şeker şurubu üretimi, ş) 5 ton/gün ve üzeri çikolata/kakaolu ürün üretimi, t) 100 ton/gün ve üzeri bitkisel/hayvansal ürün konservesi ve ambalajlanması$$, 26),
('ek2', '27', $$Hayvan yetiştirme tesisleri; a) 500 baş ve üzeri büyükbaş yetiştirme, b) 2.500 baş ve üzeri küçükbaş yetiştirme, c) 500 adet ve üzeri büyükbaş/küçükbaş birlikte yetiştirme, ç) 20.000 adet ve üzeri tavuk/kanatlı yetiştirme, d) Kürk hayvanı yetiştiriciliği (5.000 adet ve üzeri), e) 300 baş ve üzeri domuz besi tesisleri$$, 27),
('ek2', '28', $$Altyapı tesisleri; a) Balıkçı barınakları, römorkör barınakları, feribot iskeleleri vb., b) Kıyı düzenlemesi/rekreasyon amaçlı 1.000 m2 ve üzeri deniz dolgusu, c) Yanaşma amaçlı olmayan dalgakıran/mahmuz/mendirek projeleri, ç) Şehir içi tramvay/metro/hafif raylı sistemler, d) Erişme kontrollü karayolları haricindeki yollar (20 km ve üzeri şerit/güzergâh değişikliği), e) Karayolu/demiryoluna tünel eklenmesi, f) Demiryollarında 20-70 km arası güzergâh değişikliği/hat çoğaltma, g) 20 km ve üzeri bağlantı/iltisak demiryolu hatları, ğ) Tersane/yat-tekne tesislerinde boyut artışı ve/veya yüzer havuz ilavesi, h) 5-24 m arası yat/tekne tadilat-imalat-çekek-bakım-onarım tesisleri, ı) Yat/tekne yanaşma/bağlanma yerleri, i) 200.000 m3 altı dip tarama projeleri$$, 28),
('ek2', '29', $$50 oda ve üzeri oteller, tatil köyleri, turizm kompleksleri vb.$$, 29),
('ek2', '30', $$Konut projeleri (300 konut ve üzeri)$$, 30),
('ek2', '31', $$Kapladığı alan 50.000 m2 ve üzeri olan daimî kamp ve karavan alanları$$, 31),
('ek2', '32', $$Temalı parklar (10.000 m2 ve üzeri alanda bilim, kültür, doğa veya spor temalı izleme/eğlenme/bilgilenme hizmeti sunan alanlar)$$, 32),
('ek2', '33', $$Kayak merkezleri (1.000 m ve üzeri mekanik tesisleri olan)$$, 33),
('ek2', '34', $$Arabalar ve motosikletler için kalıcı yarış ve test parkurları$$, 34),
('ek2', '35', $$Golf tesisleri$$, 35),
('ek2', '36', $$Alışveriş merkezleri (10.000 m2 ve üzeri kapalı inşaat alanı)$$, 36),
('ek2', '37', $$154 kV ve üzeri gerilimde ve 5 km ve üzeri sürekli uzunlukta olan elektrik enerjisi iletim hatları$$, 37),
('ek2', '38', $$Mevcut baraj veya isale hatlarına kurulacak olan hidroelektrik enerji santralleri$$, 38),
('ek2', '39', $$Jeotermal kaynağın çıkarılması veya kullanılması (Ek-1 listesi 42 nci madde hariç diğer kullanımlar)$$, 39),
('ek2', '40', $$Elektrik, gaz, buhar ve sıcak su elde edilmesi için kurulan endüstriyel tesisler (Toplam ısıl gücü 20 MWt-300 MWt arası)$$, 40),
('ek2', '41', $$Güneş enerji santralleri; a) Proje alanı 7,5 hektar ve üzerinde olan arazi güneş enerji santralleri (çatı/cephe hariç), b) Proje alanı 2 hektara kadar olan yüzer güneş enerji santralleri$$, 41),
('ek2', '42', $$Göl hacmi 1 milyon m3 ve üzeri olan baraj ve göletler$$, 42),
('ek2', '43', $$300.000 m3/yıl ve üzerinde yeraltından su çıkarma veya suyu yeraltında depolama projeleri$$, 43),
('ek2', '44', $$Akarsu yatakları ile ilgili projeler; a) Akarsu havzaları arasında su aktarma projeleri, b) Sürekli akış gösteren akarsuların yataklarında 5 km ve üzerinde düzenleme yapılan projeler$$, 44),
('ek2', '45', $$Madencilik projeleri; a) Madenlerin çıkarılması (Ek-1'de yer almayanlar), b) 5.000 m3/yıl ve üzeri mermer/dekoratif taş kesme-işleme-sayalama tesisleri, c) Karbondioksit ve diğer gazların çıkarılması, ç) Petrol, doğalgaz ve kayagazının çıkarılması (Ek-1'de yer almayanlar), d) Maden arama projeleri, e) Kırma-eleme-yıkama-kurutma-cevher hazırlama tesisleri, f) Fiziksel yöntemler uygulanan cevher zenginleştirme tesisleri ve atık tesisleri, g) Petrol/doğalgaz/kayagazı/jeotermal kaynak arama projeleri$$, 45),
('ek2', '46', $$Kömür işleme tesisleri; a) Havagazı ve kok fabrikaları, b) Kömür briketleme tesisleri, c) Lavvar tesisleri$$, 46),
('ek2', '47', $$Petrokok ve kömür depolama, sınıflama ve ambalajlama tesisleri (Perakende satış birimleri hariç)$$, 47),
('ek2', '48', $$Kireç fabrikaları ve/veya alçı fabrikaları$$, 48),
('ek2', '49', $$Manyezit işleme tesisleri$$, 49),
('ek2', '50', $$Perlit ve benzeri maden genleştirme tesisleri$$, 50),
('ek2', '51', $$Atık su arıtma ve derin deniz deşarjı projeleri; a) Kapasitesi 30.000 m3/gün ve üzeri olan atık su arıtma tesisleri, b) Derin deniz deşarjı projeleri$$, 51),
('ek2', '52', $$Define arama projeleri$$, 52),
('ek2', '53', $$Asbest içeren yapı ve tesislerin sökülmesi/yıkılması$$, 53),
('ek2', '54', $$Karbon yakalama ve depolama amacıyla CO2'in boru hatları ile taşınması$$, 54),
('ek2', '55', $$Arazilerin Yeniden Yapılandırılması Projeleri; a) Tarım arazilerinin yeniden yapılandırılması (1.000 hektar ve üzeri), b) İşlenmemiş/yarı işlenmiş alanların tarım-orman amaçlı kullanımı (1.000 hektar ve üzeri), c) Orman alanlarının başka amaçla kullanıma dönüştürülmesi (1.000 hektar ve üzeri), ç) Tarımsal amaçlı su yönetimi projeleri (1.000 hektar ve üzeri)$$, 55),
('ek2', '56', $$Kültür balıkçılığı projeleri dışında kalan su ürünleri yetiştiriciliği projeleri (30 ton/yıl ve üzeri üretim)$$, 56),
('ek2', '57', $$1 adet türbin ve üzeri rüzgâr enerji santralleri$$, 57),
('ek2', '58', $$100.000 ton/yıl ve üzeri hayvan yemi üreten tesisler$$, 58),
('ek2', '59', $$Balık ağı yıkama tesisleri$$, 59)
ON CONFLICT (stage, code) DO NOTHING;
