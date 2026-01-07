import { useState, useEffect, useRef, useTransition, type ReactElement } from 'react';
import { Car, Package, ArrowsClockwise, Truck, Shield, Money, FloppyDisk } from '@phosphor-icons/react';
import { Button } from '@/components/common';
import type { Customer, CustomerUpdate } from '@/types';
import {
  VEHICLE_MODELS_GROUPED,
  BODY_COLOURS,
  INSURANCE_COMPANIES,
  PRZ_TYPES,
} from '@/constants/vehicleData';

interface VsaTabProps {
  customer: Customer;
  onUpdate: (id: number, updates: CustomerUpdate) => Promise<void>;
}

type VsaSection =
  | 'vehicle'
  | 'package'
  | 'tradeIn'
  | 'delivery'
  | 'insurance'
  | 'loan';

export function VsaTab({ customer, onUpdate }: VsaTabProps) {
  const [isPending, startTransition] = useTransition();
  const [activeSection, setActiveSection] = useState<VsaSection>('vehicle');
  // Track if monthly repayment was manually edited
  const monthlyRepaymentManuallyEdited = useRef(false);
  const [formData, setFormData] = useState({
    // Vehicle
    vsa_make_model: customer.vsa_make_model || '',
    vsa_variant: customer.vsa_variant || '',
    vsa_yom: customer.vsa_yom || '',
    vsa_body_colour: customer.vsa_body_colour || '',
    vsa_upholstery: customer.vsa_upholstery || '',
    vsa_prz_type: customer.vsa_prz_type || '',
    // Package
    vsa_package: customer.vsa_package || '',
    vsa_selling_price_list: customer.vsa_selling_price_list?.toString() || '',
    vsa_purchase_price_with_coe: customer.vsa_purchase_price_with_coe?.toString() || '',
    vsa_coe_rebate_level: customer.vsa_coe_rebate_level || '',
    vsa_deposit: customer.vsa_deposit?.toString() || '',
    vsa_less_others: customer.vsa_less_others?.toString() || '',
    vsa_add_others: customer.vsa_add_others?.toString() || '',
    vsa_delivery_date: customer.vsa_delivery_date || '',
    // Trade-In
    vsa_trade_in_car_no: customer.vsa_trade_in_car_no || '',
    vsa_trade_in_car_model: customer.vsa_trade_in_car_model || '',
    vsa_trade_in_amount: customer.vsa_trade_in_amount?.toString() || '',
    vsa_trade_in_settlement_cost: customer.vsa_trade_in_settlement_cost?.toString() || '',
    vsa_number_retention: customer.vsa_number_retention || false,
    vsa_number_retention_fee: customer.vsa_number_retention_fee?.toString() || '',
    vsa_trade_in_owner_not_customer: customer.vsa_trade_in_owner_not_customer || false,
    vsa_trade_in_owner_name: customer.vsa_trade_in_owner_name || '',
    vsa_trade_in_owner_nric: customer.vsa_trade_in_owner_nric || '',
    vsa_trade_in_owner_mobile: customer.vsa_trade_in_owner_mobile || '',
    vsa_trade_in_insurance_company: customer.vsa_trade_in_insurance_company || '',
    vsa_trade_in_policy_number: customer.vsa_trade_in_policy_number || '',
    // Delivery
    vsa_date_of_registration: customer.vsa_date_of_registration || '',
    vsa_registration_no: customer.vsa_registration_no || '',
    vsa_chassis_no: customer.vsa_chassis_no || '',
    vsa_engine_no: customer.vsa_engine_no || '',
    vsa_motor_no: customer.vsa_motor_no || '',
    // Insurance
    vsa_insurance_company: customer.vsa_insurance_company || '',
    vsa_insurance_fee: customer.vsa_insurance_fee?.toString() || '',
    vsa_insurance_subsidy: customer.vsa_insurance_subsidy?.toString() || '',
    // Loan & Remarks
    vsa_remarks1: customer.vsa_remarks1 || '',
    vsa_remarks2: customer.vsa_remarks2 || '',
    vsa_loan_amount: customer.vsa_loan_amount?.toString() || '',
    vsa_interest: customer.vsa_interest?.toString() || '',
    vsa_tenure: customer.vsa_tenure?.toString() || '',
    vsa_admin_fee: customer.vsa_admin_fee?.toString() || '',
    vsa_monthly_repayment: customer.vsa_monthly_repayment?.toString() || '',
  });

  useEffect(() => {
    setFormData({
      vsa_make_model: customer.vsa_make_model || '',
      vsa_variant: customer.vsa_variant || '',
      vsa_yom: customer.vsa_yom || '',
      vsa_body_colour: customer.vsa_body_colour || '',
      vsa_upholstery: customer.vsa_upholstery || '',
      vsa_prz_type: customer.vsa_prz_type || '',
      vsa_package: customer.vsa_package || '',
      vsa_selling_price_list: customer.vsa_selling_price_list?.toString() || '',
      vsa_purchase_price_with_coe: customer.vsa_purchase_price_with_coe?.toString() || '',
      vsa_coe_rebate_level: customer.vsa_coe_rebate_level || '',
      vsa_deposit: customer.vsa_deposit?.toString() || '',
      vsa_less_others: customer.vsa_less_others?.toString() || '',
      vsa_add_others: customer.vsa_add_others?.toString() || '',
      vsa_delivery_date: customer.vsa_delivery_date || '',
      vsa_trade_in_car_no: customer.vsa_trade_in_car_no || '',
      vsa_trade_in_car_model: customer.vsa_trade_in_car_model || '',
      vsa_trade_in_amount: customer.vsa_trade_in_amount?.toString() || '',
      vsa_trade_in_settlement_cost: customer.vsa_trade_in_settlement_cost?.toString() || '',
      vsa_number_retention: customer.vsa_number_retention || false,
      vsa_number_retention_fee: customer.vsa_number_retention_fee?.toString() || '',
      vsa_trade_in_owner_not_customer: customer.vsa_trade_in_owner_not_customer || false,
      vsa_trade_in_owner_name: customer.vsa_trade_in_owner_name || '',
      vsa_trade_in_owner_nric: customer.vsa_trade_in_owner_nric || '',
      vsa_trade_in_owner_mobile: customer.vsa_trade_in_owner_mobile || '',
      vsa_trade_in_insurance_company: customer.vsa_trade_in_insurance_company || '',
      vsa_trade_in_policy_number: customer.vsa_trade_in_policy_number || '',
      vsa_date_of_registration: customer.vsa_date_of_registration || '',
      vsa_registration_no: customer.vsa_registration_no || '',
      vsa_chassis_no: customer.vsa_chassis_no || '',
      vsa_engine_no: customer.vsa_engine_no || '',
      vsa_motor_no: customer.vsa_motor_no || '',
      vsa_insurance_company: customer.vsa_insurance_company || '',
      vsa_insurance_fee: customer.vsa_insurance_fee?.toString() || '',
      vsa_insurance_subsidy: customer.vsa_insurance_subsidy?.toString() || '',
      vsa_remarks1: customer.vsa_remarks1 || '',
      vsa_remarks2: customer.vsa_remarks2 || '',
      vsa_loan_amount: customer.vsa_loan_amount?.toString() || '',
      vsa_interest: customer.vsa_interest?.toString() || '',
      vsa_tenure: customer.vsa_tenure?.toString() || '',
      vsa_admin_fee: customer.vsa_admin_fee?.toString() || '',
      vsa_monthly_repayment: customer.vsa_monthly_repayment?.toString() || '',
    });
  }, [customer]);

  // Auto-calculate monthly repayment when loan details change
  // Flat Rate Formula: Monthly = (Principal + (Principal × Rate × Years)) / Months
  // This is the standard car loan calculation in Singapore
  useEffect(() => {
    if (monthlyRepaymentManuallyEdited.current) return;

    const loanAmount = parseFloat(formData.vsa_loan_amount) || 0;
    const annualInterestRate = parseFloat(formData.vsa_interest) || 0;
    const tenure = parseFloat(formData.vsa_tenure) || 0;

    if (loanAmount > 0 && tenure > 0) {
      const years = tenure / 12;
      const totalInterest = loanAmount * (annualInterestRate / 100) * years;
      const totalAmount = loanAmount + totalInterest;
      const monthlyPayment = totalAmount / tenure;

      setFormData((prev) => ({
        ...prev,
        vsa_monthly_repayment: monthlyPayment.toFixed(2),
      }));
    }
  }, [formData.vsa_loan_amount, formData.vsa_interest, formData.vsa_tenure]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    // Track if user manually edits monthly repayment
    if (name === 'vsa_monthly_repayment') {
      monthlyRepaymentManuallyEdited.current = true;
    }
    // Reset manual edit flag if user changes loan-related fields
    if (name === 'vsa_loan_amount' || name === 'vsa_interest' || name === 'vsa_tenure') {
      monthlyRepaymentManuallyEdited.current = false;
    }

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = () => {
    const updates: CustomerUpdate = {
      vsa_make_model: formData.vsa_make_model || null,
      vsa_variant: formData.vsa_variant || null,
      vsa_yom: formData.vsa_yom || null,
      vsa_body_colour: formData.vsa_body_colour || null,
      vsa_upholstery: formData.vsa_upholstery || null,
      vsa_prz_type: (formData.vsa_prz_type as 'P' | 'R' | 'Z') || null,
      vsa_package: formData.vsa_package || null,
      vsa_selling_price_list: formData.vsa_selling_price_list ? Number(formData.vsa_selling_price_list) : null,
      vsa_purchase_price_with_coe: formData.vsa_purchase_price_with_coe ? Number(formData.vsa_purchase_price_with_coe) : null,
      vsa_coe_rebate_level: formData.vsa_coe_rebate_level || null,
      vsa_deposit: formData.vsa_deposit ? Number(formData.vsa_deposit) : null,
      vsa_less_others: formData.vsa_less_others ? Number(formData.vsa_less_others) : null,
      vsa_add_others: formData.vsa_add_others ? Number(formData.vsa_add_others) : null,
      vsa_delivery_date: formData.vsa_delivery_date || null,
      vsa_trade_in_car_no: formData.vsa_trade_in_car_no || null,
      vsa_trade_in_car_model: formData.vsa_trade_in_car_model || null,
      vsa_trade_in_amount: formData.vsa_trade_in_amount ? Number(formData.vsa_trade_in_amount) : null,
      vsa_trade_in_settlement_cost: formData.vsa_trade_in_settlement_cost ? Number(formData.vsa_trade_in_settlement_cost) : null,
      vsa_number_retention: formData.vsa_number_retention,
      vsa_number_retention_fee: formData.vsa_number_retention_fee ? Number(formData.vsa_number_retention_fee) : null,
      vsa_trade_in_owner_not_customer: formData.vsa_trade_in_owner_not_customer,
      vsa_trade_in_owner_name: formData.vsa_trade_in_owner_name || null,
      vsa_trade_in_owner_nric: formData.vsa_trade_in_owner_nric || null,
      vsa_trade_in_owner_mobile: formData.vsa_trade_in_owner_mobile || null,
      vsa_trade_in_insurance_company: formData.vsa_trade_in_insurance_company || null,
      vsa_trade_in_policy_number: formData.vsa_trade_in_policy_number || null,
      vsa_date_of_registration: formData.vsa_date_of_registration || null,
      vsa_registration_no: formData.vsa_registration_no || null,
      vsa_chassis_no: formData.vsa_chassis_no || null,
      vsa_engine_no: formData.vsa_engine_no || null,
      vsa_motor_no: formData.vsa_motor_no || null,
      vsa_insurance_company: formData.vsa_insurance_company || null,
      vsa_insurance_fee: formData.vsa_insurance_fee ? Number(formData.vsa_insurance_fee) : null,
      vsa_insurance_subsidy: formData.vsa_insurance_subsidy ? Number(formData.vsa_insurance_subsidy) : null,
      vsa_remarks1: formData.vsa_remarks1 || null,
      vsa_remarks2: formData.vsa_remarks2 || null,
      vsa_loan_amount: formData.vsa_loan_amount ? Number(formData.vsa_loan_amount) : null,
      vsa_interest: formData.vsa_interest ? Number(formData.vsa_interest) : null,
      vsa_tenure: formData.vsa_tenure ? Number(formData.vsa_tenure) : null,
      vsa_admin_fee: formData.vsa_admin_fee ? Number(formData.vsa_admin_fee) : null,
      vsa_monthly_repayment: formData.vsa_monthly_repayment ? Number(formData.vsa_monthly_repayment) : null,
    };
    startTransition(async () => {
      await onUpdate(customer.id, updates);
    });
  };

  const sections: { id: VsaSection; label: string; icon: ReactElement }[] = [
    { id: 'vehicle', label: 'Vehicle', icon: <Car size={16} /> },
    { id: 'package', label: 'Package', icon: <Package size={16} /> },
    { id: 'tradeIn', label: 'Trade-In', icon: <ArrowsClockwise size={16} /> },
    { id: 'delivery', label: 'Delivery', icon: <Truck size={16} /> },
    { id: 'insurance', label: 'Insurance', icon: <Shield size={16} /> },
    { id: 'loan', label: 'Loan', icon: <Money size={16} /> },
  ];

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'vehicle':
        return (
          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label">Make & Model</label>
              <select
                name="vsa_make_model"
                aria-label="Vehicle Make and Model"
                value={formData.vsa_make_model}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">Select Model</option>
                {VEHICLE_MODELS_GROUPED.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.models.map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Variant</label>
              <input
                type="text"
                name="vsa_variant"
                value={formData.vsa_variant}
                onChange={handleChange}
                placeholder="Premium AWD"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Year of Manufacture</label>
              <input
                type="text"
                name="vsa_yom"
                value={formData.vsa_yom}
                onChange={handleChange}
                placeholder="2024"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Body Colour</label>
              <select
                name="vsa_body_colour"
                aria-label="Body Colour"
                value={formData.vsa_body_colour}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">Select Colour</option>
                {BODY_COLOURS.map((colour) => (
                  <option key={colour} value={colour}>{colour}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Upholstery</label>
              <input
                type="text"
                name="vsa_upholstery"
                value={formData.vsa_upholstery}
                onChange={handleChange}
                placeholder="Black Leather"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">P/R/Z Type</label>
              <select
                name="vsa_prz_type"
                aria-label="Vehicle Registration Type"
                value={formData.vsa_prz_type}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">Select Type</option>
                {PRZ_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'package':
        return (
          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label">Package</label>
              <input
                type="text"
                name="vsa_package"
                value={formData.vsa_package}
                onChange={handleChange}
                placeholder="Standard Package"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Selling Price (List)</label>
              <input
                type="number"
                name="vsa_selling_price_list"
                value={formData.vsa_selling_price_list}
                onChange={handleChange}
                placeholder="189888"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Price with COE</label>
              <input
                type="number"
                name="vsa_purchase_price_with_coe"
                value={formData.vsa_purchase_price_with_coe}
                onChange={handleChange}
                placeholder="199888"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">COE Rebate Level</label>
              <input
                type="text"
                name="vsa_coe_rebate_level"
                value={formData.vsa_coe_rebate_level}
                onChange={handleChange}
                placeholder="Rebate level"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Deposit</label>
              <input
                type="number"
                name="vsa_deposit"
                value={formData.vsa_deposit}
                onChange={handleChange}
                placeholder="5000"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Less: Others</label>
              <input
                type="number"
                name="vsa_less_others"
                value={formData.vsa_less_others}
                onChange={handleChange}
                placeholder="0"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Add: Others</label>
              <input
                type="number"
                name="vsa_add_others"
                value={formData.vsa_add_others}
                onChange={handleChange}
                placeholder="0"
                className="form-input"
              />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Estimated Delivery Date</label>
              <select
                name="vsa_delivery_date"
                aria-label="Estimated Delivery Date"
                value={formData.vsa_delivery_date}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">Select delivery month</option>
                {(() => {
                  const options = [];
                  const currentDate = new Date();
                  for (let i = 0; i < 24; i++) {
                    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
                    const monthName = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                    // Get next month for the display format "JAN/FEB 2026"
                    const nextDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);
                    const nextMonthName = nextDate.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                    const nextYear = nextDate.getFullYear();
                    // Value is the full format that gets saved
                    const value = `${monthName}/${nextMonthName} ${nextYear}`;
                    options.push(<option key={value} value={value}>{value}</option>);
                  }
                  return options;
                })()}
              </select>
            </div>
          </div>
        );

      case 'tradeIn':
        return (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Car No.</label>
              <input
                type="text"
                name="vsa_trade_in_car_no"
                value={formData.vsa_trade_in_car_no}
                onChange={handleChange}
                placeholder="SBA1234A"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Car Model</label>
              <input
                type="text"
                name="vsa_trade_in_car_model"
                value={formData.vsa_trade_in_car_model}
                onChange={handleChange}
                placeholder="Toyota Camry"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Trade-In Amount</label>
              <input
                type="number"
                name="vsa_trade_in_amount"
                value={formData.vsa_trade_in_amount}
                onChange={handleChange}
                placeholder="50000"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Settlement Cost</label>
              <input
                type="number"
                name="vsa_trade_in_settlement_cost"
                value={formData.vsa_trade_in_settlement_cost}
                onChange={handleChange}
                placeholder="20000"
                className="form-input"
              />
            </div>

            {/* Number Retention Checkbox */}
            <div className="form-group full-width">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="vsa_number_retention"
                  checked={formData.vsa_number_retention}
                  onChange={handleChange}
                />
                <span>Number Retention (Retain old car registration)</span>
              </label>
            </div>

            {formData.vsa_number_retention && (
              <div className="form-group">
                <label className="form-label">Number Retention Fee</label>
                <input
                  type="number"
                  name="vsa_number_retention_fee"
                  value={formData.vsa_number_retention_fee}
                  onChange={handleChange}
                  placeholder="100"
                  className="form-input"
                />
              </div>
            )}

            {/* Trade-In Owner Different Checkbox */}
            <div className="form-group full-width">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="vsa_trade_in_owner_not_customer"
                  checked={formData.vsa_trade_in_owner_not_customer}
                  onChange={handleChange}
                />
                <span>Trade-in owner is different from customer</span>
              </label>
            </div>

            {formData.vsa_trade_in_owner_not_customer && (
              <>
                <div className="form-group">
                  <label className="form-label">Owner Name</label>
                  <input
                    type="text"
                    name="vsa_trade_in_owner_name"
                    value={formData.vsa_trade_in_owner_name}
                    onChange={handleChange}
                    placeholder="Owner name"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner NRIC</label>
                  <input
                    type="text"
                    name="vsa_trade_in_owner_nric"
                    value={formData.vsa_trade_in_owner_nric}
                    onChange={handleChange}
                    placeholder="S1234567A"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner Mobile</label>
                  <input
                    type="tel"
                    name="vsa_trade_in_owner_mobile"
                    value={formData.vsa_trade_in_owner_mobile}
                    onChange={handleChange}
                    placeholder="91234567"
                    className="form-input"
                  />
                </div>
              </>
            )}

            {/* Trade-In Insurance */}
            <div className="form-group">
              <label className="form-label">Insurance Company</label>
              <select
                name="vsa_trade_in_insurance_company"
                aria-label="Trade-In Insurance Company"
                value={formData.vsa_trade_in_insurance_company}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">Select Company</option>
                {INSURANCE_COMPANIES.map((company) => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Policy Number</label>
              <input
                type="text"
                name="vsa_trade_in_policy_number"
                value={formData.vsa_trade_in_policy_number}
                onChange={handleChange}
                placeholder="Policy number"
                className="form-input"
              />
            </div>
          </div>
        );

      case 'delivery':
        return (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Date of Registration</label>
              <input
                type="date"
                name="vsa_date_of_registration"
                value={formData.vsa_date_of_registration}
                onChange={handleChange}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Registration No.</label>
              <input
                type="text"
                name="vsa_registration_no"
                value={formData.vsa_registration_no}
                onChange={handleChange}
                placeholder="SBY1234A"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Chassis No.</label>
              <input
                type="text"
                name="vsa_chassis_no"
                value={formData.vsa_chassis_no}
                onChange={handleChange}
                placeholder="LNBSC..."
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Engine No.</label>
              <input
                type="text"
                name="vsa_engine_no"
                value={formData.vsa_engine_no}
                onChange={handleChange}
                placeholder="Engine number"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Motor No.</label>
              <input
                type="text"
                name="vsa_motor_no"
                value={formData.vsa_motor_no}
                onChange={handleChange}
                placeholder="Motor number"
                className="form-input"
              />
            </div>
          </div>
        );

      case 'insurance':
        return (
          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label">Insurance Company</label>
              <select
                name="vsa_insurance_company"
                aria-label="Insurance Company"
                value={formData.vsa_insurance_company}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">Select Company</option>
                {INSURANCE_COMPANIES.map((company) => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Insurance Fee</label>
              <input
                type="number"
                name="vsa_insurance_fee"
                value={formData.vsa_insurance_fee}
                onChange={handleChange}
                placeholder="1500"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Insurance Subsidy</label>
              <input
                type="number"
                name="vsa_insurance_subsidy"
                value={formData.vsa_insurance_subsidy}
                onChange={handleChange}
                placeholder="500"
                className="form-input"
              />
            </div>
          </div>
        );

      case 'loan':
        return (
          <div className="form-grid">
            {/* Remarks Section */}
            <div className="form-group full-width">
              <label className="form-label">Remarks 1</label>
              <textarea
                name="vsa_remarks1"
                value={formData.vsa_remarks1}
                onChange={handleChange}
                placeholder="Remarks..."
                rows={2}
                className="form-input"
              />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Remarks 2</label>
              <textarea
                name="vsa_remarks2"
                value={formData.vsa_remarks2}
                onChange={handleChange}
                placeholder="Additional remarks..."
                rows={2}
                className="form-input"
              />
            </div>

            {/* Loan Details */}
            <div className="form-group">
              <label className="form-label">Loan Amount</label>
              <input
                type="number"
                name="vsa_loan_amount"
                value={formData.vsa_loan_amount}
                onChange={handleChange}
                placeholder="100000"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Interest Rate (%)</label>
              <input
                type="number"
                name="vsa_interest"
                value={formData.vsa_interest}
                onChange={handleChange}
                placeholder="2.78"
                step="0.01"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tenure (Months)</label>
              <input
                type="number"
                name="vsa_tenure"
                value={formData.vsa_tenure}
                onChange={handleChange}
                placeholder="84"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Admin Fee</label>
              <input
                type="number"
                name="vsa_admin_fee"
                value={formData.vsa_admin_fee}
                onChange={handleChange}
                placeholder="500"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Monthly Repayment</label>
              <input
                type="number"
                name="vsa_monthly_repayment"
                value={formData.vsa_monthly_repayment}
                onChange={handleChange}
                placeholder="1500"
                className="form-input"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="vsa-tab">
      {/* Section Tabs */}
      <div className="vsa-sections">
        {sections.map((section) => (
          <button
            key={section.id}
            className={`vsa-section-button ${activeSection === section.id ? 'active' : ''}`}
            onClick={() => setActiveSection(section.id)}
          >
            <span className="section-btn-icon">{section.icon}</span>
            {section.label}
          </button>
        ))}
      </div>

      {/* Section Content */}
      <section className="details-section">{renderSectionContent()}</section>

      <div className="section-actions">
        <Button onClick={handleSave} isLoading={isPending}>
          <FloppyDisk size={16} className="btn-icon" />
          Save VSA Details
        </Button>
      </div>
    </div>
  );
}
