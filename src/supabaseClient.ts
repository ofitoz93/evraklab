import { createClient } from '@supabase/supabase-js';

// Get values from environment variables or use fallbacks
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://txdhuaqrxdwftlzxsdpo.supabase.co';
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QSxADzAjUsXLIfyJAhaZBQ_hHy5SyTt';

export const supabase = createClient(supabaseUrl, supabaseKey);

