import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Cpu, HardDrive, Network, Activity } from "lucide-react";

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
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {clusterStats.map((stat, index) => (
            <MetricCard key={index} {...stat} />
          ))}
        </div>

        {/* Cluster Details */}
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
      </div>
    </Layout>
  );
}