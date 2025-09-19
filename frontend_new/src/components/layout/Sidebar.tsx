import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Server,
  Box,
  Layers,
  Settings,
  Database,
  Network,
  HardDrive,
  ChevronLeft,
  LayoutDashboard,
  Activity,
  Shield,
  TrendingUp,
  DollarSign,
  Plus,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useCluster } from "../../components/context/ClusterContext";

const mainItems = [
  // { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Overview", url: "/overview", icon: BarChart3 },
  { title: "Create Cluster", action: "create-cluster", icon: Server, description: "Create new Kubernetes cluster" },
];

const metricItems = [
  { title: "Cluster Metrics", url: "/metric/cluster", icon: Server },
  { title: "Node Metrics", url: "/metric/nodes", icon: Box },
  { title: "Pods & Containers", url: "/metric/pods", icon: Layers },
];

const platformItems = [
];

interface AppSidebarProps {
  onCreateClusterClick?: () => void;
}

export function AppSidebar({ onCreateClusterClick }: AppSidebarProps) {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const { selectedInstance }: any = useCluster();

  // Custom active checker for metric items with query params
  const isMetricItemActive = (basePath: string) => {
    return currentPath === basePath;
  };

  function getNavClassName(isActive: boolean): string {
    return cn(
      "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
      isActive
        ? "bg-primary text-primary-foreground"
        : "hover:bg-muted hover:text-foreground"
    );
  }

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
                <h2 className="font-bold text-lg">Environment</h2>
                <p className="text-xs text-muted-foreground">
                  Cluster Management
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
                  {item.action ? (
                    <SidebarMenuButton 
                      onClick={() => onCreateClusterClick?.()}
                      isActive={false}
                    >
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton 
                      asChild 
                      isActive={currentPath === item.url}
                    >
                      <NavLink to={item.url}>
                        <item.icon className="w-4 h-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  )}
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
              {metricItems.map((item) => {
                // Build URL with cluster_id if selected
                const url = selectedInstance?.id
                  ? `${item.url}?cluster_id=${selectedInstance.id}`
                  : item.url;
                
               
                const isCurrentlyActive = isMetricItemActive(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isCurrentlyActive}
                    >
                      <NavLink to={item.url}>
                        <item.icon className="w-4 h-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
                        className={() => getNavClassName(currentPath === item.url)}
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