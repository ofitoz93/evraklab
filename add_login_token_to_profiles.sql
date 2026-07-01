-- Support multiple client login accounts (sub-users) per company.
-- Previously the password-setup token lived on consultant_clients (one row per
-- company), so creating a second login account for the same company would
-- clobber the first account's pending token. Each client profile now carries
-- its own login_token so accounts don't interfere with each other.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_token TEXT;
