import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

type Variant = "blue" | "green" | "amber" | "purple" | "rose";

const styles: Record<Variant, { bg: string; border: string; icon: string }> = {
  blue:   { bg: "#EAF2FB", border: "#D6E4F5", icon: "#3B6FB0" },
  green:  { bg: "#E8F4ED", border: "#D2E8DB", icon: "#3F8B5C" },
  amber:  { bg: "#FBF3DF", border: "#F3E5BF", icon: "#A8842A" },
  purple: { bg: "#F4ECF7", border: "#E5D6EE", icon: "#7E4FA0" },
  rose:   { bg: "#FDECEC", border: "#F5D6D6", icon: "#B04A4A" },
};

interface PageHeaderProps {
  icon: LucideIcon;
  iconVariant?: Variant;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ icon: Icon, iconVariant = "blue", title, subtitle, actions }: PageHeaderProps) {
  const s = styles[iconVariant];
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: s.bg, border: `1px solid ${s.border}` }}
        >
          <Icon className="w-6 h-6" style={{ color: s.icon }} />
        </div>
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground leading-none">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] text-muted-foreground mt-1.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
