-- Create document templates table
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Template info
  name TEXT NOT NULL,
  category TEXT DEFAULT 'other' CHECK (category IN ('vsa', 'insurance', 'delivery', 'test_drive', 'finance', 'other')),

  -- Storage reference
  image_path TEXT,              -- Path in Supabase Storage
  image_url TEXT,               -- Cached signed URL (refreshed on access)

  -- Image metadata
  dpi INTEGER DEFAULT 300,
  width INTEGER,
  height INTEGER,

  -- Field mappings (JSONB)
  fields JSONB DEFAULT '{}',
  /*
  Example fields structure:
  {
    "field_1": {
      "type": "name",
      "x": 150,
      "y": 200,
      "width": 300,
      "height": 30,
      "fontSize": 12,
      "fontFamily": "Arial",
      "textAlign": "left",
      "color": "#000000",
      "customValue": null
    }
  }
  */

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_document_templates_user_id ON document_templates(user_id);
CREATE INDEX idx_document_templates_category ON document_templates(category);

-- Enable RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own document templates" ON document_templates
  FOR ALL USING (auth.uid() = user_id);

-- Updated at trigger
CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
