-- Create excel templates table
CREATE TABLE IF NOT EXISTS excel_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Template info
  name TEXT NOT NULL,

  -- Storage reference
  file_path TEXT,               -- Path in Supabase Storage

  -- Field mappings per sheet (JSONB)
  field_mappings JSONB DEFAULT '{}',
  /*
  Example structure:
  {
    "Sheet1": {
      "A1": "name",
      "B1": "phone",
      "C1": "email",
      "A5": "vsa_make_model",
      "B5": "vsa_selling_price_list"
    },
    "Sheet2": {
      "A1": "guarantor1_name",
      "B1": "guarantor1_nric"
    }
  }
  */

  -- Metadata
  sheet_names TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_excel_templates_user_id ON excel_templates(user_id);

-- Enable RLS
ALTER TABLE excel_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own excel templates" ON excel_templates
  FOR ALL USING (auth.uid() = user_id);

-- Updated at trigger
CREATE TRIGGER update_excel_templates_updated_at
  BEFORE UPDATE ON excel_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
