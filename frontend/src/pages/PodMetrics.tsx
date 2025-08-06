import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Filter,
  TrendingUp,
  Server,
  Database,
  Activity,
  AlertCircle,
  DollarSign,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  LineChart,
  Line,
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

const KubecostDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("totalCost");
  const [sortDirection, setSortDirection] = useState("desc");
  const [selectedTimeRange, setSelectedTimeRange] = useState("7d");

  // New pagination and filtering states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    start: "",
    end: "",
  });
  const [showPodModal, setShowPodModal] = useState(false);
  const [selectedPod, setSelectedPod] = useState(null);
  const [podDetails, setPodDetails] = useState([]);

  // Original useEffect - don't touch this
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

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
        limit: 200,
        includeSharedCostBreakdown: true,
        chartType: "costovertime",
        costUnit: "cumulative",
      };

      try {
        const res = await ClusterService.getClusterAllocationSummary(
          queryParams
        );
        setData(res.data.data);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch cost allocation data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedTimeRange]);

  // New useEffect for pagination/filtering API calls
  useEffect(() => {
    const fetchPaginatedData = async () => {
      if (!data) return; // Only run after initial data is loaded

      const queryParams = {
        window: selectedTimeRange,
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
        filter: searchTerm,
        offset: (currentPage - 1) * itemsPerPage,
        limit: itemsPerPage,
        includeSharedCostBreakdown: true,
        chartType: "costovertime",
        costUnit: "cumulative",
      };

      try {
        // Uncomment when ready to use paginated API
        // const res = await ClusterService.getClusterAllocationSummary(queryParams);
        // Handle paginated response here
        console.log("Paginated query params:", queryParams);
      } catch (err) {
        console.error("Pagination fetch error:", err);
      }
    };

    fetchPaginatedData();
  }, [currentPage, itemsPerPage, searchTerm, selectedTimeRange, data]);

  const getWindowFromSelectedTimeRange = (range: string): string => {
    switch (range) {
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
        // If it's custom, parse the dates and compute difference in days
        if (range.includes(":")) {
          const [start, end] = range.split(":");
          const diffInMs = new Date(end).getTime() - new Date(start).getTime();
          const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
          return `${diffInDays}d`;
        }
        return "1d"; // fallback
    }
  };

  const handlePodDetails = async (name) => {
    setShowPodModal(true);
    console.log(name);
    let queryParams = {
      window: "7d",
      accumulate: "true",
      aggregate: "controller",
      external: "false",
      filterPods: name,
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
    let filtered = processedData.pods.filter(
      (pod) =>
        pod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pod.namespace.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sorted = filtered.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [processedData.pods, searchTerm, sortField, sortDirection]);

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
    setCurrentPage(1); // Reset to first page
  };

  const getTimeRangeOptions = () => [
    { value: "1d", label: "Last 24h" },
    { value: "2d", label: "Last 48h" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "60d", label: "Last 60 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "6m", label: "Last 6 months" },
    { value: "12m", label: "Last 12 months" },
    { value: "custom", label: "Custom Range" },
  ];

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

  if (loading) {
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
    <Layout
      title="Pods & Containers"
      subtitle="CPU, memory, restarts, state, and health probe monitoring"
    >
      <div className="min-h-screen p-6">
        <div className="mx-auto">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search pods by name or namespace..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex gap-3 items-center">
                {/* Time Range Selector */}
                <div className="relative">
                  <select
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[140px]"
                    value={selectedTimeRange}
                    onChange={(e) => {
                      if (e.target.value === "custom") {
                        setShowDateRangeModal(true);
                      } else {
                        setSelectedTimeRange(e.target.value);
                      }
                    }}
                  >
                    {getTimeRangeOptions().map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Button */}
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
              </div>
            </div>
          </div>

          {/* Date Range Modal */}
          {showDateRangeModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">
                  Select Date Range
                </h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={customDateRange.start}
                        onChange={(e) =>
                          setCustomDateRange((prev) => ({
                            ...prev,
                            start: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={customDateRange.end}
                        onChange={(e) =>
                          setCustomDateRange((prev) => ({
                            ...prev,
                            end: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                      onClick={() => setShowDateRangeModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      onClick={() => {
                        setSelectedTimeRange(
                          `${customDateRange.start}:${customDateRange.end}`
                        );
                        setShowDateRangeModal(false);
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Cost
                  </p>
                  <p className="text-2xl font-bold text">
                    {formatCurrency(processedData.totalCost)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
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
                    Active Pods
                  </p>
                  <p className="text-2xl font-bold text">
                    {processedData.pods.length}
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
                  <p className="text-sm font-medium text-gray-600">Idle Cost</p>
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
                    {(
                      (processedData.pods.reduce(
                        (sum, pod) => sum + (pod.totalEfficiency || 0),
                        0
                      ) /
                        processedData.pods.length) *
                      100
                    ).toFixed(1)}
                    %
                  </p>
                  <p className="text-xs text-purple-600 mt-1">Resource usage</p>
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
                                (sum:any, entry) => sum + entry.value,
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Namespace
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
                  {paginatedPods.map((pod, index) => (
                    <tr
                      key={pod.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="p-2 bg-blue-100 rounded-lg mr-3">
                            <Database className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div
                              className="text-sm font-medium text-gray-900 cursor-pointer"
                              onClick={() => handlePodDetails(pod.name)}
                            >
                              {pod.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              CPU: {pod.cpuCoreUsageAverage?.toFixed(4)} /{" "}
                              {pod.cpuCoreRequestAverage} cores
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {pod.namespace}
                        </span>
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
                  <p className="text-sm font-medium text-gray-600">CPU Cost</p>
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

      {showPodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              Details for {selectedPod}
            </h3>

            {podDetails.length === 0 ? (
              <p>No container data found.</p>
            ) : (
              <div className="space-y-4">
                {podDetails.map((container, index) => (
                  <div key={index} className="border p-3 rounded-md shadow">
                    <p className="font-semibold">{container.containerName}</p>
                    <p>
                      CPU: {container.cpu.amount} cores (${container.cpu.cost})
                    </p>
                    <p>
                      RAM: {container.ram.amount} GiB (${container.ram.cost})
                    </p>
                    <p>
                      PV: {container.pv.amount} GiB (${container.pv.cost})
                    </p>
                    <p>Total Time: {container.totalHours} hours</p>
                    <p className="font-bold">
                      Total Cost: ${container.totalCost}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <button
              className="mt-6 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              onClick={() => setShowPodModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default KubecostDashboard;