-- =======================================================
-- GÖRÜŞ YAZISI "SAYI" NUMARALANDIRMASI
-- Supabase SQL Editor'de çalıştırın (create_opinion_letters.sql'den SONRA)
--
-- Sayı artık görüntüleme sayfasında her seferinde yeniden hesaplanmıyor;
-- oluşturma anında hesaplanıp sequence_no kolonunda saklanıyor. Böylece
-- her zaman aynı ve tutarlı kalıyor (ör. CAN Varil'in 2026'daki ilk
-- görüşü sequence_no=1 -> "2026-01" olarak gösterilir).
-- =======================================================

ALTER TABLE public.opinion_letters
  ADD COLUMN IF NOT EXISTS sequence_no INTEGER;
