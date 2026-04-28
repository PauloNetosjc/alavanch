interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: { value: number; positive?: boolean };
}

export function KpiCard({ label, value, hint, trend }: KpiCardProps) {
  return (
    <div className="surface-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value mt-2">{value}</div>
      {(hint || trend) && (
        <div className="flex items-center gap-2 mt-2">
          {trend && (
            <span
              className="text-[10px] font-medium"
              style={{ color: trend.positive ? "hsl(var(--status-success-fg))" : "hsl(var(--status-danger-fg))" }}
            >
              {trend.positive ? "▲" : "▼"} {Math.abs(trend.value)}%
            </span>
          )}
          {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  );
}
