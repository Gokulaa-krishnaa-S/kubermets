import { useEffect, useState, useRef, useCallback } from "react";
import ClusterService from "../services/ClusterService";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";
import { DonutChart } from "@/components/chart/DonutChart";
import { toast } from "@/components/ui/use-toast";
import { FilterBar } from "@/components/reusable/filterbar";
import ClusterDetailModal from "@/components/modals/ClusterDetailModal";
import { GroupedBarChart } from "@/components/chart/GroupedBarChart";

import { ClusterLayoutLoader } from "@/components/loader/clusterloader";
import { useCluster } from "../../src/components/context/ClusterContext";

// Import the standardized connection status components
import {
  ConnectionStatusBanner,
  NetworkStatusIndicator,
  LoadingBanner,
} from "./ConnectionStatusBanner";

import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  TrendingUp,
  AlertCircle,
  Users,
  Layers,
  Clock,
  BarChart3,
  Zap,
  Database,
  RefreshCw,
  DollarSign,
  Gauge,
  ChevronRight,
  Coins,
  WifiOff,
} from "lucide-react";

export default function ClusterMetrics() {
  const { selectedInstance }: any = useCluster();
  console.log(selectedInstance?.id, "-------------");
  let cluster_id = selectedInstance?.id;
  let user_id = selectedInstance?.user_id;
  const [clusterStats, setClusterStats] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [chartData, setChartData] = useState({
    cpuData: [],
    memoryData: [],
    costBreakdown: [],
  });
  const [timeRange, setTimeRange] = useState("24h");
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const intervalRef = useRef(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [isAutoRefreshPaused, setIsAutoRefreshPaused] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Standardized connection status states
  const [serverStatus, setServerStatus] = useState<"live" | "down">("live");
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("connected");
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [maxRetries, setMaxRetries] = useState(3);
  const [error, setError] = useState<string | null>(null);

  // Add loading state to prevent multiple simultaneous calls
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Helper function to convert bytes to GB
  const bytesToGB = (bytes) => (bytes / 1024 ** 3).toFixed(2);

  // Connection error detection function
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

  // Define the expected type for cluster allocation
  type ClusterAllocation = {
    cpuCoreUsageAverage: number;
    cpuCoreRequestAverage: number;
    ramByteUsageAverage: number;
    ramByteRequestAverage: number;
    totalCost: number;
    totalEfficiency?: number;
    version?: string;
    status?: string;
    cpuCost?: number;
    ramCost?: number;
    pvCost?: number;
    [key: string]: any;
  };

  // Enhanced cluster data API call with retry logic
  const handleCallClusterData = useCallback(
    async (queryParams, isRetry = false) => {
      try {
        console.log("Calling cluster data API with:", queryParams);
        const res = await ClusterService.getClusterDetails(queryParams);

        if (res?.api_failed) {
          setServerStatus("down");
          setConnectionStatus("disconnected");
          setIsAutoRefreshPaused(true);
          console.warn("API reported failure:", res.data);
          if (!res?.data) throw new Error("No data available and API failed");
        } else {
          setServerStatus("live");
          setConnectionStatus("connected");
          setRetryAttempts(0);
          setError(null);
          setIsAutoRefreshPaused(false);
        }

        const allocations = res?.data || [];
        console.log(allocations, "------");

        // Separate idle and active clusters
        const idleEntry =
          allocations.find((a) => a.cluster_name === "__idle__") || {};
        const activeClusters = allocations.filter(
          (a) =>
            a.cluster_name !== "__idle__" && a.cluster_name !== "cluster-total"
        );

        // Calculate "cluster-total" by summing idle + all active
        const totalEntry = activeClusters.concat(idleEntry).reduce(
          (acc, cur) => {
            acc.cpu_cost += cur.cpu_cost || 0;
            acc.ram_cost += cur.ram_cost || 0;
            acc.pv_cost += cur.pv_cost || 0;
            acc.cpu_core_usage_average += cur.cpu_core_usage_average || 0;
            acc.ram_byte_usage_average += cur.ram_byte_usage_average || 0;
            return acc;
          },
          {
            cpu_cost: 0,
            ram_cost: 0,
            pv_cost: 0,
            cpu_core_usage_average: 0,
            ram_byte_usage_average: 0,
          }
        );

        // Prepare cluster list for UI (active only)
        const clusterList = activeClusters.map((c) => ({
          name: c.cluster_name,
          cpu: c.cpu_usage_percent
            ? `${c.cpu_usage_percent.toFixed(0)}%`
            : "0%",
          memory: c.memory_usage_percent
            ? `${c.memory_usage_percent.toFixed(0)}%`
            : "0%",
          cost: `$${(c.total_cost || 0).toFixed(2)}`,
          cpuCores: c.cpu_core_usage_average?.toFixed(2) || "0",
          memoryGB: bytesToGB(c.ram_byte_usage_average || 0),
          efficiency: c.efficiency_percent
            ? `${c.efficiency_percent.toFixed(1)}%`
            : "N/A",
          version: c.cluster_version ?? "N/A",
          nodes: c.node_count || 0,
          pods: c.pod_count || 0,
          status: c.cluster_status ?? "running",
        }));

        setClusters(clusterList);

        // Set cluster stats using computed totalEntry (active + idle)
        setClusterStats([
          {
            title: "Active Clusters",
            value: activeClusters.length,
            subtitle: "Running clusters",
            icon: <Server className="w-4 h-4" />,
            status: "healthy",
          },
          {
            title: "CPU Cost",
            value: `$${(totalEntry.cpu_cost || 0).toFixed(2)}`,
            subtitle: "This period",
            icon: <Cpu className="w-4 h-4" />,
            status: "info",
          },
          {
            title: "Memory Cost",
            value: `$${(totalEntry.ram_cost || 0).toFixed(2)}`,
            subtitle: "This period",
            icon: <Activity className="w-4 h-4" />,
            status: "healthy",
          },
          {
            title: "Storage Cost",
            value: `$${(totalEntry.pv_cost || 0).toFixed(2)}`,
            subtitle: "This period",
            icon: <HardDrive className="w-4 h-4" />,
            status: "info",
          },
          {
            title: "Total CPU Cores",
            value: (totalEntry.cpu_core_usage_average || 0).toFixed(1),
            subtitle: "In use",
            icon: <Zap className="w-4 h-4" />,
            status: "healthy",
          },
          {
            title: "Total Memory",
            value: `${bytesToGB(totalEntry.ram_byte_usage_average || 0)} GB`,
            subtitle: "In use",
            icon: <Database className="w-4 h-4" />,
            status: "info",
          },
        ]);
      } catch (error) {
        console.error("Failed to fetch cluster summary", error);

        if (isConnectionError(error)) {
          setConnectionStatus("disconnected");
          setServerStatus("down");

          if (!isRetry && retryAttempts < maxRetries) {
            console.log(
              `Connection failed, retrying cluster data... (${
                retryAttempts + 1
              }/${maxRetries})`
            );
            setRetryAttempts((prev) => prev + 1);

            setTimeout(() => {
              handleCallClusterData(queryParams, true);
            }, 2000 * (retryAttempts + 1));

            return;
          }

          setError(`Failed to fetch cluster data: ${error.message}`);
          handleApiFailure(error, false);
        } else {
          setError(`Failed to fetch cluster data: ${error.message}`);
          handleApiFailure(error, false);
        }

        throw error;
      }
    },
    [retryAttempts, maxRetries]
  );

  const handleClusterChartData = useCallback(
    async (queryParams, isRetry = false) => {
      try {
        console.log("Calling cluster chart data API with:", queryParams);
        const res = await ClusterService.getClusterAllocationSummary(
          queryParams
        );
        console.log(res, "2------------------");
        console.log(res.data, "condition 1------------------");

        // Check API failure flag
        if (res?.data?.api_failed === true) {
          console.log("came to condition 1");
          setServerStatus("down");
          setConnectionStatus("disconnected");
          setIsAutoRefreshPaused(true);
          console.warn("API reported failure:", res.data);

          // Still process data if available despite API failure
          if (res?.data?.data?.sets?.[0]?.allocations) {
            // Process cached data...
          } else {
            throw new Error("No data available and API failed");
          }
        } else {
          setServerStatus("live");
          setConnectionStatus("connected");
          setRetryAttempts(0);
          setError(null);
          setIsAutoRefreshPaused(false);
        }

        const allocations = res?.data?.data?.sets?.[0]?.allocations || {};

        // CPU usage data
        const cpuChartData = Object.entries(allocations)
          .filter(([name]) => name !== "__idle__")
          .map(([name, cluster]) => ({
            name,
            used: parseFloat(
              (cluster as ClusterAllocation).cpuCoreUsageAverage?.toFixed(2) ||
                "0"
            ),
            requested: parseFloat(
              (cluster as ClusterAllocation).cpuCoreRequestAverage?.toFixed(
                2
              ) || "0"
            ),
          }));

        // Memory usage data
        const memoryChartData = Object.entries(allocations)
          .filter(([name]) => name !== "__idle__")
          .map(([name, cluster]) => {
            const c = cluster as ClusterAllocation;
            return {
              name,
              used: parseFloat(bytesToGB(c.ramByteUsageAverage || 0)),
              requested: parseFloat(bytesToGB(c.ramByteRequestAverage || 0)),
            };
          });

        // Cost breakdown
        const totalClusterCost: any = Object.values(allocations).reduce(
          (sum: number, item: unknown) =>
            sum + ((item as ClusterAllocation).totalCost || 0),
          0
        );

        const costData = Object.entries(allocations).map(([name, cluster]) => {
          const c = cluster as ClusterAllocation;
          return {
            name: name === "__idle__" ? "Idle Resources" : name,
            value: parseFloat(c.totalCost?.toFixed(2) || "0"),
            label: "Cost ($)",
            percentage:
              totalClusterCost > 0
                ? ((c.totalCost / totalClusterCost) * 100).toFixed(1)
                : "0.0",
          };
        });

        setLastUpdated(new Date());
        setChartData({
          cpuData: cpuChartData,
          memoryData: memoryChartData,
          costBreakdown: costData,
        });
      } catch (error) {
        console.error("Failed to fetch cluster chart data", error);

        if (isConnectionError(error)) {
          setConnectionStatus("disconnected");
          setServerStatus("down");

          if (!isRetry && retryAttempts < maxRetries) {
            console.log(
              `Connection failed, retrying chart data... (${
                retryAttempts + 1
              }/${maxRetries})`
            );
            setRetryAttempts((prev) => prev + 1);

            setTimeout(() => {
              handleClusterChartData(queryParams, true);
            }, 2000 * (retryAttempts + 1));

            return;
          }

          setError(`Failed to fetch cluster chart data: ${error.message}`);
          handleApiFailure(error, false);
        } else {
          setError(`Failed to fetch cluster chart data: ${error.message}`);
          handleApiFailure(error, false);
        }

        throw error;
      }
    },
    [retryAttempts, maxRetries]
  );

  // Consolidated data fetching function that accepts explicit parameters
  const fetchAllData = useCallback(
    async (
      window: string,
      domain: string,
      showToast = false,
      isManualRefresh = false
    ) => {
      if (isLoadingData) return;

      setIsRefreshing(true);
      setError(null);

      try {
        const queryParams = {
          user_id,
          cluster_id,
          window,
        };
        console.log("Fetching all data with params:", queryParams);

        await Promise.all([
          handleCallClusterData(queryParams),
          handleClusterChartData(queryParams),
        ]);

        setLastUpdated(new Date());
        if (isManualRefresh && serverStatus === "live")
          setIsAutoRefreshPaused(false);
      } catch (error) {
        setIsAutoRefreshPaused(true);
      } finally {
        setIsLoadingData(false);
        setIsRefreshing(false);
        setIsInitialLoading(false);
      }
    },
    [
      cluster_id,
      user_id,
      isLoadingData,
      handleCallClusterData,
      handleClusterChartData,
      serverStatus,
    ]
  );

  // Handle retry function
  const handleRetry = () => {
    setRetryAttempts(0);
    setError(null);
    refreshAllData(false);
  };

  // Handle time range changes - immediately fetch data with new time range
  const handleTimeRangeChange = useCallback(
    (range: string) => {
      console.log("Time range changed to:", range);
      setTimeRange(range);
      setSearchParams({ window: range });
      // Immediately fetch data with the new time range
      fetchAllData(range, cluster_id, false);
    },
    [cluster_id, fetchAllData, setSearchParams]
  );

  // Manual refresh function - uses current state values
  const refreshAllData = useCallback(
    (showToast?: boolean) => {
      console.log("Manual refresh triggered");
      return fetchAllData(timeRange, cluster_id, showToast ?? true, true); // Pass isManualRefresh = true
    },
    [fetchAllData, timeRange, cluster_id]
  );

  const handleRefreshIntervalChange = useCallback((interval: number) => {
    setRefreshInterval(interval);
  }, []);

  const handleFilterClick = useCallback(() => {
    console.log("Filter button clicked");
  }, []);

  // Initial data load effect
  useEffect(() => {
    console.log("Initial useEffect - loading data on component mount");

    // Get initial time range from URL
    const rangeFromUrl = searchParams.get("window") || "24h";

    // Set initial time range if different
    if (rangeFromUrl !== timeRange) {
      setTimeRange(rangeFromUrl);
    }

    // Load initial data
    if (cluster_id) {
      fetchAllData(rangeFromUrl, cluster_id);
    }
  }, []); // Empty dependency array for initial load only

  // Auto-refresh interval effect
  useEffect(() => {
    if (refreshInterval > 0 && !isAutoRefreshPaused) {
      console.log(`Setting up auto-refresh every ${refreshInterval}ms`);

      intervalRef.current = setInterval(() => {
        // Double-check the pause state before auto-refreshing
        if (!isAutoRefreshPaused) {
          console.log("Auto-refresh triggered");
          fetchAllData(timeRange, cluster_id, false, false); // isManualRefresh = false
        } else {
          console.log("Auto-refresh skipped - paused due to server issues");
        }
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          console.log("Clearing auto-refresh interval");
          clearInterval(intervalRef.current);
        }
      };
    } else if (isAutoRefreshPaused) {
      console.log("Auto-refresh is paused - not setting up interval");
    }
  }, [
    refreshInterval,
    timeRange,
    cluster_id,
    fetchAllData,
    isAutoRefreshPaused,
  ]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (cluster_id) {
      refreshAllData(false); // No toast, force refresh
    }
  }, [cluster_id]);

  // Calculate resource metrics from clusters data
  const getResourceMetrics = () => {
    if (clusters.length === 0) return [];

    const avgCpuUsage =
      clusters.reduce((sum, cluster) => {
        const cpuPercent = parseFloat(cluster.cpu.replace("%", "")) || 0;
        return sum + cpuPercent;
      }, 0) / clusters.length;

    const avgMemoryUsage =
      clusters.reduce((sum, cluster) => {
        const memoryPercent = parseFloat(cluster.memory.replace("%", "")) || 0;
        return sum + memoryPercent;
      }, 0) / clusters.length;

    return [
      {
        label: "Avg CPU Utilization",
        value: Math.round(avgCpuUsage),
        max: 100,
        color: "bg-gradient-to-r from-blue-500 to-blue-600",
        unit: "%",
      },
      {
        label: "Avg Memory Usage",
        value: Math.round(avgMemoryUsage),
        max: 100,
        color: "bg-gradient-to-r from-emerald-500 to-emerald-600",
        unit: "%",
      },
      {
        label: "Cluster Health",
        value: clusters.filter((c) => c.status === "running").length,
        max: clusters.length || 1,
        color: "bg-gradient-to-r from-green-500 to-green-600",
        unit: `/${clusters.length}`,
      },
    ];
  };

  // Get efficiency stats
  const getEfficiencyStats = () => {
    if (clusters.length === 0) return { high: 0, medium: 0, low: 0 };

    let high = 0,
      medium = 0,
      low = 0;
    clusters.forEach((cluster) => {
      if (cluster.efficiency === "N/A") return;
      const eff = parseFloat(cluster.efficiency.replace("%", "")) || 0;
      if (eff >= 70) high++;
      else if (eff >= 30) medium++;
      else low++;
    });

    return { high, medium, low };
  };

  // Enhanced Progress Bar Component
  const ProgressBar = ({ label, value, max, color, unit }) => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">
            {value}
            {unit}
          </span>
          <span className="text-xs text-gray-500">
            / {max}
            {unit === "%" ? "%" : ""}
          </span>
        </div>
      </div>
      <div className="relative">
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-700 ease-out rounded-full relative`}
            style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
          >
            <div className="absolute inset-0 bg-white opacity-20 rounded-full animate-pulse"></div>
          </div>
        </div>
        <div
          className="absolute -top-1 text-xs text-gray-500"
          style={{ left: `${Math.min((value / max) * 100, 100)}%` }}
        >
          ↑
        </div>
      </div>
    </div>
  );

  // Error Display Component - similar to NodeMetrics
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
          <button
            onClick={handleRetry}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <ClusterLayoutLoader
        title="Cluster Metrics"
        subtitle="Loading comprehensive monitoring and resource analytics..."
      />
    );
  }

  const resourceMetrics = getResourceMetrics();
  const efficiencyStats = getEfficiencyStats();

  return (
    <div className="p-4 lg:p-6">
      {/* Standardized Connection Status Banner */}
      {/* <ConnectionStatusBanner
        connectionStatus={connectionStatus}
        error={error}
        retryAttempts={retryAttempts}
        maxRetries={maxRetries}
        isLoadingData={isLoadingData}
        isRefreshing={isRefreshing}
        onRetry={handleRetry}
      /> */}

      {/* Filter Bar with Network Status Indicator */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <FilterBar
            selectedTimeRange={timeRange}
            onTimeRangeChange={handleTimeRangeChange}
            timeRangeVariant="select"
            timeRangeOptions={["24h", "7d", "30d"]}
            onFilterClick={handleFilterClick}
            showFilter={false}
            onRefresh={refreshAllData}
            refreshInterval={refreshInterval}
            onRefreshIntervalChange={handleRefreshIntervalChange}
            isRefreshing={isRefreshing}
            lastUpdated={lastUpdated}
            showRefresh
            className="flex-1"
          />
          <div className="ml-4">
            {/* <NetworkStatusIndicator serverStatus={serverStatus} /> */}
          </div>
        </div>
      </div>

      {/* Loading Banner */}
      {isLoadingData && <LoadingBanner message="Loading cluster data..." />}

      <div className="space-y-6">
        {/* Enhanced Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {clusterStats.map((stat, index) => (
            <div key={index} className="relative">
              <MetricCard {...stat} />
              {/* Add subtle animation */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 hover:opacity-10 transition-opacity duration-500 rounded-lg pointer-events-none"></div>
            </div>
          ))}
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Enhanced Cluster Overview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Enhanced Cluster Cards */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-gray-900">
                      Active Clusters
                      {/* {serverStatus === "down" && (
                        <span className="ml-2 text-sm text-red-600 font-normal">
                          (Offline Mode)
                        </span>
                      )} */}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {clusters.length} clusters running
                      {serverStatus === "down" && (
                        <span className="text-red-600 ml-2">
                          - Showing cached data
                        </span>
                      )}
                    </p>
                  </div>
                  {/* <div className="flex items-center gap-3">
                    <NetworkStatusIndicator serverStatus={serverStatus} />
                  </div> */}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {clusters.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Server className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">
                        No clusters found
                      </p>
                      <p className="text-sm text-gray-400">
                        {cluster_id
                          ? "No clusters for selected domain"
                          : "Check your configuration"}
                      </p>
                    </div>
                  ) : (
                    clusters.map((cluster, index) => (
                      <div
                        key={`${cluster.name}-${index}`}
                        onClick={() => {
                          setSelectedCluster(cluster.name);
                          setShowClusterModal(true);
                        }}
                        className="group p-6 border-2 border-gray-100 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-300 cursor-pointer bg-white hover:bg-blue-50/30"
                      >
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl group-hover:from-blue-600 group-hover:to-blue-700 transition-all duration-300 shadow-lg">
                              <Server className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-900 transition-colors">
                                {cluster.name}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm text-gray-600">
                                  Kubernetes {cluster.version}
                                </p>
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                <p className="text-sm text-gray-600">
                                  Efficiency: {cluster.efficiency}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={cluster.status} />
                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                          </div>
                        </div>

                        {/* Enhanced Metrics Row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <div className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg group-hover:from-blue-50 group-hover:to-blue-100 transition-all duration-300">
                            <div className="text-xl font-bold text-gray-900 mb-1">
                              {cluster.cost}
                            </div>
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Total Cost
                            </div>
                          </div>
                          <div className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg group-hover:from-blue-50 group-hover:to-blue-100 transition-all duration-300">
                            <div className="text-xl font-bold text-gray-900 mb-1">
                              {cluster.cpuCores}
                            </div>
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              CPU Cores
                            </div>
                          </div>
                          <div className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg group-hover:from-blue-50 group-hover:to-blue-100 transition-all duration-300">
                            <div className="text-xl font-bold text-gray-900 mb-1">
                              {cluster.memoryGB} GB
                            </div>
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Memory
                            </div>
                          </div>
                          <div className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg group-hover:from-blue-50 group-hover:to-blue-100 transition-all duration-300">
                            <div className="text-xl font-bold text-gray-900 mb-1">
                              {cluster.efficiency}
                            </div>
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Efficiency
                            </div>
                          </div>
                        </div>

                        {/* Enhanced Resource Usage Bars */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-blue-600" />
                                CPU Usage
                              </span>
                              <span className="text-sm font-bold text-gray-900">
                                {cluster.cpu}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-700 ease-out rounded-full relative"
                                style={{ width: cluster.cpu }}
                              >
                                <div className="absolute inset-0 bg-white opacity-20 rounded-full"></div>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-600" />
                                Memory Usage
                              </span>
                              <span className="text-sm font-bold text-gray-900">
                                {cluster.memory}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-700 ease-out rounded-full relative"
                                style={{ width: cluster.memory }}
                              >
                                <div className="absolute inset-0 bg-white opacity-20 rounded-full"></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              Updated{" "}
                              {lastUpdated
                                ? new Date(lastUpdated).toLocaleTimeString()
                                : "just now"}
                            </span>
                          </div>
                          {/* <button className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium group-hover:translate-x-1 transition-all duration-200">
                            View Details
                            <ChevronRight className="w-4 h-4" />
                          </button> */}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Resource Utilization Chart */}
            {resourceMetrics.length > 0 && (
              <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                      <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    Resource Utilization Overview
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Real-time cluster resource metrics
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {resourceMetrics.map((metric, index) => (
                      <ProgressBar key={index} {...metric} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Enhanced Sidebar */}
          <div className="space-y-6">
            {/* Cluster Efficiency Stats */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                    <Gauge className="w-4 h-4 text-white" />
                  </div>
                  Efficiency Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-700">
                        High Efficiency (≥70%)
                      </span>
                    </div>
                    <span className="text-lg font-bold text-green-700">
                      {efficiencyStats.high}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-700">
                        Medium Efficiency (30-70%)
                      </span>
                    </div>
                    <span className="text-lg font-bold text-yellow-700">
                      {efficiencyStats.medium}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-700">
                        Low Efficiency (&lt;30%)
                      </span>
                    </div>
                    <span className="text-lg font-bold text-red-700">
                      {efficiencyStats.low}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost Breakdown */}
            {chartData.costBreakdown.length > 0 && (
              <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                      <Coins className="w-4 h-4 text-white" />
                    </div>
                    Cost Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {chartData.costBreakdown.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="group hover:bg-gray-50 p-3 rounded-lg transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700 truncate">
                              {item.name}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-gray-900">
                              ${item.value}
                            </div>
                            <div className="text-xs text-gray-500">
                              {item.percentage}%
                            </div>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              item.name === "Idle Resources"
                                ? "bg-gray-400"
                                : "bg-gradient-to-r from-blue-500 to-blue-600"
                            }`}
                            style={{ width: `${item.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* System Health */}
            {/* Bottom Section - Cost Breakdown Donut Chart */}
            {chartData.costBreakdown.length > 0 && (
              <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                    Cost Distribution Analysis
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Visual breakdown of cluster costs and idle resources
                  </p>
                </CardHeader>
                <CardContent className="pb-14">
                  <div className="flex justify-center">
                    <DonutChart
                      data={chartData.costBreakdown}
                      title="Cost Breakdown by Cluster"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Modal */}
      {showClusterModal && selectedCluster && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40  backdrop-blur-sm transition-opacity"
            style={{ pointerEvents: "auto" }}
            onClick={() => {
              setShowClusterModal(false);
              setSelectedCluster(null);
            }}
          />
          {/* Centered Modal */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 mt-2"
            style={{ pointerEvents: "none" }}
          >
            <div
              className="h-[90vh] transform scale-100 transition-transform"
              style={{
                pointerEvents: "auto",
                maxWidth: "95vw",
                width: "100%",
                height: "80vh",
              }}
            >
              <ClusterDetailModal
                clusterName={selectedCluster}
                clusterId={1}
                onClose={() => {
                  setShowClusterModal(false);
                  setSelectedCluster(null);
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
