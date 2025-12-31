/**
 * Customer type definitions
 * Based on existing BYD CRM data model with 80+ fields
 */

import type { MilestoneId, ArchiveStatus, DocumentStatus, PrzType, Timestamps } from './common.types';

// Uploaded file reference
export interface UploadedFile {
  fileId: string;
  fileName: string;
  uploadedAt: string;
  classification?: string;
}

// Document checklist item
export interface DocumentChecklistItem {
  status: DocumentStatus;
  uploadedAt: string | null;
  uploadedFiles: UploadedFile[];
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string;
}

// Document checklist state (per milestone)
export type DocumentChecklistState = Record<MilestoneId, Record<string, DocumentChecklistItem>>;

// Milestone dates
export interface MilestoneDates {
  test_drive: string | null;
  close_deal: string | null;
  registration: string | null;
  delivery: string | null;
  nps: string | null;
}

// Checklist state (task completion per milestone)
export interface ChecklistState {
  currentMilestone: MilestoneId;
  test_drive: Record<string, boolean>;
  close_deal: Record<string, boolean>;
  registration: Record<string, boolean>;
  delivery: Record<string, boolean>;
  nps: Record<string, boolean>;
}

// Guarantor
export interface Guarantor {
  id: number;
  customer_id: number;
  position: 1 | 2 | 3 | 4 | 5;
  name: string;
  phone: string | null;
  email: string | null;
  nric: string | null;
  occupation: string | null;
  dob: string | null;
  address: string | null;
  address_continue: string | null;
  created_at: string;
  updated_at: string;
}

export type GuarantorInsert = Omit<Guarantor, 'id' | 'created_at' | 'updated_at'>;
export type GuarantorUpdate = Partial<GuarantorInsert>;

// Main Customer interface
export interface Customer extends Timestamps {
  id: number;
  user_id: string;

  // Basic Info
  name: string;
  phone: string | null;
  email: string | null;
  nric: string | null;
  occupation: string | null;
  dob: string | null;
  license_start_date: string | null;
  address: string | null;
  address_continue: string | null;
  sales_consultant: string | null;
  vsa_no: string | null;
  notes: string | null;

  // Status
  archive_status: ArchiveStatus;
  archived_at: string | null;
  deal_closed: boolean;
  current_milestone: MilestoneId;

  // VSA Details - Vehicle
  vsa_make_model: string | null;
  vsa_variant: string | null;
  vsa_yom: string | null;
  vsa_body_colour: string | null;
  vsa_upholstery: string | null;
  vsa_prz_type: PrzType;

  // VSA Details - Package
  vsa_package: string | null;
  vsa_selling_price_list: number | null;
  vsa_purchase_price_with_coe: number | null;
  vsa_coe_rebate_level: string | null;
  vsa_deposit: number | null;
  vsa_less_others: number | null;
  vsa_add_others: number | null;
  vsa_delivery_date: string | null;

  // VSA Details - Trade In
  vsa_trade_in_car_no: string | null;
  vsa_trade_in_car_model: string | null;
  vsa_trade_in_amount: number | null;
  vsa_trade_in_settlement_cost: number | null;
  vsa_number_retention: boolean;
  vsa_number_retention_fee: number | null;
  vsa_trade_in_owner_not_customer: boolean;
  vsa_trade_in_owner_name: string | null;
  vsa_trade_in_owner_nric: string | null;
  vsa_trade_in_owner_mobile: string | null;
  vsa_trade_in_insurance_company: string | null;
  vsa_trade_in_policy_number: string | null;

  // VSA Details - Delivery
  vsa_date_of_registration: string | null;
  vsa_registration_no: string | null;
  vsa_chassis_no: string | null;
  vsa_engine_no: string | null;
  vsa_motor_no: string | null;

  // VSA Details - Insurance
  vsa_insurance_company: string | null;
  vsa_insurance_fee: number | null;
  vsa_insurance_subsidy: number | null;

  // VSA Details - Loan
  vsa_remarks1: string | null;
  vsa_remarks2: string | null;
  vsa_loan_amount: number | null;
  vsa_interest: number | null;
  vsa_tenure: number | null;
  vsa_admin_fee: number | null;
  vsa_monthly_repayment: number | null;

  // Proposal Details
  proposal_model: string | null;
  proposal_variant: string | null;
  proposal_color: string | null;
  proposal_bank: string | null;
  proposal_selling_price: number | null;
  proposal_interest_rate: number | null;
  proposal_downpayment: number | null;
  proposal_loan_tenure: number | null;
  proposal_loan_amount: number | null;
  proposal_admin_fee: number | null;
  proposal_referral_fee: number | null;
  proposal_trade_in_model: string | null;
  proposal_low_loan_surcharge: number | null;
  proposal_trade_in_car_plate: string | null;
  proposal_no_loan_surcharge: number | null;
  proposal_quoted_trade_in_price: number | null;
  proposal_benefit1: string | null;
  proposal_benefit2: string | null;
  proposal_benefit3: string | null;
  proposal_benefit4: string | null;
  proposal_benefit5: string | null;
  proposal_benefit6: string | null;
  proposal_benefit7: string | null;
  proposal_benefit8: string | null;
  proposal_benefit9: string | null;
  proposal_benefits_given: string | null;
  proposal_remarks: string | null;

  // JSONB Fields
  checklist: ChecklistState;
  milestone_dates: MilestoneDates;
  document_checklist: DocumentChecklistState;

  // Relations (optional, for joins)
  guarantors?: Guarantor[];
}

// Type for creating a new customer
export type CustomerInsert = Omit<Customer, 'id' | 'created_at' | 'updated_at'>;

// Type for updating a customer
export type CustomerUpdate = Partial<Omit<CustomerInsert, 'user_id'>>;

// Customer with computed fields for display
export interface CustomerWithProgress extends Customer {
  milestoneProgress: number;
  overallProgress: number;
}
