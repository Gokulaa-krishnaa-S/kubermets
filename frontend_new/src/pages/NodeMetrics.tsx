import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from 'react-router-dom';
import AdvancedFilter from "@/components/reusable/advancedFilter";
import {
  Server,
  Cpu,
  Activity,
  DollarSign,
  Info,
  TrendingUp,
  Clock,
  Zap,
  AlertCircle,
  WifiOff,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

const NODE_METRIC_TOOLTIPS = {

  activeNodes:
    "Total number of nodes currently counted (including idle nodes) in the cluster",
  totalNodeCost: "Sum of all node costs during the selected time period",
  avgCpuUsage:
    "Average CPU usage across all nodes: (sum of node CPU usage %) ÷ total nodes",
  avgEfficiency:
    "Average efficiency across all nodes: (sum of node efficiency %) ÷ total nodes",

  healthyNodes:
    "Number of nodes in a healthy state (default from node_status unless overridden by CPU/Memory thresholds)",
  warningNodes: "Number of nodes in warning state (CPU > 80% or RAM > 85%)",
  criticalNodes: "Number of nodes in critical state (CPU > 90% or RAM > 95%)",


  ramCost: "Total cost attributed to RAM usage across all nodes",
  storageCost: "Total cost attributed to storage usage across all nodes",
  cpuCost: "Total cost attributed to CPU usage across all nodes",
  pvCost: "Persistent volume cost (if applicable) attributed to nodes",

  nodeCpuUsage:
    "CPU usage percentage per node = (CPU cores used ÷ CPU cores requested) × 100",
  nodeRamUsage:
    "RAM usage percentage per node = (Memory used ÷ Memory requested) × 100 (capped at 100%)",
  nodeEfficiency: "Efficiency percentage per node = efficiency_percent × 100",


  nodeStatus:
    "Current operational state of the node (overridden to Warning or Critical based on utilization thresholds)",
  nodeCpu:
    "Node CPU utilization percentage = (CPU cores used ÷ CPU cores requested) × 100",
  nodeMemory:
    "Node memory utilization percentage = (Memory used ÷ Memory requested) × 100",
  nodeCost: "Total cost incurred by this node during the selected time period",
  nodeEfficiencyUsage:
    "Efficiency usage percentage for this node = efficiency_percent × 100",
  nodeUptime:
    "Time since node became active, calculated from start and end timestamps",
  totalNodes: "Total number of nodes currently active in the cluster",
};


const TooltipWrapper = ({ children, tooltip, className = "" }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`relative group inline-block ${className} `}>

      {children}

      <div
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Info className="w-4 h-4 text-gray-400 hover:text-blue-600 cursor-pointer" />
      </div>


      {showTooltip && tooltip && (
        <div className="absolute top-8 right-0 z-50 w-44 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg border " >
          <div className="relative">
            {tooltip}

            <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
          </div>
        </div>
      )}
    </div>
  );
};


