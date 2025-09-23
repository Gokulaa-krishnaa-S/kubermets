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
import { useLocation } from 'react-router-dom';

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
  Info,
} from "lucide-react";

const METRIC_TOOLTIPS = {
  totalCost:
    "Sum of all cluster costs: CPU cost + Memory cost + Storage cost across all clusters for the selected time period",
  cpuCost:
    "Total CPU cost across all active clusters for the selected time period",
  memoryCost:
    "Total memory (RAM) cost across all active clusters for the selected time period",
  storageCost:
    "Total persistent volume (PV) cost across all active clusters for the selected time period",
  totalCpuCores: "Sum of CPU cores currently in use across all clusters",
  totalMemory: "Sum of memory currently in use (GB) across all clusters",

  clusterName: "Unique identifier for the cluster",
  clusterCost:
    "Total cost incurred by this cluster during the selected time period",
  cpuCores: "CPU cores allocated/used by this cluster",
  memoryGB: "Memory allocated/used by this cluster in GB",
  cpuUsage: "Percentage of CPU capacity currently utilized in this cluster",
  memoryUsage:
    "Percentage of memory capacity currently utilized in this cluster",
  efficiency:
    "Ratio of actual resource usage to requested resources for this cluster (higher is better)",

  version: "Kubernetes version running on the cluster",
  nodes: "Total number of nodes in this cluster",
  pods: "Total number of pods running in this cluster",
  status:
    "Current operational state of the cluster (e.g., Running, Pending, Failed)",

  avgCpuUtilization: "Average CPU utilization across all active clusters",
  avgMemoryUsage: "Average memory utilization across all active clusters",
  clusterHealth:
    "Proportion of healthy (Running) clusters compared to total clusters",

  cpuEfficiency: "CPU efficiency for this cluster (actual usage vs requested)",
  memoryEfficiency: "Memory efficiency for this cluster (actual usage vs requested)",
  overallEfficiency: "Overall resource efficiency for this cluster",

  costBreakdown:
    "Breakdown of this cluster's cost by CPU, memory, storage, and other resources",
  idleResourcesCost:
    "Portion of cost from resources that were allocated but not used (idle)",
  usedCpu: "Actual CPU cores actively consumed by workloads",
  requestedCpu: "Total CPU cores requested/allocated by workloads",
  usedMemory: "Actual memory actively consumed by workloads (GB)",
  requestedMemory: "Total memory requested/allocated by workloads (GB)",
  costDistribution:
    "Visual representation of how costs are distributed across clusters and idle resources",
};

