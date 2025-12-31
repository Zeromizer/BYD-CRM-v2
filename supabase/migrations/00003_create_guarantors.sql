-- Create guarantors table (normalized from customer.guarantors array)
CREATE TABLE IF NOT EXISTS guarantors (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 5),

  -- Guarantor info
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  nric TEXT,
  occupation TEXT,
  dob DATE,
  address TEXT,
  address_continue TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique position per customer
  UNIQUE(customer_id, position)
);

-- Indexes
CREATE INDEX idx_guarantors_customer_id ON guarantors(customer_id);

-- Enable RLS
ALTER TABLE guarantors ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Access through customer ownership
CREATE POLICY "Users can access guarantors through customers" ON guarantors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = guarantors.customer_id
      AND customers.user_id = auth.uid()
    )
  );

-- Updated at trigger
CREATE TRIGGER update_guarantors_updated_at
  BEFORE UPDATE ON guarantors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
