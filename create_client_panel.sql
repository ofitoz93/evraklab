-- Alter profiles table to add client_id column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES consultant_clients(id) ON DELETE CASCADE;

-- Update RLS policy on consultant_clients to support client role
DROP POLICY IF EXISTS "Client role can select their own record" ON consultant_clients;
CREATE POLICY "Client role can select their own record" ON consultant_clients
    FOR SELECT TO authenticated
    USING (
        id = (SELECT client_id FROM profiles WHERE id = auth.uid())
    );

-- Update RLS policy on profiles to let client roles view their profile
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
    FOR ALL TO authenticated
    USING (id = auth.uid() OR auth.uid() IN (
        -- Also let organization admins/staff view the profiles (for management)
        SELECT p.id FROM profiles p WHERE p.organization_id = profiles.organization_id
    ));
