/**
 * useMilestoneChecklist Hook
 *
 * Shared logic for milestone checklist management.
 * Used by both MilestoneTracker and MilestoneSidebar components.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  MILESTONES,
  CHECKLISTS,
  getDefaultChecklistState,
  getDefaultMilestoneDates,
} from '@/constants/milestones';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useTodoStore } from '@/stores/useTodoStore';
import type { Customer, MilestoneId, ChecklistState, MilestoneDates } from '@/types';

interface UseMilestoneChecklistOptions {
  customer: Customer;
  resetExpandedOnCustomerChange?: boolean;
}

export function useMilestoneChecklist({
  customer,
  resetExpandedOnCustomerChange = false,
}: UseMilestoneChecklistOptions) {
  const { updateCustomer } = useCustomerStore();
  const { todos, createTodo } = useTodoStore();

  const [expandedMilestone, setExpandedMilestone] = useState<MilestoneId | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTodos, setIsCreatingTodos] = useState(false);

  // Local state for editing (saved on explicit action)
  const [localChecklist, setLocalChecklist] = useState<ChecklistState>(
    () => customer?.checklist || getDefaultChecklistState()
  );
  const [localMilestoneDates, setLocalMilestoneDates] = useState<MilestoneDates>(
    () => customer?.milestone_dates || getDefaultMilestoneDates()
  );
  const [hasChanges, setHasChanges] = useState(false);

  // Reset local state when customer changes
  useEffect(() => {
    setLocalChecklist(customer?.checklist || getDefaultChecklistState());
    setLocalMilestoneDates(customer?.milestone_dates || getDefaultMilestoneDates());
    setHasChanges(false);
    if (resetExpandedOnCustomerChange) {
      setExpandedMilestone(null);
    }
  }, [customer?.id, customer?.checklist, customer?.milestone_dates, resetExpandedOnCustomerChange]);

  const currentMilestone = localChecklist.currentMilestone || 'test_drive';

  const handleMilestoneClick = useCallback((milestoneId: MilestoneId) => {
    setExpandedMilestone((prev) => (prev === milestoneId ? null : milestoneId));
  }, []);

  const handleSetCurrentMilestone = useCallback((milestoneId: MilestoneId) => {
    setLocalChecklist((prev) => ({ ...prev, currentMilestone: milestoneId }));
    setHasChanges(true);
  }, []);

  const handleChecklistToggle = useCallback((milestoneId: MilestoneId, itemId: string, checked: boolean) => {
    setLocalChecklist((prev) => ({
      ...prev,
      [milestoneId]: { ...(prev[milestoneId] || {}), [itemId]: checked },
    }));
    setHasChanges(true);
  }, []);

  const handleMilestoneDateChange = useCallback((milestoneId: MilestoneId, date: string) => {
    setLocalMilestoneDates((prev) => ({ ...prev, [milestoneId]: date || null }));
    setHasChanges(true);
  }, []);

  // Create todos from uncompleted checklist items
  const handleCreateTodosFromChecklist = useCallback(
    async (milestoneId: MilestoneId) => {
      if (isCreatingTodos) return;

      const items = CHECKLISTS[milestoneId] || [];
      const milestone = MILESTONES.find((m) => m.id === milestoneId);
      const milestoneDate = localMilestoneDates[milestoneId];

      // Get uncompleted items
      const uncompletedItems = items.filter((item) => !localChecklist[milestoneId]?.[item.id]);

      if (uncompletedItems.length === 0) {
        alert('All checklist items are already completed!');
        return;
      }

      // Check for existing todos to prevent duplicates
      const existingTodos = todos.filter(
        (t) => t.customer_id === customer?.id && t.milestone_id === milestoneId && !t.completed
      );
      const existingTexts = new Set(existingTodos.map((t) => t.text));

      const itemsToCreate = uncompletedItems.filter((item) => {
        const todoText = `${milestone?.name}: ${item.label}`;
        return !existingTexts.has(todoText);
      });

      if (itemsToCreate.length === 0) {
        alert('Tasks already exist for all uncompleted checklist items.');
        return;
      }

      setIsCreatingTodos(true);

      try {
        for (const item of itemsToCreate) {
          await createTodo({
            text: `${milestone?.name}: ${item.label}`,
            priority: milestoneDate ? 'high' : 'medium',
            due_date: milestoneDate || null,
            customer_id: customer?.id || null,
            customer_name: customer?.name || null,
            milestone_id: milestoneId,
            checklist_item_id: item.id,
          });
        }

        alert(`Created ${itemsToCreate.length} task(s) for ${milestone?.name}`);
      } catch (error) {
        console.error('Failed to create todos:', error);
        alert('Failed to create tasks. Please try again.');
      } finally {
        setIsCreatingTodos(false);
      }
    },
    [isCreatingTodos, localChecklist, localMilestoneDates, todos, customer, createTodo]
  );

  // Save changes to store
  const handleSaveChanges = useCallback(async () => {
    if (!customer || !hasChanges) return;

    setIsSaving(true);
    try {
      await updateCustomer(customer.id, {
        checklist: localChecklist,
        milestone_dates: localMilestoneDates,
        current_milestone: localChecklist.currentMilestone,
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [customer, hasChanges, localChecklist, localMilestoneDates, updateCustomer]);

  // Cancel and revert
  const handleCancel = useCallback(() => {
    setLocalChecklist(customer?.checklist || getDefaultChecklistState());
    setLocalMilestoneDates(customer?.milestone_dates || getDefaultMilestoneDates());
    setHasChanges(false);
  }, [customer]);

  // Close expanded panel
  const handleClosePanel = useCallback(() => {
    setExpandedMilestone(null);
  }, []);

  return {
    // State
    expandedMilestone,
    currentMilestone,
    localChecklist,
    localMilestoneDates,
    hasChanges,
    isSaving,
    isCreatingTodos,

    // Setters
    setExpandedMilestone,

    // Handlers
    handleMilestoneClick,
    handleSetCurrentMilestone,
    handleChecklistToggle,
    handleMilestoneDateChange,
    handleCreateTodosFromChecklist,
    handleSaveChanges,
    handleCancel,
    handleClosePanel,
  };
}
