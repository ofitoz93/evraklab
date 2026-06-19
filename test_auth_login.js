import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tblexblpvhaezihfiasf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibGV4YmxwdmhhZXppaGZpYXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDcwOTIsImV4cCI6MjA5NjEyMzA5Mn0.JFiKXVZCDEUfD6SaKWCsO2NHBot6UEoxJtG8WOOG6Ms';

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Sign in as y.enes@y.enes.com
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'y.enes@y.enes.com',
    password: '123456'
  });
  
  if (authError) {
    console.error('Auth failed:', authError);
    return;
  }
  
  const session = authData.session;
  console.log('Signed in successfully as y.enes@y.enes.com');
  
  const authSupabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  
  await authSupabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  });

  // Get assignments
  const { data: assignments, error: errAssign } = await authSupabase
    .from('consultant_assignments')
    .select('client_id')
    .eq('user_id', session.user.id);
    
  if (errAssign) {
    console.error('Error fetching assignments:', errAssign);
    return;
  }
  
  const cIds = assignments?.map((a) => a.client_id) || [];
  console.log('Client assignments cIds:', cIds);

  // Exact Dashboard query
  console.log('\nRunning exact Dashboard query...');
  let actQuery = authSupabase
    .from('compliance_actions')
    .select('*, client:consultant_clients(name)')
    .in('status', ['pending', 'correction_requested']);

  if (cIds.length > 0) {
    actQuery = actQuery.or(`assigned_to.eq.${session.user.id},client_id.in.(${cIds.join(',')})`);
  } else {
    actQuery = actQuery.eq('assigned_to', session.user.id);
  }

  const { data: acts, error: errActs } = await actQuery.order('due_date', { ascending: true });
  if (errActs) {
    console.error('Dashboard query failed:', errActs);
  } else {
    console.log('Dashboard query succeeded, actions:', acts.length);
  }

  // Exact Consultant Panel query
  console.log('\nRunning exact Consultant Panel query...');
  let panelQuery = authSupabase
    .from('compliance_actions')
    .select('*, client:consultant_clients(name), assignee:profiles!assigned_to(full_name), creator:profiles!created_by(full_name)');

  if (cIds.length > 0) {
    panelQuery = panelQuery.or(`assigned_to.eq.${session.user.id},client_id.in.(${cIds.join(',')})`);
  } else {
    panelQuery = panelQuery.eq('assigned_to', session.user.id);
  }

  const { data: panelActs, error: errPanel } = await panelQuery.order('created_at', { ascending: false });
  if (errPanel) {
    console.error('Panel query failed:', errPanel);
  } else {
    console.log('Panel query succeeded, actions:', panelActs.length);
  }
}

main();
