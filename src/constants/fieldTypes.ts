/**
 * Field Types Configuration
 * Defines all available field types for document and Excel mapping
 */

export interface FieldType {
  label: string
  category: string
  defaultWidth?: number
  defaultHeight?: number
}

export const FIELD_TYPES: Record<string, FieldType> = {
  // Basic Customer Information
  name: { label: 'Customer Name', category: 'Basic Info', defaultWidth: 200, defaultHeight: 30 },
  phone: { label: 'Phone Number', category: 'Basic Info', defaultWidth: 150, defaultHeight: 30 },
  email: { label: 'Email', category: 'Basic Info', defaultWidth: 220, defaultHeight: 30 },
  nric: { label: 'NRIC/FIN', category: 'Basic Info', defaultWidth: 120, defaultHeight: 30 },
  occupation: { label: 'Occupation', category: 'Basic Info', defaultWidth: 180, defaultHeight: 30 },
  dob: { label: 'Date of Birth', category: 'Basic Info', defaultWidth: 120, defaultHeight: 30 },
  address: { label: 'Address', category: 'Basic Info', defaultWidth: 350, defaultHeight: 30 },
  addressContinue: {
    label: 'Address Continue',
    category: 'Basic Info',
    defaultWidth: 200,
    defaultHeight: 30,
  },
  fullAddress: {
    label: 'Full Address (Combined)',
    category: 'Basic Info',
    defaultWidth: 400,
    defaultHeight: 50,
  },
  salesConsultant: {
    label: 'Sales Consultant',
    category: 'Basic Info',
    defaultWidth: 150,
    defaultHeight: 30,
  },
  vsaNo: { label: 'VSA No', category: 'Basic Info', defaultWidth: 150, defaultHeight: 30 },
  date: { label: "Today's Date", category: 'Basic Info', defaultWidth: 120, defaultHeight: 30 },

  // VSA Details - BYD New Car Details
  makeModel: {
    label: 'Make & Model',
    category: 'Vehicle Details',
    defaultWidth: 200,
    defaultHeight: 30,
  },
  yom: {
    label: 'Year of Manufacture',
    category: 'Vehicle Details',
    defaultWidth: 80,
    defaultHeight: 30,
  },
  bodyColour: {
    label: 'Body Colour',
    category: 'Vehicle Details',
    defaultWidth: 150,
    defaultHeight: 30,
  },
  upholstery: {
    label: 'Upholstery',
    category: 'Vehicle Details',
    defaultWidth: 150,
    defaultHeight: 30,
  },
  przType: {
    label: 'P/R/Z Type',
    category: 'Vehicle Details',
    defaultWidth: 60,
    defaultHeight: 30,
  },

  // VSA Details - BYD New Car Package
  package: { label: 'Package', category: 'Vehicle Package', defaultWidth: 150, defaultHeight: 30 },
  sellingPriceList: {
    label: 'Selling Price on Price List',
    category: 'Vehicle Package',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  purchasePriceWithCOE: {
    label: 'Purchase Price with COE',
    category: 'Vehicle Package',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  coeRebateLevel: {
    label: 'COE Rebate Level',
    category: 'Vehicle Package',
    defaultWidth: 100,
    defaultHeight: 30,
  },
  deposit: { label: 'Deposit', category: 'Vehicle Package', defaultWidth: 100, defaultHeight: 30 },
  lessOthers: {
    label: 'Less: Others',
    category: 'Vehicle Package',
    defaultWidth: 100,
    defaultHeight: 30,
  },
  addOthers: {
    label: 'Add: Others',
    category: 'Vehicle Package',
    defaultWidth: 100,
    defaultHeight: 30,
  },
  deliveryDate: {
    label: 'Approximate Delivery Date',
    category: 'Vehicle Package',
    defaultWidth: 150,
    defaultHeight: 30,
  },

  // VSA Details - Trade In Car Details
  tradeInCarNo: {
    label: 'Trade in Car No',
    category: 'Trade-In',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  tradeInCarModel: {
    label: 'Trade in Car Model',
    category: 'Trade-In',
    defaultWidth: 200,
    defaultHeight: 30,
  },
  tradeInAmount: {
    label: 'Trade In Amount',
    category: 'Trade-In',
    defaultWidth: 100,
    defaultHeight: 30,
  },
  tradeInSettlementCost: {
    label: 'Settlement Cost',
    category: 'Trade-In',
    defaultWidth: 100,
    defaultHeight: 30,
  },
  numberRetention: {
    label: 'Number Retention',
    category: 'Trade-In',
    defaultWidth: 80,
    defaultHeight: 30,
  },
  numberRetentionFee: {
    label: 'Number Retention Fee',
    category: 'Trade-In',
    defaultWidth: 100,
    defaultHeight: 30,
  },
  tradeInOwnerNotCustomer: {
    label: 'Trade In Owner Not Customer',
    category: 'Trade-In',
    defaultWidth: 80,
    defaultHeight: 30,
  },
  tradeInOwnerName: {
    label: 'Trade In Owner Name',
    category: 'Trade-In',
    defaultWidth: 200,
    defaultHeight: 30,
  },
  tradeInOwnerNric: {
    label: 'Trade In Owner NRIC',
    category: 'Trade-In',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  tradeInOwnerMobile: {
    label: 'Trade In Owner Mobile',
    category: 'Trade-In',
    defaultWidth: 150,
    defaultHeight: 30,
  },
  tradeInInsuranceCompany: {
    label: 'Trade In Insurance Company',
    category: 'Trade-In',
    defaultWidth: 180,
    defaultHeight: 30,
  },
  tradeInPolicyNumber: {
    label: 'Trade In Policy Number',
    category: 'Trade-In',
    defaultWidth: 150,
    defaultHeight: 30,
  },
  tradeInNameAuto: {
    label: 'Trade In Name (Auto)',
    category: 'Trade-In',
    defaultWidth: 200,
    defaultHeight: 30,
  },
  tradeInNricAuto: {
    label: 'Trade In NRIC (Auto)',
    category: 'Trade-In',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  tradeInMobileAuto: {
    label: 'Trade In Mobile (Auto)',
    category: 'Trade-In',
    defaultWidth: 150,
    defaultHeight: 30,
  },

  // VSA Details - Delivery Details
  dateOfRegistration: {
    label: 'Date of Registration',
    category: 'Delivery',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  registrationNo: {
    label: 'Registration No',
    category: 'Delivery',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  chassisNo: { label: 'Chassis No', category: 'Delivery', defaultWidth: 200, defaultHeight: 30 },
  engineNo: { label: 'Engine No', category: 'Delivery', defaultWidth: 150, defaultHeight: 30 },
  motorNo: { label: 'Motor No', category: 'Delivery', defaultWidth: 150, defaultHeight: 30 },

  // VSA Details - Insurance
  insuranceCompany: {
    label: 'Insurance Company',
    category: 'Insurance',
    defaultWidth: 180,
    defaultHeight: 30,
  },
  insuranceFee: {
    label: 'Insurance Fee',
    category: 'Insurance',
    defaultWidth: 100,
    defaultHeight: 30,
  },
  insuranceFeeNet: {
    label: 'Net Insurance Fee',
    category: 'Insurance',
    defaultWidth: 100,
    defaultHeight: 30,
  },

  // VSA Details - Remarks
  remarks1: {
    label: 'Remarks 1',
    category: 'Remarks & Loan',
    defaultWidth: 350,
    defaultHeight: 50,
  },
  remarks2: {
    label: 'Remarks 2',
    category: 'Remarks & Loan',
    defaultWidth: 350,
    defaultHeight: 50,
  },
  loanAmount: {
    label: 'Loan Amount',
    category: 'Remarks & Loan',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  interest: { label: 'Interest', category: 'Remarks & Loan', defaultWidth: 80, defaultHeight: 30 },
  tenure: { label: 'Tenure', category: 'Remarks & Loan', defaultWidth: 80, defaultHeight: 30 },
  adminFee: {
    label: 'Admin Fee',
    category: 'Remarks & Loan',
    defaultWidth: 100,
    defaultHeight: 30,
  },
  insuranceSubsidy: {
    label: 'Insurance Subsidy',
    category: 'Remarks & Loan',
    defaultWidth: 100,
    defaultHeight: 30,
  },
  monthlyRepayment: {
    label: 'Monthly Repayment',
    category: 'Remarks & Loan',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  loanSummary: {
    label: 'Loan Summary (Combined)',
    category: 'Remarks & Loan',
    defaultWidth: 400,
    defaultHeight: 60,
  },
  invoiceInstallmentConditional: {
    label: 'Invoice Installment (if interest > 2.5%)',
    category: 'Invoice',
    defaultWidth: 120,
    defaultHeight: 30,
  },

  // Proposal Details
  proposalModel: { label: 'Model', category: 'Proposal', defaultWidth: 200, defaultHeight: 30 },
  proposalBank: { label: 'Bank', category: 'Proposal', defaultWidth: 150, defaultHeight: 30 },
  proposalSellingPrice: {
    label: 'Selling Price',
    category: 'Proposal',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  proposalInterestRate: {
    label: 'Interest Rate',
    category: 'Proposal',
    defaultWidth: 80,
    defaultHeight: 30,
  },
  proposalDownpayment: {
    label: 'Downpayment',
    category: 'Proposal',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  proposalLoanTenure: {
    label: 'Loan Tenure',
    category: 'Proposal',
    defaultWidth: 80,
    defaultHeight: 30,
  },
  proposalLoanAmount: {
    label: 'Loan Amount',
    category: 'Proposal',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  proposalAdminFee: {
    label: 'Admin Fee',
    category: 'Proposal',
    defaultWidth: 100,
    defaultHeight: 30,
  },
  proposalReferralFee: {
    label: 'Referral Fee',
    category: 'Proposal',
    defaultWidth: 100,
    defaultHeight: 30,
  },
  proposalTradeInModel: {
    label: 'Trade In Model',
    category: 'Proposal',
    defaultWidth: 200,
    defaultHeight: 30,
  },
  proposalLowLoanSurcharge: {
    label: 'Low Loan Surcharge',
    category: 'Proposal',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  proposalTradeInCarPlate: {
    label: 'Trade In Car Plate',
    category: 'Proposal',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  proposalNoLoanSurcharge: {
    label: 'No Loan Surcharge',
    category: 'Proposal',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  proposalQuotedTradeInPrice: {
    label: 'Quoted Trade In Price',
    category: 'Proposal',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  proposalBenefit1: {
    label: 'Benefit 1',
    category: 'Proposal',
    defaultWidth: 250,
    defaultHeight: 30,
  },
  proposalBenefit2: {
    label: 'Benefit 2',
    category: 'Proposal',
    defaultWidth: 250,
    defaultHeight: 30,
  },
  proposalBenefit3: {
    label: 'Benefit 3',
    category: 'Proposal',
    defaultWidth: 250,
    defaultHeight: 30,
  },
  proposalBenefit4: {
    label: 'Benefit 4',
    category: 'Proposal',
    defaultWidth: 250,
    defaultHeight: 30,
  },
  proposalBenefit5: {
    label: 'Benefit 5',
    category: 'Proposal',
    defaultWidth: 250,
    defaultHeight: 30,
  },
  proposalBenefit6: {
    label: 'Benefit 6',
    category: 'Proposal',
    defaultWidth: 250,
    defaultHeight: 30,
  },
  proposalBenefit7: {
    label: 'Benefit 7',
    category: 'Proposal',
    defaultWidth: 250,
    defaultHeight: 30,
  },
  proposalBenefit8: {
    label: 'Benefit 8',
    category: 'Proposal',
    defaultWidth: 250,
    defaultHeight: 30,
  },
  proposalBenefit9: {
    label: 'Benefit 9',
    category: 'Proposal',
    defaultWidth: 250,
    defaultHeight: 30,
  },
  proposalBenefitsGiven: {
    label: 'Benefits Given',
    category: 'Proposal',
    defaultWidth: 350,
    defaultHeight: 50,
  },
  proposalRemarks: { label: 'Remarks', category: 'Proposal', defaultWidth: 350, defaultHeight: 50 },

  // Guarantor 1
  guarantor1Name: {
    label: 'Guarantor 1 Name',
    category: 'Guarantor 1',
    defaultWidth: 200,
    defaultHeight: 30,
  },
  guarantor1Phone: {
    label: 'Guarantor 1 Phone',
    category: 'Guarantor 1',
    defaultWidth: 150,
    defaultHeight: 30,
  },
  guarantor1Email: {
    label: 'Guarantor 1 Email',
    category: 'Guarantor 1',
    defaultWidth: 220,
    defaultHeight: 30,
  },
  guarantor1Nric: {
    label: 'Guarantor 1 NRIC',
    category: 'Guarantor 1',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  guarantor1Occupation: {
    label: 'Guarantor 1 Occupation',
    category: 'Guarantor 1',
    defaultWidth: 180,
    defaultHeight: 30,
  },
  guarantor1Dob: {
    label: 'Guarantor 1 DOB',
    category: 'Guarantor 1',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  guarantor1Address: {
    label: 'Guarantor 1 Address',
    category: 'Guarantor 1',
    defaultWidth: 350,
    defaultHeight: 30,
  },
  guarantor1AddressContinue: {
    label: 'Guarantor 1 Address Continue',
    category: 'Guarantor 1',
    defaultWidth: 200,
    defaultHeight: 30,
  },

  // Guarantor 2
  guarantor2Name: {
    label: 'Guarantor 2 Name',
    category: 'Guarantor 2',
    defaultWidth: 200,
    defaultHeight: 30,
  },
  guarantor2Phone: {
    label: 'Guarantor 2 Phone',
    category: 'Guarantor 2',
    defaultWidth: 150,
    defaultHeight: 30,
  },
  guarantor2Email: {
    label: 'Guarantor 2 Email',
    category: 'Guarantor 2',
    defaultWidth: 220,
    defaultHeight: 30,
  },
  guarantor2Nric: {
    label: 'Guarantor 2 NRIC',
    category: 'Guarantor 2',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  guarantor2Occupation: {
    label: 'Guarantor 2 Occupation',
    category: 'Guarantor 2',
    defaultWidth: 180,
    defaultHeight: 30,
  },
  guarantor2Dob: {
    label: 'Guarantor 2 DOB',
    category: 'Guarantor 2',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  guarantor2Address: {
    label: 'Guarantor 2 Address',
    category: 'Guarantor 2',
    defaultWidth: 350,
    defaultHeight: 30,
  },
  guarantor2AddressContinue: {
    label: 'Guarantor 2 Address Continue',
    category: 'Guarantor 2',
    defaultWidth: 200,
    defaultHeight: 30,
  },

  // Guarantor 3
  guarantor3Name: {
    label: 'Guarantor 3 Name',
    category: 'Guarantor 3',
    defaultWidth: 200,
    defaultHeight: 30,
  },
  guarantor3Phone: {
    label: 'Guarantor 3 Phone',
    category: 'Guarantor 3',
    defaultWidth: 150,
    defaultHeight: 30,
  },
  guarantor3Email: {
    label: 'Guarantor 3 Email',
    category: 'Guarantor 3',
    defaultWidth: 220,
    defaultHeight: 30,
  },
  guarantor3Nric: {
    label: 'Guarantor 3 NRIC',
    category: 'Guarantor 3',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  guarantor3Occupation: {
    label: 'Guarantor 3 Occupation',
    category: 'Guarantor 3',
    defaultWidth: 180,
    defaultHeight: 30,
  },
  guarantor3Dob: {
    label: 'Guarantor 3 DOB',
    category: 'Guarantor 3',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  guarantor3Address: {
    label: 'Guarantor 3 Address',
    category: 'Guarantor 3',
    defaultWidth: 350,
    defaultHeight: 30,
  },
  guarantor3AddressContinue: {
    label: 'Guarantor 3 Address Continue',
    category: 'Guarantor 3',
    defaultWidth: 200,
    defaultHeight: 30,
  },

  // Guarantor 4
  guarantor4Name: {
    label: 'Guarantor 4 Name',
    category: 'Guarantor 4',
    defaultWidth: 200,
    defaultHeight: 30,
  },
  guarantor4Phone: {
    label: 'Guarantor 4 Phone',
    category: 'Guarantor 4',
    defaultWidth: 150,
    defaultHeight: 30,
  },
  guarantor4Email: {
    label: 'Guarantor 4 Email',
    category: 'Guarantor 4',
    defaultWidth: 220,
    defaultHeight: 30,
  },
  guarantor4Nric: {
    label: 'Guarantor 4 NRIC',
    category: 'Guarantor 4',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  guarantor4Occupation: {
    label: 'Guarantor 4 Occupation',
    category: 'Guarantor 4',
    defaultWidth: 180,
    defaultHeight: 30,
  },
  guarantor4Dob: {
    label: 'Guarantor 4 DOB',
    category: 'Guarantor 4',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  guarantor4Address: {
    label: 'Guarantor 4 Address',
    category: 'Guarantor 4',
    defaultWidth: 350,
    defaultHeight: 30,
  },
  guarantor4AddressContinue: {
    label: 'Guarantor 4 Address Continue',
    category: 'Guarantor 4',
    defaultWidth: 200,
    defaultHeight: 30,
  },

  // Guarantor 5
  guarantor5Name: {
    label: 'Guarantor 5 Name',
    category: 'Guarantor 5',
    defaultWidth: 200,
    defaultHeight: 30,
  },
  guarantor5Phone: {
    label: 'Guarantor 5 Phone',
    category: 'Guarantor 5',
    defaultWidth: 150,
    defaultHeight: 30,
  },
  guarantor5Email: {
    label: 'Guarantor 5 Email',
    category: 'Guarantor 5',
    defaultWidth: 220,
    defaultHeight: 30,
  },
  guarantor5Nric: {
    label: 'Guarantor 5 NRIC',
    category: 'Guarantor 5',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  guarantor5Occupation: {
    label: 'Guarantor 5 Occupation',
    category: 'Guarantor 5',
    defaultWidth: 180,
    defaultHeight: 30,
  },
  guarantor5Dob: {
    label: 'Guarantor 5 DOB',
    category: 'Guarantor 5',
    defaultWidth: 120,
    defaultHeight: 30,
  },
  guarantor5Address: {
    label: 'Guarantor 5 Address',
    category: 'Guarantor 5',
    defaultWidth: 350,
    defaultHeight: 30,
  },
  guarantor5AddressContinue: {
    label: 'Guarantor 5 Address Continue',
    category: 'Guarantor 5',
    defaultWidth: 200,
    defaultHeight: 30,
  },

  // Special
  custom: { label: 'Custom Value', category: 'Other', defaultWidth: 200, defaultHeight: 30 },
}

/**
 * Get field types grouped by category
 */
export function getFieldTypesByCategory(): Record<string, ({ key: string } & FieldType)[]> {
  const grouped: Record<string, ({ key: string } & FieldType)[]> = {}

  Object.entries(FIELD_TYPES).forEach(([key, value]) => {
    const category = value.category
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push({ key, ...value })
  })

  return grouped
}

/**
 * Get field display name
 */
export function getFieldLabel(fieldType: string): string {
  return FIELD_TYPES[fieldType]?.label || fieldType
}

/**
 * Get default size for a field type
 */
export function getFieldDefaultSize(fieldType: string): { width: number; height: number } {
  const field = FIELD_TYPES[fieldType]
  return {
    width: field?.defaultWidth ?? 500,
    height: field?.defaultHeight ?? 50,
  }
}

/**
 * Get example data for field preview in editor
 */
export function getFieldExampleData(fieldType: string): string {
  const examples: Record<string, string> = {
    // Basic Info
    name: 'John Tan Wei Ming',
    phone: '+65 9123 4567',
    email: 'john.tan@email.com',
    nric: 'S1234567A',
    occupation: 'Software Engineer',
    dob: '15/03/1990',
    address: '123 Orchard Road #12-34',
    addressContinue: 'Singapore 238888',
    fullAddress: '123 Orchard Road #12-34, Singapore 238888',
    salesConsultant: 'Shawn',
    vsaNo: 'VSA-2024-001234',
    date: '31/12/2025',

    // Vehicle Details
    makeModel: 'BYD Seal',
    yom: '2025',
    bodyColour: 'Arctic White',
    upholstery: 'Black Leather',
    przType: 'P',

    // Vehicle Package
    package: 'Premium',
    sellingPriceList: '$188,888',
    purchasePriceWithCOE: '$168,888',
    coeRebateLevel: '$20,000',
    deposit: '$10,000',
    lessOthers: '$5,000',
    addOthers: '$2,000',
    deliveryDate: 'March 2025',

    // Trade-In
    tradeInCarNo: 'SBA1234A',
    tradeInCarModel: 'Toyota Camry',
    tradeInAmount: '$45,000',
    tradeInSettlementCost: '$5,000',
    numberRetention: 'Yes',
    numberRetentionFee: '$1,000',
    tradeInOwnerName: 'John Tan',
    tradeInOwnerNric: 'S1234567A',
    tradeInOwnerMobile: '+65 9123 4567',

    // Delivery
    dateOfRegistration: '01/01/2025',
    registrationNo: 'SBA5678B',
    chassisNo: 'LGXCE6CB1P0123456',
    engineNo: 'N/A',
    motorNo: 'M12345678',

    // Insurance
    insuranceCompany: 'AXA Insurance',
    insuranceFee: '$1,500',
    insuranceFeeNet: '$1,350',

    // Loan
    loanAmount: '$120,000',
    interest: '2.78%',
    tenure: '7 years',
    adminFee: '$500',
    monthlyRepayment: '$1,580',
    remarks1: 'Customer prefers morning delivery',
    remarks2: 'Free first service included',

    // Guarantor
    guarantor1Name: 'Mary Tan',
    guarantor1Phone: '+65 9876 5432',
    guarantor1Email: 'mary.tan@email.com',
    guarantor1Nric: 'S7654321B',
    guarantor1Occupation: 'Teacher',
    guarantor1Dob: '20/05/1985',
    guarantor1Address: '456 Bukit Timah Road',

    // Custom
    custom: 'Custom Value',
  }

  return examples[fieldType] || 'Sample Text'
}

/**
 * Standard font sizes in points
 */
export const FONT_SIZES = [
  6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72,
]

/**
 * Standard font families
 */
export const FONT_FAMILIES = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier', label: 'Courier' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Georgia', label: 'Georgia' },
]

/**
 * Text alignments
 */
export const TEXT_ALIGNMENTS = [
  { value: 'left' as const, label: 'Left' },
  { value: 'center' as const, label: 'Center' },
  { value: 'right' as const, label: 'Right' },
]
