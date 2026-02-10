import { createClient } from '@supabase/supabase-js';

// Senin Proje URL'in
const supabaseUrl = 'https://txdhuaqrxdwftlzxsdpo.supabase.co';

// DİKKAT: Buraya Supabase panelinden aldığın 'anon public' key'i yapıştır.
// (Project Settings -> API -> Project API keys -> anon public)
const supabaseKey = 'sb_publishable_QSxADzAjUsXLIfyJAhaZBQ_hHy5SyTt';

export const supabase = createClient(supabaseUrl, supabaseKey);
