-- Danışmanların kendi değerlendirmelerini görmesini engellemek için evaluatee politikasını kaldırıyoruz.
DROP POLICY IF EXISTS "Users can view evaluations where they are the evaluatee" ON public.evaluations;
