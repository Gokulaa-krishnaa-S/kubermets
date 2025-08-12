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
import { Header } from "@/components/layout/Header";
import TopBar from "@/components/header/header";

const fetchDashboardSummary = async () => {
  try {
    const res = await ClusterService.getAllMetrics(); // New API method
    console.log(res, "------------------");
    return res?.data || { clusters: [], aggregated: {} };
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return { clusters: [], aggregated: {} };
  }
};

export default function Overview() {
  const [dashboardData, setDashboardData] = useState({
    clusters: [],
    aggregated: {},
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchDashboardSummary();
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

  const { clusters, aggregated }: any = dashboardData;

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
        `$${aggregated.totalCost?.toFixed(2) || "0.00"} Total Cost`,
        `${(aggregated.avgEfficiency * 100)?.toFixed(1) || "0.0"
        }% Avg Efficiency`,
        `${aggregated.avgCpuUsage?.toFixed(1) || "0.0"}% Avg CPU Utilization`,
      ],
      status: aggregated.avgEfficiency > 0.5 ? "healthy" : "warning",
    },
    {
      title: "Node Metrics",
      description: "Node costs, efficiency, and resource allocation",
      icon: <Box className="w-6 h-6" />,
      path: "/nodes",
      metrics: [
        `${aggregated.totalNodes || 0} Total Nodes`,
        `${aggregated.healthyNodes || 0} Healthy`,
        `${(aggregated.nodeAvgEfficiency * 100)?.toFixed(1) || "0.0"
        }% Avg Efficiency`,
      ],
      status: aggregated.warningNodes > 0 ? "warning" : "healthy",
    },
    {
      title: "Pod Metrics",
      description: "Pod costs, resource usage, and efficiency tracking",
      icon: <Layers className="w-6 h-6" />,
      path: "/pods",
      metrics: [
        `${aggregated.totalPods || 0} Total Pods`,
        `${aggregated.runningPods || 0} Active`,
        `${aggregated.idlePods || 0} Idle`,
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
      subtitle={`Complete Kubernetes metrics visualization across ${aggregated.clusterCount || 0
        } clusters (last 7 days)`}
    >
      
     <TopBar title={"Overview"} subtitle={`Complete Kubernetes metrics visualization across
                  ${aggregated.clusterCount || 0} cluster`} />
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
                ${aggregated.totalCost?.toFixed(2) || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">
                Across {aggregated.clusterCount || 0} clusters
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Efficiency
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${aggregated.avgEfficiency > 0.5
                    ? "text-green-600"
                    : "text-yellow-600"
                  }`}
              >
                {(aggregated.avgEfficiency * 100)?.toFixed(1) || "0.0"}%
              </div>
              <p className="text-xs text-muted-foreground">
                Resource utilization
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Nodes</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {aggregated.totalNodes || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {aggregated.healthyNodes || 0} healthy,{" "}
                {aggregated.warningNodes || 0} need attention
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
                {aggregated.runningPods || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {aggregated.totalPods || 0} total, {aggregated.idlePods || 0}{" "}
                idle
              </p>
            </CardContent>
          </Card>
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
              {aggregated.clusterCount || 0} Kubernetes clusters. Track spending
              patterns, identify optimization opportunities, and ensure optimal
              resource allocation across your infrastructure.
            </p>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">System Status:</span>
                {getStatusIcon(
                  aggregated.avgEfficiency > 0.5 ? "healthy" : "warning"
                )}
                <span
                  className={
                    aggregated.avgEfficiency > 0.5
                      ? "text-green-600"
                      : "text-yellow-600"
                  }
                >
                  {aggregated.avgEfficiency > 0.5
                    ? "Optimal"
                    : "Needs Optimization"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Clusters:</span>
                <span className="font-medium">
                  {aggregated.clusterCount || 0} Active
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
                    className={`p-2 rounded-lg ${category.status === "healthy"
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
                        className={`w-1.5 h-1.5 rounded-full ${category.status === "healthy"
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
                    {aggregated.totalCost
                      ? (aggregated.totalCost * 0.63).toFixed(2)
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
                    {aggregated.totalCost
                      ? (aggregated.totalCost * 0.33).toFixed(2)
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
                    {aggregated.totalCost
                      ? (aggregated.totalCost * 0.04).toFixed(2)
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
                      aggregated.avgEfficiency > 0.5 ? "healthy" : "warning"
                    )}
                    <span
                      className={`font-medium ${aggregated.avgEfficiency > 0.5
                          ? "text-green-600"
                          : "text-yellow-600"
                        }`}
                    >
                      {(aggregated.avgEfficiency * 100)?.toFixed(1) || "0.0"}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Idle Resources</span>
                  <span className="font-medium text-red-600">
                    ${aggregated.idleCost?.toFixed(2) || "0.00"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Optimization Potential</span>
                  <span className="font-medium text-green-600">
                    {aggregated.avgEfficiency < 0.5
                      ? "High"
                      : aggregated.avgEfficiency < 0.8
                        ? "Medium"
                        : "Low"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cluster Details */}
        {clusters.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cluster Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clusters.map((cluster, index) => {
                  if (cluster.error) {
                    return (
                      <div
                        key={index}
                        className="p-4 border border-red-200 rounded-lg bg-red-50"
                      >
                        <h4 className="font-semibold mb-2 text-red-600">
                          {cluster.name}
                        </h4>
                        <p className="text-sm text-red-500">
                          Error: {cluster.error}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div key={index} className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">{cluster.name}</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Cost:</span>
                          <span className="font-medium">
                            ${cluster.cluster?.totalCost?.toFixed(2) || "0.00"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Efficiency:</span>
                          <span
                            className={`font-medium ${cluster.cluster?.efficiency > 0.5
                                ? "text-green-600"
                                : "text-yellow-600"
                              }`}
                          >
                            {((cluster.cluster?.efficiency || 0) * 100).toFixed(
                              1
                            )}
                            %
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Nodes:</span>
                          <span className="font-medium">
                            {cluster.node?.totalNodes || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pods:</span>
                          <span className="font-medium">
                            {cluster.pod?.totalPods || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
