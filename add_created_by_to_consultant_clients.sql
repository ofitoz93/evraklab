-- Migration: Add created_by column to consultant_clients table
ALTER TABLE public.consultant_clients 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
