import React, { useState, useEffect, useRef } from "react";
import {
  Filter,
  RefreshCw,
  ChevronDown,
  Clock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useCluster } from "../context/ClusterContext";

const predefinedOptions = [
  { label: "Last 3h", value: "3h" },
  { label: "Last 12h", value: "12h" },
  { label: "Last 24h", value: "24h" },
  { label: "Last 48h", value: "48h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 60 days", value: "60d" },
  { label: "Last 90 days", value: "90d" },
  { label: "Last 6 months", value: "180d" },
  { label: "Last 12 months", value: "365d" },
];

// Utility to get days from custom range string
function getDaysFromCustomRange(range) {
  if (!range || !range.includes(":")) return null;
  const [start, end] = range.split(":");
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
  const diff = Math.abs(endDate.getTime() - startDate.getTime());
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  return days;
}

// Calendar Component
const Calendar = ({
  selectedStart,
  selectedEnd,
  onDateSelect,
  onApply,
  onCancel,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [startDate, setStartDate] = useState(selectedStart);
  const [endDate, setEndDate] = useState(selectedEnd);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Previous month's days
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonth.getDate() - i,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonth.getDate() - i),
      });
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        isCurrentMonth: true,
        date: new Date(year, month, day),
      });
    }

    // Next month's days
    const remainingSlots = 42 - days.length;
    for (let day = 1; day <= remainingSlots; day++) {
      days.push({
        day,
        isCurrentMonth: false,
        date: new Date(year, month + 1, day),
      });
    }

    return days;
  };

  const days = getDaysInMonth(currentMonth);

  // Helper function to check if a date is in the future
  const isFutureDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate > today;
  };

  const handleDateClick = (date) => {
    // Block future dates
    if (isFutureDate(date)) {
      return;
    }

    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate(null);
    } else if (startDate && !endDate) {
      if (date < startDate) {
        setStartDate(date);
        setEndDate(null);
      } else {
        setEndDate(date);
      }
    }
  };

  const isDateInRange = (date) => {
    if (!startDate || !endDate) return false;
    return date >= startDate && date <= endDate;
  };

  const isDateSelected = (date) => {
    return (
      (startDate && date.getTime() === startDate.getTime()) ||
      (endDate && date.getTime() === endDate.getTime())
    );
  };

  const formatDate = (date) => {
    if (!date) return "";
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`;
  };

  const handleApply = () => {
    if (startDate && endDate) {
      onApply(startDate, endDate);
    }
  };

  return (
    <div className="w-80 max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-lg p-4">
      {/* Date Range Inputs */}
      <div className="flex items-center gap-2 mb-4 p-2 border border-gray-200 rounded">
        <input
          type="text"
          value={formatDate(startDate)}
          placeholder="Jul 31 2025"
          className="flex-1 text-sm bg-transparent outline-none"
          readOnly
        />
        <span className="text-gray-400">-</span>
        <input
          type="text"
          value={formatDate(endDate)}
          placeholder="Aug 7 2025"
          className="flex-1 text-sm bg-transparent outline-none"
          readOnly
        />
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() =>
            setCurrentMonth(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
            )
          }
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="font-medium">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          onClick={() =>
            setCurrentMonth(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
            )
          }
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="mb-4">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-gray-500 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((dayObj, index) => {
            const isSelected = isDateSelected(dayObj.date);
            const isInRange = isDateInRange(dayObj.date);
            const isToday =
              new Date().toDateString() === dayObj.date.toDateString();
            const isFuture = isFutureDate(dayObj.date);

            return (
              <button
                key={index}
                onClick={() =>
                  dayObj.isCurrentMonth && !isFuture && handleDateClick(dayObj.date)
                }
                className={`
                  w-8 h-8 text-sm rounded flex items-center justify-center
                  ${
                    dayObj.isCurrentMonth && !isFuture
                      ? "hover:bg-gray-100 cursor-pointer"
                      : dayObj.isCurrentMonth && isFuture
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-300"
                  }
                  ${
                    isSelected
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : ""
                  }
                  ${
                    isInRange && !isSelected
                      ? "bg-green-100 text-green-800"
                      : ""
                  }
                  ${isToday && !isSelected ? "ring-1 ring-green-500" : ""}
                  ${isFuture && dayObj.isCurrentMonth ? "opacity-40" : ""}
                `}
                disabled={!dayObj.isCurrentMonth || isFuture}
                title={isFuture ? "Future dates are not selectable" : ""}
              >
                {dayObj.day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} className="text-gray-600">
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          disabled={!startDate || !endDate}
          className="bg-green-800 hover:bg-green-900 text-white"
        >
          Apply
        </Button>
      </div>
    </div>
  );
};

// Days Component
interface DaysProps {
  selectedTimeRange: string;
  onTimeRangeChange: (range: string) => void;
  className?: string;
  variant?: "buttons" | "select";
  buttonOptions?: string[];
}

export const Days: React.FC<DaysProps> = ({
  selectedTimeRange,
  onTimeRangeChange,
  className = "",
  variant = "select",
}) => {
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const getSelectedLabel = () => {
    // If custom range, show as 'YYYY-MM-DD to YYYY-MM-DD (Xd)'
    if (selectedTimeRange && selectedTimeRange.includes(":")) {
      const [start, end] = selectedTimeRange.split(":");
      const days = getDaysFromCustomRange(selectedTimeRange);
      return `${start} to ${end} (${days}d)`;
    }
    const option = predefinedOptions.find((o) => o.value === selectedTimeRange);
    return option ? option.label : "Custom Range";
  };

  const handleCustomRangeApply = (startDate, endDate) => {
    const formatDate = (date) => {
      return date.toISOString().split("T")[0];
    };
    const customRange = `${formatDate(startDate)}:${formatDate(endDate)}`;
    // Calculate days and send as 'Xd' for query param
    const days = getDaysFromCustomRange(customRange);
    if (days) {
      onTimeRangeChange(`${days}d`); // send as 'Xd' for backend
    } else {
      onTimeRangeChange(customRange); // fallback to raw range
    }
    setShowCustomCalendar(false);
    setIsDropdownOpen(false);
  };

  if (variant === "buttons") {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        {["1h", "6h", "24h", "7d", "30d"].map((range) => (
          <Button
            key={range}
            variant={selectedTimeRange === range ? "default" : "outline"}
            size="sm"
            onClick={() => onTimeRangeChange(range)}
            className="text-xs sm:text-sm"
          >
            {range}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 min-w-[120px] sm:min-w-[140px] justify-between text-xs sm:text-sm"
          >
            <span className="truncate">{getSelectedLabel()}</span>
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 p-0">
          <div className="p-3">
            <div className="text-sm font-medium text-gray-900 mb-3">
              Date Range
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-2 gap-1">
              {predefinedOptions.map((option, index) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => {
                    onTimeRangeChange(option.value);
                    setIsDropdownOpen(false);
                  }}
                  className={`cursor-pointer px-2 py-1.5 text-sm rounded hover:bg-gray-100 colors-h3-text ${
                    selectedTimeRange === option.value
                      ? "text-green-600 font-medium"
                      : "text-gray-700"
                  }`}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </div>

            {/* Custom Range Option */}
            <div className="border-t border-gray-200 mt-3 pt-3">
              <button
                onClick={() => {
                  setShowCustomCalendar(true);
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                Custom Range
              </button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Custom Calendar Modal */}
      {showCustomCalendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <Calendar
            selectedStart={null}
            selectedEnd={null}
            onApply={handleCustomRangeApply}
            onCancel={() => setShowCustomCalendar(false)}
            onDateSelect={undefined}
          />
        </div>
      )}
    </div>
  );
};

// Filter Component
interface FilterProps {
  onFilterClick: () => void;
  className?: string;
}

export const FilterButton: React.FC<FilterProps> = ({
  onFilterClick,
  className = "",
}) => {
  return (
    <Button
      variant="outline"
      onClick={onFilterClick}
      className={`flex items-center gap-2 text-xs sm:text-sm ${className}`}
      size="sm"
    >
      <Filter className="w-4 h-4" />
      <span className="hidden sm:inline">Filter</span>
    </Button>
  );
};

interface RefreshProps {
  onRefresh: (showToast?: boolean) => Promise<void>;
  refreshInterval: number | null;
  onRefreshIntervalChange: (interval: number | null) => void;
  isRefreshing?: boolean;
  lastUpdated?: Date | null;
  className?: string;
}

export const Refresh: React.FC<RefreshProps> = ({
  onRefresh,
  refreshInterval,
  onRefreshIntervalChange,
  isRefreshing = false,
  lastUpdated = null,
  className = "",
}) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refreshOptions = [
    { label: "Every 10 seconds", value: 10000 },
    { label: "Every 30 seconds", value: 30000 },
    { label: "Every 1 minute", value: 60000 },
    { label: "Every 2 minutes", value: 120000 },
    { label: "Every 5 minutes", value: 300000 },
    { label: "Every 10 minutes", value: 600000 },
  ];

  const getRefreshLabel = () => {
    const option = refreshOptions.find((opt) => opt.value === refreshInterval);
    return option ? option.label : "Every 10 seconds";
  };

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (refreshInterval) {
      intervalRef.current = setInterval(() => {
        onRefresh(false);
      }, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshInterval, onRefresh]);

  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* {lastUpdated && (
        <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 order-3 sm:order-1 w-full sm:w-auto">
          <Clock className="w-3 h-3" />
          <span>Updated {formatLastUpdated(lastUpdated)}</span>
        </div>
      )} */}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onRefresh(true)}
        disabled={isRefreshing}
        className="flex items-center gap-2 text-xs sm:text-sm order-1 sm:order-2"
      >
        <RefreshCw
          className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
        />
        <span className="hidden sm:inline">Refresh</span>
      </Button>
    </div>
  );
};

// Combined Filter Bar Component
interface FilterBarProps {
  selectedTimeRange: string;
  onTimeRangeChange: (range: string) => void;
  timeRangeVariant?: "buttons" | "select";
  timeRangeOptions?: string[];
  onFilterClick?: () => void;
  showFilter?: boolean;
  onRefresh: (showToast?: boolean) => Promise<void>;
  refreshInterval: number | null;
  onRefreshIntervalChange: (interval: number | null) => void;
  isRefreshing?: boolean;
  lastUpdated?: Date | null;
  showRefresh?: boolean;
  className?: string;
  type?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedTimeRange,
  onTimeRangeChange,
  timeRangeVariant = "buttons",
  timeRangeOptions = ["1h", "6h", "24h", "7d", "30d"],
  onFilterClick = () => {},
  showFilter = false,
  onRefresh,
  refreshInterval,
  onRefreshIntervalChange,
  isRefreshing = false,
  lastUpdated = null,
  showRefresh = true,
  className = "",
  type = "",
}) => {
  const navigate = useNavigate();
  const { selectedInstance }: any = useCluster();

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 ${className}`}
    >
      {/* Time Range Selection */}
      <div className="flex-shrink-0 order-1">
        <Days
          selectedTimeRange={selectedTimeRange}
          onTimeRangeChange={onTimeRangeChange}
          variant={timeRangeVariant}
          buttonOptions={timeRangeOptions}
        />
      </div>

      {/* Filter and Refresh Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2 flex-shrink-0 order-2">
        {/* Filter and action buttons */}
        {type === "cluster" && (
          <div className="flex items-center gap-2">
            {/* Show Node + Pod buttons when in cluster view */}
            <Button
              variant="primary"
              size="sm"
              title="Navigate to Node metrics"
              onClick={() => {
                navigate({
                  pathname: "/metric/nodes",
                  search: `?cluster_id=${selectedInstance.id}`,
                });
              }}
            >
              Node
            </Button>
            <Button
              variant="primary"
              size="sm"
              title="Navigate to Pod metrics"
              onClick={() => {
                navigate({
                  pathname: "/metric/pods",
                  search: `?cluster_id=${selectedInstance.id}`,
                });
              }}
            >
              Pod
            </Button>
          </div>
        )}

        {type === "node" && (
          <div className="flex items-center gap-2">
            {/* Show Cluster + Pod buttons when in node view */}
            <Button
              variant="primary"
              size="sm"
              title="Navigate to Cluster metrics"
              onClick={() => {
                navigate({
                  pathname: "/metric/cluster",
                  search: `?cluster_id=${selectedInstance.id}`,
                });
              }}
            >
              Cluster
            </Button>
            <Button
              variant="primary"
              size="sm"
              title="Navigate to Pod metrics"
              onClick={() => {
                navigate({
                  pathname: "/metric/pods",
                  search: `?cluster_id=${selectedInstance.id}`,
                });
              }}
            >
              Pod
            </Button>
          </div>
        )}

        {type === "pod" && (
          <div className="flex items-center gap-2">
            {/* Show Cluster + Node buttons when in pod view */}
            <Button
              variant="primary"
              size="sm"
              title="Navigate to Cluster metrics"
              onClick={() => {
                navigate({
                  pathname: "/metric/cluster",
                  search: `?cluster_id=${selectedInstance.id}`,
                });
              }}
            >
              Cluster
            </Button>
            <Button
              variant="primary"
              size="sm"
              title="Navigate to Node metrics"
              onClick={() => {
                navigate({
                  pathname: "/metric/nodes",
                  search: `?cluster_id=${selectedInstance.id}`,
                });
              }}
            >
              Node
            </Button>
          </div>
        )}

        {/* Filter + Refresh */}
        <div className="flex items-center gap-2">
          {showFilter && <FilterButton onFilterClick={onFilterClick} />}
          {showRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRefresh(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
