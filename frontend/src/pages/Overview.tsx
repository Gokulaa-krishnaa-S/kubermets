import { Layout } from "@/components/layout/Layout";
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
  ArrowRight 
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Overview() {
  const navigate = useNavigate();

  const metricCategories = [
    {
      title: "Cluster Metrics",
      description: "Node counts, status, and overall resource utilization",
      icon: <Server className="w-6 h-6" />,
      path: "/cluster",
      metrics: ["24 Total Nodes", "5 Active Clusters", "92% Availability"],
      status: "healthy"
    },
    {
      title: "Node Metrics", 
      description: "CPU, memory, disk, network, and node health",
      icon: <Box className="w-6 h-6" />,
      path: "/nodes",
      metrics: ["68% Avg CPU", "72% Memory", "3 Under Pressure"],
      status: "warning"
    },
    {
      title: "Pods & Containers",
      description: "CPU, memory, restarts, state, and health probes",
      icon: <Layers className="w-6 h-6" />,
      path: "/pods", 
      metrics: ["342 Running Pods", "12 Pending", "5 Failed"],
      status: "healthy"
    },
    {
      title: "Deployment Metrics",
      description: "Replica counts, status, and rollout monitoring",
      icon: <Activity className="w-6 h-6" />,
      path: "/deployments",
      metrics: ["28 Deployments", "3 Rolling Updates", "1 Failed"],
      status: "warning"
    },
    {
      title: "Control Plane",
      description: "API server, controller, scheduler, and kubelet health",
      icon: <Shield className="w-6 h-6" />,
      path: "/control-plane",
      metrics: ["API Server: Healthy", "Scheduler: Active", "Controller: Running"],
      status: "healthy"
    },
    {
      title: "Resource Usage",
      description: "Aggregate CPU/memory and custom metrics",
      icon: <TrendingUp className="w-6 h-6" />,
      path: "/resources",
      metrics: ["CPU: 68%", "Memory: 72%", "GPU: 78%"],
      status: "info"
    },
    {
      title: "Networking",
      description: "Bandwidth, error rates, and ingress statistics",
      icon: <Network className="w-6 h-6" />,
      path: "/networking",
      metrics: ["1.2GB/s Throughput", "0.1% Error Rate", "45 Services"],
      status: "healthy"
    },
    {
      title: "Storage",
      description: "Capacity, I/O performance, and volume health",
      icon: <HardDrive className="w-6 h-6" />,
      path: "/storage",
      metrics: ["2.4TB Used", "85% I/O Efficiency", "12 Volumes"],
      status: "info"
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy": return "text-success";
      case "warning": return "text-warning"; 
      case "error": return "text-destructive";
      default: return "text-primary";
    }
  };

  return (
    <Layout
      title="Overview"
      subtitle="Complete Kubernetes metrics visualization in one unified view"
    >
      <div className="space-y-6">
        {/* Introduction */}
        <Card>
          <CardHeader>
            <CardTitle>Kubernetes Monitoring Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Monitor the full spectrum of Kubernetes metrics across eight key categories. 
              Each section provides detailed insights into your cluster's health, performance, and resource utilization.
            </p>
            <div className="flex gap-2 text-sm">
              <span className="text-muted-foreground">Quick Actions:</span>
              <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => navigate("/cluster")}>
                View Cluster Health
              </Button>
              <span className="text-muted-foreground">•</span>
              <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => navigate("/resources")}>
                Check Resource Usage
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Metric Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {metricCategories.map((category, index) => (
            <Card 
              key={index}
              className="cursor-pointer transition-all duration-200 hover:shadow-hover hover:scale-[1.02] group"
              onClick={() => navigate(category.path)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg bg-primary/10 ${getStatusColor(category.status)}`}>
                    {category.icon}
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
                    <div key={metricIndex} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      <span className="text-muted-foreground">{metric}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* System Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-success">Healthy Components</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success mb-2">18</div>
              <p className="text-sm text-muted-foreground">
                Most systems operating normally
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-warning">Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning mb-2">3</div>
              <p className="text-sm text-muted-foreground">
                Components requiring attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-destructive">Critical Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive mb-2">0</div>
              <p className="text-sm text-muted-foreground">
                No critical issues detected
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}