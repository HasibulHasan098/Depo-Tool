import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface TitleBarProps {
  query?: string;
  onSearch?: (q: string) => void;
}

export function TitleBar({ query, onSearch }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    const updateState = async () => {
      setIsMaximized(await appWindow.isMaximized());
    };
    updateState();

    const unlisten = appWindow.listen("tauri://resize", updateState);
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const minimize = () => appWindow.minimize();
  const toggleMaximize = async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };
  const close = () => appWindow.close();

  return (
    <div className="h-10 grid grid-cols-[auto_1fr_auto] bg-background/80 backdrop-blur-xl border-b border-white/5 select-none fixed top-0 left-0 right-0 z-[5000] items-center px-4 gap-4">
        {/* Left Side: Title & Drag Region */}
        <div className="flex items-center gap-2.5 min-w-[140px] h-full pl-3">
            <img src="/logo.png" alt="DEPO" className="w-5 h-5 object-contain opacity-90 relative top-[1px]" />
            <div className="text-sm font-bold tracking-tight text-foreground/90 pointer-events-none leading-none">
                DEPO Tool
            </div>
            {/* Left Drag Region */}
            <div 
                className="flex-1 h-full w-full cursor-default"
                onPointerDown={(e) => {
                    if (e.button === 0) { // Left click only
                        appWindow.startDragging();
                    }
                }}
            />
        </div>

        {/* Center: Search Bar */}
        <div className="flex justify-center h-full items-center relative z-20">
             {/* Center Drag Region (Behind search, fills empty space) */}
             <div 
                className="absolute inset-0 cursor-default -z-10"
                onPointerDown={(e) => {
                    if (e.button === 0) {
                        appWindow.startDragging();
                    }
                }}
            />
            {onSearch && (
            <div className="w-full max-w-md relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors z-20" />
                <Input 
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                className="h-8 pl-9 bg-secondary/50 border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-background rounded-full transition-all text-sm shadow-sm hover:bg-secondary/80 outline-none"
                placeholder="Search by name or App ID..." 
                />
            </div>
            )}
        </div>

        {/* Right Side: Drag Region & Window Controls */}
        <div className="flex items-center h-full">
            {/* Right Drag Region */}
            <div 
                className="flex-1 h-full min-w-[20px] cursor-default"
                onPointerDown={(e) => {
                    if (e.button === 0) { 
                        appWindow.startDragging();
                    }
                }}
            />
            
            {/* Window Controls */}
            <div className="flex items-center gap-1 pl-2">
                <button
                    onClick={minimize}
                    className="h-7 w-9 hover:bg-white/10 rounded-md transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                    tabIndex={-1}
                >
                    <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={toggleMaximize}
                    className="h-7 w-9 hover:bg-white/10 rounded-md transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                    tabIndex={-1}
                >
                    <Square className={cn("w-3 h-3", isMaximized && "fill-current")} />
                </button>
                <button
                    onClick={close}
                    className="h-7 w-9 hover:bg-red-500 hover:text-white rounded-md transition-colors flex items-center justify-center text-muted-foreground cursor-pointer"
                    tabIndex={-1}
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    </div>
  );
}
