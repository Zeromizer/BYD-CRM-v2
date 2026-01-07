import { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import { Car, Money, ArrowsClockwise, Gift, FloppyDisk, Note } from '@phosphor-icons/react';
import { Button, useToast, CollapsibleSection } from '@/components/common';
import type { Customer, CustomerUpdate } from '@/types';
import {
  VEHICLE_MODELS_GROUPED,
  BANKS,
  BENEFITS_GROUPED,
} from '@/constants/vehicleData';

interface ProposalTabProps {
  customer: Customer;
  onUpdate: (id: number, updates: CustomerUpdate) => Promise<void>;
}

export function ProposalTab({ customer, onUpdate }: ProposalTabProps) {
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useToast();
  const loanAmountManuallyEdited = useRef(false);
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
    proposal_admin_fee: customer.proposal_admin_fee?.toString() || '',
    proposal_referral_fee: customer.proposal_referral_fee?.toString() || '',
    proposal_trade_in_model: customer.proposal_trade_in_model || '',
    proposal_trade_in_car_plate: customer.proposal_trade_in_car_plate || '',
    proposal_quoted_trade_in_price: customer.proposal_quoted_trade_in_price?.toString() || '',
    proposal_low_loan_surcharge: customer.proposal_low_loan_surcharge?.toString() || '',
    proposal_no_loan_surcharge: customer.proposal_no_loan_surcharge?.toString() || '',
    proposal_benefit1: customer.proposal_benefit1 || '',
    proposal_benefit2: customer.proposal_benefit2 || '',
    proposal_benefit3: customer.proposal_benefit3 || '',
    proposal_benefit4: customer.proposal_benefit4 || '',
    proposal_benefit5: customer.proposal_benefit5 || '',
    proposal_benefit6: customer.proposal_benefit6 || '',
    proposal_benefit7: customer.proposal_benefit7 || '',
    proposal_benefit8: customer.proposal_benefit8 || '',
    proposal_benefit9: customer.proposal_benefit9 || '',
    proposal_benefits_given: customer.proposal_benefits_given || '',
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
      proposal_admin_fee: customer.proposal_admin_fee?.toString() || '',
      proposal_referral_fee: customer.proposal_referral_fee?.toString() || '',
      proposal_trade_in_model: customer.proposal_trade_in_model || '',
      proposal_trade_in_car_plate: customer.proposal_trade_in_car_plate || '',
      proposal_quoted_trade_in_price: customer.proposal_quoted_trade_in_price?.toString() || '',
      proposal_low_loan_surcharge: customer.proposal_low_loan_surcharge?.toString() || '',
      proposal_no_loan_surcharge: customer.proposal_no_loan_surcharge?.toString() || '',
      proposal_benefit1: customer.proposal_benefit1 || '',
      proposal_benefit2: customer.proposal_benefit2 || '',
      proposal_benefit3: customer.proposal_benefit3 || '',
      proposal_benefit4: customer.proposal_benefit4 || '',
      proposal_benefit5: customer.proposal_benefit5 || '',
      proposal_benefit6: customer.proposal_benefit6 || '',
      proposal_benefit7: customer.proposal_benefit7 || '',
      proposal_benefit8: customer.proposal_benefit8 || '',
      proposal_benefit9: customer.proposal_benefit9 || '',
      proposal_benefits_given: customer.proposal_benefits_given || '',
      proposal_remarks: customer.proposal_remarks || '',
    });
  }, [customer]);

  // Count selected benefits
  const selectedBenefitsCount = useMemo(() => {
    return [
      formData.proposal_benefit1,
      formData.proposal_benefit2,
      formData.proposal_benefit3,
      formData.proposal_benefit4,
      formData.proposal_benefit5,
      formData.proposal_benefit6,
      formData.proposal_benefit7,
      formData.proposal_benefit8,
      formData.proposal_benefit9,
    ].filter(Boolean).length;
  }, [formData]);

  // Check if has trade-in
  const hasTradeIn = Boolean(formData.proposal_trade_in_model || formData.proposal_trade_in_car_plate);

  // Auto-calculate loan amount when selling price or downpayment changes
  useEffect(() => {
    if (loanAmountManuallyEdited.current) return;

    const sellingPrice = parseFloat(formData.proposal_selling_price) || 0;
    const downpayment = parseFloat(formData.proposal_downpayment) || 0;

    if (sellingPrice > 0 && downpayment >= 0) {
      const calculatedLoanAmount = sellingPrice - downpayment;
      if (calculatedLoanAmount >= 0) {
        setFormData((prev) => ({
          ...prev,
          proposal_loan_amount: calculatedLoanAmount.toString(),
        }));
      }
    }
  }, [formData.proposal_selling_price, formData.proposal_downpayment]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'proposal_loan_amount') {
      loanAmountManuallyEdited.current = true;
    }
    if (name === 'proposal_selling_price' || name === 'proposal_downpayment') {
      loanAmountManuallyEdited.current = false;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
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
      proposal_admin_fee: formData.proposal_admin_fee ? Number(formData.proposal_admin_fee) : null,
      proposal_referral_fee: formData.proposal_referral_fee ? Number(formData.proposal_referral_fee) : null,
      proposal_trade_in_model: formData.proposal_trade_in_model || null,
      proposal_trade_in_car_plate: formData.proposal_trade_in_car_plate || null,
      proposal_quoted_trade_in_price: formData.proposal_quoted_trade_in_price ? Number(formData.proposal_quoted_trade_in_price) : null,
      proposal_low_loan_surcharge: formData.proposal_low_loan_surcharge ? Number(formData.proposal_low_loan_surcharge) : null,
      proposal_no_loan_surcharge: formData.proposal_no_loan_surcharge ? Number(formData.proposal_no_loan_surcharge) : null,
      proposal_benefit1: formData.proposal_benefit1 || null,
      proposal_benefit2: formData.proposal_benefit2 || null,
      proposal_benefit3: formData.proposal_benefit3 || null,
      proposal_benefit4: formData.proposal_benefit4 || null,
      proposal_benefit5: formData.proposal_benefit5 || null,
      proposal_benefit6: formData.proposal_benefit6 || null,
      proposal_benefit7: formData.proposal_benefit7 || null,
      proposal_benefit8: formData.proposal_benefit8 || null,
      proposal_benefit9: formData.proposal_benefit9 || null,
      proposal_benefits_given: formData.proposal_benefits_given || null,
      proposal_remarks: formData.proposal_remarks || null,
    };
    startTransition(async () => {
      try {
        await onUpdate(customer.id, updates);
        success('Proposal saved');
      } catch (err) {
        toastError('Failed to save proposal');
      }
    });
  };

  return (
    <div className="proposal-tab">
      {/* Vehicle Section - Primary, always expanded */}
      <CollapsibleSection
        title="Vehicle"
        icon={<Car size={18} />}
        defaultExpanded={true}
        persistKey="proposal-vehicle"
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Model</label>
            <select
              name="proposal_model"
              aria-label="Vehicle Model"
              value={formData.proposal_model}
              onChange={handleChange}
              className="form-select"
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
      </CollapsibleSection>

      {/* Financing Section - Primary, expanded */}
      <CollapsibleSection
        title="Financing"
        icon={<Money size={18} />}
        defaultExpanded={true}
        persistKey="proposal-financing"
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Bank</label>
            <select
              name="proposal_bank"
              aria-label="Bank"
              value={formData.proposal_bank}
              onChange={handleChange}
              className="form-select"
            >
              <option value="">Select Bank</option>
              {BANKS.map((bank) => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
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
            <label className="form-label">Downpayment</label>
            <input
              type="number"
              name="proposal_downpayment"
              value={formData.proposal_downpayment}
              onChange={handleChange}
              placeholder="18588"
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
              placeholder="150000"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Loan Tenure (months)</label>
            <input
              type="number"
              name="proposal_loan_tenure"
              value={formData.proposal_loan_tenure}
              onChange={handleChange}
              placeholder="84"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Admin Fee</label>
            <input
              type="number"
              name="proposal_admin_fee"
              value={formData.proposal_admin_fee}
              onChange={handleChange}
              placeholder="500"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Referral Fee</label>
            <input
              type="number"
              name="proposal_referral_fee"
              value={formData.proposal_referral_fee}
              onChange={handleChange}
              placeholder="500"
              className="form-input"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Trade-In Section - Collapsed, expand if has trade-in */}
      <CollapsibleSection
        title="Trade-In"
        icon={<ArrowsClockwise size={18} />}
        defaultExpanded={hasTradeIn}
        persistKey="proposal-tradein"
      >
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
              className="form-input data-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Quoted Trade-In Price</label>
            <input
              type="number"
              name="proposal_quoted_trade_in_price"
              value={formData.proposal_quoted_trade_in_price}
              onChange={handleChange}
              placeholder="15000"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Low Loan Surcharge</label>
            <input
              type="number"
              name="proposal_low_loan_surcharge"
              value={formData.proposal_low_loan_surcharge}
              onChange={handleChange}
              placeholder="1000"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">No Loan Surcharge</label>
            <input
              type="number"
              name="proposal_no_loan_surcharge"
              value={formData.proposal_no_loan_surcharge}
              onChange={handleChange}
              placeholder="2000"
              className="form-input"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Benefits Section - Collapsed with count badge */}
      <CollapsibleSection
        title="Benefits"
        icon={<Gift size={18} />}
        badge={selectedBenefitsCount || undefined}
        defaultExpanded={false}
        persistKey="proposal-benefits"
      >
        <div className="form-grid form-grid-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <div className="form-group" key={num}>
              <label className="form-label">Benefit {num}</label>
              <select
                name={`proposal_benefit${num}`}
                aria-label={`Benefit ${num}`}
                value={formData[`proposal_benefit${num}` as keyof typeof formData] || ''}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select</option>
                {BENEFITS_GROUPED.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.benefits.map((benefit) => (
                      <option key={benefit} value={benefit}>{benefit}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="form-group full-width" style={{ marginTop: 'var(--space-4)' }}>
          <label className="form-label">Benefits Summary</label>
          <textarea
            name="proposal_benefits_given"
            value={formData.proposal_benefits_given}
            onChange={handleChange}
            placeholder="Summary of all benefits given..."
            className="form-textarea"
            rows={2}
          />
        </div>
      </CollapsibleSection>

      {/* Remarks Section - Collapsed */}
      <CollapsibleSection
        title="Remarks"
        icon={<Note size={18} />}
        defaultExpanded={false}
        persistKey="proposal-remarks"
      >
        <div className="form-group">
          <textarea
            name="proposal_remarks"
            value={formData.proposal_remarks}
            onChange={handleChange}
            placeholder="Additional remarks or notes..."
            className="form-textarea"
            rows={4}
          />
        </div>
      </CollapsibleSection>

      {/* Save Button - Always visible */}
      <div className="section-actions sticky-actions">
        <Button onClick={handleSave} isLoading={isPending}>
          <FloppyDisk size={16} />
          Save Proposal
        </Button>
      </div>
    </div>
  );
}
