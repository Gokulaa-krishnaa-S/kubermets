import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Server,
  Box,
  Layers,
  Activity,
  Shield,
  TrendingUp,
  Network,
  HardDrive,
  ArrowRight,
  DollarSign,
  Cpu,
  MemoryStick,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import ClusterService from "@/services/ClusterService";
import { useNavigate } from "react-router-dom";
import { useCluster } from "../../src/components/context/ClusterContext";
import TopBar from "@/components/header/header";
import { ResponsiveLoader } from "@/components/loader/loader";
import { useOutletContext } from "react-router-dom";

// Overview page metric tooltips
const OVERVIEW_METRIC_TOOLTIPS = {
  // Overall metrics
  totalClusterCost:
    "Sum of all cluster costs from API response. Total cost across all clusters for selected time period",
  avgEfficiency:
    "Mean efficiency across all clusters calculated as (Actual resource usage / Requested resources) * 100",
  totalNodes: "Total count of all nodes across clusters",
  healthyNodes: "Count of nodes with healthy status",
  warningNodes: "Count of nodes requiring attention",
  runningPods: "Count of pods in running state",
  totalPods: "Total pod count across all clusters",
  idlePods: "Count of pods with idle status",
  clusterCount: "Number of active clusters being monitored",

  // Cost breakdown
  cpuCost:
    "Calculated as 63% of total cost based on typical Kubernetes resource allocation",
  memoryCost: "Calculated as 33% of total cost for memory resources",
  storageCost: "Calculated as 4% of total cost for persistent storage",

  // Efficiency insights
  overallEfficiency: "Average efficiency across all clusters",
  idleResourcesCost: "Cost of unused/idle resources from API response",
  optimizationPotential:
    "Assessment of potential cost savings: High (< 50%), Medium (50-80%), Low (> 80%)",

  // Cluster details
  clusterName: "Display name and configuration name of the cluster",
  clusterCost:
    "Total cost incurred by this cluster during the selected time period",
  clusterEfficiency:
    "Efficiency percentage for this cluster = efficiency_percent × 100",
  clusterNodes: "Total number of nodes in this specific cluster",
  clusterPods: "Total number of pods running in this specific cluster",
};

