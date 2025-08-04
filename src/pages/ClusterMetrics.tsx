import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  CheckCircle,
} from "lucide-react";

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

export default function ClusterMetrics() {
  const clusterStats = [
    {
      title: "Total Nodes",
      value: "24",
      subtitle: "Across all clusters",
      icon: <Server className="w-4 h-4" />,
      trend: { value: "+2", direction: "up" as const, label: "this week" },
      status: "healthy" as const,
    },
    {
      title: "CPU Utilization",
      value: "68%",
      subtitle: "Average across nodes",
      icon: <Cpu className="w-4 h-4" />,
      trend: { value: "+5%", direction: "up" as const, label: "from yesterday" },
      status: "info" as const,
    },
    {
      title: "Memory Usage",
      value: "72%",
      subtitle: "Total allocated",
      icon: <Activity className="w-4 h-4" />,
      trend: { value: "-2%", direction: "down" as const, label: "optimized" },
      status: "healthy" as const,
    },
    {
      title: "Storage Used",
      value: "2.4TB",
      subtitle: "Of 5TB capacity",
      icon: <HardDrive className="w-4 h-4" />,
      trend: { value: "+100GB", direction: "up" as const, label: "this week" },
      status: "info" as const,
    },
  ];

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

  const nodeStatusData = [
    { name: "Healthy", count: 12, color: "#10B981" },
    { name: "Unhealthy", count: 2, color: "#EF4444" },
    { name: "Unschedulable", count: 1, color: "#6B7280" },
  ];

  const clusters = [
    {
      name: "Production-US-East",
      status: "healthy" as const,
      nodes: 12,
      cpu: "68%",
      memory: "72%",
      pods: 156,
      version: "v1.28.2",
    },
    {
      name: "Staging-US-West",
      status: "healthy" as const,
      nodes: 6,
      cpu: "45%",
      memory: "52%",
      pods: 78,
      version: "v1.28.2",
    },
    {
      name: "Dev-EU-Central",
      status: "warning" as const,
      nodes: 4,
      cpu: "89%",
      memory: "91%",
      pods: 92,
      version: "v1.27.8",
    },
  ];

  return (
    <Layout
      title="Cluster Metrics"
      subtitle="Node counts, status, and overall resource utilization"
    >
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {clusterStats.map((stat, index) => (
            <MetricCard key={index} {...stat} />
          ))}
        </div>

        {/* Cluster Overview List */}
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

        {/* Node Status BarChart */}
        <Card>
          <CardHeader>
            <CardTitle>Node Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={nodeStatusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count">
                  {nodeStatusData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
