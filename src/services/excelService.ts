/**
 * Excel Service
 *
 * Handles Excel file parsing, template population, and data mapping.
 * Uses xlsx-populate for Excel manipulation.
 */

import type { Customer, Guarantor } from '@/types'
import type { ExcelTemplate, ExcelFieldMappings } from '@/types/excel.types'
import { CURRENCY_FIELDS, PERCENTAGE_FIELDS } from '@/constants/excelFields'
import { formatCurrency, currencyToNumber } from '@/utils/formatting'

// Lazy load xlsx-populate module
let xlsxModule: typeof import('xlsx-populate') | null = null

const loadXlsxPopulate = async () => {
  if (!xlsxModule) {
    xlsxModule = await import('xlsx-populate')
  }
  return xlsxModule.default
}

/**
 * Format loan summary
 */
function formatLoanSummary(
  loanAmount: number | null | undefined,
  interest: number | null | undefined,
  tenure: number | null | undefined
): string {
  const numericLoan = loanAmount ?? 0
  if (numericLoan === 0) {
    return 'NO LOAN'
  }

  const loanStr = `$${numericLoan.toLocaleString('en-US')}`
  const interestStr = interest ? `${interest}%` : ''
  const tenureStr = tenure ? `${tenure} MONTHS` : ''

  const parts = [loanStr, interestStr, tenureStr].filter((p) => p)
  return `LOAN AMOUNT ${parts.join(' x ')}`
}

/**
 * Get conditional installment (only if interest > 2.5%)
 */
function getConditionalInstallment(
  interest: number | null | undefined,
  monthlyRepayment: number | null | undefined
): string {
  const interestRate = interest ?? 0
  if (interestRate > 2.5 && monthlyRepayment) {
    return formatCurrency(monthlyRepayment)
  }
  return ''
}

/**
 * Extract guarantor fields from guarantors array
 */
function extractGuarantorFields(guarantors: Guarantor[] | undefined): Record<string, string> {
  const fields: Record<string, string> = {}
  const maxGuarantors = 5

  for (let i = 0; i < maxGuarantors; i++) {
    const g = guarantors?.[i]
    const num = i + 1

    fields[`guarantor${num}Name`] = g?.name ?? ''
    fields[`guarantor${num}Phone`] = g?.phone ?? ''
    fields[`guarantor${num}Email`] = g?.email ?? ''
    fields[`guarantor${num}Nric`] = g?.nric ?? ''
    fields[`guarantor${num}Occupation`] = g?.occupation ?? ''
    fields[`guarantor${num}Dob`] = g?.dob ?? ''
    fields[`guarantor${num}Address`] = g?.address ?? ''
    fields[`guarantor${num}AddressContinue`] = g?.address_continue ?? ''
  }

  return fields
}

/**
 * Create customer data mapping for Excel population
 * Maps all customer fields to a flat object with string values
 */
