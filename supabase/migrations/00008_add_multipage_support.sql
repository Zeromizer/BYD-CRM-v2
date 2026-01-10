-- Add multi-page support to document templates
-- Migration: 00008_add_multipage_support.sql

-- Add pages JSONB column for multi-page templates
-- When pages is NULL, use legacy single-page fields (image_path, image_url, fields)
-- When pages is populated, it contains an array of page objects
ALTER TABLE document_templates
ADD COLUMN IF NOT EXISTS pages JSONB DEFAULT NULL;

/*
  Pages structure:
  [
    {
      "id": "page_1",
      "page_number": 1,
      "image_path": "user_id/timestamp.png",
      "image_url": "signed_url",
      "width": 2480,
      "height": 3508,
      "fields": {
        "field_1": {
          "type": "name",
          "x": 150,
          "y": 200,
          "width": 300,
          "height": 30,
          "fontSize": 12,
          "fontFamily": "Arial",
          "textAlign": "left",
          "color": "#000000"
        }
      }
    },
    {
      "id": "page_2",
      "page_number": 2,
      "image_path": "user_id/timestamp2.png",
      "image_url": "signed_url",
      "width": 2480,
      "height": 3508,
      "fields": {}
    }
  ]
*/

-- Add GIN index for querying pages JSONB
CREATE INDEX IF NOT EXISTS idx_document_templates_pages
ON document_templates USING GIN (pages);

COMMENT ON COLUMN document_templates.pages IS
'Array of page objects for multi-page templates. NULL means legacy single-page template using image_path/image_url/fields columns.';