// Tooltip Component
const TooltipWrapper = ({ children, tooltip, className = "" }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`relative group inline-block ${className}`}>
      {/* Wrapped content */}
      {children}

      {/* Info icon (only visible on hover of parent) */}
      <div
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Info className="w-4 h-4 text-gray-400 hover:text-blue-600 cursor-help" />
      </div>

      {/* Tooltip */}
      {showTooltip && tooltip && (
        <div className="absolute top-8 right-0 z-50 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg border">
          <div className="relative">
            {tooltip}
            {/* Tooltip arrow */}
            <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function Overview() {
  const [dashboardData, setDashboardData] = useState({
    clusters: [],
    aggregated: {},
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { onDomainSelect }: any = useOutletContext();
  const { instances }: any = useCluster();

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchDashboardSummary();
        console.log(data, "----------------------------");
        setDashboardData(data);
      } catch (error) {
        console.error("Error loading dashboard summary:", error);
      } finally {
        setLoading(false);
      }
    };

    // Initial load
    loadData();

    // Set up interval to fetch data every 30 seconds
    const interval = setInterval(() => {
      loadData();
    }, 10000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardSummary = async () => {
    try {
      const res = await ClusterService.getAllMetrics(); // New API method
      console.log(instances);
      console.log(res, "------------------");
      if (!res?.data?.clusters) return { clusters: [], aggregated: {} };
      const mergedClusters = res?.data?.clusters?.map((cluster) => {
        const match = instances.find((inst) => inst?.id === cluster?.id);

        return {
          ...cluster,
          clusterName: match?.config?.clusterName || cluster.name, // fallback to API name
        };
      });

      return {
        aggregated: res?.data?.aggregated,
        clusters: mergedClusters,
      };
      // return res?.data || { clusters: [], aggregated: {} };
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      return { clusters: [], aggregated: {} };
    }
  };

  const { clusters, aggregated }: any = dashboardData;
  const handleRowClick = (clusterId: string) => {
    console.log("cluster id", clusterId);
    if (!clusterId) return;

    onDomainSelect(clusterId);

    // ✅ Navigate with query param
    navigate({
      pathname: "/metric/cluster",
      search: `?cluster_id=${clusterId}`,
    });
  };

  if (loading) {
    return (
      <Layout title="Overview" subtitle="Loading Kubernetes cost metrics...">
        <ResponsiveLoader
          title="Overview"
          subtitle={`Loading Kubernetes metrics across ${
            aggregated?.clusterCount || 0
          } clusters...`}
        />
      </Layout>
    );
  }

  const metricCategories = [
    {
      title: "Cluster Metrics",
      description: "Overall cluster cost, efficiency, and resource utilization",
      icon: <Server className="w-6 h-6" />,
      path: "/metric/cluster",
      metrics: [
        `${aggregated?.totalCost?.toFixed(2) || "0.00"} Total Cost`,
        `${
          (aggregated?.avgEfficiency * 100)?.toFixed(1) || "0.0"
        }% Avg Efficiency`,
        `${aggregated?.avgCpuUsage?.toFixed(1) || "0.0"}% Avg CPU Utilization`,
      ],
      status: aggregated?.avgEfficiency > 0.5 ? "healthy" : "warning",
    },
    {
      title: "Node Metrics",
      description: "Node costs, efficiency, and resource allocation",
      icon: <Box className="w-6 h-6" />,
      path: "/metric/nodes",
      metrics: [
        `${aggregated?.totalNodes || 0} Total Nodes`,
        `${aggregated?.healthyNodes || 0} Healthy`,
        `${
          (aggregated?.nodeAvgEfficiency * 100)?.toFixed(1) || "0.0"
        }% Avg Efficiency`,
      ],
      status: aggregated?.warningNodes > 0 ? "warning" : "healthy",
    },
    {
      title: "Pod Metrics",
      description: "Pod costs, resource usage, and efficiency tracking",
      icon: <Layers className="w-6 h-6" />,
      path: "/metric/pods",
      metrics: [
        `${aggregated?.totalPods || 0} Total Pods`,
        `${aggregated?.runningPods || 0} Active`,
        `${aggregated?.idlePods || 0} Idle`,
      ],
      status: "healthy",
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "healthy":
        return "text-green-600";
      case "warning":
        return "text-yellow-600";
      case "error":
        return "text-red-600";
      default:
        return "text-blue-600";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Activity className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <TooltipWrapper tooltip={OVERVIEW_METRIC_TOOLTIPS.totalClusterCost}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Cluster Cost
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${aggregated?.totalCost?.toFixed(2) || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">
                Across {aggregated?.clusterCount || 0} clusters
              </p>
            </CardContent>
          </Card>
        </TooltipWrapper>

        <TooltipWrapper tooltip={OVERVIEW_METRIC_TOOLTIPS.avgEfficiency}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Efficiency
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  aggregated?.avgEfficiency > 0.5
                    ? "text-green-600"
                    : "text-yellow-600"
                }`}
              >
                {(aggregated?.avgEfficiency * 100)?.toFixed(1) || "0.0"}%
              </div>
              <p className="text-xs text-muted-foreground">
                Resource utilization
              </p>
            </CardContent>
          </Card>
        </TooltipWrapper>

        <TooltipWrapper tooltip={OVERVIEW_METRIC_TOOLTIPS.totalNodes}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Nodes</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {aggregated?.totalNodes || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {aggregated?.healthyNodes || 0} healthy,{" "}
                {aggregated?.warningNodes || 0} need attention
              </p>
            </CardContent>
          </Card>
        </TooltipWrapper>

        <TooltipWrapper tooltip={OVERVIEW_METRIC_TOOLTIPS.runningPods}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Running Pods
              </CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {aggregated?.runningPods || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {aggregated?.totalPods || 0} total, {aggregated?.idlePods || 0}{" "}
                idle
              </p>
            </CardContent>
          </Card>
        </TooltipWrapper>
      </div>

      {/* Introduction */}
      <Card>
        <CardHeader>
          <CardTitle>
            Multi-Cluster Kubernetes Cost Monitoring Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Monitor cost efficiency and resource utilization across{" "}
            {aggregated?.clusterCount || 0} Kubernetes clusters. Track spending
            patterns, identify optimization opportunities, and ensure optimal
            resource allocation across your infrastructure.
          </p>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">System Status:</span>
              {getStatusIcon(
                aggregated?.avgEfficiency > 0.5 ? "healthy" : "warning"
              )}
              <span
                className={
                  aggregated?.avgEfficiency > 0.5
                    ? "text-green-600"
                    : "text-yellow-600"
                }
              >
                {aggregated?.avgEfficiency > 0.5
                  ? "Optimal"
                  : "Needs Optimization"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Clusters:</span>
              <span className="font-medium">
                {aggregated?.clusterCount || 0} Active
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricCategories.map((category, index) => (
          <Card
            key={index}
            className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] group border-l-4"
            style={{
              borderLeftColor:
                category.status === "healthy"
                  ? "#10b981"
                  : category.status === "warning"
                  ? "#f59e0b"
                  : "#ef4444",
            }}
            onClick={() => navigate(`${category.path}`)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div
                  className={`p-2 rounded-lg ${
                    category.status === "healthy"
                      ? "bg-green-100"
                      : category.status === "warning"
                      ? "bg-yellow-100"
                      : "bg-red-100"
                  }`}
                >
                  <div className={getStatusColor(category.status)}>
                    {category.icon}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
                  {category.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {category.description}
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {category.metrics.map((metric, metricIndex) => (
                  <div
                    key={metricIndex}
                    className="flex items-center gap-2 text-sm"
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        category.status === "healthy"
                          ? "bg-green-500"
                          : category.status === "warning"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                    />
                    <span className="text-muted-foreground">{metric}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cost Breakdown (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <TooltipWrapper
                tooltip={OVERVIEW_METRIC_TOOLTIPS.cpuCost}
                className="w-full"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">CPU Cost</span>
                  </div>
                  <span className="font-medium">
                    $
                    {aggregated?.totalCost
                      ? (aggregated?.totalCost * 0.63).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
              </TooltipWrapper>

              <TooltipWrapper
                tooltip={OVERVIEW_METRIC_TOOLTIPS.memoryCost}
                className="w-full"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Memory Cost</span>
                  </div>
                  <span className="font-medium">
                    $
                    {aggregated?.totalCost
                      ? (aggregated?.totalCost * 0.33).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
              </TooltipWrapper>

              <TooltipWrapper
                tooltip={OVERVIEW_METRIC_TOOLTIPS.storageCost}
                className="w-full"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-purple-500" />
                    <span className="text-sm">Storage Cost</span>
                  </div>
                  <span className="font-medium">
                    $
                    {aggregated?.totalCost
                      ? (aggregated?.totalCost * 0.04).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
              </TooltipWrapper>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Efficiency Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <TooltipWrapper
                tooltip={OVERVIEW_METRIC_TOOLTIPS.overallEfficiency}
                className="w-full"
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm">Overall Efficiency</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(
                      aggregated?.avgEfficiency > 0.5 ? "healthy" : "warning"
                    )}
                    <span
                      className={`font-medium ${
                        aggregated?.avgEfficiency > 0.5
                          ? "text-green-600"
                          : "text-yellow-600"
                      }`}
                    >
                      {(aggregated?.avgEfficiency * 100)?.toFixed(1) || "0.0"}%
                    </span>
                  </div>
                </div>
              </TooltipWrapper>

              <TooltipWrapper
                tooltip={OVERVIEW_METRIC_TOOLTIPS.idleResourcesCost}
                className="w-full"
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm">Idle Resources</span>
                  <span className="font-medium text-red-600">
                    ${aggregated?.idleCost?.toFixed(2) || "0.00"}
                  </span>
                </div>
              </TooltipWrapper>

              <TooltipWrapper
                tooltip={OVERVIEW_METRIC_TOOLTIPS.optimizationPotential}
                className="w-full"
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm">Optimization Potential</span>
                  <span className="font-medium text-green-600">
                    {aggregated?.avgEfficiency < 0.5
                      ? "High"
                      : aggregated?.avgEfficiency < 0.8
                      ? "Medium"
                      : "Low"}
                  </span>
                </div>
              </TooltipWrapper>
            </div>
          </CardContent>
        </Card>
      </div>

      {clusters?.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base sm:text-lg">
                <Server className="w-4 h-4 text-purple-600" />
                Cluster Details
              </div>
              <div className="text-sm text-muted-foreground">
                {clusters.length} clusters total
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            {/* Desktop Table View */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className="border-b"
                    style={{ color: "hsl(var(--primary))" }}
                  >
                    <th className="text-left p-4 font-medium">S.No</th>
                    <th className="text-left p-4 font-medium">
                      <TooltipWrapper
                        tooltip={OVERVIEW_METRIC_TOOLTIPS.clusterName}
                      >
                        <span>Cluster</span>
                      </TooltipWrapper>
                    </th>
                    <th className="text-left p-4 font-medium">
                      <TooltipWrapper
                        tooltip={OVERVIEW_METRIC_TOOLTIPS.clusterCost}
                      >
                        <span>Cost</span>
                      </TooltipWrapper>
                    </th>
                    <th className="text-left p-4 font-medium">
                      <TooltipWrapper
                        tooltip={OVERVIEW_METRIC_TOOLTIPS.clusterEfficiency}
                      >
                        <span>Efficiency</span>
                      </TooltipWrapper>
                    </th>
                    <th className="text-left p-4 font-medium">
                      <TooltipWrapper
                        tooltip={OVERVIEW_METRIC_TOOLTIPS.clusterNodes}
                      >
                        <span>Nodes</span>
                      </TooltipWrapper>
                    </th>
                    <th className="text-left p-4 font-medium">
                      <TooltipWrapper
                        tooltip={OVERVIEW_METRIC_TOOLTIPS.clusterPods}
                      >
                        <span>Pods</span>
                      </TooltipWrapper>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clusters.map((cluster, index) => {
                    if (cluster.error) {
                      return (
                        <tr key={index} className="border-b bg-red-50">
                          <td className="p-4">{index + 1}</td>
                          <td className="p-4 font-semibold text-red-600">
                            {cluster.name}
                          </td>
                          <td colSpan={4} className="p-4 text-red-500">
                            Error: {cluster.error}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={index}
                        className="border-b transition-colors cursor-pointer"
                        style={{ color: "hsl(var(--foreground))" }}
                        onClick={() => handleRowClick(cluster.id)}
                      >
                        <td className="p-4">{index + 1}</td>
                        <td className="p-4 font-medium">
                          {cluster?.name} <b>({cluster?.clusterName})</b>
                        </td>
                        <td className="p-4">
                          ${cluster.cluster?.totalCost?.toFixed(2) || "0.00"}
                        </td>
                        <td
                          className={`p-4 font-medium ${
                            cluster.cluster?.efficiency > 0.5
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }`}
                        >
                          {((cluster.cluster?.efficiency || 0) * 100).toFixed(
                            1
                          )}
                          %
                        </td>
                        <td className="p-4">{cluster.node?.totalNodes || 0}</td>
                        <td className="p-4">{cluster.pod?.totalPods || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {clusters.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Server className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No clusters found</p>
                  <p className="text-sm">
                    Try refreshing or check your connection
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
