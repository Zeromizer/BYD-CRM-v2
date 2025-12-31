import { useState, useEffect, useMemo } from 'react';
import { useCustomerStore, useCustomers, useSelectedCustomerId } from '@/stores';
import { Search, Plus, Archive } from 'lucide-react';
import { MILESTONES, getOverallProgress } from '@/constants';
import type { Customer, MilestoneId } from '@/types';
import './CustomerList.css';

interface CustomerListProps {
  onAddCustomer: () => void;
}

type FilterTab = 'active' | 'archived';
type SortOption = 'recent' | 'name' | 'milestone';

export function CustomerList({ onAddCustomer }: CustomerListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('active');
  const [sortBy] = useState<SortOption>('recent');
  const [milestoneFilter, setMilestoneFilter] = useState<MilestoneId | 'all'>('all');

  const customers = useCustomers();
  const selectedCustomerId = useSelectedCustomerId();
  const { selectCustomer, fetchCustomers, subscribeToChanges } = useCustomerStore();

  useEffect(() => {
    fetchCustomers();
    const unsubscribe = subscribeToChanges();
    return unsubscribe;
  }, [fetchCustomers, subscribeToChanges]);

  const filteredCustomers = useMemo(() => {
    let result = customers;

    // Filter by archive status
    if (filterTab === 'active') {
      result = result.filter((c) => !c.archive_status);
    } else {
      result = result.filter((c) => c.archive_status);
    }

    // Filter by milestone
    if (milestoneFilter !== 'all') {
      result = result.filter((c) => c.current_milestone === milestoneFilter);
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phone?.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.vsa_no?.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case 'name':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'milestone':
        result = [...result].sort((a, b) => {
          const milestoneOrder = MILESTONES.map((m) => m.id);
          return (
            milestoneOrder.indexOf(a.current_milestone) -
            milestoneOrder.indexOf(b.current_milestone)
          );
        });
        break;
      case 'recent':
      default:
        result = [...result].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return result;
  }, [customers, filterTab, milestoneFilter, searchQuery, sortBy]);

  return (
    <div className="customer-list">
      {/* Header */}
      <div className="list-header">
        <h2 className="list-title">Customers</h2>
        <button onClick={onAddCustomer} className="add-customer-btn">
          <Plus size={18} />
          <span>Add</span>
        </button>
      </div>

      {/* Search */}
      <div className="search-container">
        <Search className="search-icon" size={18} />
        <input
          type="text"
          placeholder="Search customers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Tabs */}
      <div className="filter-tabs">
        <button
          onClick={() => setFilterTab('active')}
          className={`filter-tab ${filterTab === 'active' ? 'active' : ''}`}
        >
          Active
        </button>
        <button
          onClick={() => setFilterTab('archived')}
          className={`filter-tab ${filterTab === 'archived' ? 'active' : ''}`}
        >
          <Archive size={14} />
          Archived
        </button>
      </div>

      {/* Milestone Filter */}
      <div className="milestone-filters">
        <button
          onClick={() => setMilestoneFilter('all')}
          className={`milestone-chip ${milestoneFilter === 'all' ? 'active' : ''}`}
        >
          All
        </button>
        {MILESTONES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMilestoneFilter(m.id)}
            className={`milestone-chip ${milestoneFilter === m.id ? 'active' : ''}`}
            style={{
              '--milestone-color': m.color,
            } as React.CSSProperties}
          >
            {m.shortName}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="list-content">
        {filteredCustomers.length === 0 ? (
          <div className="list-empty">
            <p>No customers found</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              isSelected={customer.id === selectedCustomerId}
              onSelect={() => selectCustomer(customer.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface CustomerCardProps {
  customer: Customer;
  isSelected: boolean;
  onSelect: () => void;
}

function CustomerCard({ customer, isSelected, onSelect }: CustomerCardProps) {
  const milestone = MILESTONES.find((m) => m.id === customer.current_milestone);
  const progress = getOverallProgress(customer.checklist);

  return (
    <div
      className={`customer-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="card-header">
        <div className="customer-avatar">
          {customer.name[0]?.toUpperCase()}
        </div>
        <div className="customer-info">
          <h3 className="customer-name">{customer.name}</h3>
          {customer.vsa_no && (
            <span className="customer-vsa">VSA: {customer.vsa_no}</span>
          )}
        </div>
      </div>

      <div className="card-footer">
        {milestone && (
          <span
            className="milestone-badge"
            style={{ backgroundColor: `${milestone.color}20`, color: milestone.color }}
          >
            {milestone.shortName}
          </span>
        )}
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${progress}%`,
              backgroundColor: milestone?.color || '#64748b',
            }}
          />
        </div>
        <span className="progress-text">{progress}%</span>
      </div>
    </div>
  );
}
