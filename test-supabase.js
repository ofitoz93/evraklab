import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://txdhuaqrxdwftlzxsdpo.supabase.co';
const supabaseKey = 'sb_publishable_QSxADzAjUsXLIfyJAhaZBQ_hHy5SyTt';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const tables = ['profiles', 'roles', 'role_permissions', 'organizations', 'firms', 'firm_memberships'];
  
  for (const table of tables) {
    console.log(`\n--- TABLE: ${table} ---`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Error querying ${table}:`, error.message);
    } else {
      if (data && data.length > 0) {
        console.log(`Keys for ${table}:`, Object.keys(data[0]));
      } else {
        console.log(`No data in ${table}`);
      }
    }
  }
}

test();
