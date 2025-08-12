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
import { useSelectedHash } from "@/hooks/selected-hash";
import { ResponsiveLoader } from "@/components/loader/loader";

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
  Network,
  Shield,
  Settings,
  Eye,
  RefreshCw,
  Filter,
  Calendar,
  DollarSign,
  Gauge,
  Monitor,
  Cloud,
  ChevronRight,
} from "lucide-react";

export default function ClusterMetrics() {
  const [clusterStats, setClusterStats] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [chartData, setChartData] = useState({
    cpuData: [],
    memoryData: [],
    costBreakdown: [],
  });
  const [timeRange, setTimeRange] = useState("24h");
  const [refreshInterval, setRefreshInterval] = useState(10000);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  // const [lastUpdatedDisplay, setLastUpdatedDisplay] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const intervalRef = useRef(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [showClusterModal, setShowClusterModal] = useState(false);
  // const [selectedHash, setSelectedHash] = useState<string>("");
  const [serverStatus, setServerStatus] = useState<"live" | "down">("live");
  const [isAutoRefreshPaused, setIsAutoRefreshPaused] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  // Add loading state to prevent multiple simultaneous calls
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Helper function to convert bytes to GB
  const bytesToGB = (bytes) => (bytes / 1024 ** 3).toFixed(2);

  const { selectedHash } = useSelectedHash();

  const getServerStatusDisplay = (status: "live" | "down") => {
    return {
      text: status === "live" ? "Live" : "Server Down",
      bgClass:
        status === "live"
          ? "bg-green-100 border-green-200"
          : "bg-red-100 border-red-200",
      dotClass: status === "live" ? "bg-green-500" : "bg-red-500",
      textClass: status === "live" ? "text-green-800" : "text-red-800",
    };
  };

  const handleApiFailure = (error: any, showToast = true) => {
    setServerStatus("down");

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

  // Memoized function to handle cluster data API call

  const handleCallClusterData = useCallback(async (queryParams) => {
    try {
      console.log("Calling cluster data API with:", queryParams);
      const res = await ClusterService.getClusterAllocationSummary(queryParams);

      // Enhanced API failure checking
      console.log(res, "condition 5-----------------");
      console.log(res.data, "condition 2------------------");
      //  setLastUpdated(new Date());

      // Handle cache timestamp for last updated
      // if (res?.cached === true && res?.cache_timestamp) {
      //   const cacheDate = new Date(res.cache_timestamp);
      //   const formattedTime = cacheDate.toLocaleTimeString();
      //   setLastUpdated(cacheDate); // Set the actual Date object
      //   setLastUpdatedDisplay(`Cached at ${formattedTime}`); // Set the display string
      // } else {
      //   const currentDate = new Date();
      //   const formattedTime = currentDate.toLocaleTimeString();
      //   setLastUpdated(currentDate); // Set the actual Date object
      //   setLastUpdatedDisplay(`Updated at ${formattedTime}`); // Set the display string
      // }

      if (res?.api_failed === true) {
        console.log("came to conditon 2");
        setServerStatus("down");
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
      }

      // ... rest of the function remains the same
      const allocations = res?.data?.data?.sets?.[0]?.allocations || {};

      // Filter out idle data for cluster list
      const activeAllocations = Object.entries(allocations).filter(
        ([name]) => name !== "__idle__"
      );

      const clusterList = activeAllocations.map(([name, cluster]) => {
        const c = cluster as ClusterAllocation;
        return {
          name,
          cpu: `${(
            (c.cpuCoreUsageAverage / c.cpuCoreRequestAverage) * 100 || 0
          ).toFixed(0)}%`,
          memory: `${(
            (c.ramByteUsageAverage / c.ramByteRequestAverage) * 100 || 0
          ).toFixed(0)}%`,
          cost: `$${c.totalCost.toFixed(2)}`,
          cpuCores: c.cpuCoreUsageAverage?.toFixed(2) || "0",
          memoryGB: bytesToGB(c.ramByteUsageAverage || 0),
          efficiency: c.totalEfficiency
            ? `${(c.totalEfficiency * 100).toFixed(1)}%`
            : "N/A",
          version: c.version ?? "N/A",
          nodes: 0,
          pods: 0,
          status: c.status ?? "running",
        };
      });

      // Calculate totals including idle
      const totalCpuCost: any = Object.values(allocations).reduce(
        (sum: number, c) => sum + ((c as ClusterAllocation).cpuCost || 0),
        0
      );
      const totalRamCost: any = Object.values(allocations).reduce(
        (sum: number, c) => sum + ((c as ClusterAllocation).ramCost || 0),
        0
      );
      const totalStorage: any = Object.values(allocations).reduce(
        (sum: number, c) => sum + ((c as ClusterAllocation).pvCost || 0),
        0
      );

      // Calculate additional metrics
      const totalCpuCores = activeAllocations.reduce(
        (sum, [, c]) =>
          sum + ((c as ClusterAllocation).cpuCoreUsageAverage || 0),
        0
      );

      const totalMemoryBytes = activeAllocations.reduce(
        (sum, [, c]) =>
          sum + ((c as ClusterAllocation).ramByteUsageAverage || 0),
        0
      );

      setClusters(clusterList);

      setClusterStats([
        {
          title: "Active Clusters",
          value: activeAllocations.length,
          subtitle: "Running clusters",
          icon: <Server className="w-4 h-4" />,
          status: "healthy",
        },
        {
          title: "CPU Cost",
          value: `$${totalCpuCost.toFixed(2)}`,
          subtitle: "This period",
          icon: <Cpu className="w-4 h-4" />,
          status: "info",
        },
        {
          title: "Memory Cost",
          value: `$${(totalRamCost as number).toFixed(2)}`,
          subtitle: "This period",
          icon: <Activity className="w-4 h-4" />,
          status: "healthy",
        },
        {
          title: "Storage Cost",
          value: `$${(totalStorage as number).toFixed(2)}`,
          subtitle: "This period",
          icon: <HardDrive className="w-4 h-4" />,
          status: "info",
        },
        {
          title: "Total CPU Cores",
          value: totalCpuCores.toFixed(1),
          subtitle: "In use",
          icon: <Zap className="w-4 h-4" />,
          status: "healthy",
        },
        {
          title: "Total Memory",
          value: `${bytesToGB(totalMemoryBytes)} GB`,
          subtitle: "In use",
          icon: <Database className="w-4 h-4" />,
          status: "info",
        },
      ]);
    } catch (error) {
      console.error("Failed to fetch cluster summary", error);
      setServerStatus("down");
      setIsAutoRefreshPaused(true);
      handleApiFailure(error);
      throw error;
    }
  }, []);

  const handleClusterChartData = useCallback(async (queryParams) => {
    try {
      console.log("Calling cluster chart data API with:", queryParams);
      const res = await ClusterService.getClusterAllocationSummary(queryParams);
      console.log(res, "2------------------");
      console.log(res.data, "condition 1------------------");
      // setLastUpdated(new Date());

      // Handle cache timestamp for last updated
      // if (res?.cached === true && res?.cache_timestamp) {
      //   const cacheDate = new Date(res.cache_timestamp);
      //   const formattedTime = cacheDate.toLocaleTimeString();
      //   setLastUpdated(cacheDate); // Set the actual Date object
      //   setLastUpdatedDisplay(`Cached at ${formattedTime}`); // Set the display string
      // } else {
      //   const currentDate = new Date();
      //   const formattedTime = currentDate.toLocaleTimeString();
      //   setLastUpdated(currentDate); // Set the actual Date object
      //   setLastUpdatedDisplay(`Updated at ${formattedTime}`); // Set the display string
      // }

      // Check API failure flag
      if (res?.data?.api_failed === true) {
        console.log("came to conditon 1");
        setServerStatus("down");
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
      }

      const allocations = res?.data?.data?.sets?.[0]?.allocations || {};

      // ... rest of the chart data processing remains the same
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
            (cluster as ClusterAllocation).cpuCoreRequestAverage?.toFixed(2) ||
              "0"
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
      setServerStatus("down");
      setIsAutoRefreshPaused(true); // Pause auto-refresh on error
      console.error("Failed to fetch cluster chart data", error);
      throw error;
    }
  }, []);

  // Consolidated data fetching function that accepts explicit parameters
  const fetchAllData = useCallback(
    async (
      window: string,
      domain: string,
      showToast = false,
      isManualRefresh = false
    ) => {
      // Prevent multiple simultaneous calls
      if (isLoadingData) {
        console.log("Data loading already in progress, skipping...");
        return;
      }

      setIsLoadingData(true);
      setIsRefreshing(true);

      try {
        const queryParams = {
          window,
          aggregate: "cluster",
          accumulate: true,
          external: false,
          shareCost: 0,
          shareTenancyCosts: true,
          idle: true,
          shareIdle: true,
          idleByNode: true,
          shareLabels: "",
          shareNamespaces: "",
          shareSplit: "weighted",
          filter: "",
          domain,
          force_refresh: true,
        };

        console.log("Fetching all data with params:", queryParams);

        // Call both APIs concurrently with the same params
        await Promise.all([
          handleCallClusterData(queryParams),
          handleClusterChartData(queryParams),
        ]);

        setLastUpdated(new Date());

        // Note: setLastUpdated is now handled within individual functions
        // based on cache status, so we don't need to set it here

        // If this was a manual refresh and server is back online, resume auto-refresh
        if (isManualRefresh && serverStatus === "live") {
          setIsAutoRefreshPaused(false);
          console.log("Server is back online - resuming auto-refresh");
        }

        if (showToast) {
          toast({
            title:
              serverStatus === "live" ? "Data Refreshed" : "Data Retrieved",
            description:
              serverStatus === "live"
                ? "Cluster metrics have been updated successfully."
                : "Retrieved cached data. Server connection issues detected.",
            variant: serverStatus === "live" ? "default" : "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching data:", error);

        // Pause auto-refresh when there's an error
        setIsAutoRefreshPaused(true);
        console.log("Auto-refresh paused due to error");

        if (showToast) {
          toast({
            title: "Refresh Failed",
            description:
              "Failed to update cluster metrics. Auto-refresh paused until manual retry.",
            variant: "destructive",
          });
        }
      } finally {
        setIsLoadingData(false);
        setIsRefreshing(false);
         setIsInitialLoading(false);
      }
    },
    [isLoadingData, handleCallClusterData, handleClusterChartData, serverStatus]
  );

  // Handle domain change from div component
  // const handleDomainChange = useCallback(
  //   (hash: string) => {
  //     console.log("Domain changed in ClusterMetrics:", hash);
  //     setSelectedHash(hash);
  //     // Immediately fetch data with the new domain hash
  //     fetchAllData(timeRange, hash, true);
  //   },
  //   [timeRange, fetchAllData]
  // );

  // Handle time range changes - immediately fetch data with new time range
  const handleTimeRangeChange = useCallback(
    (range: string) => {
      console.log("Time range changed to:", range);
      setTimeRange(range);
      setSearchParams({ window: range });
      // Immediately fetch data with the new time range
      fetchAllData(range, selectedHash, false);
    },
    [selectedHash, fetchAllData, setSearchParams]
  );

  // Manual refresh function - uses current state values
  const refreshAllData = useCallback(
    (showToast?: boolean) => {
      console.log("Manual refresh triggered");
      return fetchAllData(timeRange, selectedHash, showToast ?? true, true); // Pass isManualRefresh = true
    },
    [fetchAllData, timeRange, selectedHash]
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
    fetchAllData(rangeFromUrl, selectedHash);
  }, []); // Empty dependency array for initial load only

  // Auto-refresh interval effect
  useEffect(() => {
    if (refreshInterval > 0 && !isAutoRefreshPaused) {
      console.log(`Setting up auto-refresh every ${refreshInterval}ms`);

      intervalRef.current = setInterval(() => {
        // Double-check the pause state before auto-refreshing
        if (!isAutoRefreshPaused) {
          console.log("Auto-refresh triggered");
          fetchAllData(timeRange, selectedHash, false, false); // isManualRefresh = false
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
    selectedHash,
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
    if (selectedHash) {
      refreshAllData(false); // No toast, force refresh
    }
  }, [selectedHash]);

  const ServerStatusBanner = () => {
    if (serverStatus === "down" || isAutoRefreshPaused) {
      return (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-800">
                {serverStatus === "down" ? "Server Down" : "Connection Issues"}
              </h4>
              <p className="text-sm text-red-700 mt-1">
                {serverStatus === "down"
                  ? "Unable to reach the server. Auto-refresh is paused to prevent continuous failed requests."
                  : "Auto-refresh has been paused due to connection issues."}{" "}
                Click the refresh button to retry and resume automatic updates.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => refreshAllData(true)}
                  disabled={isRefreshing}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isRefreshing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Retry Connection
                    </>
                  )}
                </button>
                <div className="text-sm text-red-600 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Auto-refresh paused
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const LoadingBanner = ({ message }: { message: string }) => (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-blue-800 text-sm">{message}</span>
      </div>
    </div>
  );

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
      const cpuPercent = parseFloat(cluster.cpu.replace("%", "")) || 0;
      if (cpuPercent >= 70) high++;
      else if (cpuPercent >= 30) medium++;
      else low++;
    });

    return { high, medium, low };
  };
  const NetworkStatusIndicator = ({
    serverStatus,
  }: {
    serverStatus: "live" | "down";
  }) => {
    const statusInfo = getServerStatusDisplay(serverStatus);

    return (
      <div
        className={`flex items-center gap-3 px-4 py-2 rounded-lg border-2 ${statusInfo.bgClass}`}
      >
        <div className="relative">
          <div className={`w-3 h-3 rounded-full ${statusInfo.dotClass}`}>
            {serverStatus === "live" && (
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-75"></div>
            )}
          </div>
        </div>
        <div>
          <span className={`text-sm font-semibold ${statusInfo.textClass}`}>
            {statusInfo.text}
          </span>
          <p className="text-xs text-gray-500">
            {serverStatus === "live" ? "Connected" : "Connection Lost"}
          </p>
        </div>
        {serverStatus === "down" && (
          <div className="ml-auto">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
        )}
      </div>
    );
  };
  const retryApiCall = async (apiFunction: Function, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiFunction();
      } catch (error) {
        console.log(`API call attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          setServerStatus("down");
          throw error;
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  };

  // 6. Enhanced status message based on cached data
  const getStatusMessage = (apiResponse: any) => {
    if (apiResponse?.api_failed) {
      if (apiResponse?.cached) {
        return {
          type: "warning",
          message: `Server Down - Showing cached data from ${new Date(
            apiResponse.cache_timestamp
          ).toLocaleString()}`,
        };
      } else {
        return {
          type: "error",
          message: "Server Down - No data available",
        };
      }
    }
    return {
      type: "success",
      message: "Live connection established",
    };
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
  if (isInitialLoading) {
    return (
      <div className="p-4 lg:p-6">
        <ResponsiveLoader 
          title="Cluster Metrics" 
          subtitle={`Loading comprehensive monitoring and resource analytics...`}
        />
      </div>
    );
  }
  const resourceMetrics = getResourceMetrics();
  const efficiencyStats = getEfficiencyStats();

  return (
    <div
      className="p-4 lg:p-6"
      // title="Cluster Metrics"
      // subtitle="Comprehensive monitoring and resource analytics"
      // onDomainChange={handleDomainChange}
    >
      {/* <ServerStatusBanner /> */}
      {/* Loading indicator */}
      {isLoadingData ? (
        <LoadingBanner message="Loading cluster data..." />
      ) : (
        <FilterBar
          selectedTimeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          timeRangeVariant="select"
          timeRangeOptions={["1h", "6h", "24h", "7d", "30d"]}
          onFilterClick={handleFilterClick}
          showFilter={false}
          onRefresh={refreshAllData}
          refreshInterval={refreshInterval}
          onRefreshIntervalChange={handleRefreshIntervalChange}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          showRefresh
          className="mb-6"
        />
      )}

      <div className="space-y-6">
        {/* Remove the DomainDropdown section completely */}
        {/* Display selected domain info if available */}

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

        {/* Three Column div */}
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
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {clusters.length} clusters running
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <NetworkStatusIndicator serverStatus={serverStatus} />
                  </div>
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
                        {selectedHash
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
                          <button className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium group-hover:translate-x-1 transition-all duration-200">
                            View Details
                            <ChevronRight className="w-4 h-4" />
                          </button>
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

            {/* CPU and Memory Charts */}
            {/* {(chartData.cpuData.length > 0 ||
              chartData.memoryData.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {chartData.cpuData.length > 0 && (
                    <Card className="shadow-lg border-0">
                      <CardHeader>
                        <CardTitle className="text-lg font-bold text-gray-900">
                          CPU Usage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <GroupedBarChart
                          data={chartData.cpuData}
                          title={undefined}
                          yAxisLabel={undefined}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {chartData.memoryData.length > 0 && (
                    <Card className="shadow-lg border-0">
                      <CardHeader>
                        <CardTitle className="text-lg font-bold text-gray-900">
                          Memory Usage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <GroupedBarChart
                          data={chartData.memoryData}
                          title={undefined}
                          yAxisLabel={undefined}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              )} */}
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
                      <DollarSign className="w-4 h-4 text-white" />
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

            {/* Quick Actions */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                    <Settings className="w-4 h-4 text-white" />
                  </div>
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all duration-200 text-left group">
                    <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                      <Monitor className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-blue-800">
                        Node Monitor
                      </span>
                      <p className="text-xs text-gray-500">View node details</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 ml-auto group-hover:text-blue-600 transition-colors" />
                  </button>

                  <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-green-50 hover:border-green-200 border border-transparent transition-all duration-200 text-left group">
                    <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                      <Shield className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-green-800">
                        Security Scan
                      </span>
                      <p className="text-xs text-gray-500">
                        Run security checks
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 ml-auto group-hover:text-green-600 transition-colors" />
                  </button>

                  <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 hover:border-purple-200 border border-transparent transition-all duration-200 text-left group">
                    <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                      <BarChart3 className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-purple-800">
                        Analytics
                      </span>
                      <p className="text-xs text-gray-500">Detailed reports</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 ml-auto group-hover:text-purple-600 transition-colors" />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-gray-700">
                        API Server
                      </span>
                    </div>
                    <span className="text-sm font-medium text-green-700">
                      Healthy
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-gray-700">
                        Data Collection
                      </span>
                    </div>
                    <span className="text-sm font-medium text-green-700">
                      Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-gray-700">
                        Monitoring
                      </span>
                    </div>
                    <span className="text-sm font-medium text-blue-700">
                      Running
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
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
