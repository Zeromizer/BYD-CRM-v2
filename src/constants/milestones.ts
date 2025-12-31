/**
 * Milestone and Checklist Configuration
 * Defines the stages of customer journey in the CRM
 */

import type { MilestoneId, MilestoneDates, ChecklistState, DocumentChecklistState } from '@/types';

export interface Milestone {
  id: MilestoneId;
  name: string;
  shortName: string;
  color: string;
  iconName: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
}

export const MILESTONES: Milestone[] = [
  {
    id: 'test_drive',
    name: 'Test Drive',
    shortName: 'TD',
    color: '#64748b', // Slate - neutral professional start
    iconName: 'Car',
  },
  {
    id: 'close_deal',
    name: 'COE Bidding',
    shortName: 'COE',
    color: '#0891b2', // Cyan - business progress
    iconName: 'Handshake',
  },
  {
    id: 'registration',
    name: 'Registration',
    shortName: 'REG',
    color: '#6366f1', // Indigo - process/documentation
    iconName: 'ClipboardCheck',
  },
  {
    id: 'delivery',
    name: 'Delivery',
    shortName: 'DEL',
    color: '#059669', // Emerald - completion/success
    iconName: 'Package',
  },
  {
    id: 'nps',
    name: 'NPS',
    shortName: 'NPS',
    color: '#d97706', // Amber - feedback/rating
    iconName: 'Star',
  },
];

export const CHECKLISTS: Record<MilestoneId, ChecklistItem[]> = {
  test_drive: [
    { id: 'customer_details_filled', label: 'Customer Details Filled' },
    { id: 'id_scanned', label: 'ID Scanned' },
    { id: 'test_drive_form', label: 'Test Drive Form' },
    { id: 'input_byd_crm_td', label: 'Input BYD CRM' },
  ],
  close_deal: [
    { id: 'vsa_details_filled', label: 'VSA Details Filled' },
    { id: 'vsa_pdpa_coe_forms', label: 'VSA Form, PDPA Form & COE Bidding Form' },
    { id: 'input_byd_crm_cd', label: 'Input BYD CRM' },
    { id: 'submit_insurance_quotation', label: 'Submit Insurance Quotation' },
    { id: 'loan_approved', label: 'Loan Approved' },
  ],
  registration: [
    { id: 'insurance_details_filled', label: 'Insurance Details Filled' },
    { id: 'insurance_accepted', label: 'Insurance Accepted' },
    { id: 'performa_invoice_balance_payment', label: 'Prepare Performa Invoice for Balance Payment' },
    { id: 'balance_payment_secured', label: 'Balance Payment Secured, Input BYD CRM' },
  ],
  delivery: [
    { id: 'delivery_details_filled', label: 'Delivery Details Filled' },
    { id: 'delivery_checklist_form', label: 'Delivery Checklist Form, Declaration of Insurance Cancellation Form' },
    { id: 'input_byd_crm_dlink', label: 'Input BYD CRM (DLink)' },
    { id: 'insurance_forms_printed', label: 'Insurance Forms Printed' },
    { id: 'performa_invoice_copy', label: 'Copy of Performa Invoice for Customer' },
    { id: 'remaining_delivery_items', label: 'Any Remaining Delivery items or gifts to be prepared' },
  ],
  nps: [
    { id: 'nps_survey_sent', label: 'NPS Survey Sent' },
    { id: 'nps_response_received', label: 'NPS Response Received' },
  ],
};

/**
 * Get default milestone dates structure for a new customer
 */
export function getDefaultMilestoneDates(): MilestoneDates {
  return {
    test_drive: null,
    close_deal: null,
    registration: null,
    delivery: null,
    nps: null,
  };
}

/**
 * Get default document checklist state for a new customer
 */
export function getDefaultDocumentChecklistState(): DocumentChecklistState {
  return {
    test_drive: {},
    close_deal: {},
    registration: {},
    delivery: {},
    nps: {},
  };
}

/**
 * Get default checklist state for a new customer
 */
export function getDefaultChecklistState(): ChecklistState {
  const state: ChecklistState = {
    currentMilestone: 'test_drive',
    test_drive: {},
    close_deal: {},
    registration: {},
    delivery: {},
    nps: {},
  };

  // Initialize all checklist items as unchecked
  (Object.keys(CHECKLISTS) as MilestoneId[]).forEach((milestoneId) => {
    CHECKLISTS[milestoneId].forEach((item) => {
      state[milestoneId][item.id] = false;
    });
  });

  return state;
}

/**
 * Calculate days remaining until a milestone date
 */
export function getDaysUntilMilestone(dateString: string | null): number | null {
  if (!dateString) return null;
  const targetDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Get milestone urgency based on days remaining
 */
export function getMilestoneUrgency(dateString: string | null): 'overdue' | 'urgent' | 'soon' | 'upcoming' | null {
  const days = getDaysUntilMilestone(dateString);
  if (days === null) return null;
  if (days < 0) return 'overdue';
  if (days <= 3) return 'urgent';
  if (days <= 7) return 'soon';
  return 'upcoming';
}

/**
 * Calculate milestone completion percentage
 */
export function getMilestoneProgress(milestoneId: MilestoneId, checklistState: ChecklistState | null): number {
  if (!checklistState || !checklistState[milestoneId]) {
    return 0;
  }

  const items = CHECKLISTS[milestoneId];
  if (!items || items.length === 0) return 0;

  const completed = items.filter((item) => checklistState[milestoneId][item.id]).length;
  return Math.round((completed / items.length) * 100);
}

/**
 * Check if a milestone is complete
 */
export function isMilestoneComplete(milestoneId: MilestoneId, checklistState: ChecklistState | null): boolean {
  return getMilestoneProgress(milestoneId, checklistState) === 100;
}

/**
 * Get overall progress across all milestones
 */
export function getOverallProgress(checklistState: ChecklistState | null): number {
  if (!checklistState) return 0;

  let totalItems = 0;
  let completedItems = 0;

  (Object.keys(CHECKLISTS) as MilestoneId[]).forEach((milestoneId) => {
    const items = CHECKLISTS[milestoneId];
    totalItems += items.length;
    if (checklistState[milestoneId]) {
      items.forEach((item) => {
        if (checklistState[milestoneId][item.id]) {
          completedItems++;
        }
      });
    }
  });

  return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
}

/**
 * Get the index of a milestone in the MILESTONES array
 */
export function getMilestoneIndex(milestoneId: MilestoneId): number {
  return MILESTONES.findIndex((m) => m.id === milestoneId);
}

/**
 * Get milestone by ID
 */
export function getMilestoneById(milestoneId: MilestoneId): Milestone | undefined {
  return MILESTONES.find((m) => m.id === milestoneId);
}
