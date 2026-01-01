/**
 * Customer Import/Export Service
 * Handles importing customers from old BYD-CRM format to new format
 * and exporting customers for backup
 */

import type { Customer, CustomerInsert, Guarantor, GuarantorInsert, ChecklistState, MilestoneDates, DocumentChecklistState } from '@/types';

// Old CRM customer format (camelCase)
interface OldCustomer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  nric?: string;
  occupation?: string;
  dob?: string;
  licenseStartDate?: string;
  salesConsultant?: string;
  vsaNo?: string;
  address?: string;
  addressContinue?: string;
  notes?: string;
  dateAdded?: string;
  dealClosed?: boolean;
  archiveStatus?: 'lost' | 'completed' | null;
  archivedAt?: string | null;

  // VSA Details - Vehicle (old format: vsa_makeModel, vsa_yom, etc.)
  vsa_makeModel?: string;
  vsa_variant?: string;
  vsa_yom?: string;
  vsa_bodyColour?: string;
  vsa_upholstery?: string;
  vsa_przType?: 'P' | 'R' | 'Z' | null;

  // VSA Details - Package
  vsa_package?: string;
  vsa_sellingPriceList?: number | string;
  vsa_purchasePriceWithCOE?: number | string;
  vsa_coeRebateLevel?: string;
  vsa_deposit?: number | string;
  vsa_lessOthers?: number | string;
  vsa_addOthers?: number | string;
  vsa_deliveryDate?: string;

  // VSA Details - Trade In
  vsa_tradeInCarNo?: string;
  vsa_tradeInCarModel?: string;
  vsa_tradeInAmount?: number | string;
  vsa_tradeInSettlementCost?: number | string;
  vsa_numberRetention?: boolean;
  vsa_numberRetentionFee?: number | string;
  vsa_tradeInOwnerNotCustomer?: boolean;
  vsa_tradeInOwnerName?: string;
  vsa_tradeInOwnerNric?: string;
  vsa_tradeInOwnerMobile?: string;
  vsa_tradeInInsuranceCompany?: string;
  vsa_tradeInPolicyNumber?: string;

  // VSA Details - Delivery
  vsa_dateOfRegistration?: string;
  vsa_registrationNo?: string;
  vsa_chassisNo?: string;
  vsa_engineNo?: string;
  vsa_motorNo?: string;

  // VSA Details - Insurance
  vsa_insuranceCompany?: string;
  vsa_insuranceFee?: number | string;
  vsa_insuranceSubsidy?: number | string;

  // VSA Details - Loan
  vsa_remarks1?: string;
  vsa_remarks2?: string;
  vsa_loanAmount?: number | string;
  vsa_interest?: number | string;
  vsa_tenure?: number | string;
  vsa_adminFee?: number | string;
  vsa_monthlyRepayment?: number | string;

  // Proposal Details (old format: proposal_model, proposal_sellingPrice, etc.)
  proposal_model?: string;
  proposal_variant?: string;
  proposal_color?: string;
  proposal_bank?: string;
  proposal_sellingPrice?: number | string;
  proposal_interestRate?: number | string;
  proposal_downpayment?: number | string;
  proposal_loanTenure?: number | string;
  proposal_loanAmount?: number | string;
  proposal_adminFee?: number | string;
  proposal_referralFee?: number | string;
  proposal_tradeInModel?: string;
  proposal_lowLoanSurcharge?: number | string;
  proposal_tradeInCarPlate?: string;
  proposal_noLoanSurcharge?: number | string;
  proposal_quotedTradeInPrice?: number | string;
  proposal_benefit1?: string;
  proposal_benefit2?: string;
  proposal_benefit3?: string;
  proposal_benefit4?: string;
  proposal_benefit5?: string;
  proposal_benefit6?: string;
  proposal_benefit7?: string;
  proposal_benefit8?: string;
  proposal_benefit9?: string;
  proposal_benefitsGiven?: string;
  proposal_remarks?: string;

  // JSONB fields
  checklist?: ChecklistState;
  milestoneDates?: MilestoneDates;
  documentChecklist?: DocumentChecklistState;

  // Guarantors (may be embedded or separate)
  guarantors?: OldGuarantor[];
  guarantor1?: OldGuarantor;
  guarantor2?: OldGuarantor;
  guarantor3?: OldGuarantor;
  guarantor4?: OldGuarantor;
  guarantor5?: OldGuarantor;
}

