import { Outlet } from "react-router-dom";
import { useState } from "react";
import { AppSidebar, SidebarInner } from "./AppSidebar";
import { Topbar } from "./Topbar";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ErrorBoundary } from "./ErrorBoundary";

export function AppLayout() {
  const { role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Montador tem layout dedicado
  if (role === "montador") {
    return <Navigate to="/montagem" replace />;
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="p-0 w-[260px] border-0"
          style={{ background: "#0F0F0F" }}
        >
          <SidebarInner onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 lg:p-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
