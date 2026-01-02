import { useState, useEffect } from 'react';
import { Phone, Envelope, CreditCard, Briefcase, Calendar, MapPin, User, FloppyDisk, UserPlus, Trash } from '@phosphor-icons/react';
import { Button, useToast } from '@/components/common';
import { useCustomerStore } from '@/stores/useCustomerStore';
import type { Customer, Guarantor, CustomerUpdate } from '@/types';

interface DetailsTabProps {
  customer: Customer;
  onUpdate: (id: number, updates: CustomerUpdate) => Promise<void>;
}

export function DetailsTab({ customer, onUpdate }: DetailsTabProps) {
  const { fetchGuarantors, saveGuarantors, isSaving } = useCustomerStore();
  const { success, error: toastError } = useToast();
  const [guarantors, setGuarantors] = useState<Partial<Guarantor>[]>([]);
  const [formData, setFormData] = useState({
    phone: customer.phone || '',
    email: customer.email || '',
    nric: customer.nric || '',
    occupation: customer.occupation || '',
    dob: customer.dob || '',
    license_start_date: customer.license_start_date || '',
    address: customer.address || '',
    address_continue: customer.address_continue || '',
    sales_consultant: customer.sales_consultant || '',
    vsa_no: customer.vsa_no || '',
    notes: customer.notes || '',
  });

  useEffect(() => {
    loadGuarantors();
  }, [customer.id]);

  useEffect(() => {
    setFormData({
      phone: customer.phone || '',
      email: customer.email || '',
      nric: customer.nric || '',
      occupation: customer.occupation || '',
      dob: customer.dob || '',
      license_start_date: customer.license_start_date || '',
      address: customer.address || '',
      address_continue: customer.address_continue || '',
      sales_consultant: customer.sales_consultant || '',
      vsa_no: customer.vsa_no || '',
      notes: customer.notes || '',
    });
  }, [customer]);

  const loadGuarantors = async () => {
    const data = await fetchGuarantors(customer.id);
    setGuarantors(data.length > 0 ? data : []);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    // Convert empty strings to null for date fields
    const updates: CustomerUpdate = {
      ...formData,
      dob: formData.dob || null,
      license_start_date: formData.license_start_date || null,
    };
    try {
      await onUpdate(customer.id, updates);
      success('Customer details saved');
    } catch (err) {
      toastError('Failed to save customer details');
    }
  };

  const handleGuarantorChange = (
    index: number,
    field: string,
    value: string
  ) => {
    setGuarantors((prev) =>
      prev.map((g, i) => (i === index ? { ...g, [field]: value } : g))
    );
  };

  const addGuarantor = () => {
    if (guarantors.length < 5) {
      setGuarantors((prev) => [
        ...prev,
        { name: '', phone: '', email: '', nric: '', occupation: '', dob: '', address: '', address_continue: '' },
      ]);
    }
  };

  const removeGuarantor = (index: number) => {
    setGuarantors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveGuarantors = async () => {
    try {
      await saveGuarantors(customer.id, guarantors);
      success('Guarantors saved');
    } catch (err) {
      toastError('Failed to save guarantors');
    }
  };

  return (
    <div className="details-tab">
      {/* Customer Info Section */}
      <section className="details-section">
        <h3 className="section-title">Customer Information</h3>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">
              <Phone size={16} className="label-icon" />
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+65 9123 4567"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Envelope size={16} className="label-icon" />
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="email@example.com"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <CreditCard size={16} className="label-icon" />
              NRIC/FIN
            </label>
            <input
              type="text"
              name="nric"
              value={formData.nric}
              onChange={handleChange}
              placeholder="S1234567A"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Briefcase size={16} className="label-icon" />
              Occupation
            </label>
            <input
              type="text"
              name="occupation"
              value={formData.occupation}
              onChange={handleChange}
              placeholder="Software Engineer"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Calendar size={16} className="label-icon" />
              Date of Birth
            </label>
            <input
              type="date"
              name="dob"
              value={formData.dob}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Calendar size={16} className="label-icon" />
              License Start Date
            </label>
            <input
              type="date"
              name="license_start_date"
              value={formData.license_start_date}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">
              <MapPin size={16} className="label-icon" />
              Address
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="123 Example Street #01-01"
              className="form-input"
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">Address (continued)</label>
            <input
              type="text"
              name="address_continue"
              value={formData.address_continue}
              onChange={handleChange}
              placeholder="Singapore 123456"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <User size={16} className="label-icon" />
              Sales Consultant
            </label>
            <input
              type="text"
              name="sales_consultant"
              value={formData.sales_consultant}
              onChange={handleChange}
              placeholder="Your name"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">VSA No.</label>
            <input
              type="text"
              name="vsa_no"
              value={formData.vsa_no}
              onChange={handleChange}
              placeholder="VSA-2024-001"
              className="form-input"
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional notes..."
              className="form-textarea"
              rows={3}
            />
          </div>
        </div>

        <div className="section-actions">
          <Button onClick={handleSave} isLoading={isSaving}>
            <FloppyDisk size={16} className="btn-icon" />
            Save Changes
          </Button>
        </div>
      </section>

      {/* Guarantors Section */}
      <section className="details-section">
        <div className="section-header">
          <h3 className="section-title">Guarantors</h3>
          {guarantors.length < 5 && (
            <Button variant="outline" size="sm" onClick={addGuarantor}>
              <UserPlus size={16} className="btn-icon" />
              Add Guarantor
            </Button>
          )}
        </div>

        {guarantors.length === 0 ? (
          <p className="no-guarantors">No guarantors added yet.</p>
        ) : (
          <div className="guarantors-list">
            {guarantors.map((guarantor, index) => (
              <div key={index} className="guarantor-card">
                <div className="guarantor-header">
                  <span className="guarantor-number">
                    Guarantor {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGuarantor(index)}
                    className="danger"
                  >
                    <Trash size={16} className="btn-icon" />
                  </Button>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      value={guarantor.name || ''}
                      onChange={(e) =>
                        handleGuarantorChange(index, 'name', e.target.value)
                      }
                      placeholder="Full name"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="tel"
                      value={guarantor.phone || ''}
                      onChange={(e) =>
                        handleGuarantorChange(index, 'phone', e.target.value)
                      }
                      placeholder="+65 9123 4567"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      value={guarantor.email || ''}
                      onChange={(e) =>
                        handleGuarantorChange(index, 'email', e.target.value)
                      }
                      placeholder="email@example.com"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">NRIC/FIN</label>
                    <input
                      type="text"
                      value={guarantor.nric || ''}
                      onChange={(e) =>
                        handleGuarantorChange(index, 'nric', e.target.value)
                      }
                      placeholder="S1234567A"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Occupation</label>
                    <input
                      type="text"
                      value={guarantor.occupation || ''}
                      onChange={(e) =>
                        handleGuarantorChange(
                          index,
                          'occupation',
                          e.target.value
                        )
                      }
                      placeholder="Occupation"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      value={guarantor.dob || ''}
                      onChange={(e) =>
                        handleGuarantorChange(index, 'dob', e.target.value)
                      }
                      className="form-input"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">Address</label>
                    <input
                      type="text"
                      value={guarantor.address || ''}
                      onChange={(e) =>
                        handleGuarantorChange(index, 'address', e.target.value)
                      }
                      placeholder="Address"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">Address (continued)</label>
                    <input
                      type="text"
                      value={guarantor.address_continue || ''}
                      onChange={(e) =>
                        handleGuarantorChange(
                          index,
                          'address_continue',
                          e.target.value
                        )
                      }
                      placeholder="Singapore 123456"
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {guarantors.length > 0 && (
          <div className="section-actions">
            <Button onClick={handleSaveGuarantors} isLoading={isSaving}>
              <FloppyDisk size={16} className="btn-icon" />
              Save Guarantors
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
