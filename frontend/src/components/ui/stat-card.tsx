import { Card, CardTitle, CardValue } from "./card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
}

export function StatCard({ title, value, subtitle, trend, icon }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardValue
            className={cn(
              "mt-1",
              trend === "up" && "text-success",
              trend === "down" && "text-danger"
            )}
          >
            {value}
          </CardValue>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="rounded-lg bg-muted p-2.5 text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
