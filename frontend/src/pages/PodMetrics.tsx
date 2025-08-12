import { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  Server,
  Database,
  Activity,
  AlertCircle,
  DollarSign,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { Layout } from "@/components/layout/Layout";
import ClusterService from "@/services/ClusterService";
import podService from "@/services/podService";
import PodDetailsModal from "@/components/modals/podDetailMetrics";
import { Days, Refresh } from "@/components/reusable/filterbar";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DomainDropdown from "@/components/reusable/domainDropdown";

// Search Component
interface SearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchInput: React.FC<SearchProps> = ({
  searchTerm,
  onSearchChange,
  placeholder = "Search pods...",
  className = "",
}) => {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="w-4 h-4 text-gray-400" />
      </div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
      />
      {searchTerm && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <button
            onClick={() => onSearchChange("")}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

const KubecostDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState("totalCost");
  const [sortDirection, setSortDirection] = useState("desc");
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTimeRange, setSelectedTimeRange] = useState(() => {
    return searchParams.get("window") || "7d";
  });

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showPodModal, setShowPodModal] = useState(false);
  const [selectedPod, setSelectedPod] = useState(null);
  const [podDetails, setPodDetails] = useState([]);

  // Refresh states
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedHash, setSelectedHash] = useState<string>("");

  const handleDomainSelect = (hash: string) => {
    console.log("Selected Unique Hash:", hash);
    setSelectedHash(hash);
    // fetchData(true);
  };
  const getWindowFromSelectedTimeRange = (range: string): string => {
    switch (range) {
      case "1h":
        return "1h";
      case "6h":
        return "6h";
      case "24h":
        return "1d";
      case "48h":
        return "2d";
      case "7d":
        return "7d";
      case "30d":
        return "30d";
      case "60d":
        return "60d";
      case "90d":
        return "90d";
      case "6m":
        return "180d";
      case "12m":
        return "365d";
      default:
        if (range.includes(":")) {
          const [start, end] = range.split(":");
          const diffInMs = new Date(end).getTime() - new Date(start).getTime();
          const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
          return `${diffInDays}d`;
        }
        return "1d"; // fallback
    }
  };

  const fetchData = async (showToast = false) => {
    setIsRefreshing(true);
    if (!showToast) setLoading(true);

    const windowParam = getWindowFromSelectedTimeRange(selectedTimeRange);

    const queryParams = {
      window: windowParam,
      aggregate: "pod",
      accumulate: true,
      external: false,
      shareCost: 0,
      shareTenancyCosts: true,
      idle: true,
      shareIdle: false,
      idleByNode: false,
      shareLabels: "",
      shareNamespaces: "",
      shareSplit: "weighted",
      filter: "",
      offset: 0,
      limit: 2000,
      includeSharedCostBreakdown: true,
      chartType: "costovertime",
      costUnit: "cumulative",
      domain: selectedHash || "",
      force_refresh: true,
    };

    try {
      const res = await ClusterService.getClusterAllocationSummary(queryParams);
      setData(res.data.data);
      setLastUpdated(new Date());

      if (showToast) {
        console.log("Data refreshed successfully");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch cost allocation data");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setSearchParams({ window: selectedTimeRange });
    // fetchData();
  }, [selectedTimeRange]);

  const handlePodDetails = async (name) => {
    setSelectedPod(name);
    setShowPodModal(true);

    let queryParams = {
      window: "7d",
      accumulate: "true",
      aggregate: "controller",
      external: "false",
      filterPods: name,
      domain:selectedHash
    };

    let response = await podService.getPodDetails(queryParams);
    const allocationData = response?.data?.data?.[0];

    if (!allocationData) return [];

    const containers = Object.entries(allocationData)
      .filter(([containerName]) => containerName !== "__idle__")
      .map(([containerName, data]) => {
        const d = data as {
          cpuCoreRequestAverage: number;
          cpuCost: number;
          ramByteRequestAverage: number;
          ramCost: number;
          pvBytes: number;
          pvCost: number;
          pvCostAdjustment: number;
          minutes: number;
          totalCost: number;
        };

        return {
          containerName,
          cpu: {
            amount: d.cpuCoreRequestAverage,
            hourlyRate: "$" + (0.031611).toFixed(6),
            cost: d.cpuCost,
          },
          ram: {
            amount: (d.ramByteRequestAverage / 1024 / 1024 / 1024).toFixed(2),
            hourlyRate: "$" + (0.004237).toFixed(6),
            cost: d.ramCost,
          },
          pv: {
            amount: (d.pvBytes / 1024 / 1024 / 1024).toFixed(0),
            hourlyRate: "$" + (0.000055).toFixed(6),
            cost: d.pvCost,
            adjustment: d.pvCostAdjustment,
          },
          totalHours: (d.minutes / 60).toFixed(2),
          totalCost: d.totalCost.toFixed(2),
        };
      });

    console.log(containers);
    setPodDetails(containers);
    return containers;
  };

  useEffect(() => {
    if (selectedHash) {
      // only fetch if we have a domain selected
      setSearchParams({ window: selectedTimeRange });
      fetchData();
    }
  }, [selectedTimeRange, selectedHash]); // now runs on dropdown change too

  useEffect(() => {
    if (showPodModal && selectedPod) {
      handlePodDetails(selectedPod).then(setPodDetails);
    }
  }, [showPodModal, selectedPod]);

  const processedData = useMemo(() => {
    if (!data?.sets?.[0]?.allocations)
      return { pods: [], idle: null, totalCost: 0 };

    const allocations = data.sets[0].allocations;
    const pods = [];
    let idle = null;
    let totalCost = 0;

    Object.entries(allocations).forEach(([key, allocationRaw]) => {
      const allocation = allocationRaw as any;
      if (key === "__idle__") {
        idle = allocation;
      } else {
        pods.push({
          ...allocation,
          id: key,
          namespace: key.split("-")[0] || "default",
          ramUsageGB: (
            allocation.ramByteUsageAverage /
            (1024 * 1024 * 1024)
          ).toFixed(2),
          ramRequestGB: (
            allocation.ramByteRequestAverage /
            (1024 * 1024 * 1024)
          ).toFixed(2),
          cpuEfficiency: (
            (allocation.cpuCoreUsageAverage /
              allocation.cpuCoreRequestAverage) *
            100
          ).toFixed(1),
          ramEfficiency: (
            (allocation.ramByteUsageAverage /
              allocation.ramByteRequestAverage) *
            100
          ).toFixed(1),
        });
      }
      totalCost += allocation.totalCost;
    });

    return { pods, idle, totalCost };
  }, [data]);

  const filteredAndSortedPods = useMemo(() => {
    // Filter pods based on search term
    const filtered = processedData.pods.filter((pod) => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        pod.name.toLowerCase().includes(searchLower) ||
        pod.namespace.toLowerCase().includes(searchLower) ||
        pod.id.toLowerCase().includes(searchLower)
      );
    });

    // Sort filtered pods
    const sorted = filtered.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [processedData.pods, sortField, sortDirection, searchTerm]);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Pagination calculations
  const totalItems = filteredAndSortedPods.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPods = filteredAndSortedPods.slice(startIndex, endIndex);

  const chartData = useMemo(() => {
    return filteredAndSortedPods.map((pod) => ({
      name: pod.name.split("-")[0],
      totalCost: parseFloat(pod.totalCost.toFixed(2)),
      cpuCost: parseFloat(pod.cpuCost.toFixed(2)),
      ramCost: parseFloat(pod.ramCost.toFixed(2)),
      pvCost: parseFloat((pod.pvCost || 0).toFixed(2)),
    }));
  }, [filteredAndSortedPods]);

  const costBreakdownData = useMemo(() => {
    const totalCpu = filteredAndSortedPods.reduce(
      (sum, pod) => sum + pod.cpuCost,
      0
    );
    const totalRam = filteredAndSortedPods.reduce(
      (sum, pod) => sum + pod.ramCost,
      0
    );
    const totalPv = filteredAndSortedPods.reduce(
      (sum, pod) => sum + (pod.pvCost || 0),
      0
    );
    const totalShared = filteredAndSortedPods.reduce(
      (sum, pod) => sum + (pod.sharedCost || 0),
      0
    );

    return [
      { name: "CPU", value: totalCpu, color: "#3B82F6" },
      { name: "Memory", value: totalRam, color: "#10B981" },
      { name: "Storage", value: totalPv, color: "#F59E0B" },
      { name: "Shared", value: totalShared, color: "#8B5CF6" },
    ].filter((item) => item.value > 0);
  }, [filteredAndSortedPods]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const formatCurrency = (value) => `$${value?.toFixed(2) || "0.00"}`;
  const formatBytes = (bytes) => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return "↕️";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  if (loading && !data) {
    return (
      <Layout
        title="Pods & Containers"
        subtitle="CPU, memory, restarts, state, and health probe monitoring"
      >
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-slate-200 rounded-lg w-64 mb-8"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl p-6 h-32 border border-slate-200"
                  ></div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl p-6 h-96 border border-slate-200"></div>
                <div className="bg-white rounded-xl p-6 h-96 border border-slate-200"></div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout
        title="Pods & Containers"
        subtitle="CPU, memory, restarts, state, and health probe monitoring"
      >
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
          <div className="bg-white rounded-xl p-8 border border-red-200 max-w-md text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Error Loading Data
            </h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout
        title="Pods & Containers"
        subtitle="CPU, memory, restarts, state, and health probe monitoring"
        onDomainChange={handleDomainSelect}
      >
        <div className="min-h-screen p-6">
          <div className="mx-auto">
            {/* Enhanced Filter Bar with Search */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-6">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                {/* Left side - Time Range */}
                <div className="flex items-center gap-4">
                  <Days
                    selectedTimeRange={selectedTimeRange}
                    onTimeRangeChange={setSelectedTimeRange}
                    variant="select"
                    buttonOptions={["1h", "6h", "24h", "7d", "30d"]}
                  />
                </div>

                {/* Center - Search */}
                <div className="flex-1 max-w-md">
                  <SearchInput
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    placeholder="Search pods by pod name"
                  />
                </div>
                <div className="flex items-center gap-4">
                  {/* <DomainDropdown onSelect={handleDomainSelect} /> */}
                  {/* {selectedHash && <p className="mt-3 text-green-600">Selected: {selectedHash}</p>} */}
                </div>
                {/* Right side - Refresh Controls */}
                <div className="flex items-center gap-3">
                  <Refresh
                    onRefresh={fetchData}
                    refreshInterval={refreshInterval}
                    onRefreshIntervalChange={setRefreshInterval}
                    isRefreshing={isRefreshing}
                    lastUpdated={lastUpdated}
                  />
                </div>
              </div>

              {/* Search Results Info */}
              {searchTerm && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                      {totalItems === 0
                        ? "No pods found"
                        : totalItems === 1
                        ? "1 pod found"
                        : `${totalItems} pods found`}
                      {searchTerm && ` matching "${searchTerm}"`}
                    </span>
                    {searchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchTerm("")}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Summary Cards - Updated to reflect filtered data */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {searchTerm ? "Filtered" : "Total"} Cost
                    </p>
                    <p className="text-2xl font-bold text">
                      {formatCurrency(
                        filteredAndSortedPods.reduce(
                          (sum, pod) => sum + pod.totalCost,
                          0
                        )
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Selected period
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {searchTerm ? "Matching" : "Active"} Pods
                    </p>
                    <p className="text-2xl font-bold text">
                      {filteredAndSortedPods.length}
                    </p>
                    <p className="text-xs text-green-600 mt-1">Running</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Server className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Idle Cost
                    </p>
                    <p className="text-2xl font-bold text">
                      {formatCurrency(processedData.idle?.totalCost || 0)}
                    </p>
                    <p className="text-xs text-orange-600 mt-1">Unallocated</p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Avg Efficiency
                    </p>
                    <p className="text-2xl font-bold text">
                      {filteredAndSortedPods.length > 0
                        ? (
                            (filteredAndSortedPods.reduce(
                              (sum, pod) => sum + (pod.totalEfficiency || 0),
                              0
                            ) /
                              filteredAndSortedPods.length) *
                            100
                          ).toFixed(1)
                        : "0"}
                      %
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      Resource usage
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Activity className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Cost Over Time Chart */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3 mb-4 sm:mb-0">
                    <div className="p-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text">
                        Pod Cost Breakdown
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        Resource allocation across pods
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text">
                        {formatCurrency(
                          chartData?.reduce(
                            (sum, item) =>
                              sum +
                              (item.cpuCost || 0) +
                              (item.ramCost || 0) +
                              (item.pvCost || 0),
                            0
                          ) || 0
                        )}
                      </div>
                      <div className="text-xs text-slate-500">Total Cost</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 mb-6 p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500 shadow-sm"></div>
                    <span className="text-sm font-medium text-slate-700">
                      CPU
                    </span>
                    <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-full">
                      {formatCurrency(
                        chartData?.reduce(
                          (sum, item) => sum + (item.cpuCost || 0),
                          0
                        ) || 0
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-sm"></div>
                    <span className="text-sm font-medium text-slate-700">
                      Memory
                    </span>
                    <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-full">
                      {formatCurrency(
                        chartData?.reduce(
                          (sum, item) => sum + (item.ramCost || 0),
                          0
                        ) || 0
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-amber-500 shadow-sm"></div>
                    <span className="text-sm font-medium text-slate-700">
                      Storage
                    </span>
                    <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-full">
                      {formatCurrency(
                        chartData?.reduce(
                          (sum, item) => sum + (item.pvCost || 0),
                          0
                        ) || 0
                      )}
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <div className="overflow-x-auto overflow-y-hidden">
                    <div
                      style={{
                        minWidth: `${Math.max(
                          800,
                          (chartData?.length || 0) * 60
                        )}px`,
                        width: "100%",
                      }}
                    >
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          data={chartData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                          barCategoryGap="20%"
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f1f5f9"
                            strokeWidth={1}
                            opacity={0.7}
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            stroke="#cbd5e1"
                            tickLine={{ stroke: "#cbd5e1" }}
                            axisLine={{ stroke: "#cbd5e1" }}
                            angle={0}
                            textAnchor="middle"
                            height={80}
                            interval={0}
                            tickMargin={10}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#64748b" }}
                            stroke="#cbd5e1"
                            tickLine={{ stroke: "#cbd5e1" }}
                            axisLine={{ stroke: "#cbd5e1" }}
                            tickFormatter={(value) => formatCurrency(value)}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "white",
                              border: "1px solid #e2e8f0",
                              borderRadius: "12px",
                              boxShadow:
                                "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                              padding: "12px",
                            }}
                            cursor={{ fill: "rgba(59, 130, 246, 0.05)" }}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const total = payload.reduce(
                                  (sum: any, entry) => sum + entry.value,
                                  0
                                );
                                return (
                                  <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                                    <p className="font-semibold text-slate-800 mb-2 text-sm">
                                      {label}
                                    </p>
                                    <div className="space-y-1">
                                      {payload.map((entry, index) => (
                                        <div
                                          key={index}
                                          className="flex items-center justify-between gap-4"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div
                                              className="w-2 h-2 rounded-full"
                                              style={{
                                                backgroundColor: entry.color,
                                              }}
                                            />
                                            <span className="text-xs text-slate-600">
                                              {entry.name}
                                            </span>
                                          </div>
                                          <span className="text-xs font-medium text-slate-900">
                                            {formatCurrency(entry.value)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="border-t border-slate-100 pt-2 mt-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-800">
                                          Total
                                        </span>
                                        <span className="text-xs font-bold text-slate-900">
                                          {formatCurrency(total)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar
                            dataKey="cpuCost"
                            stackId="cost"
                            fill="#3B82F6"
                            name="CPU"
                            radius={[0, 0, 0, 0]}
                          />
                          <Bar
                            dataKey="ramCost"
                            stackId="cost"
                            fill="#10B981"
                            name="Memory"
                            radius={[0, 0, 0, 0]}
                          />
                          <Bar
                            dataKey="pvCost"
                            stackId="cost"
                            fill="#F59E0B"
                            name="Storage"
                            radius={[2, 2, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="flex justify-center mt-2">
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16l4-4m0 0l4 4m-4-4v12"
                        />
                      </svg>
                      Scroll horizontally to view all pods
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <div className="text-lg font-bold text-slate-900">
                        {chartData?.length || 0}
                      </div>
                      <div className="text-xs text-slate-600">Total Pods</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">
                        {formatCurrency(
                          chartData?.reduce(
                            (sum, item) =>
                              sum + (item.cpuCost || 0) + (item.ramCost || 0),
                            0
                          ) || 0
                        )}
                      </div>
                      <div className="text-xs text-slate-600">Compute</div>
                    </div>
                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                      <div className="text-lg font-bold text-amber-600">
                        {formatCurrency(
                          chartData?.reduce(
                            (sum, item) => sum + (item.pvCost || 0),
                            0
                          ) || 0
                        )}
                      </div>
                      <div className="text-xs text-slate-600">Storage</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost Distribution Pie Chart */}
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <h2 className="text-xl font-semibold text mb-6">
                  Cost Distribution
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={costBreakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      dataKey="value"
                    >
                      {costBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {costBreakdownData.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-gray-600">{item.name}</span>
                      </div>
                      <span className="font-medium">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pod Details Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text">
                    Pod Cost Allocation Details
                  </h2>
                  <div className="text-sm text-gray-500">
                    {totalItems} items • Page {currentPage} of {totalPages}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("name")}
                      >
                        Pod Name {getSortIcon("name")}
                      </th>
                      <th
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("cpuCost")}
                      >
                        CPU Cost {getSortIcon("cpuCost")}
                      </th>
                      <th
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("ramCost")}
                      >
                        Memory Cost {getSortIcon("ramCost")}
                      </th>
                      <th
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("pvCost")}
                      >
                        Storage Cost {getSortIcon("pvCost")}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Efficiency
                      </th>
                      <th
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("totalCost")}
                      >
                        Total Cost {getSortIcon("totalCost")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedPods.map((pod) => (
                      <tr
                        key={pod.id}
                        className="hover:bg-gray-50 transition-colors"
                        onClick={() => handlePodDetails(pod.name)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg mr-3">
                              <Database className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 cursor-pointer">
                                {pod.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                CPU: {pod.cpuCoreUsageAverage?.toFixed(4)} /{" "}
                                {pod.cpuCoreRequestAverage} cores
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(pod.cpuCost)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {pod.cpuEfficiency}% used
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(pod.ramCost)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {pod.ramUsageGB}GB / {pod.ramRequestGB}GB
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(pod.pvCost || 0)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              pod.totalEfficiency * 100 > 50
                                ? "bg-green-100 text-green-800"
                                : pod.totalEfficiency * 100 > 20
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {(pod.totalEfficiency * 100).toFixed(1)}%
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-bold text-gray-900">
                            {formatCurrency(pod.totalCost)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Enhanced Pagination Controls */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Rows per page selector */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700">Rows per page</span>
                    <select
                      className="border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={itemsPerPage}
                      onChange={(e) =>
                        handleItemsPerPageChange(Number(e.target.value))
                      }
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  {/* Page info and navigation */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-700">
                      {startIndex + 1}-{Math.min(endIndex, totalItems)} of{" "}
                      {totalItems} items
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        First
                      </button>

                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {/* Page numbers */}
                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: Math.min(5, totalPages) },
                          (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }

                            return (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                                className={`px-3 py-1 text-sm border rounded ${
                                  currentPage === pageNum
                                    ? "bg-blue-500 text-white border-blue-500"
                                    : "border-gray-300 hover:bg-gray-100"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          }
                        )}
                      </div>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Idle Resources Section */}
            {processedData.idle && (
              <div className="mt-8 bg-orange-50 rounded-xl p-6 border border-orange-200">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                  <h2 className="text-xl font-semibold text-orange-900">
                    Idle Resources
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <p className="text-sm font-medium text-gray-600">
                      CPU Cost
                    </p>
                    <p className="text-lg font-bold text-orange-900">
                      {formatCurrency(processedData.idle.cpuCost)}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <p className="text-sm font-medium text-gray-600">
                      Memory Cost
                    </p>
                    <p className="text-lg font-bold text-orange-900">
                      {formatCurrency(processedData.idle.ramCost)}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <p className="text-sm font-medium text-gray-600">
                      Total Idle Cost
                    </p>
                    <p className="text-lg font-bold text-orange-900">
                      {formatCurrency(processedData.idle.totalCost)}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-orange-700 mt-4">
                  These costs represent unallocated cluster resources that could
                  be optimized to reduce overall spending.
                </p>
              </div>
            )}
          </div>
        </div>
      </Layout>

      <PodDetailsModal
        isOpen={showPodModal}
        onClose={() => {
          setShowPodModal(false);
          setSelectedPod(null);
          setPodDetails([]);
        }}
        selectedPod={selectedPod}
        podDetails={podDetails}
        isLoading={podDetails.length === 0 && showPodModal}
        formatCurrency={formatCurrency}
        theme={{
          primary: "blue",
          success: "green",
          warning: "amber",
          accent: "purple",
        }}
        showResourceDistribution={true}
        showPerformanceMetrics={true}
      />
    </>
  );
};

export default KubecostDashboard;
