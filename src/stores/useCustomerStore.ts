/**
 * Customer Store
 * Manages customer data with Supabase integration
 *
 * Uses Zustand middleware stack (outer to inner):
 * - devtools: Redux DevTools integration for debugging
 * - persist: localStorage persistence for selectedCustomerId
 * - subscribeWithSelector: Fine-grained subscriptions for performance
 * - immer: Simplified immutable state updates
 */

import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { getSupabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Customer, CustomerInsert, CustomerUpdate, Guarantor, MilestoneId } from '@/types'
import {
  getDefaultChecklistState,
  getDefaultMilestoneDates,
  getDefaultDocumentChecklistState,
} from '@/constants'
import { deleteEntireCustomerFolder } from '@/services/customerDocumentService'

// Pagination settings
const PAGE_SIZE = 50

interface CustomerState {
  customers: Customer[]
  selectedCustomerId: number | null
  isLoading: boolean
  isLoadingMore: boolean
  isSaving: boolean
  error: string | null
  hasMore: boolean
  _channel: RealtimeChannel | null
}

interface CustomerActions {
  // CRUD
  fetchCustomers: () => Promise<void>
  fetchMoreCustomers: () => Promise<void>
  fetchCustomerById: (id: number) => Promise<Customer | null>
  createCustomer: (data: Partial<CustomerInsert>) => Promise<Customer>
  updateCustomer: (id: number, updates: CustomerUpdate) => Promise<void>
  deleteCustomer: (id: number) => Promise<void>

  // Selection
  selectCustomer: (id: number | null) => void

  // Checklist
  updateChecklistItem: (
    customerId: number,
    milestoneId: MilestoneId,
    itemId: string,
    checked: boolean
  ) => Promise<void>
  setCurrentMilestone: (customerId: number, milestoneId: MilestoneId) => Promise<void>

  // Archive
  archiveCustomer: (id: number, status: 'lost' | 'completed') => Promise<void>
  unarchiveCustomer: (id: number) => Promise<void>

  // Guarantors
  fetchGuarantors: (customerId: number) => Promise<Guarantor[]>
  saveGuarantors: (customerId: number, guarantors: Partial<Guarantor>[]) => Promise<void>

  // Realtime
  subscribeToChanges: () => () => void

  // Utility
  clearError: () => void
}