interface OldGuarantor {
  id?: number;
  position?: 1 | 2 | 3 | 4 | 5;
  name?: string;
  phone?: string;
  email?: string;
  nric?: string;
  occupation?: string;
  dob?: string;
  address?: string;
  addressContinue?: string;
}

interface OldExportData {
  version?: string;
  exportDate?: string;
  type?: 'customers' | 'all_data';
  customers: OldCustomer[];
}

export interface CustomerImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  customers: Array<{
    customer: Omit<CustomerInsert, 'user_id'>;
    guarantors: Omit<GuarantorInsert, 'customer_id'>[];
  }>;
}

/**
 * Parse currency string to number
 * Handles formats like "$185,888", "185888", "185,888.00"
 */
function parseNumber(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return value;

  // Remove currency symbols, commas, and whitespace
  const cleaned = value.toString().replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse date string - only returns valid ISO date format (YYYY-MM-DD)
 * Returns null for non-standard date formats like "NOV/DEC 2025"
 */
function parseDate(value: string | undefined | null): string | null {
  if (!value || value.trim() === '') return null;

  // Check if it's already a valid ISO date (YYYY-MM-DD)
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateRegex.test(value)) {
    return value;
  }

  // Try to parse as a date
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    // Return ISO date string (YYYY-MM-DD)
    return parsed.toISOString().split('T')[0];
  }

  // Not a valid date format (e.g., "NOV/DEC 2025") - return null
  return null;
}

/**
 * Get default checklist state
 */
function getDefaultChecklistState(): ChecklistState {
  return {
    currentMilestone: 'test_drive',
    test_drive: {},
    close_deal: {},
    registration: {},
    delivery: {},
    nps: {},
  };
}

/**
 * Get default milestone dates
 */
function getDefaultMilestoneDates(): MilestoneDates {
  return {
    test_drive: null,
    close_deal: null,
    registration: null,
    delivery: null,
    nps: null,
  };
}

/**
 * Get default document checklist
 */
function getDefaultDocumentChecklist(): DocumentChecklistState {
  return {
    test_drive: {},
    close_deal: {},
    registration: {},
    delivery: {},
    nps: {},
  };
}

/**
 * Convert old CRM customer to new format
 */