const TooltipWrapper = ({ children, tooltip, className = "" }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`relative ${className}`}>
      {children}
      <div
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Info className="w-4 h-4 text-gray-400 hover:text-blue-600 cursor-pointer" />
      </div>
      {showTooltip && tooltip && (
        <div className="absolute top-8 right-0 z-50 w-44 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg border">
          <div className="relative">
            {tooltip}
            <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function ClusterMetrics() {
  const { selectedInstance, userId }: any = useCluster();
  const [isSticky, setIsSticky] = useState(false);
  const filterBarRef = useRef(null);
  const stickyPlaceholderRef = useRef(null);
  const location = useLocation();
  console.log(selectedInstance?.id, "iddd2-------------");
  let cluster_id = selectedInstance?.id;
  let user_id = userId;
  console.log(user_id, "user_id------------------");
  const [clusterStats, setClusterStats] = useState([]);

  const [cluster, setCluster] = useState(null);

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

  const [serverStatus, setServerStatus] = useState<"live" | "down">("live");
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("connected");
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [maxRetries, setMaxRetries] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const [isLoadingData, setIsLoadingData] = useState(false);

  const bytesToGB = (bytes) => (bytes / 1024 ** 3).toFixed(2);

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

        const idleEntry =
          allocations.find((a) => a.cluster_name === "__idle__") || {};
        const activeClusters = allocations.filter(
          (a) =>
            a.cluster_name !== "__idle__" && a.cluster_name !== "cluster-total"
        );

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

        const activeCluster = activeClusters[0];

        if (activeCluster) {
          const clusterData = {
            name: activeCluster.cluster_name,
            cpu: activeCluster.cpu_usage_percent
              ? `${activeCluster.cpu_usage_percent.toFixed(0)}%`
              : "0%",
            memory: activeCluster.memory_usage_percent
              ? `${activeCluster.memory_usage_percent.toFixed(0)}%`
              : "0%",
            cost: `$${(activeCluster.total_cost || 0).toFixed(2)}`,
            cpuCores: activeCluster.cpu_core_usage_average?.toFixed(2) || "0",
            memoryGB: bytesToGB(activeCluster.ram_byte_usage_average || 0),
            efficiency: activeCluster.efficiency_percent
              ? `${activeCluster.efficiency_percent.toFixed(1)}%`
              : "N/A",
            version: activeCluster.cluster_version ?? "N/A",
            nodes: activeCluster.node_count || 0,
            pods: activeCluster.pod_count || 0,
            status: activeCluster.cluster_status ?? "running",

            rawData: activeCluster,
          };

          setCluster(clusterData);
        } else {
          setCluster(null);
        }

        const totalCost = activeClusters.reduce((sum, cluster) => {
          return sum + (cluster.total_cost || 0);
        }, 0);

        setClusterStats([
          {
            title: "Total Cost",
            value: `$${totalCost.toFixed(2)}`,
            subtitle: "Total Cost",
            icon: <DollarSign className="w-4 h-4" />,
            status: "info",
            tooltip: METRIC_TOOLTIPS.totalCost,
          },
          {
            title: "CPU Cost",
            value: `$${(totalEntry.cpu_cost || 0).toFixed(2)}`,
            tooltip: METRIC_TOOLTIPS.cpuCost,
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
            tooltip: METRIC_TOOLTIPS.memoryCost,
          },
          {
            title: "Storage Cost",
            value: `$${(totalEntry.pv_cost || 0).toFixed(2)}`,
            subtitle: "This period",
            icon: <HardDrive className="w-4 h-4" />,
            status: "info",
            tooltip: METRIC_TOOLTIPS.storageCost,
          },
          {
            title: "Total CPU Cores",
            value: (totalEntry.cpu_core_usage_average || 0).toFixed(2),
            subtitle: "In use",
            icon: <Zap className="w-4 h-4" />,
            status: "healthy",
            tooltip: METRIC_TOOLTIPS.totalCpuCores,
          },
          {
            title: "Total Memory",
            value: `${bytesToGB(totalEntry.ram_byte_usage_average || 0)} GB`,
            subtitle: "In use",
            icon: <Database className="w-4 h-4" />,
            status: "info",
            tooltip: METRIC_TOOLTIPS.totalMemory,
          },
        ]);
      } catch (error) {
        console.error("Failed to fetch cluster summary", error);

        if (isConnectionError(error)) {
          setConnectionStatus("disconnected");
          setServerStatus("down");

          if (!isRetry && retryAttempts < maxRetries) {
            console.log(
              `Connection failed, retrying cluster data... (${retryAttempts + 1
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

        if (res?.data?.api_failed === true) {
          console.log("came to condition 1");
          setServerStatus("down");
          setConnectionStatus("disconnected");
          setIsAutoRefreshPaused(true);
          console.warn("API reported failure:", res.data);

          if (res?.data?.data?.sets?.[0]?.allocations) {

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
              `Connection failed, retrying chart data... (${retryAttempts + 1
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

  const handleRetry = () => {
    setRetryAttempts(0);
    setError(null);
    refreshAllData(false);
  };

  const handleTimeRangeChange = useCallback(
    (range: string) => {
      console.log("Time range changed to:", range);
      setTimeRange(range);
      setSearchParams({ window: range });
      fetchAllData(range, cluster_id, false);
    },
    [cluster_id, fetchAllData, setSearchParams]
  );

const refreshAllData = async (showToast = true) => {
  setIsRefreshing(true);
  try {
    // Call your existing data fetch
    await fetchAllData(timeRange, cluster_id, showToast ?? true, true);
    setLastUpdated(new Date());

    // Check server status for auto-refresh
    if (serverStatus === "live") {
      setIsAutoRefreshPaused(false);
      console.log("Server is back online - resuming auto-refresh");
    }

    // Success toast only if allowed and server is live
    if (showToast && serverStatus === "live") {
      toast({
        title: "Data Refreshed",
        description: "Cluster metrics have been updated successfully.",
        variant: "default",
      });
    }
  } catch (error) {
    console.error("Error refreshing data:", error);

    if (showToast) {
      toast({
        title: "Refresh Failed",
        description:
          "Failed to update cluster metrics. Auto-refresh paused until manual retry.",
        variant: "destructive",
      });
    }

    // Pause auto-refresh on failure
    setIsAutoRefreshPaused(true);
  } finally {
    setIsRefreshing(false);
  }
};

  const handleRefreshIntervalChange = useCallback((interval: number) => {
    setRefreshInterval(interval);
  }, []);

  const handleFilterClick = useCallback(() => {
    console.log("Filter button clicked");
  }, []);

  const callInsertClusterAPI = useCallback(async (clusterId) => {
    try {
      const apiBaseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://172.16.10.4:5007/v1";
      const response = await fetch(`${apiBaseUrl}/saveNewCluster`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cluster_id: clusterId,
          snapshots: [
            {
              window: {
                timestamp: null,
                window_start: null,
                window_end: null,
                window_duration: "24h",
              },
              allocations: {
                "default-cluster": {
                  timestamp: null,
                  window_start: null,
                  window_end: null,
                  window_duration: "24h",
                  total_cost: 0,
                  cpu_cost: 0,
                  cpu_cost_idle: 0,
                  ram_cost: 0,
                  ram_cost_idle: 0,
                  pv_cost: 0,
                  network_cost: 0,
                  gpu_cost: 0,
                  gpu_cost_idle: 0,
                  load_balancer_cost: 0,
                  external_cost: 0,
                  shared_cost: 0,
                  cpu_core_request_average: 0,
                  cpu_core_usage_average: 0,
                  ram_byte_request_average: 0,
                  ram_byte_usage_average: 0,
                  gpu_request_average: 0,
                  gpu_usage_average: 0,
                  total_efficiency: 0,
                  cpu_usage_percent: 0,
                  memory_usage_percent: 0,
                  memory_gb_used: 0,
                  memory_gb_requested: 0,
                  efficiency_percent: 0,
                  cluster_status: "running",
                  cluster_version: "1.28",
                  node_count: 1,
                  pod_count: 1,
                  efficiency_category: "unknown",
                  is_idle_allocation: false,
                  query_params: {},
                  fetch_timestamp: null,

                  node_data: {
                    data: {
                      sets: [
                        {
                          allocations: {
                            "node-001": {
                              node_name: "node-001",
                              namespace: null,
                              deployment_name: null,
                              total_cost: 0,
                              cpu_cost: 0,
                              ram_cost: 0,
                              gpu_cost: 0,
                              pv_cost: 0,
                              network_cost: 0,
                              cpu_core_request_average: 0,
                              cpu_core_usage_average: 0,
                              ram_byte_request_average: 0,
                              ram_byte_usage_average: 0,
                              gpu_request_average: 0,
                              gpu_usage_average: 0,
                              total_efficiency: 0,
                              cpu_usage_percent: 0,
                              memory_usage_percent: 0,
                              memory_gb_used: 0,
                              memory_gb_requested: 0,
                              efficiency_percent: 0,
                              node_status: "Healthy",
                              node_health_score: 100,
                              is_idle_allocation: false,
                              is_unallocated: false,
                              is_system_allocation: false,
                              is_active: true,

                              pod_data: {
                                data: {
                                  sets: [
                                    {
                                      allocations: {
                                        "pod-001": {
                                          key: "pod-001",
                                          namespace: "default",
                                          name: "sample-pod",
                                          deployment_name: "sample-deployment",
                                          node_name: "node-001",
                                          cpu_core_usage_average: 0,
                                          cpu_core_request_average: 0,
                                          cpu_cost: 0,
                                          cpu_cost_idle: 0,
                                          ram_byte_usage_average: 0,
                                          ram_byte_request_average: 0,
                                          ram_cost: 0,
                                          ram_cost_idle: 0,
                                          ram_usage_gb: 0,
                                          ram_request_gb: 0,
                                          gpu_cost: 0,
                                          gpu_cost_idle: 0,
                                          gpu_request_average: 0,
                                          gpu_usage_average: 0,
                                          pv_cost: 0,
                                          pv_bytes: 0,
                                          external_cost: 0,
                                          load_balancer_cost: 0,
                                          network_cost: 0,
                                          shared_cost: 0,
                                          total_cost: 0,
                                          cpu_efficiency: 0,
                                          ram_efficiency: 0,
                                          total_efficiency: 0,
                                          is_idle: false,
                                          domain: null,
                                        },
                                      },
                                    },
                                  ],
                                },
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          ],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Cluster inserted successfully:", result);
        toast({
          title: "Cluster Added",
          description: "New cluster has been added to monitoring system",
        });
        return result;
      } else {
        const error = await response.json();
        console.error("Error inserting cluster:", error);
        toast({
          title: "Error",
          description: "Failed to add cluster to monitoring system",
          variant: "destructive",
        });
        return null;
      }
    } catch (error) {
      console.error("Error calling insertCluster API:", error);
      toast({
        title: "Error",
        description: "Failed to connect to monitoring system",
        variant: "destructive",
      });
      return null;
    }
  }, []);

  const checkClusterExists = useCallback(async (clusterId) => {
    try {
      const backendApiBaseUrl =
        import.meta.env.VITE_BACKEND_API_BASE_URL ||
        "";
      const response = await fetch(
        `${backendApiBaseUrl}/clusters/${clusterId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("Cluster found:", result);
        return result.data;
      } else {
        console.error("Cluster not found or error:", response.status);
        return null;
      }
    } catch (error) {
      console.error("Error checking cluster existence:", error);
      return null;
    }
  }, []);

  // FIXED: Optimized scroll handler with throttling and proper cleanup
  // useEffect(() => {
  //   let ticking = false;
  //   let lastStickyState = isSticky;

  //   const handleScroll = () => {
  //     if (!ticking) {
  //       requestAnimationFrame(() => {
  //         if (filterBarRef.current && stickyPlaceholderRef.current) {
  //           const rect = stickyPlaceholderRef.current.getBoundingClientRect();
  //           const shouldBeSticky = rect.top <= 0;

  //           // Only update state if it actually changed and avoid rapid state changes
  //           if (shouldBeSticky !== lastStickyState) {
  //             lastStickyState = shouldBeSticky;
  //             setIsSticky(shouldBeSticky);
  //           }
  //         }
  //         ticking = false;
  //       });
  //       ticking = true;
  //     }
  //   };

  //   // Add event listener only once
  //   window.addEventListener('scroll', handleScroll, { passive: true });

  //   // Initial check after a brief delay to ensure DOM is ready
  //   setTimeout(handleScroll, 0);

  //   // Cleanup function
  //   return () => {
  //     window.removeEventListener('scroll', handleScroll);
  //   };
  // }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    console.log("Initial useEffect - loading data on component mount");
    if (!userId) return;

    const rangeFromUrl = searchParams.get("window") || "24h";
    const creationType = searchParams.get("creation_type");
    const clusterIdFromUrl = searchParams.get("cluster_id");

    const effectiveClusterId = clusterIdFromUrl || cluster_id;

    if (rangeFromUrl !== timeRange) {
      setTimeRange(rangeFromUrl);
    }

    if (creationType === "new" && effectiveClusterId) {
      console.log(
        "New cluster creation detected, checking cluster existence..."
      );

      callInsertClusterAPI(effectiveClusterId).then((result) => {
        if (result) {
          console.log("Cluster successfully added to monitoring system");
          fetchAllData(rangeFromUrl, effectiveClusterId);
        }
      });
    } else {

      if (effectiveClusterId) {
        fetchAllData(rangeFromUrl, effectiveClusterId);
      }
    }
  }, [userId, location.pathname]);

  useEffect(() => {
    if (refreshInterval > 0 && !isAutoRefreshPaused) {
      console.log(`Setting up auto-refresh every ${refreshInterval}ms`);

      intervalRef.current = setInterval(() => {
        if (!isAutoRefreshPaused) {
          console.log("Auto-refresh triggered");
          fetchAllData(timeRange, cluster_id, false, false);
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

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (cluster_id) {
      refreshAllData(false);
    }
  }, [cluster_id]);

  const getResourceMetrics = () => {
    if (!cluster) return [];

    const cpuUsage = parseFloat(cluster.cpu.replace("%", "")) || 0;
    const memoryUsage = parseFloat(cluster.memory.replace("%", "")) || 0;

    const efficiency = cluster.efficiency !== "N/A"
      ? parseFloat(cluster.efficiency.replace("%", "")) || 0
      : 0;

    return [
      {
        label: "CPU Utilization",
        value: Math.round(cpuUsage),
        max: 100,
        color: "bg-gradient-to-r from-blue-500 to-blue-600",
        unit: "%",
        tooltip: METRIC_TOOLTIPS.cpuUsage,
      },
      {
        label: "Memory Usage",
        value: Math.round(memoryUsage),
        max: 100,
        color: "bg-gradient-to-r from-emerald-500 to-emerald-600",
        unit: "%",
        tooltip: METRIC_TOOLTIPS.memoryUsage,
      },
      {
        label: "Overall Efficiency",
        value: Math.round(efficiency),
        max: 100,
        color: "bg-gradient-to-r from-green-500 to-green-600",
        unit: "%",
        tooltip: METRIC_TOOLTIPS.overallEfficiency,
      },
    ];
  };

  const getEfficiencyBreakdown = () => {
    if (!cluster || !cluster.rawData) return { cpu: 0, memory: 0, overall: 0 };

    const rawData = cluster.rawData;

    const cpuEfficiency = rawData.cpu_core_request_average > 0
      ? Math.round((rawData.cpu_core_usage_average / rawData.cpu_core_request_average) * 100)
      : 0;

    const memoryEfficiency = rawData.ram_byte_request_average > 0
      ? Math.round((rawData.ram_byte_usage_average / rawData.ram_byte_request_average) * 100)
      : 0;

    const overallEfficiency = rawData.efficiency_percent
      ? Math.round(rawData.efficiency_percent)
      : 0;

    return {
      cpu: cpuEfficiency,
      memory: memoryEfficiency,
      overall: overallEfficiency
    };
  };

  const ProgressBar = ({ label, value, max, color, unit, tooltip }) => (
    <TooltipWrapper tooltip={tooltip} className="group">
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
            →
          </div>
        </div>
      </div>
    </TooltipWrapper>
  );

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
  const efficiencyBreakdown = getEfficiencyBreakdown();

  return (
    <div className="p-4 lg:p-6">

      <div
        ref={stickyPlaceholderRef}
        className={`transition-all duration-300 ${isSticky ? 'h-20' : 'h-0'}`}
      />

      <div
        ref={filterBarRef}
        className={`
      transition-all duration-300 ease-in-out z-50 mb-6
      ${isSticky
            ? `fixed top-0 left-0 right-0 mx-0 px-4 md:px-6 py-4
           bg-white/95 backdrop-blur-md border-b border-gray-200/50
           shadow-lg shadow-black/5`
            : 'relative bg-white rounded-xl shadow-sm'
          }
    `}
      >
        <div className={`
      mx-auto w-full
      ${isSticky ? 'max-w-none' : 'p-4 md:p-6 max-w-full'}
    `}>
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
              className={`flex-1 ${isSticky
                ? '[&>div]:bg-white/90 [&>div]:backdrop-blur-sm [&>div]:border-white/30'
                : ''
                }`}
              type="cluster"
            />
            <div className="ml-4">

            </div>
          </div>
        </div>
      </div>

      {isLoadingData && <LoadingBanner message="Loading cluster data..." />}

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {clusterStats.map((stat, index) => (
            <TooltipWrapper
              key={index}
              tooltip={stat.tooltip}
              className="group relative"
            >
              <MetricCard {...stat} />

              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 hover:opacity-10 transition-opacity duration-500 rounded-lg pointer-events-none"></div>
            </TooltipWrapper>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <div className="lg:col-span-2 space-y-6">

            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-gray-900">
                      {cluster ? cluster.name : "Cluster Details"}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {cluster ? `Status: ${cluster.status}` : "No cluster data available"}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!cluster ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Server className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">
                        No cluster data received from API
                      </p>
                      <p className="text-sm text-gray-400">
                        Please check your cluster configuration and try refreshing
                      </p>
                    </div>
                  ) : (
                    <TooltipWrapper
                      tooltip={METRIC_TOOLTIPS.clusterName}
                      className="group"
                    >
                      <div
                        onClick={() => {
                          setSelectedCluster(cluster.name);
                          setShowClusterModal(true);
                        }}
                        className="p-6 border-2 border-gray-100 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-300 cursor-pointer bg-white hover:bg-blue-50/30"
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
                                  {cluster.nodes} nodes, {cluster.pods} pods
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={cluster.status} />
                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <TooltipWrapper tooltip={METRIC_TOOLTIPS.clusterCost}>
                            <div className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg group-hover:from-blue-50 group-hover:to-blue-100 transition-all duration-300">
                              <div className="text-xl font-bold text-gray-900 mb-1">
                                {cluster.cost}
                              </div>
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Total Cost
                              </div>
                            </div>
                          </TooltipWrapper>
                          <TooltipWrapper tooltip={METRIC_TOOLTIPS.cpuCores}>
                            <div className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg group-hover:from-blue-50 group-hover:to-blue-100 transition-all duration-300">
                              <div className="text-xl font-bold text-gray-900 mb-1">
                                {cluster.cpuCores}
                              </div>
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                CPU Cores
                              </div>
                            </div>
                          </TooltipWrapper>
                          <TooltipWrapper tooltip={METRIC_TOOLTIPS.memoryGB}>
                            <div className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg group-hover:from-blue-50 group-hover:to-blue-100 transition-all duration-300">
                              <div className="text-xl font-bold text-gray-900 mb-1">
                                {cluster.memoryGB} GB
                              </div>
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Memory
                              </div>
                            </div>
                          </TooltipWrapper>
                          <TooltipWrapper tooltip={METRIC_TOOLTIPS.efficiency}>
                            <div className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg group-hover:from-blue-50 group-hover:to-blue-100 transition-all duration-300">
                              <div className="text-xl font-bold text-gray-900 mb-1">
                                {cluster.efficiency}
                              </div>
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Efficiency
                              </div>
                            </div>
                          </TooltipWrapper>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <TooltipWrapper tooltip={METRIC_TOOLTIPS.cpuUsage}>
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
                          </TooltipWrapper>
                          <TooltipWrapper tooltip={METRIC_TOOLTIPS.memoryUsage}>
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
                          </TooltipWrapper>
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
                        </div>
                      </div>
                    </TooltipWrapper>
                  )}
                </div>
              </CardContent>
            </Card>

            {resourceMetrics.length > 0 && (
              <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
                <CardHeader>
                  <TooltipWrapper tooltip="Real-time resource metrics and utilization for this cluster">
                    <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                        <BarChart3 className="w-5 h-5 text-white" />
                      </div>
                      Resource Utilization
                    </CardTitle>
                  </TooltipWrapper>
                  <p className="text-sm text-gray-600">
                    Real-time cluster resource metrics for {cluster?.name}
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

          <div className="space-y-6">

            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
              <CardHeader>
                <TooltipWrapper tooltip="Detailed efficiency breakdown for this cluster showing CPU, memory, and overall resource utilization">
                  <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                      <Gauge className="w-4 h-4 text-white" />
                    </div>
                    Efficiency Breakdown
                  </CardTitle>
                </TooltipWrapper>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <TooltipWrapper tooltip={METRIC_TOOLTIPS.cpuEfficiency}>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Cpu className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">
                          CPU Efficiency
                        </span>
                      </div>
                      <span className="text-lg font-bold text-blue-700">
                        {efficiencyBreakdown.cpu}%
                      </span>
                    </div>
                  </TooltipWrapper>
                  <TooltipWrapper tooltip={METRIC_TOOLTIPS.memoryEfficiency}>
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-gray-700">
                          Memory Efficiency
                        </span>
                      </div>
                      <span className="text-lg font-bold text-emerald-700">
                        {efficiencyBreakdown.memory}%
                      </span>
                    </div>
                  </TooltipWrapper>
                  <TooltipWrapper tooltip={METRIC_TOOLTIPS.overallEfficiency}>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Gauge className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-700">
                          Overall Efficiency
                        </span>
                      </div>
                      <span className="text-lg font-bold text-green-700">
                        {efficiencyBreakdown.overall}%
                      </span>
                    </div>
                  </TooltipWrapper>
                </div>
              </CardContent>
            </Card>

            {chartData.costBreakdown.length > 0 && (
              <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
                <CardHeader>
                  <TooltipWrapper tooltip={METRIC_TOOLTIPS.costBreakdown}>
                    <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                        <Coins className="w-4 h-4 text-white" />
                      </div>
                      Cost Breakdown
                    </CardTitle>
                  </TooltipWrapper>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {chartData.costBreakdown.map((item, index) => (
                      <TooltipWrapper
                        key={`${item.name}-${index}`}
                        tooltip={
                          item.name === "Idle Resources"
                            ? METRIC_TOOLTIPS.idleResourcesCost
                            : METRIC_TOOLTIPS.clusterCost
                        }
                      >
                        <div className="hover:bg-gray-50 p-3 rounded-lg transition-colors">
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
                              className={`h-2 rounded-full transition-all duration-500 ${item.name === "Idle Resources"
                                ? "bg-gray-400"
                                : "bg-gradient-to-r from-blue-500 to-blue-600"
                                }`}
                              style={{ width: `${item.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </TooltipWrapper>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {chartData.costBreakdown.length > 0 && (
              <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
                <CardHeader>
                  <TooltipWrapper tooltip={METRIC_TOOLTIPS.costDistribution}>
                    <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
                        <DollarSign className="w-5 h-5 text-white" />
                      </div>
                      Cost Distribution
                    </CardTitle>
                  </TooltipWrapper>
                  <p className="text-sm text-gray-600">
                    Visual breakdown of cluster costs and idle resources
                  </p>
                </CardHeader>
                <CardContent className="pb-14">
                  <div className="flex justify-center">
                    <DonutChart
                      data={chartData.costBreakdown}
                      title="Cost Breakdown"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {showClusterModal && selectedCluster && (
        <>

          <div
            className="fixed inset-0 z-40 backdrop-blur-sm transition-opacity"
            style={{ pointerEvents: "auto" }}
            onClick={() => {
              setShowClusterModal(false);
              setSelectedCluster(null);
            }}
          />

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
                clusterId={cluster_id}
                userId={userId}
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