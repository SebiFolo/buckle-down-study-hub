import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderOpen,
  BookOpen,
  Users,
  User,
  LogOut,
  Target,
  ArrowLeft,
  Store,
} from "lucide-react";
import { BuckLogo } from "./BuckLogo";
import { NotificationsBell } from "./NotificationsBell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vault", label: "Vault", icon: FolderOpen },
  { to: "/study", label: "Study", icon: BookOpen },
  { to: "/quests", label: "Quests", icon: Target },
  { to: "/shop", label: "Shop", icon: Store },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    nav({ to: "/login" });
  };

  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else nav({ to: "/dashboard" });
  };

  // Hide back button on top-level nav routes
  const isTopLevel = NAV.some((n) => loc.pathname === n.to || loc.pathname === n.to + "/");

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop sidebar — sticky, full-height, no internal scroll needed */}
      <aside className="hidden md:flex md:sticky md:top-0 md:h-screen w-60 flex-col bg-sidebar border-r border-sidebar-border p-4 gap-1 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-3 text-primary">
          <BuckLogo className="h-8 w-8" />
          <span className="font-bold text-lg tracking-tight">Buckle Down</span>
        </Link>
        <nav className="flex flex-col gap-1 mt-2">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-1">
          <NotificationsBell />
          <Button variant="ghost" size="sm" className="flex-1 justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar">
        <div className="flex items-center gap-2">
          {!isTopLevel && (
            <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Link to="/dashboard" className="flex items-center gap-2 text-primary">
            <BuckLogo className="h-7 w-7" />
            <span className="font-bold">Buckle Down</span>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-6 min-w-0">
        {/* Desktop back arrow */}
        {!isTopLevel && (
          <div className="hidden md:flex px-4 md:px-8 pt-4">
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </div>
        )}
        {children}
      </main>

      {/* Mobile bottom tab */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-sidebar border-t border-sidebar-border flex justify-around z-40">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = loc.pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
