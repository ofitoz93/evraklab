-- src/ClientPanel.tsx > ensureAutoDocumentRequests() süresi geçmiş bir belge
-- için otomatik "Evrak Talebi" açmadan önce "bu source_document_id için zaten
-- bekleyen bir talep var mı?" diye kontrol edip sonra INSERT ediyor. Bu iki
-- adım arasında hiçbir DB kısıtı olmadığı için, fonksiyon neredeyse aynı anda
-- iki kez tetiklenirse (ör. React effect'in çift çalışması) her iki çağrı da
-- kontrol anında "yok" görüp ikisi de ekliyor — aynı belge için iki adet
-- birebir aynı "pending" talep oluşuyordu (canlıda gözlemlendi: aynı
-- source_document_id için 274ms arayla açılmış iki kayıt).
--
-- Danışmanın elle açtığı talepler source_document_id'siz (NULL) olduğu için
-- bu kısıt onları etkilemiyor; sadece otomatik-açılan ve hâlâ "pending"
-- durumdaki talepler için aynı kaynak belgeden ikinci bir kayıt açılmasını
-- DB seviyesinde engelliyor.

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_requests_unique_pending_source
ON public.document_requests (source_document_id)
WHERE status = 'pending' AND source_document_id IS NOT NULL;
