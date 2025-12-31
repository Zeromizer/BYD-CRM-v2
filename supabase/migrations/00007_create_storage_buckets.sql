-- Create storage buckets for files
-- Note: Run this in Supabase Dashboard SQL Editor or via Supabase CLI

-- Document templates bucket (form template images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-templates',
  'document-templates',
  false,
  52428800,  -- 50MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Excel templates bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'excel-templates',
  'excel-templates',
  false,
  52428800,  -- 50MB limit
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
) ON CONFLICT (id) DO NOTHING;

-- Customer documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-documents',
  'customer-documents',
  false,
  104857600,  -- 100MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Scanned documents bucket (for OCR)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scanned-documents',
  'scanned-documents',
  false,
  52428800,  -- 50MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies

-- Document templates: Users can only access their own files
CREATE POLICY "Users can access own document templates"
ON storage.objects FOR ALL USING (
  bucket_id = 'document-templates' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Excel templates: Users can only access their own files
CREATE POLICY "Users can access own excel templates"
ON storage.objects FOR ALL USING (
  bucket_id = 'excel-templates' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Customer documents: Users can only access their own files
CREATE POLICY "Users can access own customer documents"
ON storage.objects FOR ALL USING (
  bucket_id = 'customer-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Scanned documents: Users can only access their own files
CREATE POLICY "Users can access own scanned documents"
ON storage.objects FOR ALL USING (
  bucket_id = 'scanned-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
