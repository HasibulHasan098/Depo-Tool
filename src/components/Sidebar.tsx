import { useState } from "react";
import { Store, Download, Settings, Library, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const items = [
    { id: "home", icon: Store, label: t("store") },
    { id: "library", icon: Library, label: t("library") },
    { id: "downloads", icon: Download, label: t("downloads") },
  ];

  return (
    <aside 
      className={cn(
        "h-full bg-card/50 backdrop-blur-xl border-r border-border/50 flex flex-col relative z-50 shadow-xl py-4 pt-6 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        isExpanded ? "w-64" : "w-[48px] items-center"
      )}
      aria-label="Sidebar Navigation"
    >
      <nav className="flex-1 flex flex-col gap-2 w-full px-2">
        {items.map((item) => (
            <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                    "flex items-center rounded-lg transition-all group relative outline-none",
                    isExpanded 
                        ? "gap-3 px-3 py-2 w-full justify-start" 
                        : "justify-center w-8 h-8 mx-auto",
                    activeTab === item.id 
                        ? "bg-accent text-accent-foreground font-medium" 
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                title={!isExpanded ? item.label : undefined}
                aria-current={activeTab === item.id ? "page" : undefined}
                aria-label={item.label}
            >
                <item.icon className={cn(
                    "w-4 h-4 transition-transform duration-300",
                    !isExpanded && "group-hover:scale-110"
                )} />
                
                {isExpanded && (
                    <span className="text-sm animate-in fade-in duration-200">
                        {item.label}
                    </span>
                )}
            </button>
        ))}
      </nav>

      <div className={cn(
          "mt-auto space-y-2 w-full flex flex-col pb-2",
          isExpanded ? "px-2" : "items-center"
      )}>
         <button
            onClick={() => onTabChange("settings")}
            className={cn(
                "flex items-center rounded-lg transition-all group relative outline-none",
                isExpanded 
                    ? "gap-3 px-3 py-2 w-full justify-start" 
                    : "justify-center w-8 h-8 mx-auto",
                activeTab === "settings"
                    ? "bg-accent text-accent-foreground font-medium" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            title="Settings"
            aria-label="Settings"
        >
            <Settings className={cn(
                "w-4 h-4 transition-transform duration-500",
                !isExpanded && "group-hover:rotate-45"
            )} />
            {isExpanded && (
                <span className="text-sm animate-in fade-in duration-200">
                    {t("settings")}
                </span>
            )}
        </button>

        <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
                "flex items-center rounded-lg transition-all group relative outline-none text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                isExpanded 
                    ? "gap-3 px-3 py-2 w-full justify-start" 
                    : "justify-center w-8 h-8 mx-auto"
            )}
            title={isExpanded ? t("collapse") : t("expand")}
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
            {isExpanded ? (
                <>
                    <PanelLeft className="w-4 h-4" />
                    <span className="text-sm animate-in fade-in duration-200">{t("collapse")}</span>
                </>
            ) : (
                <PanelLeft className="w-4 h-4 transition-transform group-hover:scale-110" />
            )}
        </button>
      </div>
    </aside>
  );
}