function convertCustomer(old: OldCustomer): Omit<CustomerInsert, 'user_id'> {
  // Determine current milestone from checklist
  let currentMilestone = old.checklist?.currentMilestone || 'test_drive';

  // Convert checklist - may have camelCase keys in old format
  let checklist = old.checklist;
  if (checklist && 'testDrive' in checklist) {
    // Convert camelCase milestone keys to snake_case
    checklist = {
      currentMilestone: checklist.currentMilestone || 'test_drive',
      test_drive: (checklist as Record<string, unknown>).testDrive as Record<string, boolean> || {},
      close_deal: (checklist as Record<string, unknown>).closeDeal as Record<string, boolean> || {},
      registration: (checklist as Record<string, unknown>).registration as Record<string, boolean> || {},
      delivery: (checklist as Record<string, unknown>).delivery as Record<string, boolean> || {},
      nps: (checklist as Record<string, unknown>).nps as Record<string, boolean> || {},
    };
  }

  // Convert milestone dates - may have camelCase keys
  let milestoneDates = old.milestoneDates;
  if (milestoneDates && 'testDrive' in milestoneDates) {
    milestoneDates = {
      test_drive: (milestoneDates as Record<string, unknown>).testDrive as string | null || null,
      close_deal: (milestoneDates as Record<string, unknown>).closeDeal as string | null || null,
      registration: milestoneDates.registration || null,
      delivery: milestoneDates.delivery || null,
      nps: milestoneDates.nps || null,
    };
  }

  return {
    // Basic Info
    name: old.name || 'Unnamed Customer',
    phone: old.phone || null,
    email: old.email || null,
    nric: old.nric || null,
    occupation: old.occupation || null,
    dob: old.dob || null,
    license_start_date: old.licenseStartDate || null,
    address: old.address || null,
    address_continue: old.addressContinue || null,
    sales_consultant: old.salesConsultant || null,
    vsa_no: old.vsaNo || null,
    notes: old.notes || null,

    // Status
    archive_status: old.archiveStatus || null,
    archived_at: old.archivedAt || null,
    deal_closed: old.dealClosed || false,
    current_milestone: currentMilestone,

    // VSA Details - Vehicle (old format: vsa_makeModel -> new: vsa_make_model)
    vsa_make_model: old.vsa_makeModel || null,
    vsa_variant: old.vsa_variant || null,
    vsa_yom: old.vsa_yom || null,
    vsa_body_colour: old.vsa_bodyColour || null,
    vsa_upholstery: old.vsa_upholstery || null,
    vsa_prz_type: old.vsa_przType || null,

    // VSA Details - Package
    vsa_package: old.vsa_package || null,
    vsa_selling_price_list: parseNumber(old.vsa_sellingPriceList),
    vsa_purchase_price_with_coe: parseNumber(old.vsa_purchasePriceWithCOE),
    vsa_coe_rebate_level: old.vsa_coeRebateLevel || null,
    vsa_deposit: parseNumber(old.vsa_deposit),
    vsa_less_others: parseNumber(old.vsa_lessOthers),
    vsa_add_others: parseNumber(old.vsa_addOthers),
    vsa_delivery_date: parseDate(old.vsa_deliveryDate),

    // VSA Details - Trade In
    vsa_trade_in_car_no: old.vsa_tradeInCarNo || null,
    vsa_trade_in_car_model: old.vsa_tradeInCarModel || null,
    vsa_trade_in_amount: parseNumber(old.vsa_tradeInAmount),
    vsa_trade_in_settlement_cost: parseNumber(old.vsa_tradeInSettlementCost),
    vsa_number_retention: old.vsa_numberRetention || false,
    vsa_number_retention_fee: parseNumber(old.vsa_numberRetentionFee),
    vsa_trade_in_owner_not_customer: old.vsa_tradeInOwnerNotCustomer || false,
    vsa_trade_in_owner_name: old.vsa_tradeInOwnerName || null,
    vsa_trade_in_owner_nric: old.vsa_tradeInOwnerNric || null,
    vsa_trade_in_owner_mobile: old.vsa_tradeInOwnerMobile || null,
    vsa_trade_in_insurance_company: old.vsa_tradeInInsuranceCompany || null,
    vsa_trade_in_policy_number: old.vsa_tradeInPolicyNumber || null,

    // VSA Details - Delivery
    vsa_date_of_registration: old.vsa_dateOfRegistration || null,
    vsa_registration_no: old.vsa_registrationNo || null,
    vsa_chassis_no: old.vsa_chassisNo || null,
    vsa_engine_no: old.vsa_engineNo || null,
    vsa_motor_no: old.vsa_motorNo || null,

    // VSA Details - Insurance
    vsa_insurance_company: old.vsa_insuranceCompany || null,
    vsa_insurance_fee: parseNumber(old.vsa_insuranceFee),
    vsa_insurance_subsidy: parseNumber(old.vsa_insuranceSubsidy),

    // VSA Details - Loan
    vsa_remarks1: old.vsa_remarks1 || null,
    vsa_remarks2: old.vsa_remarks2 || null,
    vsa_loan_amount: parseNumber(old.vsa_loanAmount),
    vsa_interest: parseNumber(old.vsa_interest),
    vsa_tenure: parseNumber(old.vsa_tenure),
    vsa_admin_fee: parseNumber(old.vsa_adminFee),
    vsa_monthly_repayment: parseNumber(old.vsa_monthlyRepayment),

    // Proposal Details (old format: proposal_sellingPrice -> new: proposal_selling_price)
    proposal_model: old.proposal_model || null,
    proposal_variant: old.proposal_variant || null,
    proposal_color: old.proposal_color || null,
    proposal_bank: old.proposal_bank || null,
    proposal_selling_price: parseNumber(old.proposal_sellingPrice),
    proposal_interest_rate: parseNumber(old.proposal_interestRate),
    proposal_downpayment: parseNumber(old.proposal_downpayment),
    proposal_loan_tenure: parseNumber(old.proposal_loanTenure),
    proposal_loan_amount: parseNumber(old.proposal_loanAmount),
    proposal_admin_fee: parseNumber(old.proposal_adminFee),
    proposal_referral_fee: parseNumber(old.proposal_referralFee),
    proposal_trade_in_model: old.proposal_tradeInModel || null,
    proposal_low_loan_surcharge: parseNumber(old.proposal_lowLoanSurcharge),
    proposal_trade_in_car_plate: old.proposal_tradeInCarPlate || null,
    proposal_no_loan_surcharge: parseNumber(old.proposal_noLoanSurcharge),
    proposal_quoted_trade_in_price: parseNumber(old.proposal_quotedTradeInPrice),
    proposal_benefit1: old.proposal_benefit1 || null,
    proposal_benefit2: old.proposal_benefit2 || null,
    proposal_benefit3: old.proposal_benefit3 || null,
    proposal_benefit4: old.proposal_benefit4 || null,
    proposal_benefit5: old.proposal_benefit5 || null,
    proposal_benefit6: old.proposal_benefit6 || null,
    proposal_benefit7: old.proposal_benefit7 || null,
    proposal_benefit8: old.proposal_benefit8 || null,
    proposal_benefit9: old.proposal_benefit9 || null,
    proposal_benefits_given: old.proposal_benefitsGiven || null,
    proposal_remarks: old.proposal_remarks || null,

    // JSONB Fields
    checklist: checklist || getDefaultChecklistState(),
    milestone_dates: milestoneDates || getDefaultMilestoneDates(),
    document_checklist: old.documentChecklist || getDefaultDocumentChecklist(),
  };
}

