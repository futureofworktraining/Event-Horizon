"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";
import {
  Home,
  Upload,
  FileText,
  Settings,
  HelpCircle,
  FolderOpen,
  BarChart3,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "./ui/button";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  isCollapsed?: boolean;
  badge?: string | number;
}

function NavItem({ href, icon, label, isActive, isCollapsed, badge }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-background text-foreground border-2 border-foreground shadow-[2px_2px_0px_0px_var(--foreground)] font-bold"
          : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium hover:translate-x-1 transition-transform",
        isCollapsed && "justify-center px-2"
      )}
      title={isCollapsed ? label : undefined}
    >
      <span className="flex-shrink-0">{icon}</span>
      {!isCollapsed && (
        <>
          <span className="flex-1">{label}</span>
          {badge !== undefined && (
            <span
              className={cn(
                "px-2 py-0.5 text-xs rounded-full",
                isActive
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted-foreground/20 text-muted-foreground"
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

interface NavSectionProps {
  title?: string;
  children: React.ReactNode;
  isCollapsed?: boolean;
}

function NavSection({ title, children, isCollapsed }: NavSectionProps) {
  return (
    <div className="space-y-1">
      {title && !isCollapsed && (
        <h3 className="px-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">
          {title}
        </h3>
      )}
      {title && isCollapsed && (
        <div className="h-px bg-border mx-2 my-2" />
      )}
      {children}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggle } = useSidebar();

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 bg-sidebar flex flex-col transition-all duration-300 ease-in-out border-r border-sidebar-border",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className={cn("border-b border-border/50 flex flex-shrink-0 items-center justify-start", isCollapsed ? "h-14 p-3" : "h-14 px-6")}>
        <Link href="/" className="flex items-center gap-3">
          <div className={cn(
            "rounded-xl bg-primary flex items-center justify-center border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex-shrink-0",
            isCollapsed ? "w-10 h-10" : "w-10 h-10"
          )}>
            <Layers className="w-5 h-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-lg font-bold tracking-tight whitespace-nowrap">Event Horizon</span>
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">AI Process Studio</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-6 overflow-y-auto", isCollapsed ? "p-2" : "p-4")}>
        <NavSection isCollapsed={isCollapsed}>
          <NavItem
            href="/"
            icon={<Home className="w-5 h-5" />}
            label="Dashboard"
            isActive={isActive("/")}
            isCollapsed={isCollapsed}
          />
        </NavSection>

        <NavSection title="Process Analysis" isCollapsed={isCollapsed}>
          <NavItem
            href="/upload"
            icon={<Upload className="w-5 h-5" />}
            label="Upload Video"
            isActive={isActive("/upload")}
            isCollapsed={isCollapsed}
          />
          <NavItem
            href="/projects"
            icon={<FolderOpen className="w-5 h-5" />}
            label="Projects"
            isActive={isActive("/projects")}
            isCollapsed={isCollapsed}
          />
          <NavItem
            href="/documents"
            icon={<FileText className="w-5 h-5" />}
            label="Documents"
            isActive={isActive("/documents")}
            isCollapsed={isCollapsed}
          />
        </NavSection>

        <NavSection title="Insights" isCollapsed={isCollapsed}>
          <NavItem
            href="/analytics"
            icon={<BarChart3 className="w-5 h-5" />}
            label="Analytics"
            isActive={isActive("/analytics")}
            isCollapsed={isCollapsed}
          />
        </NavSection>
      </nav>

      {/* Footer */}
      <div className={cn("space-y-1", isCollapsed ? "p-2" : "p-4")}>
        <NavItem
          href="/settings"
          icon={<Settings className="w-5 h-5" />}
          label="Settings"
          isActive={isActive("/settings")}
          isCollapsed={isCollapsed}
        />
        <NavItem
          href="/help"
          icon={<HelpCircle className="w-5 h-5" />}
          label="Help & Support"
          isActive={isActive("/help")}
          isCollapsed={isCollapsed}
        />
      </div>

      {/* Collapse Toggle & Version */}
      <div className={cn("border-t border-border/50 bg-muted/30", isCollapsed ? "p-2" : "px-4 py-3")}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
          {!isCollapsed && (
            <p className="text-xs text-muted-foreground">
              v1.0.0
            </p>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="h-8 w-8"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}
