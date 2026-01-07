/**
 * Excel Field Type Definitions
 *
 * Defines all 176 customer fields that can be mapped to Excel cells.
 * Fields are organized by category for easy selection in the UI.
 */

export interface FieldType {
  label: string;
  category: string;
}

export const FIELD_TYPES: Record<string, FieldType> = {
  // Basic Customer Information (12 fields)
  name: { label: 'Customer Name', category: 'Basic Info' },
  phone: { label: 'Phone Number', category: 'Basic Info' },
  email: { label: 'Email', category: 'Basic Info' },
  nric: { label: 'NRIC/FIN', category: 'Basic Info' },
  occupation: { label: 'Occupation', category: 'Basic Info' },
  dob: { label: 'Date of Birth', category: 'Basic Info' },
  address: { label: 'Address', category: 'Basic Info' },
  addressContinue: { label: 'Address Continue', category: 'Basic Info' },
  fullAddress: { label: 'Full Address (Combined)', category: 'Basic Info' },
  salesConsultant: { label: 'Sales Consultant', category: 'Basic Info' },
  vsaNo: { label: 'VSA No', category: 'Basic Info' },
  date: { label: "Today's Date", category: 'Basic Info' },

  // Vehicle Details (5 fields)
  makeModel: { label: 'Make & Model', category: 'Vehicle Details' },
  yom: { label: 'Year of Manufacture', category: 'Vehicle Details' },
  bodyColour: { label: 'Body Colour', category: 'Vehicle Details' },
  upholstery: { label: 'Upholstery', category: 'Vehicle Details' },
  przType: { label: 'P/R/Z Type', category: 'Vehicle Details' },

  // Vehicle Package (8 fields)
  package: { label: 'Package', category: 'Vehicle Package' },
  sellingPriceList: { label: 'Selling Price on Price List', category: 'Vehicle Package' },
  purchasePriceWithCOE: { label: 'Purchase Price with COE', category: 'Vehicle Package' },
  coeRebateLevel: { label: 'COE Rebate Level', category: 'Vehicle Package' },
  deposit: { label: 'Deposit', category: 'Vehicle Package' },
  lessOthers: { label: 'Less: Others', category: 'Vehicle Package' },
  addOthers: { label: 'Add: Others', category: 'Vehicle Package' },
  deliveryDate: { label: 'Approximate Delivery Date', category: 'Vehicle Package' },

  // Trade-In Details (15 fields)
  tradeInCarNo: { label: 'Trade in Car No', category: 'Trade-In' },
  tradeInCarModel: { label: 'Trade in Car Model', category: 'Trade-In' },
  tradeInAmount: { label: 'Trade In Amount', category: 'Trade-In' },
  tradeInSettlementCost: { label: 'Settlement Cost', category: 'Trade-In' },
  numberRetention: { label: 'Number Retention', category: 'Trade-In' },
  numberRetentionFee: { label: 'Number Retention Fee', category: 'Trade-In' },
  tradeInOwnerNotCustomer: { label: 'Trade In Owner Not Customer', category: 'Trade-In' },
  tradeInOwnerName: { label: 'Trade In Owner Name', category: 'Trade-In' },
  tradeInOwnerNric: { label: 'Trade In Owner NRIC', category: 'Trade-In' },
  tradeInOwnerMobile: { label: 'Trade In Owner Mobile', category: 'Trade-In' },
  tradeInInsuranceCompany: { label: 'Trade In Insurance Company', category: 'Trade-In' },
  tradeInPolicyNumber: { label: 'Trade In Policy Number', category: 'Trade-In' },
  tradeInNameAuto: { label: 'Trade In Name (Auto)', category: 'Trade-In' },
  tradeInNricAuto: { label: 'Trade In NRIC (Auto)', category: 'Trade-In' },
  tradeInMobileAuto: { label: 'Trade In Mobile (Auto)', category: 'Trade-In' },

  // Delivery Details (5 fields)
  dateOfRegistration: { label: 'Date of Registration', category: 'Delivery' },
  registrationNo: { label: 'Registration No', category: 'Delivery' },
  chassisNo: { label: 'Chassis No', category: 'Delivery' },
  engineNo: { label: 'Engine No', category: 'Delivery' },
  motorNo: { label: 'Motor No', category: 'Delivery' },

  // Insurance (3 fields)
  insuranceCompany: { label: 'Insurance Company', category: 'Insurance' },
  insuranceFee: { label: 'Insurance Fee', category: 'Insurance' },
  insuranceFeeNet: { label: 'Net Insurance Fee', category: 'Insurance' },

  // Remarks & Loan (9 fields)
  remarks1: { label: 'Remarks 1', category: 'Remarks & Loan' },
  remarks2: { label: 'Remarks 2', category: 'Remarks & Loan' },
  loanAmount: { label: 'Loan Amount', category: 'Remarks & Loan' },
  interest: { label: 'Interest', category: 'Remarks & Loan' },
  tenure: { label: 'Tenure', category: 'Remarks & Loan' },
  adminFee: { label: 'Admin Fee', category: 'Remarks & Loan' },
  insuranceSubsidy: { label: 'Insurance Subsidy', category: 'Remarks & Loan' },
  monthlyRepayment: { label: 'Monthly Repayment', category: 'Remarks & Loan' },
  loanSummary: { label: 'Loan Summary (Combined)', category: 'Remarks & Loan' },

  // Invoice (1 field)
  invoiceInstallmentConditional: { label: 'Invoice Installment (if interest > 2.5%)', category: 'Invoice' },

  // Proposal Details (25 fields)
  proposalModel: { label: 'Model', category: 'Proposal' },
  proposalBank: { label: 'Bank', category: 'Proposal' },
  proposalSellingPrice: { label: 'Selling Price', category: 'Proposal' },
  proposalInterestRate: { label: 'Interest Rate', category: 'Proposal' },
  proposalDownpayment: { label: 'Downpayment', category: 'Proposal' },
  proposalLoanTenure: { label: 'Loan Tenure', category: 'Proposal' },
  proposalLoanAmount: { label: 'Loan Amount', category: 'Proposal' },
  proposalAdminFee: { label: 'Admin Fee', category: 'Proposal' },
  proposalReferralFee: { label: 'Referral Fee', category: 'Proposal' },
  proposalTradeInModel: { label: 'Trade In Model', category: 'Proposal' },
  proposalLowLoanSurcharge: { label: 'Low Loan Surcharge', category: 'Proposal' },
  proposalTradeInCarPlate: { label: 'Trade In Car Plate', category: 'Proposal' },
  proposalNoLoanSurcharge: { label: 'No Loan Surcharge', category: 'Proposal' },
  proposalQuotedTradeInPrice: { label: 'Quoted Trade In Price', category: 'Proposal' },
  proposalBenefit1: { label: 'Benefit 1', category: 'Proposal' },
  proposalBenefit2: { label: 'Benefit 2', category: 'Proposal' },
  proposalBenefit3: { label: 'Benefit 3', category: 'Proposal' },
  proposalBenefit4: { label: 'Benefit 4', category: 'Proposal' },
  proposalBenefit5: { label: 'Benefit 5', category: 'Proposal' },
  proposalBenefit6: { label: 'Benefit 6', category: 'Proposal' },
  proposalBenefit7: { label: 'Benefit 7', category: 'Proposal' },
  proposalBenefit8: { label: 'Benefit 8', category: 'Proposal' },
  proposalBenefit9: { label: 'Benefit 9', category: 'Proposal' },
  proposalBenefitsGiven: { label: 'Benefits Given', category: 'Proposal' },
  proposalRemarks: { label: 'Remarks', category: 'Proposal' },

  // Guarantor 1 (8 fields)
  guarantor1Name: { label: 'Guarantor 1 Name', category: 'Guarantor 1' },
  guarantor1Phone: { label: 'Guarantor 1 Phone', category: 'Guarantor 1' },
  guarantor1Email: { label: 'Guarantor 1 Email', category: 'Guarantor 1' },
  guarantor1Nric: { label: 'Guarantor 1 NRIC', category: 'Guarantor 1' },
  guarantor1Occupation: { label: 'Guarantor 1 Occupation', category: 'Guarantor 1' },
  guarantor1Dob: { label: 'Guarantor 1 DOB', category: 'Guarantor 1' },
  guarantor1Address: { label: 'Guarantor 1 Address', category: 'Guarantor 1' },
  guarantor1AddressContinue: { label: 'Guarantor 1 Address Continue', category: 'Guarantor 1' },

  // Guarantor 2 (8 fields)
  guarantor2Name: { label: 'Guarantor 2 Name', category: 'Guarantor 2' },
  guarantor2Phone: { label: 'Guarantor 2 Phone', category: 'Guarantor 2' },
  guarantor2Email: { label: 'Guarantor 2 Email', category: 'Guarantor 2' },
  guarantor2Nric: { label: 'Guarantor 2 NRIC', category: 'Guarantor 2' },
  guarantor2Occupation: { label: 'Guarantor 2 Occupation', category: 'Guarantor 2' },
  guarantor2Dob: { label: 'Guarantor 2 DOB', category: 'Guarantor 2' },
  guarantor2Address: { label: 'Guarantor 2 Address', category: 'Guarantor 2' },
  guarantor2AddressContinue: { label: 'Guarantor 2 Address Continue', category: 'Guarantor 2' },

  // Guarantor 3 (8 fields)
  guarantor3Name: { label: 'Guarantor 3 Name', category: 'Guarantor 3' },
  guarantor3Phone: { label: 'Guarantor 3 Phone', category: 'Guarantor 3' },
  guarantor3Email: { label: 'Guarantor 3 Email', category: 'Guarantor 3' },
  guarantor3Nric: { label: 'Guarantor 3 NRIC', category: 'Guarantor 3' },
  guarantor3Occupation: { label: 'Guarantor 3 Occupation', category: 'Guarantor 3' },
  guarantor3Dob: { label: 'Guarantor 3 DOB', category: 'Guarantor 3' },
  guarantor3Address: { label: 'Guarantor 3 Address', category: 'Guarantor 3' },
  guarantor3AddressContinue: { label: 'Guarantor 3 Address Continue', category: 'Guarantor 3' },

  // Guarantor 4 (8 fields)
  guarantor4Name: { label: 'Guarantor 4 Name', category: 'Guarantor 4' },
  guarantor4Phone: { label: 'Guarantor 4 Phone', category: 'Guarantor 4' },
  guarantor4Email: { label: 'Guarantor 4 Email', category: 'Guarantor 4' },
  guarantor4Nric: { label: 'Guarantor 4 NRIC', category: 'Guarantor 4' },
  guarantor4Occupation: { label: 'Guarantor 4 Occupation', category: 'Guarantor 4' },
  guarantor4Dob: { label: 'Guarantor 4 DOB', category: 'Guarantor 4' },
  guarantor4Address: { label: 'Guarantor 4 Address', category: 'Guarantor 4' },
  guarantor4AddressContinue: { label: 'Guarantor 4 Address Continue', category: 'Guarantor 4' },

  // Guarantor 5 (8 fields)
  guarantor5Name: { label: 'Guarantor 5 Name', category: 'Guarantor 5' },
  guarantor5Phone: { label: 'Guarantor 5 Phone', category: 'Guarantor 5' },
  guarantor5Email: { label: 'Guarantor 5 Email', category: 'Guarantor 5' },
  guarantor5Nric: { label: 'Guarantor 5 NRIC', category: 'Guarantor 5' },
  guarantor5Occupation: { label: 'Guarantor 5 Occupation', category: 'Guarantor 5' },
  guarantor5Dob: { label: 'Guarantor 5 DOB', category: 'Guarantor 5' },
  guarantor5Address: { label: 'Guarantor 5 Address', category: 'Guarantor 5' },
  guarantor5AddressContinue: { label: 'Guarantor 5 Address Continue', category: 'Guarantor 5' },

  // Special
  _custom: { label: 'Custom Value', category: 'Other' },
};

