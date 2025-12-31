import { MILESTONES, getMilestoneIndex } from '@/constants/milestones';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { Check, Circle } from 'lucide-react';
import type { Customer, MilestoneId } from '@/types';

interface MilestoneTrackerProps {
  customer: Customer;
}

export function MilestoneTracker({ customer }: MilestoneTrackerProps) {
  const { updateCustomer } = useCustomerStore();
  const currentIndex = getMilestoneIndex(customer.current_milestone);

  const handleMilestoneClick = async (milestoneId: MilestoneId) => {
    await updateCustomer(customer.id, { current_milestone: milestoneId });
  };

  return (
    <div className="milestone-tracker">
      <div className="milestone-progress">
        {MILESTONES.map((milestone, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div
              key={milestone.id}
              className={`milestone-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
            >
              {/* Connector line */}
              {index > 0 && (
                <div
                  className={`milestone-connector ${isCompleted ? 'completed' : ''}`}
                />
              )}

              {/* Milestone circle */}
              <button
                className="milestone-circle"
                onClick={() => handleMilestoneClick(milestone.id)}
                title={`Set to ${milestone.name}`}
              >
                {isCompleted ? <Check size={14} /> : <Circle size={14} />}
              </button>

              {/* Label */}
              <span className="milestone-label">{milestone.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
