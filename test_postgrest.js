import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tblexblpvhaezihfiasf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibGV4YmxwdmhhZXppaGZpYXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDcwOTIsImV4cCI6MjA5NjEyMzA5Mn0.JFiKXVZCDEUfD6SaKWCsO2NHBot6UEoxJtG8WOOG6Ms';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWrong() {
  console.log('Testing wrong join syntax...');
  const { data, error } = await supabase
    .from('compliance_actions')
    .select('*, client:consultant_clients(name), assignee:profiles!assigned_to(full_name)')
    .limit(1);
  if (error) {
    console.error('Wrong syntax error:', error);
  } else {
    console.log('Wrong syntax success:', data);
  }
}

async function testCorrect() {
  console.log('Testing correct join syntax...');
  const { data, error } = await supabase
    .from('compliance_actions')
    .select('*, client:client_id(name), assignee:assigned_to(full_name), creator:created_by(full_name)')
    .limit(1);
  if (error) {
    console.error('Correct syntax error:', error);
  } else {
    console.log('Correct syntax success:', data);
  }
}

async function run() {
  await testWrong();
  await testCorrect();
}

run();
