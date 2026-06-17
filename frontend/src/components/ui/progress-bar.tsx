import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max: number;
  variant?: "success" | "danger" | "warning" | "primary";
  label?: string;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const variantColors = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  primary: "bg-primary",
};

const sizeHeights = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

export function ProgressBar({
  value,
  max,
  variant = "primary",
  label,
  showValue = true,
  size = "md",
  className,
}: ProgressBarProps) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showValue && (
            <span className="font-medium tabular-nums">
              {value.toFixed(2)} / {max.toFixed(2)}
            </span>
          )}
        </div>
      )}
      <div className={cn("w-full overflow-hidden rounded-full bg-muted", sizeHeights[size])}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            variantColors[variant]
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showValue && (
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {percent.toFixed(1)}%
        </p>
      )}
    </div>
  );
}
