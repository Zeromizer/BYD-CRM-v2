-- Create customers table with all 80+ fields
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Basic Info
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  nric TEXT,
  occupation TEXT,
  dob DATE,
  license_start_date DATE,
  address TEXT,
  address_continue TEXT,
  sales_consultant TEXT,
  vsa_no TEXT,
  notes TEXT,

  -- Status
  archive_status TEXT CHECK (archive_status IN ('lost', 'completed')),
  archived_at TIMESTAMPTZ,
  deal_closed BOOLEAN DEFAULT FALSE,
  current_milestone TEXT DEFAULT 'test_drive',

  -- VSA Details - Vehicle
  vsa_make_model TEXT,
  vsa_variant TEXT,
  vsa_yom TEXT,
  vsa_body_colour TEXT,
  vsa_upholstery TEXT,
  vsa_prz_type TEXT CHECK (vsa_prz_type IN ('P', 'R', 'Z')),

  -- VSA Details - Package
  vsa_package TEXT,
  vsa_selling_price_list DECIMAL(12,2),
  vsa_purchase_price_with_coe DECIMAL(12,2),
  vsa_coe_rebate_level TEXT,
  vsa_deposit DECIMAL(12,2),
  vsa_less_others DECIMAL(12,2),
  vsa_add_others DECIMAL(12,2),
  vsa_delivery_date DATE,

  -- VSA Details - Trade In
  vsa_trade_in_car_no TEXT,
  vsa_trade_in_car_model TEXT,
  vsa_trade_in_amount DECIMAL(12,2),
  vsa_trade_in_settlement_cost DECIMAL(12,2),
  vsa_number_retention BOOLEAN DEFAULT FALSE,
  vsa_number_retention_fee DECIMAL(12,2),
  vsa_trade_in_owner_not_customer BOOLEAN DEFAULT FALSE,
  vsa_trade_in_owner_name TEXT,
  vsa_trade_in_owner_nric TEXT,
  vsa_trade_in_owner_mobile TEXT,
  vsa_trade_in_insurance_company TEXT,
  vsa_trade_in_policy_number TEXT,

  -- VSA Details - Delivery
  vsa_date_of_registration DATE,
  vsa_registration_no TEXT,
  vsa_chassis_no TEXT,
  vsa_engine_no TEXT,
  vsa_motor_no TEXT,

  -- VSA Details - Insurance
  vsa_insurance_company TEXT,
  vsa_insurance_fee DECIMAL(12,2),
  vsa_insurance_subsidy DECIMAL(12,2),

  -- VSA Details - Loan
  vsa_remarks1 TEXT,
  vsa_remarks2 TEXT,
  vsa_loan_amount DECIMAL(12,2),
  vsa_interest DECIMAL(5,2),
  vsa_tenure INTEGER,
  vsa_admin_fee DECIMAL(12,2),
  vsa_monthly_repayment DECIMAL(12,2),

  -- Proposal Details
  proposal_model TEXT,
  proposal_variant TEXT,
  proposal_color TEXT,
  proposal_bank TEXT,
  proposal_selling_price DECIMAL(12,2),
  proposal_interest_rate DECIMAL(5,2),
  proposal_downpayment DECIMAL(12,2),
  proposal_loan_tenure INTEGER,
  proposal_loan_amount DECIMAL(12,2),
  proposal_admin_fee DECIMAL(12,2),
  proposal_referral_fee DECIMAL(12,2),
  proposal_trade_in_model TEXT,
  proposal_low_loan_surcharge DECIMAL(12,2),
  proposal_trade_in_car_plate TEXT,
  proposal_no_loan_surcharge DECIMAL(12,2),
  proposal_quoted_trade_in_price DECIMAL(12,2),
  proposal_benefit1 TEXT,
  proposal_benefit2 TEXT,
  proposal_benefit3 TEXT,
  proposal_benefit4 TEXT,
  proposal_benefit5 TEXT,
  proposal_benefit6 TEXT,
  proposal_benefit7 TEXT,
  proposal_benefit8 TEXT,
  proposal_benefit9 TEXT,
  proposal_benefits_given TEXT,
  proposal_remarks TEXT,

  -- JSONB Fields for flexible nested data
  checklist JSONB DEFAULT '{"currentMilestone": "test_drive", "test_drive": {}, "close_deal": {}, "registration": {}, "delivery": {}, "nps": {}}',
  milestone_dates JSONB DEFAULT '{"test_drive": null, "close_deal": null, "registration": null, "delivery": null, "nps": null}',
  document_checklist JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_vsa_per_user UNIQUE (user_id, vsa_no)
);

-- Indexes
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_archive_status ON customers(archive_status);
CREATE INDEX idx_customers_current_milestone ON customers(current_milestone);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);
CREATE INDEX idx_customers_name ON customers(name);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own customers" ON customers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customers" ON customers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customers" ON customers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own customers" ON customers
  FOR DELETE USING (auth.uid() = user_id);

-- Updated at trigger
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
