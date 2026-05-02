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
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 sm:mb-6">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div
          className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: s.bg, border: `1px solid ${s.border}` }}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: s.icon }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-[20px] sm:text-[28px] font-semibold tracking-tight text-foreground leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-1 sm:mt-1.5 line-clamp-2">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0 [&>*]:flex-1 sm:[&>*]:flex-initial">
          {actions}
        </div>
      )}
    </div>
  );
}
