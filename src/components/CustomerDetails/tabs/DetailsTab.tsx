import { useState, useEffect, useTransition } from 'react'
import {
  Phone,
  Envelope,
  CreditCard,
  Briefcase,
  Calendar,
  MapPin,
  User,
  FloppyDisk,
  UserPlus,
  Trash,
  Users,
  Note,
  IdentificationCard,
} from '@phosphor-icons/react'
import { Button, useToast, CollapsibleSection } from '@/components/common'
import { useCustomerStore } from '@/stores/useCustomerStore'
import type { Customer, Guarantor, CustomerUpdate } from '@/types'

interface DetailsTabProps {
  customer: Customer
  onUpdate: (id: number, updates: CustomerUpdate) => Promise<void>
}

export function DetailsTab({ customer, onUpdate }: DetailsTabProps) {
  const { fetchGuarantors, saveGuarantors } = useCustomerStore()
  const { success, error: toastError } = useToast()
  const [isPending, startTransition] = useTransition()
  const [guarantors, setGuarantors] = useState<Partial<Guarantor>[]>([])
  const [formData, setFormData] = useState({
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    nric: customer.nric ?? '',
    occupation: customer.occupation ?? '',
    dob: customer.dob ?? '',
    license_start_date: customer.license_start_date ?? '',
    address: customer.address ?? '',
    address_continue: customer.address_continue ?? '',
    sales_consultant: customer.sales_consultant ?? '',
    vsa_no: customer.vsa_no ?? '',
    notes: customer.notes ?? '',
  })

  useEffect(() => {
    void loadGuarantors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id])

  useEffect(() => {
    setFormData({
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      nric: customer.nric ?? '',
      occupation: customer.occupation ?? '',
      dob: customer.dob ?? '',
      license_start_date: customer.license_start_date ?? '',
      address: customer.address ?? '',
      address_continue: customer.address_continue ?? '',
      sales_consultant: customer.sales_consultant ?? '',
      vsa_no: customer.vsa_no ?? '',
      notes: customer.notes ?? '',
    })
  }, [customer])

  // Pre-fill DOB with 30 years ago if empty (for easier date selection)
  useEffect(() => {
    if (!formData.dob && !customer.dob) {
      const defaultYear = new Date().getFullYear() - 30
      setFormData((prev) => ({ ...prev, dob: `${defaultYear}-01-01` }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id])

  // Load last used Sales Consultant from localStorage if field is empty
  useEffect(() => {
    if (!formData.sales_consultant && !customer.sales_consultant) {
      const lastConsultant = localStorage.getItem('lastSalesConsultant')
      if (lastConsultant) {
        setFormData((prev) => ({ ...prev, sales_consultant: lastConsultant }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id])

  const loadGuarantors = async () => {
    const data = await fetchGuarantors(customer.id)
    setGuarantors(data.length > 0 ? data : [])
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = () => {
    const updates: CustomerUpdate = {
      ...formData,
      dob: formData.dob ?? null,
      license_start_date: formData.license_start_date ?? null,
    }
    startTransition(async () => {
      try {
        if (formData.sales_consultant) {
          localStorage.setItem('lastSalesConsultant', formData.sales_consultant)
        }
        await onUpdate(customer.id, updates)
        success('Customer details saved')
      } catch (_err) {
        toastError('Failed to save customer details')
      }
    })
  }

  const handleGuarantorChange = (index: number, field: string, value: string) => {
    setGuarantors((prev) => prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)))
  }

  const addGuarantor = () => {
    if (guarantors.length < 5) {
      setGuarantors((prev) => [
        ...prev,
        {
          name: '',
          phone: '',
          email: '',
          nric: '',
          occupation: '',
          dob: '',
          address: '',
          address_continue: '',
        },
      ])
    }
  }

  const removeGuarantor = (index: number) => {
    setGuarantors((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSaveGuarantors = () => {
    startTransition(async () => {
      try {
        await saveGuarantors(customer.id, guarantors)
        success('Guarantors saved')
      } catch (_err) {
        toastError('Failed to save guarantors')
      }
    })
  }

  return (
    <div className="details-tab">
      {/* Contact Information - Primary, always expanded */}
      <CollapsibleSection
        title="Contact Information"
        icon={<Phone size={18} />}
        defaultExpanded={true}
        persistKey="details-contact"
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">
              <Phone size={16} />
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
              <Envelope size={16} />
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
        </div>
      </CollapsibleSection>

      {/* Identity & Personal - Secondary, collapsed by default */}
      <CollapsibleSection
        title="Identity & Personal"
        icon={<IdentificationCard size={18} />}
        defaultExpanded={false}
        persistKey="details-identity"
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">
              <CreditCard size={16} />
              NRIC/FIN
            </label>
            <input
              type="text"
              name="nric"
              value={formData.nric}
              onChange={handleChange}
              placeholder="S1234567A"
              className="form-input data-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Briefcase size={16} />
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
              <Calendar size={16} />
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
              <Calendar size={16} />
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
        </div>
      </CollapsibleSection>

      {/* Address - Collapsed by default */}
      <CollapsibleSection
        title="Address"
        icon={<MapPin size={18} />}
        defaultExpanded={false}
        persistKey="details-address"
      >
        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label">
              <MapPin size={16} />
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
        </div>
      </CollapsibleSection>

      {/* Sales Information - Collapsed by default */}
      <CollapsibleSection
        title="Sales Information"
        icon={<User size={18} />}
        defaultExpanded={false}
        persistKey="details-sales"
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">
              <User size={16} />
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
              placeholder="BYD80001"
              className="form-input data-input"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Notes - Collapsed by default */}
      <CollapsibleSection
        title="Notes"
        icon={<Note size={18} />}
        defaultExpanded={false}
        persistKey="details-notes"
      >
        <div className="form-group">
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Any additional notes..."
            className="form-textarea"
            rows={4}
          />
        </div>
      </CollapsibleSection>

      {/* Save Button - Always visible */}
      <div className="section-actions sticky-actions">
        <Button onClick={handleSave} isLoading={isPending}>
          <FloppyDisk size={16} />
          Save Changes
        </Button>
      </div>

      {/* Guarantors - Collapsed with badge showing count */}
      <CollapsibleSection
        title="Guarantors"
        icon={<Users size={18} />}
        badge={guarantors.length || undefined}
        defaultExpanded={false}
        persistKey="details-guarantors"
      >
        <div className="guarantors-header">
          {guarantors.length < 5 && (
            <Button variant="outline" size="sm" onClick={addGuarantor}>
              <UserPlus size={16} />
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
                  <span className="guarantor-number">Guarantor {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGuarantor(index)}
                    className="danger"
                  >
                    <Trash size={16} />
                  </Button>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      value={guarantor.name ?? ''}
                      onChange={(e) => handleGuarantorChange(index, 'name', e.target.value)}
                      placeholder="Full name"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="tel"
                      value={guarantor.phone ?? ''}
                      onChange={(e) => handleGuarantorChange(index, 'phone', e.target.value)}
                      placeholder="+65 9123 4567"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      value={guarantor.email ?? ''}
                      onChange={(e) => handleGuarantorChange(index, 'email', e.target.value)}
                      placeholder="email@example.com"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">NRIC/FIN</label>
                    <input
                      type="text"
                      value={guarantor.nric ?? ''}
                      onChange={(e) => handleGuarantorChange(index, 'nric', e.target.value)}
                      placeholder="S1234567A"
                      className="form-input data-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Occupation</label>
                    <input
                      type="text"
                      value={guarantor.occupation ?? ''}
                      onChange={(e) => handleGuarantorChange(index, 'occupation', e.target.value)}
                      placeholder="Occupation"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      value={guarantor.dob ?? ''}
                      onChange={(e) => handleGuarantorChange(index, 'dob', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">Address</label>
                    <input
                      type="text"
                      value={guarantor.address ?? ''}
                      onChange={(e) => handleGuarantorChange(index, 'address', e.target.value)}
                      placeholder="Address"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">Address (continued)</label>
                    <input
                      type="text"
                      value={guarantor.address_continue ?? ''}
                      onChange={(e) =>
                        handleGuarantorChange(index, 'address_continue', e.target.value)
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
            <Button onClick={handleSaveGuarantors} isLoading={isPending}>
              <FloppyDisk size={16} />
              Save Guarantors
            </Button>
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
}
