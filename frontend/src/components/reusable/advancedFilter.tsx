import React, { useState, useRef, useEffect } from 'react';
import { Filter, X, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterConfig {
  namespace?: FilterOption[];
  node?: FilterOption[];
  deployment?: FilterOption[];
  pod?: FilterOption[];
}

interface AdvancedFilterProps {
  // Filter configuration based on page type
  filterConfig: FilterConfig;
  
  // Current filter values
  filters: {
    namespace?: string[];
    node?: string[];
    deployment?: string[];
    pod?: string[];
  };
  
  // Filter change handlers
  onFiltersChange: (filters: {
    namespace?: string[];
    node?: string[];
    deployment?: string[];
    pod?: string[];
  }) => void;
  
  // UI customization
  className?: string;
  showClearAll?: boolean;
  
  // Loading states
  isLoading?: boolean;
  
  // Page type to determine available filters
  pageType: 'cluster' | 'node' | 'pod';
}

const AdvancedFilter: React.FC<AdvancedFilterProps> = ({
  filterConfig,
  filters,
  onFiltersChange,
  className = '',
  showClearAll = true,
  isLoading = false,
  pageType
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine available filter types based on page
  const getAvailableFilters = () => {
    switch (pageType) {
      case 'cluster':
        return ['namespace', 'node', 'deployment'];
      case 'node':
        return ['pod', 'namespace', 'deployment'];
      case 'pod':
        return ['node', 'namespace', 'deployment'];
      default:
        return [];
    }
  };

  const availableFilters = getAvailableFilters();

  // Set initial active tab
  useEffect(() => {
    if (!activeTab && availableFilters.length > 0) {
      setActiveTab(availableFilters[0]);
    }
  }, [availableFilters, activeTab]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Count total active filters
  const getActiveFilterCount = () => {
    return Object.values(filters).reduce((count, filterArray) => {
      return count + (filterArray?.length || 0);
    }, 0);
  };

  // Handle filter selection
  const handleFilterToggle = (filterType: string, value: string) => {
    const currentFilters = filters[filterType as keyof typeof filters] || [];
    const isSelected = currentFilters.includes(value);
    
    const updatedFilters = isSelected
      ? currentFilters.filter(item => item !== value)
      : [...currentFilters, value];

    onFiltersChange({
      ...filters,
      [filterType]: updatedFilters
    });
  };

  // Handle clear all filters
  const handleClearAll = () => {
    const clearedFilters = {};
    availableFilters.forEach(filterType => {
      clearedFilters[filterType as keyof typeof filters] = [];
    });
    onFiltersChange(clearedFilters);
  };

  // Handle clear specific filter type
  const handleClearFilterType = (filterType: string) => {
    onFiltersChange({
      ...filters,
      [filterType]: []
    });
  };

  // Get filter display name
  const getFilterDisplayName = (filterType: string) => {
    const names = {
      namespace: 'Namespace',
      node: 'Node',
      deployment: 'Deployment',
      pod: 'Pod'
    };
    return names[filterType as keyof typeof names] || filterType;
  };

  // Get filter icon color
  const getFilterColor = (filterType: string) => {
    const colors = {
      namespace: 'text-blue-600 bg-blue-50',
      node: 'text-green-600 bg-green-50',
      deployment: 'text-purple-600 bg-purple-50',
      pod: 'text-orange-600 bg-orange-50'
    };
    return colors[filterType as keyof typeof colors] || 'text-gray-600 bg-gray-50';
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Filter Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex items-center gap-2 ${
          activeFilterCount > 0 ? 'border-blue-500 bg-blue-50' : ''
        }`}
        disabled={isLoading}
      >
        <Filter className="w-4 h-4" />
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Filter Options</h3>
              <div className="flex items-center gap-2">
                {showClearAll && activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear All
                  </Button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active Filters Summary */}
            {activeFilterCount > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(filters).map(([filterType, filterValues]) => {
                  if (!filterValues || filterValues.length === 0) return null;
                  return (
                    <span
                      key={filterType}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {getFilterDisplayName(filterType)}: {filterValues.length}
                      <button
                        onClick={() => handleClearFilterType(filterType)}
                        className="hover:text-blue-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-gray-200">
            {availableFilters.map((filterType) => {
              const count = filters[filterType as keyof typeof filters]?.length || 0;
              const options = filterConfig[filterType as keyof FilterConfig] || [];
              
              return (
                <button
                  key={filterType}
                  onClick={() => setActiveTab(filterType)}
                  className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === filterType
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>{getFilterDisplayName(filterType)}</span>
                    {count > 0 && (
                      <span className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        {count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Filter Options */}
          <div className="max-h-64 overflow-y-auto">
            {activeTab && (
              <div className="p-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-gray-500">Loading options...</div>
                  </div>
                ) : (
                  <>
                    {filterConfig[activeTab as keyof FilterConfig]?.map((option) => {
                      const isSelected = filters[activeTab as keyof typeof filters]?.includes(option.value) || false;
                      
                      return (
                        <label
                          key={option.value}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleFilterToggle(activeTab, option.value)}
                              className="sr-only"
                            />
                            <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                              isSelected 
                                ? 'bg-blue-500 border-blue-500' 
                                : 'border-gray-300'
                            }`}>
                              {isSelected && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="text-sm text-gray-900">
                              {option.label}
                            </div>
                            {option.count !== undefined && (
                              <div className="text-xs text-gray-500">
                                {option.count} items
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    }) || (
                      <div className="text-sm text-gray-500 text-center py-4">
                        No {getFilterDisplayName(activeTab).toLowerCase()} options available
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-blue-600 hover:text-blue-700"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilter;