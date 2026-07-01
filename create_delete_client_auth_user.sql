-- This SQL defines a SECURITY DEFINER function to allow deleting a client's auth user record from client-side JS
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

CREATE OR REPLACE FUNCTION public.delete_client_auth_user(client_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- runs with bypass security definer privileges to access auth.users
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- 1. Find user ID in auth.users by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = client_email;
  
  IF v_user_id IS NOT NULL THEN
    -- Delete from auth.users (cascades to public.profiles and related profile tables)
    DELETE FROM auth.users WHERE id = v_user_id;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;