export function getCustomerDataMapping(
  customer: Customer,
  guarantors?: Guarantor[]
): Record<string, string | number | Date> {
  // Calculate derived values
  const insuranceFee = customer.vsa_insurance_fee ?? 0
  const subsidy = customer.vsa_insurance_subsidy ?? 0
  const netInsuranceFee = insuranceFee - subsidy

  const dataMapping: Record<string, string | number | Date> = {
    // Basic Customer Information
    name: customer.name ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    nric: customer.nric ?? '',
    occupation: customer.occupation ?? '',
    dob: customer.dob ?? '',
    address: customer.address ?? '',
    addressContinue: customer.address_continue ?? '',
    fullAddress: [customer.address, customer.address_continue].filter(Boolean).join(', '),
    salesConsultant: customer.sales_consultant ?? '',
    vsaNo: customer.vsa_no ?? '',
    date: new Date(),

    // Vehicle Details
    makeModel: customer.vsa_make_model ?? '',
    yom: customer.vsa_yom ?? '',
    bodyColour: customer.vsa_body_colour ?? '',
    upholstery: customer.vsa_upholstery ?? '',
    przType: customer.vsa_prz_type ?? '',

    // Vehicle Package
    package: customer.vsa_package ?? '',
    sellingPriceList: customer.vsa_selling_price_list ?? '',
    purchasePriceWithCOE: customer.vsa_purchase_price_with_coe ?? '',
    coeRebateLevel: customer.vsa_coe_rebate_level ?? '',
    deposit: customer.vsa_deposit ?? '',
    lessOthers: customer.vsa_less_others ?? '',
    addOthers: customer.vsa_add_others ?? '',
    deliveryDate: customer.vsa_delivery_date ?? '',

    // Trade-In Details
    tradeInCarNo: customer.vsa_trade_in_car_no ?? '',
    tradeInCarModel: customer.vsa_trade_in_car_model ?? '',
    tradeInAmount: customer.vsa_trade_in_amount ?? '',
    tradeInSettlementCost: customer.vsa_trade_in_settlement_cost ?? '',
    numberRetention: customer.vsa_number_retention ? 'Yes' : 'No',
    numberRetentionFee: customer.vsa_number_retention_fee ?? '',
    tradeInOwnerNotCustomer: customer.vsa_trade_in_owner_not_customer ? 'Yes' : 'No',
    tradeInOwnerName: customer.vsa_trade_in_owner_name ?? '',
    tradeInOwnerNric: customer.vsa_trade_in_owner_nric ?? '',
    tradeInOwnerMobile: customer.vsa_trade_in_owner_mobile ?? '',
    tradeInInsuranceCompany: customer.vsa_trade_in_insurance_company ?? '',
    tradeInPolicyNumber: customer.vsa_trade_in_policy_number ?? '',
    // Auto fields - use owner if different, else customer
    tradeInNameAuto: customer.vsa_trade_in_owner_not_customer
      ? (customer.vsa_trade_in_owner_name ?? '')
      : (customer.name ?? ''),
    tradeInNricAuto: customer.vsa_trade_in_owner_not_customer
      ? (customer.vsa_trade_in_owner_nric ?? '')
      : (customer.nric ?? ''),
    tradeInMobileAuto: customer.vsa_trade_in_owner_not_customer
      ? (customer.vsa_trade_in_owner_mobile ?? '')
      : (customer.phone ?? ''),

    // Delivery Details
    dateOfRegistration: customer.vsa_date_of_registration ?? '',
    registrationNo: customer.vsa_registration_no ?? '',
    chassisNo: customer.vsa_chassis_no ?? '',
    engineNo: customer.vsa_engine_no ?? '',
    motorNo: customer.vsa_motor_no ?? '',

    // Insurance
    insuranceCompany: customer.vsa_insurance_company ?? '',
    insuranceFee: customer.vsa_insurance_fee ?? '',
    insuranceFeeNet: netInsuranceFee ?? '',
    insuranceSubsidy: customer.vsa_insurance_subsidy ?? '',

    // Remarks & Loan
    remarks1: customer.vsa_remarks1 ?? '',
    remarks2: customer.vsa_remarks2 ?? '',
    loanAmount: customer.vsa_loan_amount ?? '',
    interest: customer.vsa_interest ?? '',
    tenure: customer.vsa_tenure ?? '',
    adminFee: customer.vsa_admin_fee ?? '',
    monthlyRepayment: customer.vsa_monthly_repayment ?? '',
    loanSummary: formatLoanSummary(
      customer.vsa_loan_amount,
      customer.vsa_interest,
      customer.vsa_tenure
    ),

    // Invoice
    invoiceInstallmentConditional: getConditionalInstallment(
      customer.vsa_interest,
      customer.vsa_monthly_repayment
    ),

    // Proposal Details
    proposalModel: customer.proposal_model ?? '',
    proposalBank: customer.proposal_bank ?? '',
    proposalSellingPrice: customer.proposal_selling_price ?? '',
    proposalInterestRate: customer.proposal_interest_rate ?? '',
    proposalDownpayment: customer.proposal_downpayment ?? '',
    proposalLoanTenure: customer.proposal_loan_tenure ?? '',
    proposalLoanAmount: customer.proposal_loan_amount ?? '',
    proposalAdminFee: customer.proposal_admin_fee ?? '',
    proposalReferralFee: customer.proposal_referral_fee ?? '',
    proposalTradeInModel: customer.proposal_trade_in_model ?? '',
    proposalLowLoanSurcharge: customer.proposal_low_loan_surcharge ?? '',
    proposalTradeInCarPlate: customer.proposal_trade_in_car_plate ?? '',
    proposalNoLoanSurcharge: customer.proposal_no_loan_surcharge ?? '',
    proposalQuotedTradeInPrice: customer.proposal_quoted_trade_in_price ?? '',
    proposalBenefit1: customer.proposal_benefit1 ?? '',
    proposalBenefit2: customer.proposal_benefit2 ?? '',
    proposalBenefit3: customer.proposal_benefit3 ?? '',
    proposalBenefit4: customer.proposal_benefit4 ?? '',
    proposalBenefit5: customer.proposal_benefit5 ?? '',
    proposalBenefit6: customer.proposal_benefit6 ?? '',
    proposalBenefit7: customer.proposal_benefit7 ?? '',
    proposalBenefit8: customer.proposal_benefit8 ?? '',
    proposalBenefit9: customer.proposal_benefit9 ?? '',
    proposalBenefitsGiven: customer.proposal_benefits_given ?? '',
    proposalRemarks: customer.proposal_remarks ?? '',

    // Guarantor fields
    ...extractGuarantorFields(guarantors || customer.guarantors),
  }

  return dataMapping
}

