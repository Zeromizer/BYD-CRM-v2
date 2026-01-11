-- Change vsa_delivery_date from DATE to TEXT
-- This allows storing delivery window estimates like "JAN/FEB 2026" instead of exact dates
ALTER TABLE customers
  ALTER COLUMN vsa_delivery_date TYPE TEXT;
