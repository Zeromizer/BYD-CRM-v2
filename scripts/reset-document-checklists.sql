-- Reset document_checklist for all customers
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

UPDATE customers
SET document_checklist = '{"test_drive": {}, "close_deal": {}, "registration": {}, "delivery": {}, "nps": {}}'::jsonb
WHERE document_checklist IS NOT NULL
  AND document_checklist != '{"test_drive": {}, "close_deal": {}, "registration": {}, "delivery": {}, "nps": {}}'::jsonb;

-- This will return the number of rows updated
