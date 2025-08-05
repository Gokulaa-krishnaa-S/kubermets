import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, Activity, RefreshCw, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function PodMetrics() {
  const podStatusData = [
    { name: "Running", value: 342, color: "#10B981" },
    { name: "Pending", value: 12, color: "#F59E0B" },
    { name: "Failed", value: 5, color: "#EF4444" },
  ];

  const namespaceStats = [
    {
      namespace: "kube-system",
      running: 45,
      pending: 0,
      failed: 0,
      status: "healthy" as const,
    },
    {
      namespace: "default",
      running: 123,
      pending: 5,
      failed: 1,
      status: "warning" as const,
    },
    {
      namespace: "monitoring",
      running: 78,
      pending: 2,
      failed: 0,
      status: "healthy" as const,
    },
    {
      namespace: "ingress-nginx",
      running: 12,
      pending: 0,
      failed: 1,
      status: "warning" as const,
    },
  ];

  return (
    <Layout
      title="Pods & Containers"
      subtitle="CPU, memory, restarts, state, and health probe monitoring"
    >
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Running Pods"
            value="342"
            subtitle="Across all namespaces"
            icon={<Layers className="w-4 h-4" />}
            trend={{ value: "+12", direction: "up", label: "new deployments" }}
            status="healthy"
          />
          <MetricCard
            title="Pending Pods"
            value="12"
            subtitle="Waiting for resources"
            icon={<Activity className="w-4 h-4" />}
            trend={{ value: "-3", direction: "down", label: "queue reduced" }}
            status="warning"
          />
          <MetricCard
            title="Failed Pods"
            value="5"
            subtitle="Require attention"
            icon={<AlertTriangle className="w-4 h-4" />}
            trend={{ value: "+2", direction: "up", label: "since yesterday" }}
            status="error"
          />
          <MetricCard
            title="Container Restarts"
            value="23"
            subtitle="Last 24 hours"
            icon={<RefreshCw className="w-4 h-4" />}
            trend={{ value: "-5", direction: "down", label: "improving" }}
            status="info"
          />
        </div>

        {/* Pod Status PieChart and Namespace List */}
        <div className="flex flex-col lg:flex-row gap-6">
          <Card className="w-full lg:w-[30%]">
            <CardHeader>
              <CardTitle>Pod Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={podStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    dataKey="value"
                  >
                    {podStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="w-full lg:w-[70%]">
            <CardHeader>
              <CardTitle>Pod Status by Namespace</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {namespaceStats.map((ns, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Layers className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{ns.namespace}</h4>
                        <p className="text-sm text-muted-foreground">
                          Namespace
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-6 text-center text-sm">
                      <div>
                        <p className="font-medium text-success">{ns.running}</p>
                        <p className="text-muted-foreground">Running</p>
                      </div>
                      <div>
                        <p className="font-medium text-warning">{ns.pending}</p>
                        <p className="text-muted-foreground">Pending</p>
                      </div>
                      <div>
                        <p className="font-medium text-destructive">
                          {ns.failed}
                        </p>
                        <p className="text-muted-foreground">Failed</p>
                      </div>
                    </div>
                    <StatusBadge status={ns.status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
