import { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
    label: string;
  };
  status?: "healthy" | "warning" | "error" | "info";
  className?: string;
  onClick?: () => void;
}

const statusConfig = {
  healthy: {
    badge: "bg-success/10 text-success border-success/20 hover:bg-success/20",
    card: "hover:border-success/30",
  },
  warning: {
    badge: "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20",
    card: "hover:border-warning/30",
  },
  error: {
    badge: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20",
    card: "hover:border-destructive/30",
  },
  info: {
    badge: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20",
    card: "hover:border-primary/30",
  },
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  status = "info",
  className,
  onClick,
}: MetricCardProps) {
  const config = statusConfig[status];
  
  const TrendIcon = trend?.direction === "up" ? TrendingUp : 
                    trend?.direction === "down" ? TrendingDown : Minus;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200 hover:shadow-hover cursor-pointer group",
        config.card,
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              config.badge
            )}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-muted-foreground truncate">
                {title}
              </h3>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
                {value}
              </p>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            
            {trend && (
              <div className="flex items-center gap-1 text-xs">
                <TrendIcon className={cn(
                  "w-3 h-3",
                  trend.direction === "up" && "text-success",
                  trend.direction === "down" && "text-destructive",
                  trend.direction === "neutral" && "text-muted-foreground"
                )} />
                <span className={cn(
                  "font-medium",
                  trend.direction === "up" && "text-success",
                  trend.direction === "down" && "text-destructive",
                  trend.direction === "neutral" && "text-muted-foreground"
                )}>
                  {trend.value}
                </span>
              </div>
            )}
          </div>
          
          {trend?.label && (
            <p className="text-xs text-muted-foreground">
              {trend.label}
            </p>
          )}
        </div>
      </CardContent>
      
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </Card>
  );
}