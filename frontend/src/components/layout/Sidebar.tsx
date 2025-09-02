import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, Server, Box, Layers } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const mainItems = [
  // { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Overview", url: "/overview", icon: BarChart3 },
];

const metricItems = [
  { title: "Cluster Metrics", url: "/metric/cluster", icon: Server },
  { title: "Node Metrics", url: "/metric/nodes", icon: Box },
  { title: "Pods & Containers", url: "/metric/pods", icon: Layers },
  // { title: "Instances", url: "/instance", icon: Layers },

  // { title: "Deployments", url: "/deployments", icon: Activity },
  // { title: "Control Plane", url: "/control-plane", icon: Shield },
  // { title: "Resource Usage", url: "/resources", icon: TrendingUp },
  // { title: "Networking", url: "/networking", icon: Network },
  // { title: "Storage", url: "/storage", icon: HardDrive },
  // { title: "Alerts & Events", url: "/alerts-events", icon: BarChart3 },
];

const clusterCreationItems = [
  {
    title: "GCP GKE",
    url: "/cluster-creation/gcp",
    icon: "/gcp.jpg",
    description: "Google Kubernetes Engine",
  },
  {
    title: "AWS EKS",
    url: "/cluster-creation/aws",
    icon: "/aws.jpg",
    description: "Amazon Elastic Kubernetes Service",
  },
  {
    title: "Azure AKS",
    url: "/cluster-creation/azure",
    icon: "/azure.jpg",
    description: "Azure Kubernetes Service",
  },
  {
    title: "Sify",
    url: "/cluster-creation/sify",
    icon: "/sify.jpg",
    description: "Sify Cloud Platform",
  },
];

const platformItems = [
  // { title: "Billing & Cost", url: "/billing-cost", icon: DollarSign },
  // { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  const getNavClassName = (active: boolean) =>
    cn(
      "w-full justify-start transition-all duration-200",
      active
        ? "bg-primary text-primary-foreground shadow-card"
        : "hover:bg-accent hover:text-accent-foreground"
    );

  return (
    <Sidebar
      className={cn(
        "border-r border-border transition-all duration-300",
        collapsed ? "w-14" : "w-64"
      )}
      collapsible="icon"
    >
      <SidebarContent className="bg-background">
        {/* Logo and Title */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Server className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-bold text-lg">K8s Monitor</h2>
                <p className="text-xs text-muted-foreground">
                  Kubernetes Platform
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={({ isActive }) => getNavClassName(isActive)}
                    >
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Metrics Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Metrics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {metricItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) => getNavClassName(isActive)}
                    >
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Cluster Creation Navigation */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Cluster Creation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {clusterCreationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) => getNavClassName(isActive)}
                    >
                      <div className="w-4 h-4 rounded-sm bg-gray-100 overflow-hidden flex items-center justify-center">
                        <img
                          src={item.icon}
                          alt={`${item.title} icon`}
                          className="w-3 h-3 object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                      </div>
                      {!collapsed && (
                        <div className="flex-1">
                          <span className="text-sm">{item.title}</span>
                          {/* <div className="text-xs text-muted-foreground">{item.description}</div> */}
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Platform Navigation */}
        {platformItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Platform
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {platformItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) => getNavClassName(isActive)}
                      >
                        <item.icon className="w-4 h-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
