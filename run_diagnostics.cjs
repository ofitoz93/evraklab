const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tblexblpvhaezihfiasf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibGV4YmxwdmhhZXppaGZpYXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDcwOTIsImV4cCI6MjA5NjEyMzA5Mn0.JFiKXVZCDEUfD6SaKWCsO2NHBot6UEoxJtG8WOOG6Ms';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.rpc('get_diagnostics');
  if (error) {
    console.error('Error calling get_diagnostics RPC:', error);
    console.log('\nLütfen diagnostics.sql içeriğini Supabase SQL editöründe çalıştırıp bu betiği tekrar çalıştırın.');
  } else {
    console.log('=== DIAGNOSTICS DATA ===');
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
