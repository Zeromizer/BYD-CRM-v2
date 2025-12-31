import { useState, useEffect } from 'react';
import { Button } from '@/components/common';
import {
  Save,
  Car,
  Package,
  Repeat,
  Truck,
  Shield,
  Banknote,
} from 'lucide-react';
import type { Customer, CustomerUpdate } from '@/types';

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
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<VsaSection>('vehicle');
  const [formData, setFormData] = useState({
    // Vehicle
    vsa_make_model: customer.vsa_make_model || '',
    vsa_variant: customer.vsa_variant || '',
    vsa_yom: customer.vsa_yom || '',
    vsa_body_colour: customer.vsa_body_colour || '',
    vsa_upholstery: customer.vsa_upholstery || '',
    // Package
    vsa_package: customer.vsa_package || '',
    vsa_selling_price_list: customer.vsa_selling_price_list?.toString() || '',
    vsa_purchase_price_with_coe: customer.vsa_purchase_price_with_coe?.toString() || '',
    vsa_deposit: customer.vsa_deposit?.toString() || '',
    vsa_delivery_date: customer.vsa_delivery_date || '',
    // Trade-In
    vsa_trade_in_car_no: customer.vsa_trade_in_car_no || '',
    vsa_trade_in_car_model: customer.vsa_trade_in_car_model || '',
    vsa_trade_in_amount: customer.vsa_trade_in_amount?.toString() || '',
    vsa_trade_in_settlement_cost: customer.vsa_trade_in_settlement_cost?.toString() || '',
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
    // Loan
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
      vsa_package: customer.vsa_package || '',
      vsa_selling_price_list: customer.vsa_selling_price_list?.toString() || '',
      vsa_purchase_price_with_coe: customer.vsa_purchase_price_with_coe?.toString() || '',
      vsa_deposit: customer.vsa_deposit?.toString() || '',
      vsa_delivery_date: customer.vsa_delivery_date || '',
      vsa_trade_in_car_no: customer.vsa_trade_in_car_no || '',
      vsa_trade_in_car_model: customer.vsa_trade_in_car_model || '',
      vsa_trade_in_amount: customer.vsa_trade_in_amount?.toString() || '',
      vsa_trade_in_settlement_cost: customer.vsa_trade_in_settlement_cost?.toString() || '',
      vsa_date_of_registration: customer.vsa_date_of_registration || '',
      vsa_registration_no: customer.vsa_registration_no || '',
      vsa_chassis_no: customer.vsa_chassis_no || '',
      vsa_engine_no: customer.vsa_engine_no || '',
      vsa_motor_no: customer.vsa_motor_no || '',
      vsa_insurance_company: customer.vsa_insurance_company || '',
      vsa_insurance_fee: customer.vsa_insurance_fee?.toString() || '',
      vsa_insurance_subsidy: customer.vsa_insurance_subsidy?.toString() || '',
      vsa_loan_amount: customer.vsa_loan_amount?.toString() || '',
      vsa_interest: customer.vsa_interest?.toString() || '',
      vsa_tenure: customer.vsa_tenure?.toString() || '',
      vsa_admin_fee: customer.vsa_admin_fee?.toString() || '',
      vsa_monthly_repayment: customer.vsa_monthly_repayment?.toString() || '',
    });
  }, [customer]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: CustomerUpdate = {
        vsa_make_model: formData.vsa_make_model || null,
        vsa_variant: formData.vsa_variant || null,
        vsa_yom: formData.vsa_yom || null,
        vsa_body_colour: formData.vsa_body_colour || null,
        vsa_upholstery: formData.vsa_upholstery || null,
        vsa_package: formData.vsa_package || null,
        vsa_selling_price_list: formData.vsa_selling_price_list ? Number(formData.vsa_selling_price_list) : null,
        vsa_purchase_price_with_coe: formData.vsa_purchase_price_with_coe ? Number(formData.vsa_purchase_price_with_coe) : null,
        vsa_deposit: formData.vsa_deposit ? Number(formData.vsa_deposit) : null,
        vsa_delivery_date: formData.vsa_delivery_date || null,
        vsa_trade_in_car_no: formData.vsa_trade_in_car_no || null,
        vsa_trade_in_car_model: formData.vsa_trade_in_car_model || null,
        vsa_trade_in_amount: formData.vsa_trade_in_amount ? Number(formData.vsa_trade_in_amount) : null,
        vsa_trade_in_settlement_cost: formData.vsa_trade_in_settlement_cost ? Number(formData.vsa_trade_in_settlement_cost) : null,
        vsa_date_of_registration: formData.vsa_date_of_registration || null,
        vsa_registration_no: formData.vsa_registration_no || null,
        vsa_chassis_no: formData.vsa_chassis_no || null,
        vsa_engine_no: formData.vsa_engine_no || null,
        vsa_motor_no: formData.vsa_motor_no || null,
        vsa_insurance_company: formData.vsa_insurance_company || null,
        vsa_insurance_fee: formData.vsa_insurance_fee ? Number(formData.vsa_insurance_fee) : null,
        vsa_insurance_subsidy: formData.vsa_insurance_subsidy ? Number(formData.vsa_insurance_subsidy) : null,
        vsa_loan_amount: formData.vsa_loan_amount ? Number(formData.vsa_loan_amount) : null,
        vsa_interest: formData.vsa_interest ? Number(formData.vsa_interest) : null,
        vsa_tenure: formData.vsa_tenure ? Number(formData.vsa_tenure) : null,
        vsa_admin_fee: formData.vsa_admin_fee ? Number(formData.vsa_admin_fee) : null,
        vsa_monthly_repayment: formData.vsa_monthly_repayment ? Number(formData.vsa_monthly_repayment) : null,
      };
      await onUpdate(customer.id, updates);
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    { id: 'vehicle' as VsaSection, label: 'Vehicle', icon: Car },
    { id: 'package' as VsaSection, label: 'Package', icon: Package },
    { id: 'tradeIn' as VsaSection, label: 'Trade-In', icon: Repeat },
    { id: 'delivery' as VsaSection, label: 'Delivery', icon: Truck },
    { id: 'insurance' as VsaSection, label: 'Insurance', icon: Shield },
    { id: 'loan' as VsaSection, label: 'Loan', icon: Banknote },
  ];

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'vehicle':
        return (
          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label">Make & Model</label>
              <input
                type="text"
                name="vsa_make_model"
                value={formData.vsa_make_model}
                onChange={handleChange}
                placeholder="BYD Seal"
                className="form-input"
              />
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
              <input
                type="text"
                name="vsa_body_colour"
                value={formData.vsa_body_colour}
                onChange={handleChange}
                placeholder="Arctic White"
                className="form-input"
              />
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
              <label className="form-label">List Price</label>
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
              <label className="form-label">Delivery Date</label>
              <input
                type="date"
                name="vsa_delivery_date"
                value={formData.vsa_delivery_date}
                onChange={handleChange}
                className="form-input"
              />
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
              <input
                type="text"
                name="vsa_insurance_company"
                value={formData.vsa_insurance_company}
                onChange={handleChange}
                placeholder="AXA, NTUC Income, etc."
                className="form-input"
              />
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
              <label className="form-label">Tenure (Years)</label>
              <input
                type="number"
                name="vsa_tenure"
                value={formData.vsa_tenure}
                onChange={handleChange}
                placeholder="7"
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
            <section.icon size={16} />
            {section.label}
          </button>
        ))}
      </div>

      {/* Section Content */}
      <section className="details-section">{renderSectionContent()}</section>

      <div className="section-actions">
        <Button onClick={handleSave} isLoading={isSaving}>
          <Save size={16} />
          Save VSA Details
        </Button>
      </div>
    </div>
  );
}