interface SearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchInput: React.FC<SearchProps> = ({
  searchTerm,
  onSearchChange,
  placeholder = "Search nodes...",
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

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import ClusterService from "@/services/ClusterService";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Days, Refresh } from "@/components/reusable/filterbar";
import { toast } from "@/components/ui/use-toast";
import DomainDropdown from "@/components/reusable/domainDropdown";
import { Button } from "@/components/ui/button";

import { NodeMetricsLoader } from "@/components/loader/nodeloader";
import { useCluster } from "../../src/components/context/ClusterContext";
import NodeService from "@/services/NodeService";


import {
  ConnectionStatusBanner,
  NetworkStatusIndicator,
  LoadingBanner,
} from "./ConnectionStatusBanner";

const NodeMetricsDashboard = () => {
  const [nodeData, setNodeData] = useState([]);
  const location = useLocation();
  const [isSticky, setIsSticky] = useState(false);
  const filterBarRef = useRef(null);
  const stickyPlaceholderRef = useRef(null);
  type SummaryStats = {
    totalNodes: number;
    totalCost: number;
    avgCpuUsage: number;
    avgEfficiency: number;
  };

  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalNodes: 0,
    totalCost: 0,
    avgCpuUsage: 0,
    avgEfficiency: 0,
  });

  const { selectedInstance, userId }: any = useCluster();
  console.log(selectedInstance);

  let cluster_id = selectedInstance?.id;
  let user_id = userId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState("24h");
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);


  const [filters, setFilters] = useState({
    pod: [],
    deployment: [],
    namespace: [],
  });


  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();


  const nodeFilterConfig = {
    pod: [
      { value: "nginx-pod-1", label: "nginx-pod-1", count: 15 },
      { value: "redis-pod-2", label: "redis-pod-2", count: 8 },
      { value: "api-pod-3", label: "api-pod-3", count: 22 },
      { value: "database-pod-1", label: "database-pod-1", count: 5 },
      { value: "web-pod-1", label: "web-pod-1", count: 12 },
    ],
    deployment: [
      { value: "nginx-deployment", label: "nginx-deployment", count: 15 },
      { value: "redis-deployment", label: "redis-deployment", count: 8 },
      { value: "api-deployment", label: "api-deployment", count: 22 },
      { value: "database-deployment", label: "database-deployment", count: 5 },
      { value: "web-deployment", label: "web-deployment", count: 12 },
    ],
    namespace: [
      { value: "default", label: "default", count: 45 },
      { value: "kube-system", label: "kube-system", count: 12 },
      { value: "production", label: "production", count: 38 },
      { value: "staging", label: "staging", count: 20 },
      { value: "monitoring", label: "monitoring", count: 8 },
    ],
  };

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    console.log("Node Filters changed:", newFilters);


  };


  const [serverStatus, setServerStatus] = useState<"live" | "down">("live");
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("connected");
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [maxRetries, setMaxRetries] = useState(3);
  const [isAutoRefreshPaused, setIsAutoRefreshPaused] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoadingData, setIsLoadingData] = useState(false);


  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(3);

  const thresholds = {
    cpuCritical: 90,
    cpuWarning: 80,
    ramCritical: 95,
    ramWarning: 85,
    cpuUsageWarning: 70,
    efficiencyWarning: 50,
  };

  const handleCallNodeData = async (params) => {
    try {
      const queryParams = {
        cluster_id: cluster_id,
        user_id: user_id,
        duration: timeRange,
      };

      const response = await NodeService.getNodeAllocationSummary(queryParams);
      return response.data;
    } catch (error) {
      console.error("Failed to fetch cluster summary", error);
      throw error;
    }
  };

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

  const fetchNodeData = useCallback(
    async (queryParams, isRetry = false) => {
      try {
        if (!isRetry) {

          setError(null);
        }

        const response = await handleCallNodeData(queryParams);

        if (!response) {
          throw new Error("Invalid response format");
        }

        console.log(response);
        const allocations = response;
        const totalNodes = response.length;


        let filteredAllocations = response.filter(
          (node) => !node.node_name.startsWith("__")
        );

        if (searchTerm) {
          filteredAllocations = filteredAllocations.filter((node) =>
            node.node_name.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        const activeNodes = filteredAllocations;

        const totalCost = activeNodes.reduce(
          (sum, node) => sum + (node.total_cost || 0),
          0
        );

        const avgCpuUsage =
          activeNodes.reduce(
            (sum, node) => sum + (node.cpu_usage_percent || 0),
            0
          ) / (activeNodes.length || 1);

        const avgMemoryUsage =
          activeNodes.reduce(
            (sum, node) => sum + (node.memory_usage_percent || 0),
            0
          ) / (activeNodes.length || 1);

        const avgEfficiency =
          activeNodes.reduce(
            (sum, node) => sum + (node.efficiency_percent || 0),
            0
          ) / (activeNodes.length || 1);

        setSummaryStats({
          totalNodes,
          totalCost,
          avgCpuUsage: avgCpuUsage * 100,
          avgEfficiency,
        });

        const processedNodes = activeNodes.map((node) => {
          const cpuRequest = node.cpu_core_request_average || 0;
          const cpuUsage = node.cpu_core_usage_average || 0;
          const cpuUtilization =
            cpuRequest > 0 ? (cpuUsage / cpuRequest) * 100 : 0;

          const ramUsageGB = node.memory_gb_used || 0;
          const ramRequestGB = node.memory_gb_requested || 0;
          const ramUtilization =
            ramRequestGB > 0
              ? Math.min((ramUsageGB / ramRequestGB) * 100, 100)
              : 0;

          let status = node.node_status.toLowerCase();
          if (
            cpuUtilization > thresholds.cpuCritical ||
            ramUtilization > thresholds.ramCritical
          ) {
            status = "critical";
          } else if (
            cpuUtilization > thresholds.cpuWarning ||
            ramUtilization > thresholds.ramWarning
          ) {
            status = "warning";
          }

          return {
            name: node.node_name,
            status,
            cpuCores: cpuRequest.toFixed(1),
            cpuUsage: cpuUtilization.toFixed(1),
            ramRequest: ramRequestGB.toFixed(2),
            ramUsage: ramUsageGB.toFixed(2),
            ramUtilization: ramUtilization.toFixed(1),
            totalCost: node.total_cost.toFixed(2),
            cpuCost: node.cpu_cost.toFixed(2),
            ramCost: node.ram_cost.toFixed(2),
            pvCost: node.pv_cost.toFixed(2),
            efficiency: (node.total_efficiency * 100).toFixed(2),
            uptime: calculateUptime(node.first_seen, node.last_seen),

            pods: node.pods || [],
            deployments: node.deployments || [],
            namespaces: node.namespaces || [],
          };
        });

        setNodeData(processedNodes);


        setServerStatus("live");
        setConnectionStatus("connected");
        setRetryAttempts(0);
        setError(null);
        setIsAutoRefreshPaused(false);
      } catch (err) {
        console.error("Failed to fetch node data:", err);

        if (isConnectionError(err)) {
          setConnectionStatus("disconnected");
          setServerStatus("down");

          if (!isRetry && retryAttempts < maxRetries) {
            console.log(
              `Connection failed, retrying... (${retryAttempts + 1
              }/${maxRetries})`
            );
            setRetryAttempts((prev) => prev + 1);

            setTimeout(() => {
              fetchNodeData(queryParams, true);
            }, 2000 * (retryAttempts + 1));

            return;
          }

          setError(
            "Failed to fetch node metrics: Request failed with status code 500"
          );
          handleApiFailure(err, false);
        } else {
          setError(`Failed to fetch node metrics: ${err.message}`);
          handleApiFailure(err, false);
        }

        setNodeData([]);
      } finally {
        setLoading(false);
        setIsLoadingData(false);
        setIsInitialLoading(false);
      }
    },
    [thresholds, retryAttempts, maxRetries, searchTerm, filters]
  );


  const filteredNodeData = useMemo(() => {
    if (!nodeData.length) return [];

    return nodeData.filter((node) => {

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (!node.name.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      if (filters.pod?.length > 0) {
        const nodePods = node.pods || [];
        const hasMatchingPod = nodePods.some((pod) =>
          filters.pod.includes(pod.name || pod)
        );
        if (!hasMatchingPod) return false;
      }


      if (filters.namespace?.length > 0) {
        const nodeNamespaces = node.namespaces || [];
        const hasMatchingNamespace = nodeNamespaces.some((ns) =>
          filters.namespace.includes(ns)
        );
        if (!hasMatchingNamespace) return false;
      }


      if (filters.deployment?.length > 0) {
        const nodeDeployments = node.deployments || [];
        const hasMatchingDeployment = nodeDeployments.some((deployment) =>
          filters.deployment.includes(deployment)
        );
        if (!hasMatchingDeployment) return false;
      }

      return true;
    });
  }, [nodeData, filters, searchTerm]);

  const refreshAllData = async (showToast = true) => {
    setIsRefreshing(true);
    try {
      const queryParams = {};

      await fetchNodeData(queryParams);
      setLastUpdated(new Date());


      if (serverStatus === "live") {
        setIsAutoRefreshPaused(false);
        console.log("Server is back online - resuming auto-refresh");
      }

      if (showToast && serverStatus === "live") {
        toast({
          title: "Data Refreshed",
          description: "Node metrics have been updated successfully.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
      if (showToast) {
        toast({
          title: "Refresh Failed",
          description:
            "Failed to update node metrics. Auto-refresh paused until manual retry.",
          variant: "destructive",
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRetry = () => {
    setRetryAttempts(0);
    setError(null);
    refreshAllData(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      if (filterBarRef.current && stickyPlaceholderRef.current) {
        const rect = stickyPlaceholderRef.current.getBoundingClientRect();
        const shouldBeSticky = rect.top <= 0;
        setIsSticky(shouldBeSticky);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


useEffect(() => {
  if (isSticky && (searchTerm || Object.values(filters).some(f => f.length > 0))) {
    // Scroll to the sticky filter bar instead of the very top
    filterBarRef.current?.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    });
  } else if (!isSticky) {
    // Only scroll to top when not sticky
    window.scrollTo(0, 0);
  }
  
  setCurrentPage(1);
}, [searchTerm, filters, location.pathname, isSticky]);

  useEffect(() => {
    const rangeFromUrl = searchParams.get("window") || "24h";
    setIsInitialLoading(true);
    console.log(cluster_id, "cluster_id in NodeMetrics");
    setTimeRange(rangeFromUrl);
    if (!cluster_id) {
      return;
    }
    const queryParams = {
      accumulate: true,
      aggregate: "node",
      chartType: "costovertime",
      costUnit: "cumulative",
      external: false,
      filter: "",
      idle: true,
      idleByNode: false,
      includeSharedCostBreakdown: true,
      shareCost: 0,
      shareIdle: false,
      shareLabels: "",
      shareNamespaces: "",
      shareSplit: "weighted",
      shareTenancyCosts: true,
      window: rangeFromUrl,
      offset: 0,
      limit: 2000000000000000000005,
      domain: cluster_id,
      force_refesh: false,
    };

    fetchNodeData(queryParams);
    setLastUpdated(new Date());

    if (refreshInterval && refreshInterval > 0 && !isAutoRefreshPaused) {
      const intervalId = setInterval(() => {
        if (!isAutoRefreshPaused) {
          fetchNodeData(queryParams);
          setLastUpdated(new Date());
        }
      }, refreshInterval * 1000);

      return () => clearInterval(intervalId);
    }
  }, [searchParams, refreshInterval, isAutoRefreshPaused]);

  useEffect(() => {
    if (cluster_id) {
      refreshAllData(false);
    }
    else {
      setLoading(false);
      setIsLoadingData(false);
      setIsInitialLoading(false);
    }
  }, [cluster_id]);

  const handleTimeRangeChange = (range) => {
    try {
      setTimeRange(range);
      setSearchParams({ window: range });

      const queryParams = {
        accumulate: true,
        aggregate: "node",
        chartType: "costovertime",
        costUnit: "cumulative",
        external: false,
        filter: "",
        idle: true,
        idleByNode: false,
        includeSharedCostBreakdown: true,
        shareCost: 0,
        shareIdle: false,
        shareLabels: "",
        shareNamespaces: "",
        shareSplit: "weighted",
        shareTenancyCosts: true,
        window: range,
        offset: 0,
        limit: 2000000000000000000005,
        domain: cluster_id,
      };

      fetchNodeData(queryParams);
    } catch (error) {
      console.error("Error updating time range:", error);
    }
  };

  const handleRefreshIntervalChange = (interval) => {
    setRefreshInterval(interval);
  };

  const calculateUptime = (start, end) => {
    if (!start || !end) return "N/A";

    try {
      const startTime: any = new Date(start);
      const endTime: any = new Date(end);
      const diffMs = endTime - startTime;

      if (diffMs < 0) return "N/A";

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      return `${days}d ${hours}h`;
    } catch {
      return "N/A";
    }
  };


  const CustomTooltip = ({ active, payload, label, formatter }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3 backdrop-blur-sm">
          {label ? (
            <p className="font-medium text-foreground mb-2">{label}</p>
          ) : (
            <></>
          )}
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              {entry.color ? (
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: entry.color?.startsWith("hsl")
                      ? entry.color
                      : undefined,
                    background: entry.color?.startsWith("hsl")
                      ? entry.color
                      : undefined,
                  }}
                />
              ) : (
                <></>
              )}
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium text-foreground">
                {formatter ? formatter(entry.value, entry.name) : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const StatusBadge = ({ status }) => {
    const statusConfig = {
      healthy: {
        bg: "bg-[hsl(var(--success)/0.1)]",
        text: "text-[hsl(var(--success))]",
        border: "border-[hsl(var(--success)/0.2)]",
        label: "Healthy",
      },
      warning: {
        bg: "bg-[hsl(var(--warning)/0.1)]",
        text: "text-[hsl(var(--warning))]",
        border: "border-[hsl(var(--warning)/0.2)]",
        label: "Warning",
      },
      critical: {
        bg: "bg-[hsl(var(--destructive)/0.1)]",
        text: "text-[hsl(var(--destructive))]",
        border: "border-[hsl(var(--destructive)/0.2)]",
        label: "Critical",
      },
    };

    const config = statusConfig[status] || statusConfig.healthy;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}
      >
        {config.label}
      </span>
    );
  };

  const MetricCard = ({ title, value, subtitle, icon, status, trend }) => {
    const statusColors = {
      healthy: "border-[hsl(var(--success))] bg-[hsl(var(--success)/0.05)]",
      warning: "border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.05)]",
      critical:
        "border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.05)]",
      info: "border-border bg-card",
    };

    return (
      <Card
        className={`transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${statusColors[status] || statusColors.info
          } ${serverStatus === "down" ? "opacity-75" : ""}`}
      >
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="pb-2 rounded-lg bg-primary/10">{icon}</div>
              <div className="hidden sm:block">
                <span className="text-sm font-medium text-muted-foreground">
                  {title}
                </span>
              </div>
            </div>
            {trend && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="w-3 h-3" />
                <span>{trend}</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="sm:hidden text-xs font-medium text-muted-foreground mb-1">
              {title}
            </div>
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {value}
            </div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const costBreakdownData = filteredNodeData.map((node) => ({
    name: node.name
      .replace("k8gwell", "")
      .replace("worker-node-", "W")
      .replace("master-node-", "M"),
    cpu: parseFloat(node.cpuCost),
    ram: parseFloat(node.ramCost),
    storage: parseFloat(node.pvCost),
    total: parseFloat(node.totalCost),
  }));

  const utilizationData = filteredNodeData.map((node) => ({
    name: node.name
      .replace("k8gwell", "")
      .replace("worker-node-", "W")
      .replace("master-node-", "M"),
    cpuUsage: parseFloat(node.cpuUsage),
    ramUsage: parseFloat(node.ramUtilization),
    efficiency: parseFloat(node.efficiency),
  }));

  const statusDistribution = filteredNodeData.reduce((acc, node) => {
    acc[node.status] = (acc[node.status] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(statusDistribution).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    color:
      status === "healthy"
        ? "hsl(var(--chart-storage))"
        : status === "warning"
          ? "hsl(var(--warning))"
          : "hsl(var(--chart-cpu))",
  }));


  const totalItems = filteredNodeData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentNodes = filteredNodeData.slice(startIndex, endIndex);


  useEffect(() => {
    setCurrentPage(1);
  }, [filteredNodeData]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };


  const Pagination = () => {
    const getPageNumbers = () => {
      const pages = [];
      const maxVisiblePages = 3;

      if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        const start = Math.max(1, currentPage - 2);
        const end = Math.min(totalPages, start + maxVisiblePages - 1);

        if (start > 1) {
          pages.push(1);
          if (start > 2) pages.push("...");
        }

        for (let i = start; i <= end; i++) {
          pages.push(i);
        }

        if (end < totalPages) {
          if (end < totalPages - 1) pages.push("...");
          pages.push(totalPages);
        }
      }

      return pages;
    };

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of{" "}
            {totalItems} entries
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>


          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-sm border border-border rounded bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            {getPageNumbers().map((page, index) => (
              <button
                key={index}
                onClick={() =>
                  typeof page === "number" && handlePageChange(page)
                }
                disabled={page === "..."}
                className={`px-3 py-1 text-sm border rounded transition-colors ${page === currentPage
                  ? "bg-primary text-primary-foreground border-primary"
                  : page === "..."
                    ? "border-transparent cursor-default"
                    : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-sm border border-border rounded bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  };


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
      <NodeMetricsLoader
        title="Node Metrics"
        subtitle="Loading comprehensive monitoring and resource analytics..."
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className=" mx-auto p-4 lg:p-6">

        <div
          ref={stickyPlaceholderRef}
          className={`transition-all duration-300 ${isSticky ? 'h-20' : 'h-0'}`}
        />


        <div
          ref={filterBarRef}
          className={`
          transition-all duration-300 ease-in-out z-50 mb-6
          ${isSticky
              ? `fixed top-0 left-64 right-0 mx-0 px-4 md:px-6 py-4
               bg-white/80 backdrop-blur-lg border-b border-white/20
               shadow-lg shadow-black/5`
              : 'relative bg-white rounded-xl shadow-sm'
            }
        `}
        >
          <div className={`
          mx-auto w-full
          ${isSticky ? 'max-w-none' : 'p-4 md:p-6 max-w-full'}
        `}>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between w-full">

              <div className="flex items-center gap-4">
                <Days
                  selectedTimeRange={timeRange}
                  onTimeRangeChange={handleTimeRangeChange}
                  variant="select"
                  buttonOptions={["1h", "6h", "24h", "7d", "30d"]}
                />
              </div>


              <div className="flex-1 max-w-md">
                <SearchInput
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  placeholder="Search nodes by name"
                />
              </div>


              <div className="flex items-center gap-3">

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      navigate({
                        pathname: "/metric/cluster",
                        search: `?cluster_id=${selectedInstance.id}`,
                      });
                    }}
                    className={`
                    transition-all duration-200
                    ${isSticky
                        ? 'bg-white/90 backdrop-blur-sm hover:bg-white text-blue-600 border border-blue-200 shadow-sm'
                        : ''
                      }
                  `}
                  >
                    Cluster
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      navigate({
                        pathname: "/metric/pods",
                        search: `?cluster_id=${selectedInstance.id}`,
                      });
                    }}
                    className={`
                    transition-all duration-200
                    ${isSticky
                        ? 'bg-white/90 backdrop-blur-sm hover:bg-white text-blue-600 border border-blue-200 shadow-sm'
                        : ''
                      }
                  `}
                  >
                    Pod
                  </Button>
                </div>

                <Refresh
                  onRefresh={refreshAllData}
                  refreshInterval={refreshInterval}
                  onRefreshIntervalChange={handleRefreshIntervalChange}
                  isRefreshing={isRefreshing}
                  lastUpdated={lastUpdated}
                  className={`
                  ${isSticky
                      ? '[&>button]:bg-white/90 [&>button]:backdrop-blur-sm [&>button]:border-white/30'
                      : ''
                    }
                `}
                />
              </div>
            </div>


            {(searchTerm || Object.values(filters).some((f) => f.length > 0)) && (
              <div className={`
              transition-all duration-300
              ${isSticky ? 'mt-4 pt-4 border-t border-white/20' : 'mt-4 pt-4 border-t border-gray-200'}
            `}>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-4">
                    <span>
                      {filteredNodeData.length === 0
                        ? "No nodes found"
                        : filteredNodeData.length === 1
                          ? "1 node found"
                          : `${filteredNodeData.length} nodes found`}
                      {(searchTerm ||
                        Object.values(filters).some((f) => f.length > 0)) &&
                        " with current filters"}
                    </span>


                    {Object.values(filters).some((f) => f.length > 0) && (
                      <div className="flex items-center gap-2">
                        <span>Filters:</span>
                        {Object.entries(filters).map(
                          ([filterType, filterValues]) => {
                            if (!filterValues || filterValues.length === 0)
                              return null;
                            return (
                              <span
                                key={filterType}
                                className={`
                                inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full
                                ${isSticky
                                    ? 'bg-blue-200/50 text-blue-800 backdrop-blur-sm'
                                    : 'bg-blue-100 text-blue-800'
                                  }
                              `}
                              >
                                {filterType}: {filterValues.length}
                              </span>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>

                  {(searchTerm ||
                    Object.values(filters).some((f) => f.length > 0)) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchTerm("");
                          setFilters({ pod: [], deployment: [], namespace: [] });
                        }}
                        className={`
                        transition-all duration-200
                        ${isSticky
                            ? 'text-blue-600 hover:text-blue-700 hover:bg-white/50 backdrop-blur-sm'
                            : 'text-blue-600 hover:text-blue-700'
                          }
                      `}
                      >
                        Clear all
                      </Button>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>


        {isLoadingData && <LoadingBanner message="Loading node data..." />}


        <div className={`${isSticky ? 'mt-4' : ''}`}>

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Node Metrics Dashboard
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Monitor cluster performance and resource utilization
            </p>
          </div>


          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6">
            <TooltipWrapper tooltip={NODE_METRIC_TOOLTIPS.activeNodes}>
              <MetricCard
                title="Active Nodes"
                value={filteredNodeData.length?.toString() || "0"}
                subtitle="Filtered nodes shown"
                icon={<Server className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
                status="info"
                trend={undefined}
              />
            </TooltipWrapper>

            <TooltipWrapper tooltip={NODE_METRIC_TOOLTIPS.totalNodeCost}>
              <MetricCard
                title="Total Cost"
                value={`${filteredNodeData
                  .reduce((sum, node) => sum + parseFloat(node.totalCost), 0)
                  .toFixed(2) || "0.00"
                  }`}
                subtitle={`Last ${timeRange}`}
                icon={
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                }
                status="info"
                trend={undefined}
              />
            </TooltipWrapper>

            <TooltipWrapper tooltip={NODE_METRIC_TOOLTIPS.avgCpuUsage}>
              <MetricCard
                title="Avg CPU Usage"
                value={`${filteredNodeData.length > 0
                  ? (
                    filteredNodeData.reduce(
                      (sum, node) => sum + parseFloat(node.cpuUsage),
                      0
                    ) / filteredNodeData.length
                  ).toFixed(1)
                  : "0.0"
                  }%`}
                subtitle="Across filtered nodes"
                icon={<Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />}
                status={
                  filteredNodeData.length > 0 &&
                    filteredNodeData.reduce(
                      (sum, node) => sum + parseFloat(node.cpuUsage),
                      0
                    ) /
                    filteredNodeData.length >
                    thresholds.cpuUsageWarning
                    ? "warning"
                    : "healthy"
                }
                trend={undefined}
              />
            </TooltipWrapper>

            <TooltipWrapper tooltip={NODE_METRIC_TOOLTIPS.avgEfficiency}>
              <MetricCard
                title="Avg Efficiency"
                value={`${filteredNodeData.length > 0
                  ? (
                    filteredNodeData.reduce(
                      (sum, node) => sum + parseFloat(node.efficiency),
                      0
                    ) / filteredNodeData.length
                  ).toFixed(1)
                  : "0.0"
                  }%`}
                subtitle="Resource utilization"
                icon={<Activity className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
                status={
                  filteredNodeData.length > 0 &&
                    filteredNodeData.reduce(
                      (sum, node) => sum + parseFloat(node.efficiency),
                      0
                    ) /
                    filteredNodeData.length <
                    thresholds.efficiencyWarning
                    ? "warning"
                    : "healthy"
                }
                trend={undefined}
              />
            </TooltipWrapper>
          </div>


          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">

            <Card className="h-fit">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <div className="p-1.5 rounded bg-primary/10">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  Node Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value, percent }) =>
                          `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={
                          <CustomTooltip
                            formatter={(value) => [`${value} nodes`]}
                            active={undefined}
                            payload={undefined}
                            label={undefined}
                          />
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>


            <Card className="h-fit">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <div className="p-1.5 rounded bg-emerald-100 dark:bg-emerald-900/30">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  Cost Breakdown by Node
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={costBreakdownData}
                      margin={{ top: 20, right: 20, bottom: 5, left: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        opacity={0.3}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        content={
                          <CustomTooltip
                            formatter={(value) => [`${value.toFixed(2)}`]}
                            active={undefined}
                            payload={undefined}
                            label={undefined}
                          />
                        }
                      />
                      <Bar
                        dataKey="cpu"
                        stackId="cost"
                        fill="hsl(var(--chart-cpu))"
                        name="CPU"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="ram"
                        stackId="cost"
                        fill="hsl(var(--chart-ram))"
                        name="RAM"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="storage"
                        stackId="cost"
                        fill="hsl(var(--chart-storage))"
                        name="Storage"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>


          <Card className="mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-base sm:text-lg">
                  <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/30">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  Resource Utilization Trends
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[250px] sm:h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={utilizationData}
                    margin={{ top: 20, right: 20, bottom: 5, left: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      opacity={0.3}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          formatter={(value) => [`${value}%`]}
                          active={undefined}
                          payload={undefined}
                          label={undefined}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="cpuUsage"
                      stroke="hsl(var(--chart-cpu-line))"
                      strokeWidth={3}
                      name="CPU Usage"
                      dot={{
                        fill: "hsl(var(--chart-cpu-line))",
                        strokeWidth: 2,
                        r: 4,
                      }}
                      activeDot={{
                        r: 6,
                        stroke: "hsl(var(--chart-cpu-line))",
                        strokeWidth: 2,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ramUsage"
                      stroke="hsl(var(--chart-ram))"
                      strokeWidth={3}
                      name="RAM Usage"
                      dot={{
                        fill: "hsl(var(--chart-ram))",
                        strokeWidth: 2,
                        r: 4,
                      }}
                      activeDot={{
                        r: 6,
                        stroke: "hsl(var(--chart-ram))",
                        strokeWidth: 2,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="efficiency"
                      stroke="hsl(var(--chart-storage))"
                      strokeWidth={3}
                      name="Efficiency"
                      dot={{
                        fill: "hsl(var(--chart-storage))",
                        strokeWidth: 2,
                        r: 4,
                      }}
                      activeDot={{
                        r: 6,
                        stroke: "hsl(var(--chart-storage))",
                        strokeWidth: 2,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>


          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-base sm:text-lg">
                  <div className="p-1.5 rounded bg-purple-100 dark:bg-purple-900/30">
                    <Server className="w-4 h-4 text-purple-600" />
                  </div>
                  Node Details
                </div>
                <div className="text-sm text-muted-foreground">
                  {totalItems} nodes total
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="hidden lg:block overflow-x-auto">
                <table
                  className={`w-full ${serverStatus === "down" ? "opacity-75" : ""
                    }`}
                >
                  <thead>
                    <tr
                      className="border-b"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      <th className="text-left p-4 font-medium">Node</th>
                      <th className="text-left p-4 font-medium">
                        <TooltipWrapper tooltip={NODE_METRIC_TOOLTIPS.nodeStatus}>
                          Status
                        </TooltipWrapper>
                      </th>
                      <th className="text-left p-4 font-medium">
                        <TooltipWrapper tooltip={NODE_METRIC_TOOLTIPS.nodeCpu}>
                          CPU
                        </TooltipWrapper>
                      </th>
                      <th className="text-left p-4 font-medium">
                        <TooltipWrapper tooltip={NODE_METRIC_TOOLTIPS.nodeMemory}>
                          Memory
                        </TooltipWrapper>
                      </th>
                      <th className="text-left p-4 font-medium">
                        <TooltipWrapper tooltip={NODE_METRIC_TOOLTIPS.nodeCost}>
                          Cost
                        </TooltipWrapper>
                      </th>
                      <th className="text-left p-4 font-medium">
                        <TooltipWrapper
                          tooltip={NODE_METRIC_TOOLTIPS.nodeEfficiencyUsage}
                        >
                          Efficiency
                        </TooltipWrapper>
                      </th>
                      <th className="text-left p-4 font-medium">
                        <TooltipWrapper tooltip={NODE_METRIC_TOOLTIPS.nodeUptime}>
                          Uptime
                        </TooltipWrapper>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentNodes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-16 text-center">
                          <div className="flex flex-col items-center gap-3 text-gray-500">
                            <Server className="w-12 h-12 text-gray-300" />
                            <div>
                              <h3 className="font-medium text-gray-900 mb-1">No node details found</h3>
                              <p className="text-sm text-gray-500">No data available</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentNodes.map((node, index) => (
                        <tr
                          key={startIndex + index}
                          className="border-b transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="p-2 rounded-lg"
                                style={{ background: "hsl(var(--primary) / 0.1)" }}
                              >
                                <Server
                                  className="w-4 h-4"
                                  style={{ color: "hsl(var(--primary))" }}
                                />
                              </div>
                              <span className="font-medium">{node.name}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <StatusBadge status={node.status} />
                          </td>
                          <td className="p-4">{node.cpuUsage}%</td>
                          <td className="p-4">{node.ramUtilization}%</td>
                          <td className="p-4">${node.totalCost}</td>
                          <td className="p-4">{node.efficiency}%</td>
                          <td className="p-4">{node.uptime}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>


              <Pagination />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NodeMetricsDashboard;
