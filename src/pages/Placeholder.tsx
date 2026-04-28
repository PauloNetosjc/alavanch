import { Construction } from "lucide-react";

export default function Placeholder({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="text-[12px] text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="surface-card flex flex-col items-center justify-center py-20 text-center">
        <Construction className="w-8 h-8 text-muted-foreground mb-3" />
        <div className="text-[13px] text-muted-foreground">Em construção</div>
        <div className="text-[12px] text-muted-foreground/70 mt-1">
          Esta tela será entregue em uma próxima fase do redesign.
        </div>
      </div>
    </div>
  );
}
