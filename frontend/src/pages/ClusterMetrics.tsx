import { useEffect, useState } from "react";
import ClusterService from "../services/ClusterService";
import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Server, Cpu, HardDrive, Activity, CheckCircle } from "lucide-react";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";

import { Button } from "@/components/ui/button";

export default function ClusterMetrics() {
  const [clusterStats, setClusterStats] = useState<any[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState("24h");


  useEffect(() => {
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

    handleCallClusterData(queryParams);
  }, []);
  const handleCallClusterData = async (queryParams) => {
    ClusterService.getClusterAllocationSummary(queryParams)
      .then((res) => {
        const allocations = res?.data?.sets?.[0]?.allocations || {};

        const nodeSet = new Set<string>();
        const podSet = new Set<string>();

        const clusterList = Object.values(allocations).map((cluster: any) => {
          const [namespace, node, pod] = cluster.name.split("/");

          if (node) nodeSet.add(node);
          if (pod) podSet.add(pod);

          return {
            name: cluster.name,
            cpu: `${(
              (cluster.cpuCoreUsageAverage / cluster.cpuCoreRequestAverage) *
                100 || 0
            ).toFixed(0)}%`,
            memory: `${(
              (cluster.ramByteUsageAverage / cluster.ramByteRequestAverage) *
                100 || 0
            ).toFixed(0)}%`,
            cost: `$${cluster.totalCost.toFixed(2)}`,
            version: "v1.28.2", // fallback
            nodes: 0, // will be set globally
            pods: 0, // will be set globally
            status: cluster.totalEfficiency > 0.5 ? "healthy" : "warning",
          };
        });

        // Global counts
        const totalNodes = nodeSet.size;
        const totalPods = podSet.size;

        // Add total node/pod count to each cluster if desired
        const updatedClusterList = clusterList.map((cluster) => ({
          ...cluster,
          nodes: totalNodes,
          pods: totalPods,
        }));

        // Totals for resource costs
        const totalCpuCost: any = Object.values(allocations).reduce(
          (sum: number, c: any) => sum + c.cpuCost,
          0
        );
        const totalRamCost: any = Object.values(allocations).reduce(
          (sum: number, c: any) => sum + c.ramCost,
          0
        );
        const totalStorage: any = Object.values(allocations).reduce(
          (sum: number, c: any) => sum + c.pvCost,
          0
        );

        setClusters(updatedClusterList);
        setClusterStats([
          {
            title: "Total Clusters",
            value: Object.keys(allocations).length,
            subtitle: "Across all environments",
            icon: <Server className="w-4 h-4" />,
            trend: { value: "", direction: "up", label: "" },
            status: "healthy",
          },
          {
            title: "CPU Cost",
            value: `$${totalCpuCost.toFixed(2)}`,
            subtitle: "This week",
            icon: <Cpu className="w-4 h-4" />,
            trend: { value: "", direction: "up", label: "" },
            status: "info",
          },
          {
            title: "Memory Cost",
            value: `$${totalRamCost.toFixed(2)}`,
            subtitle: "This week",
            icon: <Activity className="w-4 h-4" />,
            trend: { value: "", direction: "up", label: "" },
            status: "healthy",
          },
          {
            title: "Storage Cost",
            value: `$${totalStorage.toFixed(2)}`,
            subtitle: "This week",
            icon: <HardDrive className="w-4 h-4" />,
            trend: { value: "", direction: "up", label: "" },
            status: "info",
          },
        ]);
      })
      .catch(() => console.log("Failed to fetch cluster summary"));
  };
  const clusterHealthData = [
    { name: "Healthy", value: 95, color: "#10B981" },
    { name: "Warning", value: 3, color: "#F59E0B" },
    { name: "Critical", value: 2, color: "#EF4444" },
  ];
  const resourceUsageData = [
    { time: "00:00", cpu: 65, memory: 72, disk: 45 },
    { time: "04:00", cpu: 58, memory: 68, disk: 47 },
    { time: "08:00", cpu: 78, memory: 82, disk: 52 },
    { time: "12:00", cpu: 85, memory: 88, disk: 58 },
    { time: "16:00", cpu: 72, memory: 75, disk: 55 },
    { time: "20:00", cpu: 68, memory: 71, disk: 49 },
  ];
  const handleTimeRangeChange = (range) => {
    try {
      const queryParams = {
        window: range,
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
      setTimeRange(range);
      handleCallClusterData(queryParams);
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <Layout
      title="Cluster Metrics"
      subtitle="Node counts, status, and overall resource utilization"
    >
     

      {/* Time Range Selector */}

        <div className="flex items-center gap-2 mb-5">
          {["1h", "6h", "24h", "7d", "30d"].map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => handleTimeRangeChange(range)}
            >
              {range}
            </Button>
          ))}
        </div>
      <div className="space-y-6">
        {/* Dynamic Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {clusterStats.map((stat, index) => (
            <MetricCard key={index} {...stat} />
          ))}
        </div>
        {/* Dynamic Cluster Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Cluster Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clusters.map((cluster, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Server className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{cluster.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Kubernetes {cluster.version}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-medium">{cluster.nodes}</p>
                      <p className="text-muted-foreground">Nodes</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{cluster.cpu}</p>
                      <p className="text-muted-foreground">CPU</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{cluster.memory}</p>
                      <p className="text-muted-foreground">Memory</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{cluster.pods}</p>
                      <p className="text-muted-foreground">Pods</p>
                    </div>
                  </div>

                  <StatusBadge status={cluster.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cluster Health PieChart */}
          <Card>
            <CardHeader>
              <CardTitle>Cluster Health Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={clusterHealthData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {clusterHealthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Resource Usage LineChart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Resource Usage Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={resourceUsageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="cpu"
                    stroke="#EF4444"
                    strokeWidth={2}
                    name="CPU %"
                  />
                  <Line
                    type="monotone"
                    dataKey="memory"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    name="Memory %"
                  />
                  <Line
                    type="monotone"
                    dataKey="disk"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Disk %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
