import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Cpu, Activity, HardDrive, Wifi } from "lucide-react";

export default function NodeMetrics() {
  const nodeStats = [
    {
      title: "Active Nodes",
      value: "22",
      subtitle: "2 nodes under maintenance",
      icon: <Server className="w-4 h-4" />,
      trend: { value: "92%", direction: "neutral" as const, label: "availability" },
      status: "healthy" as const,
    },
    {
      title: "Avg CPU Usage",
      value: "64%",
      subtitle: "Across all nodes",
      icon: <Cpu className="w-4 h-4" />,
      trend: { value: "+3%", direction: "up" as const, label: "from last hour" },
      status: "info" as const,
    },
    {
      title: "Memory Pressure",
      value: "3",
      subtitle: "Nodes experiencing pressure",
      icon: <Activity className="w-4 h-4" />,
      trend: { value: "-1", direction: "down" as const, label: "improved" },
      status: "warning" as const,
    },
    {
      title: "Disk I/O",
      value: "1.2GB/s",
      subtitle: "Total throughput",
      icon: <HardDrive className="w-4 h-4" />,
      trend: { value: "+200MB/s", direction: "up" as const, label: "peak usage" },
      status: "info" as const,
    },
  ];

  const nodes = [
    {
      name: "worker-node-01",
      status: "running" as const,
      cpu: "78%",
      memory: "82%",
      disk: "45%",
      network: "125 MB/s",
      pods: 15,
      uptime: "23d 4h",
    },
    {
      name: "worker-node-02",
      status: "running" as const,
      cpu: "65%",
      memory: "70%",
      disk: "38%",
      network: "98 MB/s",
      pods: 12,
      uptime: "23d 4h",
    },
    {
      name: "worker-node-03",
      status: "warning" as const,
      cpu: "92%",
      memory: "95%",
      disk: "67%",
      network: "87 MB/s",
      pods: 18,
      uptime: "15d 2h",
    },
    {
      name: "worker-node-04",
      status: "pending" as const,
      cpu: "0%",
      memory: "0%",
      disk: "0%",
      network: "0 MB/s",
      pods: 0,
      uptime: "Rebooting",
    },
  ];

  return (
    <Layout
      title="Node Metrics"
      subtitle="CPU, memory, disk, network, and node health monitoring"
    >
      <div className="space-y-6">
        {/* Node Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {nodeStats.map((stat, index) => (
            <MetricCard key={index} {...stat} />
          ))}
        </div>

        {/* Node Details Table */}
        <Card>
          <CardHeader>
            <CardTitle>Node Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nodes.map((node, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="lg:col-span-3 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Server className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{node.name}</h4>
                      <p className="text-xs text-muted-foreground">{node.uptime}</p>
                    </div>
                  </div>
                  
                  <div className="lg:col-span-7 grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-medium">{node.cpu}</p>
                      <p className="text-muted-foreground">CPU</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{node.memory}</p>
                      <p className="text-muted-foreground">Memory</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{node.disk}</p>
                      <p className="text-muted-foreground">Disk</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{node.network}</p>
                      <p className="text-muted-foreground">Network</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{node.pods}</p>
                      <p className="text-muted-foreground">Pods</p>
                    </div>
                  </div>
                  
                  <div className="lg:col-span-2 flex items-center justify-end">
                    <StatusBadge status={node.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}