import { MetricCard } from "./MetricCard";
import { Server, Activity, Box, Cpu } from "lucide-react";

interface QuickStatsProps {
  onCardClick?: (metric: string) => void;
}

export function QuickStats({ onCardClick }: QuickStatsProps) {
  const stats = [
    {
      id: "blueprints",
      title: "Running Blueprints",
      value: "12",
      subtitle: "All systems operational",
      icon: <Activity className="w-4 h-4" />,
      trend: {
        value: "+3",
        direction: "up" as const,
        label: "this week"
      },
      status: "healthy" as const,
    },
    {
      id: "agents",
      title: "Active Agents",
      value: "8",
      subtitle: "Processing workloads",
      icon: <Server className="w-4 h-4" />,
      trend: {
        value: "+2",
        direction: "up" as const,
        label: "today"
      },
      status: "healthy" as const,
    },
    {
      id: "clusters",
      title: "K8s Clusters",
      value: "5",
      subtitle: "All healthy",
      icon: <Box className="w-4 h-4" />,
      trend: {
        value: "0",
        direction: "neutral" as const,
        label: "no changes"
      },
      status: "healthy" as const,
    },
    {
      id: "utilization",
      title: "GPU Utilization",
      value: "78%",
      subtitle: "High efficiency",
      icon: <Cpu className="w-4 h-4" />,
      trend: {
        value: "+5%",
        direction: "up" as const,
        label: "from yesterday"
      },
      status: "warning" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <MetricCard
          key={stat.id}
          title={stat.title}
          value={stat.value}
          subtitle={stat.subtitle}
          icon={stat.icon}
          trend={stat.trend}
          status={stat.status}
          onClick={() => onCardClick?.(stat.id)}
        />
      ))}
    </div>
  );
}