/**
 * Todo/Task type definitions
 */

import type { Priority, Timestamps } from './common.types';

export interface Todo extends Timestamps {
  id: number;
  user_id: string;
  customer_id: number | null;

  text: string;
  completed: boolean;
  priority: Priority;
  due_date: string | null;
  customer_name: string | null;
  milestone_id: string | null;
  checklist_item_id: string | null;
}

export type TodoInsert = Omit<Todo, 'id' | 'created_at' | 'updated_at'>;
export type TodoUpdate = Partial<Omit<TodoInsert, 'user_id'>>;

// Filter options for todos
export type TodoFilter = 'all' | 'today' | 'overdue' | 'completed' | 'high_priority';