/**
 * Convert old guarantor to new format
 */
function convertGuarantor(old: OldGuarantor, position: 1 | 2 | 3 | 4 | 5): Omit<GuarantorInsert, 'customer_id'> {
  return {
    position,
    name: old.name || '',
    phone: old.phone || null,
    email: old.email || null,
    nric: old.nric || null,
    occupation: old.occupation || null,
    dob: old.dob || null,
    address: old.address || null,
    address_continue: old.addressContinue || null,
  };
}

/**
 * Extract guarantors from old customer data
 */
function extractGuarantors(old: OldCustomer): Omit<GuarantorInsert, 'customer_id'>[] {
  const guarantors: Omit<GuarantorInsert, 'customer_id'>[] = [];

  // Check for guarantors array
  if (old.guarantors && Array.isArray(old.guarantors)) {
    old.guarantors.forEach((g, index) => {
      if (g.name) {
        const position = (g.position || index + 1) as 1 | 2 | 3 | 4 | 5;
        guarantors.push(convertGuarantor(g, position));
      }
    });
  }

  // Check for individual guarantor fields (guarantor1, guarantor2, etc.)
  const guarantorFields = [
    { field: old.guarantor1, position: 1 },
    { field: old.guarantor2, position: 2 },
    { field: old.guarantor3, position: 3 },
    { field: old.guarantor4, position: 4 },
    { field: old.guarantor5, position: 5 },
  ] as const;

  for (const { field, position } of guarantorFields) {
    if (field && field.name) {
      guarantors.push(convertGuarantor(field, position));
    }
  }

  return guarantors;
}

/**
 * Parse import file (JSON)
 */
export async function parseCustomerImportFile(file: File): Promise<OldExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);

        // Handle different export formats
        if (Array.isArray(data)) {
          // Direct array of customers
          resolve({ customers: data });
        } else if (data.customers && Array.isArray(data.customers)) {
          // Wrapped format with metadata
          resolve(data);
        } else {
          reject(new Error('Invalid customer data format'));
        }
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Convert old CRM customers to new format
 */
export function convertCustomers(data: OldExportData): CustomerImportResult {
  const result: CustomerImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
    customers: [],
  };

  if (!data.customers || !Array.isArray(data.customers)) {
    result.success = false;
    result.errors.push('No customers found in import file');
    return result;
  }

  for (const oldCustomer of data.customers) {
    try {
      // Skip customers without a name
      if (!oldCustomer.name || oldCustomer.name.trim() === '') {
        result.skipped++;
        continue;
      }

      const customer = convertCustomer(oldCustomer);
      const guarantors = extractGuarantors(oldCustomer);

      result.customers.push({ customer, guarantors });
      result.imported++;
    } catch (err) {
      result.errors.push(`Failed to convert customer "${oldCustomer.name || 'Unknown'}": ${(err as Error).message}`);
    }
  }

  if (result.customers.length === 0 && result.errors.length > 0) {
    result.success = false;
  }

  return result;
}

/**
 * Main import function
 */
export async function importCustomersFromFile(file: File): Promise<CustomerImportResult> {
  try {
    const data = await parseCustomerImportFile(file);
    return convertCustomers(data);
  } catch (err) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [(err as Error).message],
      customers: [],
    };
  }
}

/**
 * Export customers to JSON format for backup
 */
export function exportCustomersToJSON(customers: Customer[], guarantorsMap: Record<number, Guarantor[]>): string {
  const exportData = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    type: 'customers',
    count: customers.length,
    customers: customers.map(customer => ({
      ...customer,
      guarantors: guarantorsMap[customer.id] || [],
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Download JSON as file
 */
export function downloadJSON(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
