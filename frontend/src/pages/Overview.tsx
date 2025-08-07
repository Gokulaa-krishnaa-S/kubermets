import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import ClusterService from "@/services/ClusterService";
import { useNavigate } from "react-router-dom";

const fetchClusterMetrics = async () => {
  const queryParams = {
    window: "7d",
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
  };

  try {
    const res = await ClusterService.getClusterAllocationSummary(queryParams);
    console.log(res, "------------------");
    return res?.data?.data?.sets?.[0]?.allocations || {};
  } catch (error) {
    console.error("Error fetching cluster metrics:", error);
    return {};
  }
};

const fetchNodeMetrics = async () => {
  const queryParams = {
    window: "7d",
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
  };

  try {
    const res = await ClusterService.getClusterAllocationSummary(queryParams);
    return res?.data?.data?.sets?.[0]?.allocations || {};
  } catch (error) {
    console.error("Error fetching node metrics:", error);
    return {};
  }
};

const fetchPodMetrics = async () => {
  const queryParams = {
    window: "7d",
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
    const res = await ClusterService.getClusterAllocationSummary(queryParams);
    return res?.data?.data?.sets?.[0]?.allocations || {};
  } catch (error) {
    console.error("Error fetching pod metrics:", error);
    return {};
  }
};

export default function Overview() {
  const [clusterData, setClusterData] = useState(null);
  const [nodeData, setNodeData] = useState(null);
  const [podData, setPodData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cluster, nodes, pods] = await Promise.all([
          fetchClusterMetrics(),
          fetchNodeMetrics(),
          fetchPodMetrics(),
        ]);
        console.log(cluster);

        setClusterData(cluster);
        setNodeData(nodes);
        setPodData(pods);
      } catch (error) {
        console.error("Error loading metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Helper functions to process the data
  const getClusterStats = () => {
    if (!clusterData) return null;
    console.log(clusterData);
    const cluster: any = Object.values(clusterData)[0];
    return {
      totalCost: cluster.totalCost,
      efficiency: cluster.totalEfficiency,
      cpuUsage:
        (cluster.cpuCoreUsageAverage / cluster.cpuCoreRequestAverage) * 100,
      memoryUsage:
        (cluster.ramByteUsageAverage / cluster.ramByteRequestAverage) * 100,
    };
  };

  const getNodeStats = () => {
    if (!nodeData) return null;

    const allocations = nodeData;
    const nodes: any = Object.entries(allocations).filter(
      ([key]) => !key.startsWith("__")
    );

    const totalNodes = nodes.length;
    const healthyNodes = nodes.filter(
      ([, node]) => node.totalEfficiency > 0.2
    ).length;
    const warningNodes = nodes.filter(
      ([, node]) => node.totalEfficiency > 0 && node.totalEfficiency <= 0.2
    ).length;

    const totalCost = nodes.reduce((sum, [, node]) => sum + node.totalCost, 0);
    const avgEfficiency =
      nodes.reduce((sum, [, node]) => sum + node.totalEfficiency, 0) /
      totalNodes;

    return {
      totalNodes,
      healthyNodes,
      warningNodes,
      totalCost,
      avgEfficiency,
      avgCpuUsage:
        nodes.reduce(
          (sum, [, node]) =>
            sum + (node.cpuCoreUsageAverage / node.cpuCoreRequestAverage) * 100,
          0
        ) / totalNodes,
    };
  };

  const getPodStats = () => {
    if (!podData) return null;

    const allocations = podData;
    const pods: any = Object.entries(allocations).filter(
      ([key]) => !key.startsWith("__")
    );

    const runningPods = pods.filter(([, pod]) => pod.totalCost >= 0).length;
    const idlePods = pods.filter(([, pod]) => pod.totalCost === 0).length;
    const totalPods = pods.length;

    return {
      totalPods,
      runningPods,
      idlePods,
      totalCost: pods.reduce((sum, [, pod]) => sum + pod.totalCost, 0),
    };
  };

  const clusterStats = getClusterStats();
  const nodeStats = getNodeStats();
  const podStats = getPodStats();

  if (loading) {
    return (
      <Layout title="Overview" subtitle="Loading Kubernetes cost metrics...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  const metricCategories = [
    {
      title: "Cluster Metrics",
      description: "Overall cluster cost, efficiency, and resource utilization",
      icon: <Server className="w-6 h-6" />,
      path: "/cluster",
      metrics: [
        `$${clusterStats?.totalCost.toFixed(2)} Total Cost`,
        `${(clusterStats?.efficiency * 100).toFixed(1)}% Efficiency`,
        `${clusterStats?.cpuUsage.toFixed(1)}% CPU Utilization`,
      ],
      status: clusterStats?.efficiency > 0.5 ? "healthy" : "warning",
    },
    {
      title: "Node Metrics",
      description: "Node costs, efficiency, and resource allocation",
      icon: <Box className="w-6 h-6" />,
      path: "/nodes",
      metrics: [
        `${nodeStats?.totalNodes} Total Nodes`,
        `${nodeStats?.healthyNodes} Healthy`,
        `${(nodeStats?.avgEfficiency * 100).toFixed(1)}% Avg Efficiency`,
      ],
      status: nodeStats?.warningNodes > 0 ? "warning" : "healthy",
    },
    {
      title: "Pod Metrics",
      description: "Pod costs, resource usage, and efficiency tracking",
      icon: <Layers className="w-6 h-6" />,
      path: "/pods",
      metrics: [
        `${podStats?.totalPods} Total Pods`,
        `${podStats?.runningPods} Active`,
        `${podStats?.idlePods} Idle`,
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
    <Layout
      title="Overview"
      subtitle="Complete Kubernetes metrics visualization in one unified view (last 7 days)"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Cluster Cost
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${clusterStats?.totalCost.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Cluster Efficiency
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  clusterStats?.efficiency > 0.5
                    ? "text-green-600"
                    : "text-yellow-600"
                }`}
              >
                {(clusterStats?.efficiency * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Resource utilization
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Nodes
              </CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {nodeStats?.totalNodes}
              </div>
              <p className="text-xs text-muted-foreground">
                {nodeStats?.healthyNodes} healthy, {nodeStats?.warningNodes}{" "}
                need attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Running Pods
              </CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {podStats?.runningPods}
              </div>
              <p className="text-xs text-muted-foreground">
                {podStats?.totalPods} total, {podStats?.idlePods} idle
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Introduction */}
        <Card>
          <CardHeader>
            <CardTitle>Kubernetes Cost Monitoring Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Monitor cost efficiency and resource utilization across your
              Kubernetes infrastructure. Track spending patterns, identify
              optimization opportunities, and ensure optimal resource
              allocation.
            </p>
            <div className="flex gap-2 text-sm items-center">
              <span className="text-muted-foreground">System Status:</span>
              {getStatusIcon(
                clusterStats?.efficiency > 0.5 ? "healthy" : "warning"
              )}
              <span
                className={
                  clusterStats?.efficiency > 0.5
                    ? "text-green-600"
                    : "text-yellow-600"
                }
              >
                {clusterStats?.efficiency > 0.5
                  ? "Optimal"
                  : "Needs Optimization"}
              </span>
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
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">CPU Cost</span>
                  </div>
                  <span className="font-medium">
                    $
                    {clusterStats?.totalCost
                      ? (clusterStats.totalCost * 0.63).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Memory Cost</span>
                  </div>
                  <span className="font-medium">
                    $
                    {clusterStats?.totalCost
                      ? (clusterStats.totalCost * 0.33).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-purple-500" />
                    <span className="text-sm">Storage Cost</span>
                  </div>
                  <span className="font-medium">
                    $
                    {clusterStats?.totalCost
                      ? (clusterStats.totalCost * 0.04).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Efficiency Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Overall Efficiency</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(
                      clusterStats?.efficiency > 0.5 ? "healthy" : "warning"
                    )}
                    <span
                      className={`font-medium ${
                        clusterStats?.efficiency > 0.5
                          ? "text-green-600"
                          : "text-yellow-600"
                      }`}
                    >
                      {(clusterStats?.efficiency * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Idle Resources</span>
                  <span className="font-medium text-red-600">
                    $
                    {nodeData
                      ? nodeData?.__idle__.totalCost.toFixed(2)
                      : "0.00"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Optimization Potential</span>
                  <span className="font-medium text-green-600">
                    {clusterStats?.efficiency < 0.5
                      ? "High"
                      : clusterStats?.efficiency < 0.8
                      ? "Medium"
                      : "Low"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
