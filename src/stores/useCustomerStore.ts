/**
 * Customer Store
 * Manages customer data with Supabase integration
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Customer, CustomerInsert, CustomerUpdate, Guarantor, MilestoneId } from '@/types';
import { getDefaultChecklistState, getDefaultMilestoneDates, getDefaultDocumentChecklistState } from '@/constants';

interface CustomerState {
  customers: Customer[];
  selectedCustomerId: number | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

interface CustomerActions {
  // CRUD
  fetchCustomers: () => Promise<void>;
  fetchCustomerById: (id: number) => Promise<Customer | null>;
  createCustomer: (data: Partial<CustomerInsert>) => Promise<Customer>;
  updateCustomer: (id: number, updates: CustomerUpdate) => Promise<void>;
  deleteCustomer: (id: number) => Promise<void>;

  // Selection
  selectCustomer: (id: number | null) => void;

  // Checklist
  updateChecklistItem: (customerId: number, milestoneId: MilestoneId, itemId: string, checked: boolean) => Promise<void>;
  setCurrentMilestone: (customerId: number, milestoneId: MilestoneId) => Promise<void>;

  // Archive
  archiveCustomer: (id: number, status: 'lost' | 'completed') => Promise<void>;
  unarchiveCustomer: (id: number) => Promise<void>;

  // Guarantors
  fetchGuarantors: (customerId: number) => Promise<Guarantor[]>;
  saveGuarantors: (customerId: number, guarantors: Partial<Guarantor>[]) => Promise<void>;

  // Realtime
  subscribeToChanges: () => () => void;

  // Utility
  clearError: () => void;
}

export const useCustomerStore = create<CustomerState & CustomerActions>((set, get) => ({
  customers: [],
  selectedCustomerId: null,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchCustomers: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ customers: data as Customer[], isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchCustomerById: async (id) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return data as Customer;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  createCustomer: async (data) => {
    set({ isSaving: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Helper to convert empty strings to null for optional fields
      const toNullIfEmpty = (value: string | null | undefined): string | null => {
        if (value === undefined || value === null || value === '') return null;
        return value;
      };

      const customerData = {
        user_id: user.id,
        name: data.name || 'New Customer',
        phone: toNullIfEmpty(data.phone),
        email: toNullIfEmpty(data.email),
        nric: toNullIfEmpty(data.nric),
        occupation: toNullIfEmpty(data.occupation),
        dob: toNullIfEmpty(data.dob),
        license_start_date: toNullIfEmpty(data.license_start_date),
        address: toNullIfEmpty(data.address),
        address_continue: toNullIfEmpty(data.address_continue),
        sales_consultant: toNullIfEmpty(data.sales_consultant),
        vsa_no: toNullIfEmpty(data.vsa_no),
        notes: toNullIfEmpty(data.notes),
        archive_status: null,
        archived_at: null,
        deal_closed: false,
        current_milestone: 'test_drive' as const,
        checklist: getDefaultChecklistState(),
        milestone_dates: getDefaultMilestoneDates(),
        document_checklist: getDefaultDocumentChecklistState(),
      };

      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw new Error(error.message || 'Failed to create customer');
      }

      set((state) => ({
        customers: [newCustomer as Customer, ...state.customers],
        isSaving: false,
      }));

      return newCustomer as Customer;
    } catch (error) {
      set({ error: (error as Error).message, isSaving: false });
      throw error;
    }
  },

  updateCustomer: async (id, updates) => {
    set({ isSaving: true, error: null });
    try {
      const { error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        customers: state.customers.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
        isSaving: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isSaving: false });
      throw error;
    }
  },

  deleteCustomer: async (id) => {
    set({ isSaving: true, error: null });
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        customers: state.customers.filter((c) => c.id !== id),
        selectedCustomerId: state.selectedCustomerId === id ? null : state.selectedCustomerId,
        isSaving: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isSaving: false });
      throw error;
    }
  },

  selectCustomer: (id) => {
    set({ selectedCustomerId: id });
  },

  updateChecklistItem: async (customerId, milestoneId, itemId, checked) => {
    const customer = get().customers.find((c) => c.id === customerId);
    if (!customer) return;

    const updatedChecklist = {
      ...customer.checklist,
      [milestoneId]: {
        ...customer.checklist[milestoneId],
        [itemId]: checked,
      },
    };

    await get().updateCustomer(customerId, { checklist: updatedChecklist });
  },

  setCurrentMilestone: async (customerId, milestoneId) => {
    const customer = get().customers.find((c) => c.id === customerId);
    if (!customer) return;

    const updatedChecklist = {
      ...customer.checklist,
      currentMilestone: milestoneId,
    };

    await get().updateCustomer(customerId, { checklist: updatedChecklist });
  },

  archiveCustomer: async (id, status) => {
    await get().updateCustomer(id, {
      archive_status: status,
      archived_at: new Date().toISOString(),
    });
  },

  unarchiveCustomer: async (id) => {
    await get().updateCustomer(id, {
      archive_status: null,
      archived_at: null,
    });
  },

  fetchGuarantors: async (customerId) => {
    try {
      const { data, error } = await supabase
        .from('guarantors')
        .select('*')
        .eq('customer_id', customerId)
        .order('position');

      if (error) throw error;

      return data as Guarantor[];
    } catch (error) {
      set({ error: (error as Error).message });
      return [];
    }
  },

  saveGuarantors: async (customerId, guarantors) => {
    set({ isSaving: true, error: null });
    try {
      // Delete existing guarantors
      await supabase
        .from('guarantors')
        .delete()
        .eq('customer_id', customerId);

      // Insert new guarantors
      if (guarantors.length > 0) {
        const guarantorData = guarantors.map((g, index) => ({
          customer_id: customerId,
          position: index + 1,
          name: g.name || '',
          phone: g.phone || null,
          email: g.email || null,
          nric: g.nric || null,
          occupation: g.occupation || null,
          dob: g.dob || null,
          address: g.address || null,
          address_continue: g.address_continue || null,
        }));

        const { error } = await supabase
          .from('guarantors')
          .insert(guarantorData);

        if (error) throw error;
      }

      set({ isSaving: false });
    } catch (error) {
      set({ error: (error as Error).message, isSaving: false });
      throw error;
    }
  },

  subscribeToChanges: () => {
    const channel = supabase
      .channel('customers_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        (payload) => {
          const { eventType } = payload;

          if (eventType === 'INSERT') {
            set((state) => ({
              customers: [payload.new as Customer, ...state.customers],
            }));
          } else if (eventType === 'UPDATE') {
            set((state) => ({
              customers: state.customers.map((c) =>
                c.id === (payload.new as Customer).id ? (payload.new as Customer) : c
              ),
            }));
          } else if (eventType === 'DELETE') {
            set((state) => ({
              customers: state.customers.filter((c) => c.id !== (payload.old as Customer).id),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },

  clearError: () => set({ error: null }),
}));

// Selector hooks
export const useCustomers = () => useCustomerStore((state) => state.customers);
export const useSelectedCustomerId = () => useCustomerStore((state) => state.selectedCustomerId);
export const useSelectedCustomer = () => {
  const customers = useCustomerStore((state) => state.customers);
  const selectedId = useCustomerStore((state) => state.selectedCustomerId);
  return customers.find((c) => c.id === selectedId) || null;
};
export const useCustomerLoading = () => useCustomerStore((state) => state.isLoading);
export const useCustomerSaving = () => useCustomerStore((state) => state.isSaving);
export const useCustomerError = () => useCustomerStore((state) => state.error);

// Filtered selectors
export const useActiveCustomers = () => useCustomerStore((state) =>
  state.customers.filter((c) => !c.archive_status)
);
export const useArchivedCustomers = () => useCustomerStore((state) =>
  state.customers.filter((c) => c.archive_status)
);