export const useCustomerStore = create<CustomerState & CustomerActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          customers: [],
          selectedCustomerId: null,
          isLoading: false,
          isLoadingMore: false,
          isSaving: false,
          error: null,
          hasMore: true,
          _channel: null,

          fetchCustomers: async () => {
            set((state) => {
              state.isLoading = true
              state.error = null
            })
            try {
              // Fetch all columns - needed for customer details view
              const { data, error } = await getSupabase()
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false })
                .range(0, PAGE_SIZE - 1)

              if (error) throw error

              const customers = data as Customer[]
              set((state) => {
                state.customers = customers
                state.isLoading = false
                state.hasMore = customers.length === PAGE_SIZE
              })
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isLoading = false
              })
            }
          },

          fetchMoreCustomers: async () => {
            const { customers, isLoadingMore, hasMore } = get()
            if (isLoadingMore || !hasMore) return

            set((state) => {
              state.isLoadingMore = true
              state.error = null
            })
            try {
              const offset = customers.length
              // Fetch all columns - needed for customer details view
              const { data, error } = await getSupabase()
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false })
                .range(offset, offset + PAGE_SIZE - 1)

              if (error) throw error

              const newCustomers = data as Customer[]
              set((state) => {
                state.customers.push(...newCustomers)
                state.isLoadingMore = false
                state.hasMore = newCustomers.length === PAGE_SIZE
              })
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isLoadingMore = false
              })
            }
          },

          fetchCustomerById: async (id) => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Supabase returns typed data based on table schema
              const { data, error } = await getSupabase()
                .from('customers')
                .select('*')
                .eq('id', id)
                .single()

              if (error) throw error

              return data as Customer
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
              })
              return null
            }
          },

          createCustomer: async (data) => {
            set((state) => {
              state.isSaving = true
              state.error = null
            })
            try {
              const {
                data: { user },
              } = await getSupabase().auth.getUser()
              if (!user) throw new Error('Not authenticated')

              // Helper to convert empty strings to null for optional fields
              const toNullIfEmpty = (value: string | null | undefined): string | null => {
                if (value === undefined || value === null || value === '') return null
                return value
              }

              const customerData: CustomerInsert = {
                user_id: user.id,
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- fallback on empty string is intentional for name default
                name: data.name || 'New Customer',

                // Basic Info
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

                // Status - use provided values or defaults
                archive_status: data.archive_status ?? null,
                archived_at: data.archived_at ?? null,
                deal_closed: data.deal_closed ?? false,
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- fallback on empty string is intentional for milestone default
                current_milestone: data.current_milestone || 'test_drive',

                // JSONB fields - use provided values or defaults
                checklist: data.checklist ?? getDefaultChecklistState(),
                milestone_dates: data.milestone_dates ?? getDefaultMilestoneDates(),
                document_checklist: data.document_checklist ?? getDefaultDocumentChecklistState(),

                // VSA Details - Vehicle
                vsa_make_model: toNullIfEmpty(data.vsa_make_model),
                vsa_variant: toNullIfEmpty(data.vsa_variant),
                vsa_yom: toNullIfEmpty(data.vsa_yom),
                vsa_body_colour: toNullIfEmpty(data.vsa_body_colour),
                vsa_upholstery: toNullIfEmpty(data.vsa_upholstery),
                vsa_prz_type: data.vsa_prz_type ?? null,

                // VSA Details - Package
                vsa_package: toNullIfEmpty(data.vsa_package),
                vsa_selling_price_list: data.vsa_selling_price_list ?? null,
                vsa_purchase_price_with_coe: data.vsa_purchase_price_with_coe ?? null,
                vsa_coe_rebate_level: toNullIfEmpty(data.vsa_coe_rebate_level),
                vsa_deposit: data.vsa_deposit ?? null,
                vsa_less_others: data.vsa_less_others ?? null,
                vsa_add_others: data.vsa_add_others ?? null,
                vsa_delivery_date: toNullIfEmpty(data.vsa_delivery_date),

                // VSA Details - Trade In
                vsa_trade_in_car_no: toNullIfEmpty(data.vsa_trade_in_car_no),
                vsa_trade_in_car_model: toNullIfEmpty(data.vsa_trade_in_car_model),
                vsa_trade_in_amount: data.vsa_trade_in_amount ?? null,
                vsa_trade_in_settlement_cost: data.vsa_trade_in_settlement_cost ?? null,
                vsa_number_retention: data.vsa_number_retention ?? false,
                vsa_number_retention_fee: data.vsa_number_retention_fee ?? null,
                vsa_trade_in_owner_not_customer: data.vsa_trade_in_owner_not_customer ?? false,
                vsa_trade_in_owner_name: toNullIfEmpty(data.vsa_trade_in_owner_name),
                vsa_trade_in_owner_nric: toNullIfEmpty(data.vsa_trade_in_owner_nric),
                vsa_trade_in_owner_mobile: toNullIfEmpty(data.vsa_trade_in_owner_mobile),
                vsa_trade_in_insurance_company: toNullIfEmpty(data.vsa_trade_in_insurance_company),
                vsa_trade_in_policy_number: toNullIfEmpty(data.vsa_trade_in_policy_number),

                // VSA Details - Delivery
                vsa_date_of_registration: toNullIfEmpty(data.vsa_date_of_registration),
                vsa_registration_no: toNullIfEmpty(data.vsa_registration_no),
                vsa_chassis_no: toNullIfEmpty(data.vsa_chassis_no),
                vsa_engine_no: toNullIfEmpty(data.vsa_engine_no),
                vsa_motor_no: toNullIfEmpty(data.vsa_motor_no),

                // VSA Details - Insurance
                vsa_insurance_company: toNullIfEmpty(data.vsa_insurance_company),
                vsa_insurance_fee: data.vsa_insurance_fee ?? null,
                vsa_insurance_subsidy: data.vsa_insurance_subsidy ?? null,

                // VSA Details - Loan
                vsa_remarks1: toNullIfEmpty(data.vsa_remarks1),
                vsa_remarks2: toNullIfEmpty(data.vsa_remarks2),
                vsa_loan_amount: data.vsa_loan_amount ?? null,
                vsa_interest: data.vsa_interest ?? null,
                vsa_tenure: data.vsa_tenure ?? null,
                vsa_admin_fee: data.vsa_admin_fee ?? null,
                vsa_monthly_repayment: data.vsa_monthly_repayment ?? null,

                // Proposal Details
                proposal_model: toNullIfEmpty(data.proposal_model),
                proposal_variant: toNullIfEmpty(data.proposal_variant),
                proposal_color: toNullIfEmpty(data.proposal_color),
                proposal_bank: toNullIfEmpty(data.proposal_bank),
                proposal_selling_price: data.proposal_selling_price ?? null,
                proposal_interest_rate: data.proposal_interest_rate ?? null,
                proposal_downpayment: data.proposal_downpayment ?? null,
                proposal_loan_tenure: data.proposal_loan_tenure ?? null,
                proposal_loan_amount: data.proposal_loan_amount ?? null,
                proposal_admin_fee: data.proposal_admin_fee ?? null,
                proposal_referral_fee: data.proposal_referral_fee ?? null,
                proposal_trade_in_model: toNullIfEmpty(data.proposal_trade_in_model),
                proposal_low_loan_surcharge: data.proposal_low_loan_surcharge ?? null,
                proposal_trade_in_car_plate: toNullIfEmpty(data.proposal_trade_in_car_plate),
                proposal_no_loan_surcharge: data.proposal_no_loan_surcharge ?? null,
                proposal_quoted_trade_in_price: data.proposal_quoted_trade_in_price ?? null,
                proposal_benefit1: toNullIfEmpty(data.proposal_benefit1),
                proposal_benefit2: toNullIfEmpty(data.proposal_benefit2),
                proposal_benefit3: toNullIfEmpty(data.proposal_benefit3),
                proposal_benefit4: toNullIfEmpty(data.proposal_benefit4),
                proposal_benefit5: toNullIfEmpty(data.proposal_benefit5),
                proposal_benefit6: toNullIfEmpty(data.proposal_benefit6),
                proposal_benefit7: toNullIfEmpty(data.proposal_benefit7),
                proposal_benefit8: toNullIfEmpty(data.proposal_benefit8),
                proposal_benefit9: toNullIfEmpty(data.proposal_benefit9),
                proposal_benefits_given: toNullIfEmpty(data.proposal_benefits_given),
                proposal_remarks: toNullIfEmpty(data.proposal_remarks),
              }

              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Supabase returns typed data based on table schema
              const { data: newCustomer, error } = await getSupabase()
                .from('customers')
                .insert(customerData)
                .select()
                .single()

              if (error) {
                console.error('Supabase insert error:', error)
                throw new Error(error.message || 'Failed to create customer')
              }

              set((state) => {
                state.customers.unshift(newCustomer as Customer)
                state.isSaving = false
              })

              return newCustomer as Customer
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isSaving = false
              })
              throw error
            }
          },

          updateCustomer: async (id, updates) => {
            set((state) => {
              state.isSaving = true
              state.error = null
            })
            try {
              const { error } = await getSupabase().from('customers').update(updates).eq('id', id)

              if (error) throw error

              set((state) => {
                const index = state.customers.findIndex((c) => c.id === id)
                if (index !== -1) {
                  Object.assign(state.customers[index], updates)
                }
                state.isSaving = false
              })
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isSaving = false
              })
              throw error
            }
          },

          deleteCustomer: async (id) => {
            set((state) => {
              state.isSaving = true
              state.error = null
            })
            try {
              // Get customer name BEFORE deleting from DB (needed to delete documents)
              const customer = get().customers.find((c) => c.id === id)
              const customerName = customer?.name

              // Delete from database first
              const { error } = await getSupabase().from('customers').delete().eq('id', id)

              if (error) throw error

              // Update local state immediately
              set((state) => {
                const index = state.customers.findIndex((c) => c.id === id)
                if (index !== -1) {
                  state.customers.splice(index, 1)
                }
                if (state.selectedCustomerId === id) {
                  state.selectedCustomerId = null
                }
                state.isSaving = false
              })

              // Delete documents from storage in background (don't block UI)
              if (customerName) {
                deleteEntireCustomerFolder(customerName)
                  .then(() => console.log(`[CustomerStore] Deleted documents for ${customerName}`))
                  .catch((err) => console.error(`[CustomerStore] Failed to delete documents:`, err))
              }
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isSaving = false
              })
              throw error
            }
          },

          selectCustomer: (id) => {
            set((state) => {
              state.selectedCustomerId = id
            })
          },

          updateChecklistItem: async (customerId, milestoneId, itemId, checked) => {
            const customer = get().customers.find((c) => c.id === customerId)
            if (!customer) return

            const updatedChecklist = {
              ...customer.checklist,
              [milestoneId]: {
                ...customer.checklist[milestoneId],
                [itemId]: checked,
              },
            }

            await get().updateCustomer(customerId, { checklist: updatedChecklist })
          },

          setCurrentMilestone: async (customerId, milestoneId) => {
            const customer = get().customers.find((c) => c.id === customerId)
            if (!customer) return

            const updatedChecklist = {
              ...customer.checklist,
              currentMilestone: milestoneId,
            }

            await get().updateCustomer(customerId, { checklist: updatedChecklist })
          },

          archiveCustomer: async (id, status) => {
            await get().updateCustomer(id, {
              archive_status: status,
              archived_at: new Date().toISOString(),
            })
          },

          unarchiveCustomer: async (id) => {
            await get().updateCustomer(id, {
              archive_status: null,
              archived_at: null,
            })
          },

          fetchGuarantors: async (customerId) => {
            try {
              const { data, error } = await getSupabase()
                .from('guarantors')
                .select('*')
                .eq('customer_id', customerId)
                .order('position')

              if (error) throw error

              return data as Guarantor[]
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
              })
              return []
            }
          },

          saveGuarantors: async (customerId, guarantors) => {
            set((state) => {
              state.isSaving = true
              state.error = null
            })
            try {
              // Delete existing guarantors
              await getSupabase().from('guarantors').delete().eq('customer_id', customerId)

              // Insert new guarantors
              if (guarantors.length > 0) {
                const guarantorData = guarantors.map((g, index) => ({
                  customer_id: customerId,
                  position: index + 1,
                  name: g.name ?? '',
                  phone: g.phone ?? null,
                  email: g.email ?? null,
                  nric: g.nric ?? null,
                  occupation: g.occupation ?? null,
                  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string must become null for date column
                  dob: g.dob || null,
                  address: g.address ?? null,
                  address_continue: g.address_continue ?? null,
                }))

                const { error } = await getSupabase().from('guarantors').insert(guarantorData)

                if (error) throw error
              }

              set((state) => {
                state.isSaving = false
              })
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isSaving = false
              })
              throw error
            }
          },

          subscribeToChanges: () => {
            // Clean up existing channel before creating new one
            const existing = get()._channel
            if (existing) {
              void existing.unsubscribe()
            }

            // Use getSupabase() to get current client instance
            const supabase = getSupabase()
            const channel = supabase
              .channel('customers_changes')
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'customers' },
                (payload) => {
                  const { eventType } = payload

                  if (eventType === 'INSERT') {
                    set((state) => {
                      state.customers.unshift(payload.new as Customer)
                    })
                  } else if (eventType === 'UPDATE') {
                    set((state) => {
                      const index = state.customers.findIndex(
                        (c) => c.id === (payload.new as Customer).id
                      )
                      if (index !== -1) {
                        state.customers[index] = payload.new as Customer
                      }
                    })
                  } else if (eventType === 'DELETE') {
                    set((state) => {
                      const index = state.customers.findIndex(
                        (c) => c.id === (payload.old as Customer).id
                      )
                      if (index !== -1) {
                        state.customers.splice(index, 1)
                      }
                    })
                  }
                }
              )
              .subscribe((status) => {
                console.log('[CustomerStore] Channel status:', status)
                // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- Supabase channel status is a string enum
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                  console.log('[CustomerStore] Will reconnect in 3s...')
                  setTimeout(() => get().subscribeToChanges(), 3000)
                }
              })

            set((state) => {
              state._channel = channel
            })

            return () => {
              void channel.unsubscribe()
              set((state) => {
                state._channel = null
              })
            }
          },

          clearError: () =>
            set((state) => {
              state.error = null
            }),
        }))
      ), // close subscribeWithSelector
      {
        name: 'customer-store',
        partialize: (state) => ({
          // Only persist selectedCustomerId for navigation restoration
          // Customer data is always fetched fresh from Supabase
          selectedCustomerId: state.selectedCustomerId,
        }),
      }
    ), // close persist
    { name: 'CustomerStore' }
  ) // close devtools
) // close create

// Selector hooks
export const useCustomers = () => useCustomerStore((state) => state.customers)
export const useSelectedCustomerId = () => useCustomerStore((state) => state.selectedCustomerId)
export const useSelectedCustomer = () => {
  const customers = useCustomerStore((state) => state.customers)
  const selectedId = useCustomerStore((state) => state.selectedCustomerId)
  return customers.find((c) => c.id === selectedId) ?? null
}

// Pagination selectors
export const useHasMoreCustomers = () => useCustomerStore((state) => state.hasMore)
export const useIsLoadingMoreCustomers = () => useCustomerStore((state) => state.isLoadingMore)

// Granular selectors for performance
export const useCustomerById = (id: number) =>
  useCustomerStore((state) => state.customers.find((c) => c.id === id))
export const useCustomerIds = () => useCustomerStore((state) => state.customers.map((c) => c.id))
