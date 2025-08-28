import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
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
import { useSearchParams } from "react-router-dom";
import { FilterBar } from "@/components/reusable/filterbar";
import { toast } from "@/components/ui/use-toast";
import DomainDropdown from "@/components/reusable/domainDropdown";
import { Button } from "@/components/ui/button";

import { NodeMetricsLoader } from "@/components/loader/nodeloader";
import { useCluster } from "../../src/components/context/ClusterContext";
import NodeService from "@/services/NodeService";

// Import the standardized connection status components
import {
  ConnectionStatusBanner,
  NetworkStatusIndicator,
  LoadingBanner,
} from "./ConnectionStatusBanner";

const NodeMetricsDashboard = () => {
  const [nodeData, setNodeData] = useState([]);
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

  const { selectedInstance }: any = useCluster();
  console.log(selectedInstance);

  let cluster_id = selectedInstance?.id;
  let user_id = selectedInstance?.user_id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState("24h");
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Standardized connection status tracking
  const [serverStatus, setServerStatus] = useState<"live" | "down">("live");
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("connected");
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [maxRetries, setMaxRetries] = useState(3);
  const [isAutoRefreshPaused, setIsAutoRefreshPaused] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Pagination states
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

    // Check for common connection error patterns
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
          // setIsLoadingData(true);
          setError(null);
        }

        const response = await handleCallNodeData(queryParams);

        if (!response) {
          throw new Error("Invalid response format");
        }

        //
        console.log(response);
        const allocations = response;

        const totalNodes = response.length;

        //
        const activeNodes = response.filter(
          (node) => !node.node_name.startsWith("__")
        );

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

        //

        // const allocations = response;
        // const activeNodes = allocations.filter(
        //   (node) =>
        //     !node.node_name.startsWith("__") &&
        //     node.cpu_core_request_average !== undefined
        // );

        // const totalNodes = activeNodes.length;
        // const totalCost = activeNodes.reduce(
        //   (sum, node) => sum + (node.total_cost || 0),
        //   0
        // );

        // const avgCpuUsage =
        //   activeNodes.reduce((sum, node) => {
        //     const usage =
        //       (node.cpu_core_usage_average || 0) /
        //       (node.cpu_core_request_average || 1);
        //     return sum + (isNaN(usage) ? 0 : usage);
        //   }, 0) / totalNodes;

        // const avgEfficiency =
        //   activeNodes.reduce(
        //     (sum, node) => sum + (node.total_efficiency * 100 || 0),
        //     0
        //   ) / totalNodes;

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
            efficiency: node.total_efficiency.toFixed(2),
            uptime: calculateUptime(node.first_seen, node.last_seen),
          };
        });

        setNodeData(processedNodes);

        // Reset connection status and retry attempts on success
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
              `Connection failed, retrying... (${
                retryAttempts + 1
              }/${maxRetries})`
            );
            setRetryAttempts((prev) => prev + 1);

            // Retry after a delay
            setTimeout(() => {
              fetchNodeData(queryParams, true);
            }, 2000 * (retryAttempts + 1)); // Exponential backoff

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
    [thresholds, retryAttempts, maxRetries]
  );

  const refreshAllData = async (showToast = true) => {
    setIsRefreshing(true);
    try {
      const queryParams = {};

      await fetchNodeData(queryParams);
      setLastUpdated(new Date());

      // If this was a manual refresh and server is back online, resume auto-refresh
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
    const rangeFromUrl = searchParams.get("window") || "24h";
    setIsInitialLoading(true);

    console.log(cluster_id, "cluster_id in NodeMetrics");
    setTimeRange(rangeFromUrl);

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

  const handleFilterClick = () => {
    console.log("Filter button clicked");
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

  // Custom Tooltip Component
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
        className={`transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${
          statusColors[status] || statusColors.info
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
            <p className="text-xs text-muted-foreground">
              {subtitle}
              {serverStatus === "down" && (
                <span className="text-red-600 ml-1">(Offline)</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const costBreakdownData = nodeData.map((node) => ({
    name: node.name
      .replace("k8gwell", "")
      .replace("worker-node-", "W")
      .replace("master-node-", "M"),
    cpu: parseFloat(node.cpuCost),
    ram: parseFloat(node.ramCost),
    storage: parseFloat(node.pvCost),
    total: parseFloat(node.totalCost),
  }));

  const utilizationData = nodeData.map((node) => ({
    name: node.name
      .replace("k8gwell", "")
      .replace("worker-node-", "W")
      .replace("master-node-", "M"),
    cpuUsage: parseFloat(node.cpuUsage),
    ramUsage: parseFloat(node.ramUtilization),
    efficiency: parseFloat(node.efficiency),
  }));

  const statusDistribution = nodeData.reduce((acc, node) => {
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

  // Pagination logic
  const totalItems = nodeData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentNodes = nodeData.slice(startIndex, endIndex);

  // Reset to first page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [nodeData]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Pagination component
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
          {/* Page Size Selector */}
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

          {/* Page Navigation */}
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
                className={`px-3 py-1 text-sm border rounded transition-colors ${
                  page === currentPage
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

  // Error Display Component
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

        {/* Filter Bar with Network Status Indicator */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
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
              showRefresh={true}
              className="flex-1"
            />
            <div className="ml-4">
              <NetworkStatusIndicator serverStatus={serverStatus} />
            </div>
          </div>
        </div>

        {/* Loading Banner */}
        {isLoadingData && <LoadingBanner message="Loading node data..." />}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Node Metrics Dashboard
            {serverStatus === "down" && (
              <span className="ml-2 text-sm text-red-600 font-normal">
                (Offline Mode)
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Monitor cluster performance and resource utilization
            {serverStatus === "down" && (
              <span className="text-red-600 ml-2">- Showing cached data</span>
            )}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6">
          <MetricCard
            title="Active Nodes"
            value={summaryStats.totalNodes?.toString() || "0"}
            subtitle="All nodes operational"
            icon={<Server className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
            status="info"
            trend={undefined}
          />

          <MetricCard
            title="Total Cost"
            value={`${summaryStats.totalCost?.toFixed(2) || "0.00"}`}
            subtitle={`Last ${timeRange}`}
            icon={
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            }
            status="info"
            trend={undefined}
          />

          <MetricCard
            title="Avg CPU Usage"
            value={`${summaryStats.avgCpuUsage?.toFixed(1) || "0.0"}%`}
            subtitle="Across all nodes"
            icon={<Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />}
            status={
              summaryStats.avgCpuUsage > thresholds.cpuUsageWarning
                ? "warning"
                : "healthy"
            }
            trend={undefined}
          />

          <MetricCard
            title="Avg Efficiency"
            value={`${summaryStats.avgEfficiency?.toFixed(1) || "0.0"}%`}
            subtitle="Resource utilization"
            icon={<Activity className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
            status={
              summaryStats.avgEfficiency < thresholds.efficiencyWarning
                ? "warning"
                : "healthy"
            }
            trend={undefined}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Status Distribution */}
          <Card className="h-fit">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <div className="p-1.5 rounded bg-primary/10">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                Node Status Distribution
                {serverStatus === "down" && (
                  <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                    Offline Data
                  </span>
                )}
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

          {/* Cost Breakdown */}
          <Card className="h-fit">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <div className="p-1.5 rounded bg-emerald-100 dark:bg-emerald-900/30">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                Cost Breakdown by Node
                {serverStatus === "down" && (
                  <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                    Offline Data
                  </span>
                )}
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

        {/* Resource Utilization Chart */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base sm:text-lg">
                <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/30">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                Resource Utilization Trends
              </div>
              {serverStatus === "down" && (
                <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                  Offline Data
                </span>
              )}
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

        {/* Node Details Table */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base sm:text-lg">
                <div className="p-1.5 rounded bg-purple-100 dark:bg-purple-900/30">
                  <Server className="w-4 h-4 text-purple-600" />
                </div>
                Node Details
                {serverStatus === "down" && (
                  <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded ml-2">
                    Offline Data
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {totalItems} nodes total
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Mobile View */}
            <div className="block lg:hidden space-y-4">
              {currentNodes.map((node, index) => (
                <Card
                  key={startIndex + index}
                  className={`p-4 bg-muted/30 ${
                    serverStatus === "down" ? "opacity-75" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{node.name}</span>
                    </div>
                    <StatusBadge status={node.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Cpu className="w-3 h-3" />
                        <span>CPU</span>
                      </div>
                      <div className="font-medium">{node.cpuUsage}%</div>
                      <div className="text-muted-foreground">
                        {node.cpuCores} cores
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Activity className="w-3 h-3" />
                        <span>Memory</span>
                      </div>
                      <div className="font-medium">{node.ramUtilization}%</div>
                      <div className="text-muted-foreground">
                        {node.ramUsage}GB used
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <DollarSign className="w-3 h-3" />
                        <span>Cost</span>
                      </div>
                      <div className="font-medium">${node.totalCost}</div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Zap className="w-3 h-3" />
                        <span>Efficiency</span>
                      </div>
                      <div
                        className={`font-medium ${
                          parseFloat(node.efficiency) > 50
                            ? "text-emerald-600"
                            : parseFloat(node.efficiency) > 30
                            ? "text-amber-600"
                            : "text-red-600"
                        }`}
                      >
                        {node.efficiency}%
                      </div>
                    </div>
                  </div>

                  {/* <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
                    <Clock className="w-3 h-3" />
                    <span>Uptime: {node.uptime}</span>
                  </div> */}
                </Card>
              ))}

              {currentNodes.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No nodes found</p>
                  {serverStatus === "down" && (
                    <p className="text-sm text-red-600 mt-2">
                      Connection lost - showing cached data
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table
                className={`w-full ${
                  serverStatus === "down" ? "opacity-75" : ""
                }`}
              >
                <thead>
                  <tr
                    className="border-b"
                    style={{ color: "hsl(var(--primary))" }}
                  >
                    <th className="text-left p-4 font-medium">Node</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">CPU</th>
                    <th className="text-left p-4 font-medium">Memory</th>
                    <th className="text-left p-4 font-medium">Cost</th>
                    <th className="text-left p-4 font-medium">Efficiency</th>
                    {/* <th className="text-left p-4 font-medium">Uptime</th> */}
                  </tr>
                </thead>
                <tbody>
                  {currentNodes.map((node, index) => (
                    <tr
                      key={startIndex + index}
                      className="border-b transition-colors"
                      style={{
                        color: "hsl(var(--foreground))",
                        backgroundColor: undefined,
                      }}
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
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="font-medium">{node.cpuUsage}%</div>
                          <div className="text-muted-foreground text-sm">
                            {node.cpuCores} cores
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="font-medium">
                            {node.ramUtilization}%
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {node.ramUsage}GB used
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="font-medium">${node.totalCost}</div>
                          <div className="text-muted-foreground text-sm">
                            CPU: ${node.cpuCost} | RAM: ${node.ramCost}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`font-medium ${
                            parseFloat(node.efficiency) > 50
                              ? "text-emerald-600"
                              : parseFloat(node.efficiency) > 30
                              ? "text-amber-600"
                              : "text-red-600"
                          }`}
                        >
                          {node.efficiency}%
                        </span>
                      </td>
                      {/* <td className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {node.uptime}
                        </div>
                      </td> */}
                    </tr>
                  ))}
                </tbody>
              </table>

              {currentNodes.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Server className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No nodes found</p>
                  <p className="text-sm">
                    {serverStatus === "down"
                      ? "Connection lost - unable to load node data"
                      : "Try adjusting your filters or refresh the data"}
                  </p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalItems > 0 && <Pagination />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NodeMetricsDashboard;