/**
 * Parse Excel file and extract sheet names
 */
export async function parseExcelFile(file: File | Blob): Promise<string[]> {
  try {
    const XlsxPopulate = await loadXlsxPopulate()
    const arrayBuffer = await file.arrayBuffer()
    const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer)
    return workbook.sheets().map((sheet: { name: () => string }) => sheet.name())
  } catch (error) {
    console.error('Error parsing Excel file:', error)
    throw new Error('Failed to parse Excel file. Please ensure it is a valid .xlsx file.')
  }
}

/**
 * Populate Excel template with customer data
 */
export async function populateExcelTemplate(
  template: ExcelTemplate,
  customer: Customer,
  guarantors: Guarantor[] | undefined,
  fileBlob: Blob
): Promise<Blob> {
  try {
    const XlsxPopulate = await loadXlsxPopulate()
    const arrayBuffer = await fileBlob.arrayBuffer()
    const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer)

    // Get customer data mapping
    const dataMapping = getCustomerDataMapping(customer, guarantors)

    // Get all sheet names for case-insensitive lookup
    const allSheets = workbook.sheets()
    const sheetNames = allSheets.map((s: { name: () => string }) => s.name())
    console.log('Available sheets:', sheetNames)

    // Apply field mappings
    const fieldMappings: ExcelFieldMappings = template.field_mappings ?? {}
    let appliedCount = 0

    for (const [sheetName, cellMappings] of Object.entries(fieldMappings)) {
      // Find sheet (case-insensitive)
      let sheet = workbook.sheet(sheetName)
      if (!sheet) {
        const matchedSheet = allSheets.find(
          (s: { name: () => string }) => s.name().toLowerCase() === sheetName.toLowerCase()
        )
        if (matchedSheet) {
          sheet = matchedSheet
        } else {
          console.warn(`Sheet "${sheetName}" not found, skipping`)
          continue
        }
      }

      for (const [cellRef, fieldType] of Object.entries(cellMappings)) {
        let value: string | number | Date | undefined

        // Handle custom values (format: "_custom:Value Here")
        if (fieldType.startsWith('_custom:')) {
          value = fieldType.substring(8) // Remove "_custom:" prefix
        } else {
          value = dataMapping[fieldType]
        }

        if (value !== undefined && value !== null && value !== '') {
          // Convert currency fields to numbers for Excel (skip Date values)
          if (CURRENCY_FIELDS.has(fieldType) && !(value instanceof Date)) {
            const numericValue = currencyToNumber(value)
            if (!isNaN(numericValue)) {
              value = numericValue
            }
          }

          // Convert percentage fields to decimal for Excel (skip Date values)
          if (PERCENTAGE_FIELDS.has(fieldType) && !(value instanceof Date)) {
            const numericValue = parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
            if (!isNaN(numericValue)) {
              value = numericValue / 100 // Convert 2.88 to 0.0288
            }
          }

          // Set cell value
          sheet.cell(cellRef).value(value as string | number | boolean | Date | null | undefined)
          appliedCount++
        }
      }
    }

    console.log(`Applied ${appliedCount} field values`)

    // Generate Excel file as blob
    const outputBlob = await workbook.outputAsync()
    return new Blob([outputBlob], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  } catch (error) {
    console.error('Error populating Excel template:', error)
    throw error
  }
}

/**
 * Download Excel file
 */
export function downloadExcelFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Generate file name for populated Excel
 */
export function generateFileName(templateName: string, customerName: string): string {
  const timestamp = new Date().toISOString().split('T')[0]
  const safeName = customerName.replace(/[^a-zA-Z0-9]/g, '_')
  const safeTemplate = templateName.replace(/[^a-zA-Z0-9]/g, '_')
  return `${safeTemplate}_${safeName}_${timestamp}.xlsx`
}
