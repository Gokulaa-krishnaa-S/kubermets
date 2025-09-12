import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle, AlertTriangle, XCircle, Clock, Activity } from "lucide-react";

export type Status = "running" | "active" | "healthy" | "warning" | "error" | "pending" | "unknown";

interface StatusBadgeProps {
  status: Status;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<Status, {
  label: string;
  icon: typeof CheckCircle;
  className: string;
}> = {
  running: {
    label: "Running",
    icon: Activity,
    className: "bg-success/10 text-success border-success/20 hover:bg-success/20",
  },
  active: {
    label: "Active",
    icon: CheckCircle,
    className: "bg-success/10 text-success border-success/20 hover:bg-success/20",
  },
  healthy: {
    label: "Healthy",
    icon: CheckCircle,
    className: "bg-success/10 text-success border-success/20 hover:bg-success/20",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    className: "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20",
  },
  error: {
    label: "Error",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-muted/10 text-muted-foreground border-muted/20 hover:bg-muted/20",
  },
  unknown: {
    label: "Unknown",
    icon: AlertTriangle,
    className: "bg-muted/10 text-muted-foreground border-muted/20 hover:bg-muted/20",
  },
};

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium transition-colors",
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      {config.label}
    </Badge>
  );
}