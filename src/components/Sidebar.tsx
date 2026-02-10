import { useState } from "react";
import { Home, Download, Settings, Library, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const items = [
    { id: "home", icon: Home, label: "Store" },
    { id: "library", icon: Library, label: "Library" },
    { id: "downloads", icon: Download, label: "Downloads" },
  ];

  return (
    <aside 
      className={cn(
        "h-full bg-card/50 backdrop-blur-xl border-r border-border/50 flex flex-col relative z-50 shadow-xl py-4 pt-6 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        isExpanded ? "w-64" : "w-[60px] items-center"
      )}
      aria-label="Sidebar Navigation"
    >
      {/* Brand / Logo - Removed per user request */}
      
      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2 w-full px-2">
        {items.map((item) => (
            <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                    "flex items-center rounded-xl transition-all group relative outline-none",
                    isExpanded 
                        ? "gap-3 px-4 py-3 w-full justify-start" 
                        : "justify-center w-10 h-10 mx-auto",
                    activeTab === item.id 
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" 
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
                title={!isExpanded ? item.label : undefined}
                aria-current={activeTab === item.id ? "page" : undefined}
                aria-label={item.label}
            >
                <item.icon className={cn(
                    "w-5 h-5 transition-transform duration-300",
                    !isExpanded && "group-hover:scale-110"
                )} />
                
                {isExpanded && (
                    <span className="font-medium text-sm animate-in fade-in duration-200">
                        {item.label}
                    </span>
                )}
            </button>
        ))}
      </nav>

      {/* Footer Actions */}
      <div className={cn(
          "mt-auto space-y-2 w-full flex flex-col pb-2",
          isExpanded ? "px-2" : "items-center"
      )}>
         {/* Settings Item */}
         <button
            onClick={() => onTabChange("settings")}
            className={cn(
                "flex items-center rounded-xl transition-all group relative outline-none",
                isExpanded 
                    ? "gap-3 px-4 py-3 w-full justify-start" 
                    : "justify-center w-10 h-10 mx-auto",
                activeTab === "settings"
                    ? "bg-muted text-foreground shadow-sm ring-1 ring-border" 
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
            title="Settings"
            aria-label="Settings"
        >
            <Settings className={cn(
                "w-5 h-5 transition-transform duration-500",
                !isExpanded && "group-hover:rotate-45"
            )} />
            {isExpanded && (
                <span className="font-medium text-sm animate-in fade-in duration-200">
                    Settings
                </span>
            )}
        </button>

        {/* Expand/Collapse Toggle */}
        <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
                "flex items-center rounded-xl transition-all group relative outline-none text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                isExpanded 
                    ? "gap-3 px-4 py-3 w-full justify-start" 
                    : "justify-center w-10 h-10 mx-auto"
            )}
            title={isExpanded ? "Collapse" : "Expand"}
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
            {isExpanded ? (
                <>
                    <PanelLeft className="w-5 h-5" />
                    <span className="font-medium text-sm animate-in fade-in duration-200">Collapse</span>
                </>
            ) : (
                <PanelLeft className="w-5 h-5 transition-transform group-hover:scale-110" />
            )}
        </button>
      </div>
    </aside>
  );
}
