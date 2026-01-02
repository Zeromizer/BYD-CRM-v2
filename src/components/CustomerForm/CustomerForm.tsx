import { useState } from 'react';
import { Camera, User, Phone, Envelope, CreditCard, Briefcase, MapPin } from '@phosphor-icons/react';
import { Button } from '@/components/common';
import { IDScanner, type ScannedData } from '@/components/IDScanner';
import './CustomerForm.css';

interface CustomerFormProps {
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CustomerForm({ initialData, onSubmit, onCancel, isLoading }: CustomerFormProps) {
  const [formData, setFormData] = useState({
    name: (initialData?.name as string) || '',
    phone: (initialData?.phone as string) || '',
    email: (initialData?.email as string) || '',
    nric: (initialData?.nric as string) || '',
    occupation: (initialData?.occupation as string) || '',
    dob: (initialData?.dob as string) || '',
    address: (initialData?.address as string) || '',
    address_continue: (initialData?.address_continue as string) || '',
    sales_consultant: (initialData?.sales_consultant as string) || '',
    notes: (initialData?.notes as string) || '',
  });
  const [showScanner, setShowScanner] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleScanData = (data: ScannedData) => {
    setFormData((prev) => ({
      ...prev,
      name: data.name || prev.name,
      nric: data.nric || prev.nric,
      dob: data.dob || prev.dob,
      address: data.address || prev.address,
      address_continue: data.addressContinue || prev.address_continue,
    }));
    setShowScanner(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="customer-form">
        {/* Scan ID Button - Only show for new customers */}
        {!initialData && (
          <div className="scan-id-section">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowScanner(true)}
              leftIcon={<Camera size={18} />}
              className="scan-id-btn"
            >
              Scan ID / License
            </Button>
            <span className="scan-id-hint">Quickly fill in details by scanning ID card</span>
          </div>
        )}

        <div className="form-grid">
          {/* Name */}
          <div className="form-group full-width">
            <label htmlFor="name" className="form-label required">
              <User size={16} className="label-icon" />
              Customer Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter customer name"
              className="form-input"
              required
            />
          </div>

        {/* Phone */}
        <div className="form-group">
          <label htmlFor="phone" className="form-label">
            <Phone size={16} className="label-icon" />
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+65 9123 4567"
            className="form-input"
          />
        </div>

        {/* Email */}
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            <Envelope size={16} className="label-icon" />
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="email@example.com"
            className="form-input"
          />
        </div>

        {/* NRIC */}
        <div className="form-group">
          <label htmlFor="nric" className="form-label">
            <CreditCard size={16} className="label-icon" />
            NRIC/FIN
          </label>
          <input
            id="nric"
            name="nric"
            type="text"
            value={formData.nric}
            onChange={handleChange}
            placeholder="S1234567A"
            className="form-input"
          />
        </div>

        {/* DOB */}
        <div className="form-group">
          <label htmlFor="dob" className="form-label">
            Date of Birth
          </label>
          <input
            id="dob"
            name="dob"
            type="date"
            value={formData.dob}
            onChange={handleChange}
            className="form-input"
          />
        </div>

        {/* Occupation */}
        <div className="form-group">
          <label htmlFor="occupation" className="form-label">
            <Briefcase size={16} className="label-icon" />
            Occupation
          </label>
          <input
            id="occupation"
            name="occupation"
            type="text"
            value={formData.occupation}
            onChange={handleChange}
            placeholder="Software Engineer"
            className="form-input"
          />
        </div>

        {/* Sales Consultant */}
        <div className="form-group">
          <label htmlFor="sales_consultant" className="form-label">
            Sales Consultant
          </label>
          <input
            id="sales_consultant"
            name="sales_consultant"
            type="text"
            value={formData.sales_consultant}
            onChange={handleChange}
            placeholder="Your name"
            className="form-input"
          />
        </div>

        {/* Address */}
        <div className="form-group full-width">
          <label htmlFor="address" className="form-label">
            <MapPin size={16} className="label-icon" />
            Address
          </label>
          <input
            id="address"
            name="address"
            type="text"
            value={formData.address}
            onChange={handleChange}
            placeholder="123 Example Street #01-01"
            className="form-input"
          />
        </div>

        {/* Address Continue */}
        <div className="form-group full-width">
          <label htmlFor="address_continue" className="form-label">
            Address (continued)
          </label>
          <input
            id="address_continue"
            name="address_continue"
            type="text"
            value={formData.address_continue}
            onChange={handleChange}
            placeholder="Singapore 123456"
            className="form-input"
          />
        </div>

        {/* Notes */}
        <div className="form-group full-width">
          <label htmlFor="notes" className="form-label">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Any additional notes..."
            className="form-textarea"
            rows={3}
          />
        </div>
      </div>

        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {initialData ? 'Save Changes' : 'Add Customer'}
          </Button>
        </div>
      </form>

      {/* ID Scanner Modal */}
      <IDScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onDataExtracted={handleScanData}
      />
    </>
  );
}
