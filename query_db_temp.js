import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tblexblpvhaezihfiasf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibGV4YmxwdmhhZXppaGZpYXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDcwOTIsImV4cCI6MjA5NjEyMzA5Mn0.JFiKXVZCDEUfD6SaKWCsO2NHBot6UEoxJtG8WOOG6Ms';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- EMAIL LOGS ---');
  const { data: logs, error } = await supabase.from('email_logs').select('*').order('sent_at', { ascending: false }).limit(20);
  if (error) {
    console.error('Error fetching email_logs:', error);
  } else {
    console.log(logs);
  }
}

main();
