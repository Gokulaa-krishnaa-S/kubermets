import { useState, useEffect, useMemo, useCallback } from "react";
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
  User,
  WifiOff,
  RefreshCw,
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
import ClusterService from "@/services/ClusterService";
import podService from "@/services/podService";
import PodDetailsModal from "@/components/modals/podDetailMetrics";
import { Days, Refresh } from "@/components/reusable/filterbar";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DomainDropdown from "@/components/reusable/domainDropdown";
import { toast } from "@/components/ui/use-toast";

import { PodMetricsLoader } from "@/components/loader/podloader";
import { useCluster } from "../../src/components/context/ClusterContext";
import {
  ConnectionStatusBanner,
  NetworkStatusIndicator,
  LoadingBanner,
} from "./ConnectionStatusBanner";

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
  let { selectedInstance }: any = useCluster();
  selectedInstance = selectedInstance ? selectedInstance : "-";
  let selectedHash = selectedInstance?.unique_hash || "-";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState("totalCost");
  const [sortDirection, setSortDirection] = useState("desc");
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTimeRange, setSelectedTimeRange] = useState(() => {
    return searchParams.get("window") || "24h";
  });

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showPodModal, setShowPodModal] = useState(false);
  const [selectedPod, setSelectedPod] = useState(null);
  const [podDetails, setPodDetails] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Enhanced connection status states (matching NodeMetrics)
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Standardized connection status tracking (from NodeMetrics)
  const [serverStatus, setServerStatus] = useState<"live" | "down">("live");
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("connected");
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [maxRetries, setMaxRetries] = useState(3);
  const [isAutoRefreshPaused, setIsAutoRefreshPaused] = useState(false);

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
        return "1d";
    }
  };

  // Connection error detection (from NodeMetrics)
  const isConnectionError = (error) => {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || "";
    const errorCode = error.code || error.status;

    return (
      errorMessage.includes("network") ||
      errorMessage.includes("connection") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("fetch") ||
      errorMessage.includes("cors") ||
      errorMessage.includes("enotfound") ||
      errorMessage.includes("econnrefused") ||
      errorCode === "NETWORK_ERROR" ||
      errorCode === "ERR_NETWORK" ||
      errorCode === 0 ||
      errorCode === 502 ||
      errorCode === 503 ||
      errorCode === 504
    );
  };

  // API failure handler (from NodeMetrics)
  const handleApiFailure = (error: any, showToast = true) => {
    setServerStatus("down");
    setConnectionStatus("disconnected");
    setIsAutoRefreshPaused(true);

    if (showToast) {
      toast({
        title: "Connection Issues",
        description: "Server connection failed. Data may be outdated.",
        variant: "destructive",
      });
    }
  };

  // Enhanced fetchData with retry logic 
  const fetchData = useCallback(
    async (showToast = false, isRetry = false) => {
      try {
        if (!isRetry) {
          setIsRefreshing(showToast);
          // setIsLoadingData(true);
          if (!showToast) setLoading(true);
          setError(null);
        }

        const queryParams = {
          cluster_id: 1,
          user_id: 1,
          duration: selectedTimeRange,
          ...(searchTerm && { search: searchTerm }),
        };

        console.log("API Query params:", queryParams);

        const response = await podService.getPodMetrics(queryParams);
        console.log("API Response:", response);

        // Transform the database response to match your frontend format
        const transformedData = {
          sets: [
            {
              allocations: {},
            },
          ],
        };

        if (response && response.data && Array.isArray(response.data)) {
          response.data.forEach((pod) => {
            const podKey = pod.id || `${pod.namespace}/${pod.name}`;
            transformedData.sets[0].allocations[podKey] = {
              name: pod.name,
              namespace: pod.namespace,
              totalCost: pod.totalCost || 0,
              cpuCost: pod.cpuCost || 0,
              ramCost: pod.ramCost || 0,
              pvCost: pod.pvCost || 0,
              gpuCost: pod.gpuCost || 0,
              networkCost: pod.networkCost || 0,
              loadBalancerCost: pod.loadBalancerCost || 0,
              externalCost: pod.externalCost || 0,
              sharedCost: pod.sharedCost || 0,
              cpuCoreUsageAverage: pod.cpuCoreUsageAverage || 0,
              cpuCoreRequestAverage: pod.cpuCoreRequestAverage || 0,
              ramByteUsageAverage: pod.ramByteUsageAverage || 0,
              ramByteRequestAverage: pod.ramByteRequestAverage || 0,
              gpuUsageAverage: pod.gpuUsageAverage || 0,
              gpuRequestAverage: pod.gpuRequestAverage || 0,
              pvBytes: pod.pvBytes || 0,
              totalEfficiency: pod.totalEfficiency || 0,
              cpuEfficiency: pod.cpuEfficiency || 0,
              ramEfficiency: pod.ramEfficiency || 0,
              isIdle: pod.isIdle || false,
            };
          });
        }

        setData(transformedData);
        setLastUpdated(new Date());

        // Reset connection status and retry attempts on success
        setServerStatus("live");
        setConnectionStatus("connected");
        setRetryAttempts(0);
        setError(null);
        setIsAutoRefreshPaused(false);

        if (showToast) {
          console.log("Data refreshed successfully");
          toast({
            title: "Data Refreshed",
            description: "Pod metrics have been updated successfully.",
            variant: "default",
          });
        }
      } catch (err) {
        console.error("Error fetching pod metrics:", err);

        if (isConnectionError(err)) {
          setConnectionStatus("disconnected");
          setServerStatus("down");

          if (!isRetry && retryAttempts < maxRetries) {
            console.log(
              `Connection failed, retrying... (${
                retryAttempts + 1
              }/${maxRetries})`
            );
            setRetryAttempts((prev) => prev + 1);

            // Retry after a delay with exponential backoff
            setTimeout(() => {
              fetchData(showToast, true);
            }, 2000 * (retryAttempts + 1));

            return;
          }

          setError(
            `Failed to fetch pod metrics: ${err.message || "Connection failed"}`
          );
          handleApiFailure(err, false);
        } else {
          setError(`Failed to fetch pod metrics: ${err.message}`);
          handleApiFailure(err, false);
        }

        // Don't clear data on error to show cached data
        if (!data) {
          setData({ sets: [{ allocations: {} }] });
        }
      } finally {
        setLoading(false);
        setIsLoadingData(false);
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedTimeRange, searchTerm, retryAttempts, maxRetries, data]
  );

  // Retry handler (from NodeMetrics)
  const handleRetry = () => {
    setRetryAttempts(0);
    setError(null);
    fetchData(false);
  };

  // Enhanced refresh handler (from NodeMetrics)
  const refreshAllData = async (showToast = true) => {
    setIsRefreshing(true);
    try {
      await fetchData(showToast);

      // If this was a manual refresh and server is back online, resume auto-refresh
      if (serverStatus === "live") {
        setIsAutoRefreshPaused(false);
        console.log("Server is back online - resuming auto-refresh");
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
      if (showToast) {
        toast({
          title: "Refresh Failed",
          description:
            "Failed to update pod metrics. Auto-refresh paused until manual retry.",
          variant: "destructive",
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Enhanced useEffect with connection status handling
  useEffect(() => {
    const rangeFromUrl = searchParams.get("window") || "24h";
    setIsInitialLoading(true);
    setSelectedTimeRange(rangeFromUrl);
    setSearchParams({ window: rangeFromUrl });

    if (selectedInstance) {
      fetchData();
    }
  }, [selectedInstance?.cluster_id]);

  // Enhanced auto-refresh with pause logic
  useEffect(() => {
    let intervalId;

    if (
      refreshInterval &&
      refreshInterval > 0 &&
      selectedInstance &&
      !isAutoRefreshPaused
    ) {
      intervalId = setInterval(() => {
        if (!isAutoRefreshPaused && serverStatus === "live") {
          fetchData();
        }
      }, refreshInterval * 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [
    refreshInterval,
    selectedInstance?.cluster_id,
    isAutoRefreshPaused,
    serverStatus,
  ]);

  // Time range change effect
  useEffect(() => {
    if (selectedInstance) {
      setSearchParams({ window: selectedTimeRange });
      fetchData();
    }
  }, [selectedTimeRange]);

  // Enhanced pod details handler with error handling
  const handlePodDetails = async (name) => {
    setSelectedPod(name);
    setShowPodModal(true);

    try {
      const queryParams = {
        cluster_id: "1",
        user_id: "1",
        duration: "7d",
        ...(selectedHash && { domain: selectedHash }),
      };

      console.log("Fetching pod details with params:", queryParams);

      const response = await podService.getPodDetails(name, queryParams);
      console.log("Pod details response:", response);

      if (!response || !response.data) {
        console.warn("No pod details data received");
        setPodDetails([]);
        return [];
      }

      const podData = response.data;
      const totalHours = podData.timeInfo?.totalRuntimeHours || 0;
      const container = {
        containerName: podData.podInfo?.name || name,
        cpu: {
          amount: podData.resourceUsage?.cpu?.averageRequest || 0,
          hourlyRate: "$0.031611",
          cost: podData.costSummary?.breakdown?.cpu || 0,
          usage: podData.resourceUsage?.cpu?.averageUsage || 0,
          efficiency: podData.resourceUsage?.cpu?.efficiency || 0,
        },
        ram: {
          amount: (
            podData.resourceUsage?.memory?.averageRequestGB || 0
          ).toFixed(2),
          hourlyRate: "$0.004237",
          cost: podData.costSummary?.breakdown?.memory || 0,
          usageGB: (podData.resourceUsage?.memory?.averageUsageGB || 0).toFixed(
            2
          ),
          efficiency: podData.resourceUsage?.memory?.efficiency || 0,
        },
        pv: {
          amount: (podData.resourceUsage?.storage?.averageGB || 0).toFixed(0),
          hourlyRate: "$0.000055",
          cost: podData.costSummary?.breakdown?.storage || 0,
          adjustment: 0,
        },
        totalHours: totalHours.toFixed(2),
        totalCost: (podData.costSummary?.totalCost || 0).toFixed(2),
        efficiency: {
          total: podData.performance?.totalEfficiency || 0,
          cpu: podData.resourceUsage?.cpu?.efficiency || 0,
          memory: podData.resourceUsage?.memory?.efficiency || 0,
        },
        window: podData.timeInfo?.queryRange?.duration || "7d",
        namespace: podData.podInfo?.namespace || "default",

        avgCostPerHour: podData.costSummary?.avgCostPerHour || 0,
        firstSeen: podData.timeInfo?.firstSeen,
        lastSeen: podData.timeInfo?.lastSeen,
        hasIdlePeriods: podData.performance?.hasIdlePeriods || false,
        totalRecords: podData.timeInfo?.totalRecords || 0,

        costBreakdown: {
          cpu: podData.costSummary?.breakdown?.cpu || 0,
          memory: podData.costSummary?.breakdown?.memory || 0,
          storage: podData.costSummary?.breakdown?.storage || 0,
          gpu: podData.costSummary?.breakdown?.gpu || 0,
          network: podData.costSummary?.breakdown?.network || 0,
          loadBalancer: podData.costSummary?.breakdown?.loadBalancer || 0,
          external: podData.costSummary?.breakdown?.external || 0,
          shared: podData.costSummary?.breakdown?.shared || 0,
        },
      };

      const containers = [container];
      setPodDetails(containers);
      return containers;
    } catch (error) {
      console.error("Error fetching pod details:", error);
      setPodDetails([]);

      // Handle connection errors for pod details
      if (isConnectionError(error)) {
        toast({
          title: "Connection Error",
          description: "Failed to load pod details due to connection issues.",
          variant: "destructive",
        });
      }
      return [];
    }
  };

  // Rest of your existing component logic...
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
    console.log(pods)
    return { pods, idle, totalCost };
  }, [data]);

  const filteredAndSortedPods = useMemo(() => {
    console.log(processedData)
    const filtered = processedData.pods.filter((pod) => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        pod.name.toLowerCase().includes(searchLower) ||
        pod.namespace.toLowerCase().includes(searchLower) ||
        pod.id.toLowerCase().includes(searchLower)
      );
    });

    const sorted = filtered.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [processedData.pods, sortField, sortDirection, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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

  // Error Display Component (from NodeMetrics)
  if (
    error &&
    !isInitialLoading &&
    serverStatus === "down" &&
    retryAttempts >= maxRetries
  ) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 border border-red-200 max-w-md text-center">
          <WifiOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Connection Lost
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-6">
            Please check your internet connection and try again.
          </p>
          <Button onClick={handleRetry} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <PodMetricsLoader
        title="Pod Metrics"
        subtitle="Loading comprehensive monitoring and resource analytics..."
      />
    );
  }

  return (
    <>
      <div className=" ">
        <div className="min-h-screen sm:p-4 md:p-6">
          <div className="mx-auto max-w-full">
            {/* Standardized Connection Status Banner */}
            <ConnectionStatusBanner
              connectionStatus={connectionStatus}
              error={error}
              retryAttempts={retryAttempts}
              maxRetries={maxRetries}
              isLoadingData={isLoadingData}
              isRefreshing={isRefreshing}
              onRetry={handleRetry}
            />

            {/* Enhanced Filter Bar with Network Status Indicator */}
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm mb-6">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between w-full">
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

                {/* Right side - Refresh Controls and Network Status */}
                <div className="flex items-center gap-3">
                  <Refresh
                    onRefresh={refreshAllData}
                    refreshInterval={refreshInterval}
                    onRefreshIntervalChange={setRefreshInterval}
                    isRefreshing={isRefreshing}
                    lastUpdated={lastUpdated}
                  />
                  <NetworkStatusIndicator serverStatus={serverStatus} />
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

            {/* Loading Banner */}
            {isLoadingData && <LoadingBanner message="Loading pod data..." />}

            {/* Summary Cards - Updated to reflect filtered data and connection status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
              <div
                className={`bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow ${
                  serverStatus === "down" ? "opacity-75" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      <DollarSign className="w-6 h-10 text-blue-600" />
                      {searchTerm ? "Filtered" : "Total"} Cost
                      {serverStatus === "down" && (
                        <span className="text-red-600 ml-1">(Offline)</span>
                      )}
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
                      {serverStatus === "down" && (
                        <span className="text-red-600 ml-1">
                          {" "}
                          - Cached data
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow ${
                  serverStatus === "down" ? "opacity-75" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      <Server className="w-6 h-10 text-green-600" />
                      {searchTerm ? "Matching" : "Active"} Pods
                      {serverStatus === "down" && (
                        <span className="text-red-600 ml-1">(Offline)</span>
                      )}
                    </p>
                    <p className="text-2xl font-bold text">
                      {filteredAndSortedPods.length}
                    </p>
                    <p className="text-xs text-green-600 mt-1">Running</p>
                  </div>
                  {/* <div className="p-3 bg-green-100 rounded-lg">
                    <Server className="w-6 h-6 text-green-600" />
                  </div> */}
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      <Clock className="w-6 h-10 text-orange-600" />
                      Idle Cost
                    </p>
                    <p className="text-2xl font-bold text">
                      {formatCurrency(processedData.idle?.totalCost || 0)}
                    </p>
                    <p className="text-xs text-orange-600 mt-1">Unallocated</p>
                  </div>
                  {/* <div className="p-3 bg-orange-100 rounded-lg">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div> */}
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      <Activity className="w-6 h-10 text-purple-600" />
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
                  {/* <div className="p-3 bg-purple-100 rounded-lg">
                    <Activity className="w-6 h-6 text-purple-600" />
                  </div> */}
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
              {/* Cost Over Time Chart */}
              <div className="md:col-span-2 bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 sm:mb-8 pb-4 border-b border-slate-100 gap-4">
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

                <div className="flex flex-wrap gap-3 sm:gap-6 mb-4 sm:mb-6 p-2 sm:p-4 bg-slate-50 rounded-xl">
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
                  <div className="overflow-x-auto overflow-y-hidden w-full">
                    <div
                      style={{
                        minWidth: `${Math.max(
                          400,
                          (chartData?.length || 0) * 60
                        )}px`,
                        width: "100%",
                      }}
                    >
                      <ResponsiveContainer width="100%" height={320}>
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

                <div className="mt-4 sm:mt-6 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
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
              <div className="w-full">
                <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm">
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
                  <div className="mt-2 sm:mt-4 space-y-2">
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

                {/* Idle Resources Section */}
                {processedData.idle && (
                  <div className="mt-6 sm:mt-8 bg-orange-50 rounded-xl p-4 sm:p-6 border border-orange-200">
                    <div className="flex items-center gap-3 mb-4">
                      <AlertCircle className="w-6 h-6 text-orange-600" />
                      <h2 className="text-xl font-semibold text-orange-900">
                        Idle Resources
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                      <div className="bg-white rounded-lg p-4 border border-orange-200">
                        <p className="text-sm font-medium text-gray-600">
                          CPU Cost
                        </p>
                        <p className="text-lg font-bold text-orange-900">
                          <div className="flex items-center gap-2">
                            {formatCurrency(processedData.idle.cpuCost)}
                          </div>
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-orange-200">
                        <p className="text-sm font-medium text-gray-600">
                          Memory Cost
                        </p>
                        <p className="text-lg font-bold text-orange-900">
                          <div className="flex items-center gap-2">
                            {formatCurrency(processedData.idle.ramCost)}
                          </div>
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-orange-200">
                        <p className="text-sm font-medium text-gray-600">
                          Total Idle Cost
                        </p>
                        <p className="text-lg font-bold text-orange-900">
                          <div className="flex items-center gap-2">
                            {formatCurrency(processedData.idle.totalCost)}
                          </div>
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-orange-700 mt-4">
                      These costs represent unallocated cluster resources that
                      could be optimized to reduce overall spending.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Pod Details Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text">
                    Pod Cost Allocation Details
                  </h2>
                  <div className="text-sm text-gray-500">
                    {totalItems} items • Page {currentPage} of {totalPages}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto w-full">
                <table className="min-w-[600px] w-full">
                  <thead className="bg-gray-50 sticky top-0 z-10">
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
              <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 sm:gap-4 w-full">
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
          </div>
        </div>
      </div>

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
