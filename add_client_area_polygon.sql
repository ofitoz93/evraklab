-- "Haritadan Konum Seç" modalına eklenen alan/poligon çizme özelliği için:
-- işletmenin tesis sınırlarını haritada çizip kaydedebilmesi amacıyla
-- consultant_clients tablosuna alan (poligon) bilgisi ekleniyor.
--
-- area_points: [{lat, lng}, ...] şeklinde çizilen poligonun köşe noktaları.
-- area_m2: köşe noktalarından hesaplanan yaklaşık alan (m²), listelerde hızlı
--          gösterim için ayrıca saklanıyor.

ALTER TABLE public.consultant_clients
  ADD COLUMN IF NOT EXISTS area_points JSONB,
  ADD COLUMN IF NOT EXISTS area_m2 NUMERIC;
