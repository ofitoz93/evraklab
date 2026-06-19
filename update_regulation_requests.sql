-- Add parent_request_id column to regulation_requests table to track escalated requests
ALTER TABLE public.regulation_requests 
ADD COLUMN IF NOT EXISTS parent_request_id UUID REFERENCES public.regulation_requests(id) ON DELETE SET NULL;
