import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { 
  Settings, 
  Database, 
  Server,
  User,
  PlayCircle,
  Pause,
  MoreHorizontal
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedTimeRange, setSelectedTimeRange] = useState("24h");

  const handleCardClick = (metric: string) => {
    // Navigate to specific metric page
    switch (metric) {
      case "blueprints":
        navigate("/deployments");
        break;
      case "agents":
        navigate("/control-plane");
        break;
      case "clusters":
        navigate("/cluster");
        break;
      case "utilization":
        navigate("/resources");
        break;
      default:
        break;
    }
  };

  const handleAddCluster = () => {
    console.log("Add cluster clicked");
  };

  const blueprints = [
    {
      id: 1,
      name: "Predictive Maintenance",
      category: "Manufacturing",
      status: "running" as const,
      performance: "98%",
      icon: <Settings className="w-4 h-4" />,
    },
    {
      id: 2,
      name: "Customer Support AI",
      category: "Service",
      status: "active" as const,
      performance: "95%",
      icon: <User className="w-4 h-4" />,
    },
    {
      id: 3,
      name: "Data Processing Pipeline",
      category: "Analytics",
      status: "running" as const,
      performance: "92%",
      icon: <Database className="w-4 h-4" />,
    },
  ];

  const clusters = [
    {
      name: "Sify CI Production",
      status: "healthy" as const,
      nodes: 12,
      utilization: "78%",
      region: "US-East",
    },
    {
      name: "Dev Environment",
      status: "healthy" as const,
      nodes: 6,
      utilization: "45%",
      region: "US-West",
    },
    {
      name: "Staging Cluster",
      status: "warning" as const,
      nodes: 4,
      utilization: "89%",
      region: "EU-Central",
    },
  ];

  return (
    <Layout
      title="Dashboard"
      subtitle="Sify InfinitAI Platform"
      showAddButton
      addButtonText="Add Cluster"
      onAddClick={handleAddCluster}
    >
      <div className="space-y-6">
        {/* Quick Stats */}
        <QuickStats onCardClick={handleCardClick} />

        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          {["1h", "6h", "24h", "7d", "30d"].map((range) => (
            <Button
              key={range}
              variant={selectedTimeRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTimeRange(range)}
            >
              {range}
            </Button>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Running Blueprints */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg font-semibold">Running Blueprints</CardTitle>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {blueprints.map((blueprint) => (
                  <div
                    key={blueprint.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        {blueprint.icon}
                      </div>
                      <div>
                        <h4 className="font-medium">{blueprint.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {blueprint.category}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium">{blueprint.performance}</p>
                        <p className="text-xs text-muted-foreground">Performance</p>
                      </div>
                      <StatusBadge status={blueprint.status} />
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* K8s Clusters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">K8s Clusters</CardTitle>
              <p className="text-sm text-muted-foreground">
                Multi-cloud infrastructure status
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {clusters.map((cluster, index) => (
                  <div
                    key={index}
                    className="p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate("/cluster")}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{cluster.name}</h4>
                      <StatusBadge status={cluster.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Nodes:</span>
                        <span className="ml-1 font-medium">{cluster.nodes}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Usage:</span>
                        <span className="ml-1 font-medium">{cluster.utilization}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Region: {cluster.region}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Customer Support</span>
                  <Badge variant="outline" className="bg-success/10 text-success">
                    24/7 Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Interactions:</span>
                  <span className="font-medium">1.2k</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Success Rate:</span>
                  <span className="font-medium text-success">98%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resource Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>CPU:</span>
                  <span className="font-medium">68%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Memory:</span>
                  <span className="font-medium">72%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Storage:</span>
                  <span className="font-medium">45%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Overall Status</span>
                  <StatusBadge status="healthy" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Uptime:</span>
                  <span className="font-medium">99.9%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Last Updated:</span>
                  <span className="font-medium">2 min ago</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}