import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, X, Globe, Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useTranslation } from "react-i18next";

const LANGUAGES = ["en", "es", "fr", "de", "zh", "ru"];

export function TitleBar() {
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();

  const appWindow = getCurrentWindow();

  const minimize = () => appWindow.minimize();
  const close = () => appWindow.close();
  const startDrag = () => appWindow.startDragging();

  const toggleLang = () => {
    // Get current language code (e.g. 'en-US' -> 'en')
    const currentLang = i18n.language.split('-')[0];
    const currentIndex = LANGUAGES.indexOf(currentLang);
    // Default to index 0 if not found
    const validIndex = currentIndex !== -1 ? currentIndex : 0;
    const nextIndex = (validIndex + 1) % LANGUAGES.length;
    i18n.changeLanguage(LANGUAGES[nextIndex]);
  };

  return (
    <div className="h-10 flex items-center justify-between fixed top-0 left-0 right-0 z-[5000] px-4 select-none bg-background/80 backdrop-blur-xl border-b border-white/5">
        {/* Left Side: Drag Region */}
        <div className="flex items-center gap-2.5 min-w-[140px] h-full">
             {/* Overlay Drag Region */}
             <div 
                 className="absolute inset-0 z-0 cursor-default"
                 onPointerDown={(e) => {
                    if (e.button === 0) {
                        startDrag();
                    }
                 }}
             />
            <span className="text-sm font-bold tracking-tight text-foreground/90 pointer-events-none relative z-10">{t('installer_title')}</span>
        </div>

        {/* Right Side: Window Controls & Tools */}
        <div className="flex items-center gap-2 h-full z-50">
            {/* Accessibility Icons */}
            <div className="flex items-center gap-1 mr-2 border-r border-border/40 pr-3 h-5">
                 <button
                    onClick={toggleLang}
                    className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors uppercase text-[10px] font-bold flex items-center gap-1.5"
                    title="Change Language"
                >
                    <Globe size={14} />
                    <span>{i18n.language.split('-')[0]}</span>
                </button>
                <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                    title="Switch Theme"
                >
                    {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                </button>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1">
                <button
                    onClick={minimize}
                    className="h-7 w-9 hover:bg-white/10 rounded-md transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                    tabIndex={-1}
                >
                    <Minus className="w-3.5 h-3.5" />
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