/**
 * Fields that should be treated as currency/numeric values in Excel
 */
export const CURRENCY_FIELDS = new Set([
  // VSA - Pricing & Deposit
  'sellingPriceList',
  'purchasePriceWithCOE',
  'coeRebateLevel',
  'deposit',
  'lessOthers',
  'addOthers',
  // VSA - Trade-In
  'tradeInAmount',
  'tradeInSettlementCost',
  'numberRetentionFee',
  // VSA - Insurance
  'insuranceFee',
  'insuranceFeeNet',
  'insuranceSubsidy',
  // VSA - Loan
  'loanAmount',
  'adminFee',
  'monthlyRepayment',
  'invoiceInstallmentConditional',
  // Proposal - Pricing
  'proposalSellingPrice',
  'proposalDownpayment',
  'proposalLoanAmount',
  'proposalAdminFee',
  'proposalReferralFee',
  'proposalLowLoanSurcharge',
  'proposalNoLoanSurcharge',
  'proposalQuotedTradeInPrice',
]);

/**
 * Fields that should be treated as percentage values in Excel
 */
export const PERCENTAGE_FIELDS = new Set([
  'interest',
  'proposalInterestRate',
]);

/**
 * Get field types grouped by category
 */
export function getFieldTypesByCategory(): Record<string, { key: string; label: string }[]> {
  const grouped: Record<string, { key: string; label: string }[]> = {};

  Object.entries(FIELD_TYPES).forEach(([key, value]) => {
    const category = value.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push({ key, label: value.label });
  });

  return grouped;
}

/**
 * Get field display label
 */
export function getFieldLabel(fieldType: string): string {
  return FIELD_TYPES[fieldType]?.label || fieldType;
}

/**
 * Category order for display
 */
export const CATEGORY_ORDER = [
  'Basic Info',
  'Vehicle Details',
  'Vehicle Package',
  'Trade-In',
  'Delivery',
  'Insurance',
  'Remarks & Loan',
  'Invoice',
  'Proposal',
  'Guarantor 1',
  'Guarantor 2',
  'Guarantor 3',
  'Guarantor 4',
  'Guarantor 5',
  'Other',
];
