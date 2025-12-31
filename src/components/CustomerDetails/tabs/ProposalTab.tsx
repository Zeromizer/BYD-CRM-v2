import { useState, useEffect } from 'react';
import { Button } from '@/components/common';
import { Save, Car, Banknote, Gift } from 'lucide-react';
import type { Customer, CustomerUpdate } from '@/types';

interface ProposalTabProps {
  customer: Customer;
  onUpdate: (id: number, updates: CustomerUpdate) => Promise<void>;
}

export function ProposalTab({ customer, onUpdate }: ProposalTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    proposal_model: customer.proposal_model || '',
    proposal_variant: customer.proposal_variant || '',
    proposal_color: customer.proposal_color || '',
    proposal_bank: customer.proposal_bank || '',
    proposal_selling_price: customer.proposal_selling_price?.toString() || '',
    proposal_loan_amount: customer.proposal_loan_amount?.toString() || '',
    proposal_interest_rate: customer.proposal_interest_rate?.toString() || '',
    proposal_loan_tenure: customer.proposal_loan_tenure?.toString() || '',
    proposal_downpayment: customer.proposal_downpayment?.toString() || '',
    proposal_trade_in_model: customer.proposal_trade_in_model || '',
    proposal_trade_in_car_plate: customer.proposal_trade_in_car_plate || '',
    proposal_quoted_trade_in_price: customer.proposal_quoted_trade_in_price?.toString() || '',
    proposal_benefit1: customer.proposal_benefit1 || '',
    proposal_benefit2: customer.proposal_benefit2 || '',
    proposal_benefit3: customer.proposal_benefit3 || '',
    proposal_benefit4: customer.proposal_benefit4 || '',
    proposal_remarks: customer.proposal_remarks || '',
  });

  useEffect(() => {
    setFormData({
      proposal_model: customer.proposal_model || '',
      proposal_variant: customer.proposal_variant || '',
      proposal_color: customer.proposal_color || '',
      proposal_bank: customer.proposal_bank || '',
      proposal_selling_price: customer.proposal_selling_price?.toString() || '',
      proposal_loan_amount: customer.proposal_loan_amount?.toString() || '',
      proposal_interest_rate: customer.proposal_interest_rate?.toString() || '',
      proposal_loan_tenure: customer.proposal_loan_tenure?.toString() || '',
      proposal_downpayment: customer.proposal_downpayment?.toString() || '',
      proposal_trade_in_model: customer.proposal_trade_in_model || '',
      proposal_trade_in_car_plate: customer.proposal_trade_in_car_plate || '',
      proposal_quoted_trade_in_price: customer.proposal_quoted_trade_in_price?.toString() || '',
      proposal_benefit1: customer.proposal_benefit1 || '',
      proposal_benefit2: customer.proposal_benefit2 || '',
      proposal_benefit3: customer.proposal_benefit3 || '',
      proposal_benefit4: customer.proposal_benefit4 || '',
      proposal_remarks: customer.proposal_remarks || '',
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
        proposal_model: formData.proposal_model || null,
        proposal_variant: formData.proposal_variant || null,
        proposal_color: formData.proposal_color || null,
        proposal_bank: formData.proposal_bank || null,
        proposal_selling_price: formData.proposal_selling_price ? Number(formData.proposal_selling_price) : null,
        proposal_loan_amount: formData.proposal_loan_amount ? Number(formData.proposal_loan_amount) : null,
        proposal_interest_rate: formData.proposal_interest_rate ? Number(formData.proposal_interest_rate) : null,
        proposal_loan_tenure: formData.proposal_loan_tenure ? Number(formData.proposal_loan_tenure) : null,
        proposal_downpayment: formData.proposal_downpayment ? Number(formData.proposal_downpayment) : null,
        proposal_trade_in_model: formData.proposal_trade_in_model || null,
        proposal_trade_in_car_plate: formData.proposal_trade_in_car_plate || null,
        proposal_quoted_trade_in_price: formData.proposal_quoted_trade_in_price ? Number(formData.proposal_quoted_trade_in_price) : null,
        proposal_benefit1: formData.proposal_benefit1 || null,
        proposal_benefit2: formData.proposal_benefit2 || null,
        proposal_benefit3: formData.proposal_benefit3 || null,
        proposal_benefit4: formData.proposal_benefit4 || null,
        proposal_remarks: formData.proposal_remarks || null,
      };
      await onUpdate(customer.id, updates);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="proposal-tab">
      {/* Vehicle Section */}
      <section className="details-section">
        <h3 className="section-title">
          <Car size={18} />
          Vehicle Details
        </h3>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Model</label>
            <input
              type="text"
              name="proposal_model"
              value={formData.proposal_model}
              onChange={handleChange}
              placeholder="BYD Seal, BYD Atto 3, etc."
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Variant</label>
            <input
              type="text"
              name="proposal_variant"
              value={formData.proposal_variant}
              onChange={handleChange}
              placeholder="Premium AWD"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Color</label>
            <input
              type="text"
              name="proposal_color"
              value={formData.proposal_color}
              onChange={handleChange}
              placeholder="Arctic White"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Selling Price</label>
            <input
              type="number"
              name="proposal_selling_price"
              value={formData.proposal_selling_price}
              onChange={handleChange}
              placeholder="189888"
              className="form-input"
            />
          </div>
        </div>
      </section>

      {/* Loan Section */}
      <section className="details-section">
        <h3 className="section-title">
          <Banknote size={18} />
          Loan Details
        </h3>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Bank</label>
            <input
              type="text"
              name="proposal_bank"
              value={formData.proposal_bank}
              onChange={handleChange}
              placeholder="DBS, OCBC, UOB, etc."
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Loan Amount</label>
            <input
              type="number"
              name="proposal_loan_amount"
              value={formData.proposal_loan_amount}
              onChange={handleChange}
              placeholder="80000"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Interest Rate (%)</label>
            <input
              type="number"
              name="proposal_interest_rate"
              value={formData.proposal_interest_rate}
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
              name="proposal_loan_tenure"
              value={formData.proposal_loan_tenure}
              onChange={handleChange}
              placeholder="7"
              className="form-input"
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">Downpayment</label>
            <input
              type="number"
              name="proposal_downpayment"
              value={formData.proposal_downpayment}
              onChange={handleChange}
              placeholder="5000"
              className="form-input"
            />
          </div>
        </div>
      </section>

      {/* Trade-In Section */}
      <section className="details-section">
        <h3 className="section-title">Trade-In</h3>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Trade-In Model</label>
            <input
              type="text"
              name="proposal_trade_in_model"
              value={formData.proposal_trade_in_model}
              onChange={handleChange}
              placeholder="Toyota Camry"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Car Plate</label>
            <input
              type="text"
              name="proposal_trade_in_car_plate"
              value={formData.proposal_trade_in_car_plate}
              onChange={handleChange}
              placeholder="SBA1234A"
              className="form-input"
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">Quoted Trade-In Price</label>
            <input
              type="number"
              name="proposal_quoted_trade_in_price"
              value={formData.proposal_quoted_trade_in_price}
              onChange={handleChange}
              placeholder="50000"
              className="form-input"
            />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="details-section">
        <h3 className="section-title">
          <Gift size={18} />
          Benefits & Remarks
        </h3>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Benefit 1</label>
            <input
              type="text"
              name="proposal_benefit1"
              value={formData.proposal_benefit1}
              onChange={handleChange}
              placeholder="Free tinting"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Benefit 2</label>
            <input
              type="text"
              name="proposal_benefit2"
              value={formData.proposal_benefit2}
              onChange={handleChange}
              placeholder="Free floor mats"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Benefit 3</label>
            <input
              type="text"
              name="proposal_benefit3"
              value={formData.proposal_benefit3}
              onChange={handleChange}
              placeholder="Free dashcam"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Benefit 4</label>
            <input
              type="text"
              name="proposal_benefit4"
              value={formData.proposal_benefit4}
              onChange={handleChange}
              placeholder="Extended warranty"
              className="form-input"
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">Remarks</label>
            <textarea
              name="proposal_remarks"
              value={formData.proposal_remarks}
              onChange={handleChange}
              placeholder="Additional remarks or notes..."
              className="form-textarea"
              rows={3}
            />
          </div>
        </div>
      </section>

      <div className="section-actions">
        <Button onClick={handleSave} isLoading={isSaving}>
          <Save size={16} />
          Save Proposal
        </Button>
      </div>
    </div>
  );
}
