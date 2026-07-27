-- One-off data fix (already applied directly against the live DB): the
-- consultant_client_service_periods rows seeded for TEST_ABC Danismanlik
-- Hizmetleri's client portfolio had renewal boundaries snapped to the
-- calendar year (Jan 1 -> Jan 1) instead of the client's actual service
-- anniversary date. E.g. a client that started service on 2023-05-07 had
-- periods 2023-05-07 -> 2024-01-01 -> 2025-01-01 -> 2026-01-01 -> 2027-01-01,
-- instead of 2023-05-07 -> 2024-05-07 -> 2025-05-07 -> 2026-05-07 -> 2027-05-07.
--
-- This recomputes each period's start/end date to be anniversary-based,
-- preserving the existing period count and fee per period (only the date
-- boundaries change) for every consultant_client_service_periods row under
-- TEST_ABC's org id.
WITH ranked AS (
  SELECT p.id, p.client_id, cc.service_start_date,
         ROW_NUMBER() OVER (PARTITION BY p.client_id ORDER BY p.start_date) AS rn
  FROM consultant_client_service_periods p
  JOIN consultant_clients cc ON cc.id = p.client_id
  WHERE p.consultant_company_id = '41156abf-da21-561b-9e2a-d27c5be91d55' -- TEST_ABC Danismanlik Hizmetleri
)
UPDATE consultant_client_service_periods p
SET start_date = (r.service_start_date + ((r.rn - 1) * interval '1 year'))::date,
    end_date   = (r.service_start_date + (r.rn * interval '1 year'))::date
FROM ranked r
WHERE p.id = r.id;
