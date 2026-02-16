import { useState, useEffect } from "react";
import { ThemeProvider } from "./components/ThemeProvider";
import { TitleBar } from "./components/TitleBar";
import { openUrl } from '@tauri-apps/plugin-opener';
import { open } from '@tauri-apps/plugin-dialog';
import { Folder, Check, ArrowRight, Download, Globe, ChevronRight, Home, Info, HardDrive, PlayCircle, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

import { getCurrentWindow } from "@tauri-apps/api/window";

function AppContent() {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [installPath, setInstallPath] = useState("C:\\Program Files\\Depo Tool");
  const [isInstalling, setIsInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [createShortcut, setCreateShortcut] = useState(true);
  const [launchNow, setLaunchNow] = useState(true);
  const [isUninstallMode, setIsUninstallMode] = useState(false);
  const [uninstallCompleted, setUninstallCompleted] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    async function checkMode() {
        try {
            const isUninstall = await invoke<boolean>("check_if_uninstalling");
            setIsUninstallMode(isUninstall);
        } catch (e) {
            console.error(e);
        }
    }
    checkMode();
  }, []);

  const openLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch (error) {
      console.error("Failed to open link:", error);
    }
  };

  const handleFolderPick = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: installPath,
      });
      if (selected && typeof selected === "string") {
        let newPath = selected;
        // Automatically append "Depo Tool" if it's not already the selected folder
        if (!newPath.endsWith("Depo Tool")) {
             // Handle both slash types just in case, though Windows usually returns backslash
             if (!newPath.endsWith("\\") && !newPath.endsWith("/")) {
                 newPath += "\\";
             }
             newPath += "Depo Tool";
        }
        setInstallPath(newPath);
      }
    } catch (error) {
      console.error("Failed to pick folder:", error);
    }
  };

  const handleInstall = async () => {
    setIsInstalling(true);
    setInstallError(null);
    
    try {
        await invoke("install_app", { installPath, createShortcut });
        
        // Mock progress for visual feedback since the actual copy is fast but synchronous
        let currentProgress = 0;
        const interval = setInterval(() => {
          currentProgress += 10;
          if (currentProgress >= 100) {
            currentProgress = 100;
            clearInterval(interval);
            setIsInstalling(false);
            setStep(4);
          }
          setProgress(currentProgress);
        }, 100);
    } catch (e) {
        console.error("Installation failed:", e);
        const message = String(e);
        if (message.includes("INSTALLER_RESOURCES_MISSING")) {
            setInstallError(t("install_missing_resources_desc"));
        } else {
            setInstallError(message);
        }
        setIsInstalling(false);
    }
  };

  const handleUninstall = async () => {
      setIsInstalling(true);
      setUninstallCompleted(false);
      let interval: number | undefined;
      try {
          let currentProgress = 0;
          interval = window.setInterval(() => {
            currentProgress += 20;
            setProgress(currentProgress);
            if (currentProgress >= 100) {
                clearInterval(interval);
            }
          }, 200);

          await invoke("uninstall_app");

          clearInterval(interval);
          setProgress(100);
          setIsInstalling(false);
          setUninstallCompleted(true);
          setTimeout(() => {
              getCurrentWindow().close();
          }, 1500);
      } catch (e) {
          clearInterval(interval);
          console.error("Uninstall failed:", e);
          setIsInstalling(false);
      }
  };

  const handleFinish = async () => {
    if (launchNow && !isUninstallMode) {
        try {
            await invoke("launch_app", { installPath });
        } catch (e) {
            console.error("Failed to launch app:", e);
        }
    }
    // Close installer immediately
    try {
        await getCurrentWindow().close();
    } catch (e) {
        console.error("Failed to close window:", e);
    }
  };

  const steps = [
    { id: 1, label: t('welcome'), icon: Home },
    { id: 2, label: t('credits'), icon: Info },
    { id: 3, label: t('install'), icon: HardDrive },
    { id: 4, label: t('finish'), icon: Check },
  ];

  if (isUninstallMode) {
      return (
        <div className="flex h-screen bg-background font-sans selection:bg-primary/20 overflow-hidden text-foreground text-xs items-center justify-center p-8">
            <TitleBar />
            <div className="max-w-md w-full space-y-6 text-center">
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center">
                        <Trash2 className="w-8 h-8" />
                    </div>
                </div>
                
                <div className="space-y-2">
                    <h1 className="text-xl font-bold tracking-tight">{t('uninstall_title')}</h1>
                    <p className="text-muted-foreground">
                        {t('uninstall_prompt')}
                    </p>
                </div>

                {isInstalling && (
                    <div className="space-y-2 text-left p-4 bg-card border border-border/40 rounded-sm">
                        <div className="flex justify-between text-[10px] uppercase font-semibold text-muted-foreground">
                            <span>{t('uninstalling')}</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1 w-full bg-secondary/30 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-destructive transition-all duration-200 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {uninstallCompleted ? (
                    <div className="space-y-2 pt-2">
                        <h2 className="text-lg font-bold tracking-tight">{t('uninstall_success_title')}</h2>
                        <p className="text-muted-foreground">{t('uninstall_success_desc')}</p>
                    </div>
                ) : (
                    <div className="flex justify-center gap-3 pt-4">
                        <button
                            onClick={() => import("@tauri-apps/api/window").then(m => m.getCurrentWindow().close())}
                            className="px-4 py-2 rounded-sm font-medium text-xs text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
                            disabled={isInstalling}
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={handleUninstall}
                            disabled={isInstalling}
                            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-sm text-xs font-semibold hover:bg-destructive/90 transition-all flex items-center gap-2 shadow-sm"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isInstalling ? t('uninstalling') : t('uninstall')}
                        </button>
                    </div>
                )}
            </div>
        </div>
      );
  }

  return (
    <div className="flex h-screen bg-background font-sans selection:bg-primary/20 overflow-hidden text-foreground text-xs">
      <TitleBar />

      {/* Sidebar */}
      <aside className="w-48 bg-secondary/20 border-r border-border/40 flex flex-col pt-10 pb-4 px-2 gap-1 z-10">
        <div className="mb-2 px-2 mt-2">
            <h1 className="text-sm font-bold tracking-tight">Depo Tool</h1>
            <p className="text-[10px] text-muted-foreground">Installer v1.0.2</p>
        </div>
        
        <nav className="space-y-0.5">
            {steps.map((s) => {
                const Icon = s.icon;
                const isActive = step === s.id;
                const isCompleted = step > s.id;
                
                return (
                    <div 
                        key={s.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                            isActive 
                                ? "bg-primary text-primary-foreground shadow-sm" 
                                : isCompleted 
                                    ? "text-muted-foreground hover:bg-secondary/40" 
                                    : "text-muted-foreground/40"
                        }`}
                    >
                        <Icon className="w-3 h-3" />
                        <span>{s.label}</span>
                        {isCompleted && <Check className="w-2.5 h-2.5 ml-auto opacity-50" />}
                    </div>
                );
            })}
        </nav>

        <div className="mt-auto px-2">
            {/* Footer removed */}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col pt-10 px-6 pb-6 overflow-y-auto relative bg-background">
        <div className="flex-1 max-w-lg mx-auto w-full flex flex-col justify-center">
            
            {/* Step 1: Welcome */}
            {step === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                    <div className="space-y-1">
                        <h2 className="text-lg font-bold tracking-tight">{t('welcome')}</h2>
                        <p className="text-muted-foreground">
                            {t('welcome_desc')}
                        </p>
                    </div>

                    <div className="grid gap-2 pt-2">
                        <div 
                            onClick={() => openLink("https://depotool.pages.dev/privacy-policy")}
                            className="p-2.5 rounded-sm border border-border/40 bg-card hover:bg-accent/40 hover:border-border/60 transition-all cursor-pointer group flex items-center justify-between"
                        >
                            <div className="flex items-center gap-2.5">
                                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                                <div>
                                    <h3 className="font-medium">{t('privacy_policy')}</h3>
                                </div>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>

                        <div 
                            onClick={() => openLink("https://depotool.pages.dev/terms-of-service")}
                            className="p-2.5 rounded-sm border border-border/40 bg-card hover:bg-accent/40 hover:border-border/60 transition-all cursor-pointer group flex items-center justify-between"
                        >
                            <div className="flex items-center gap-2.5">
                                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                                <div>
                                    <h3 className="font-medium">{t('terms_of_service')}</h3>
                                </div>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Credits */}
            {step === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                    <div className="space-y-1">
                        <h2 className="text-lg font-bold tracking-tight">{t('credits')}</h2>
                        <p className="text-muted-foreground">
                            {t('credits_desc')}
                        </p>
                    </div>

                    <div className="p-4 bg-card border border-border/40 rounded-sm flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                            <div className="p-1.5 bg-secondary/50 rounded-sm text-primary mt-0.5">
                                <Globe className="w-4 h-4" />
                            </div>
                            <div className="space-y-1 flex-1">
                                <h3 className="font-bold">CRACK WORLD</h3>
                                <p className="text-muted-foreground max-w-xs leading-relaxed">
                                    {t('game_fix_credit')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => openLink("https://discord.gg/RPWnCnXYDb")}
                            className="self-start px-3 py-1 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-sm font-medium transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                            <Globe className="w-3 h-3" />
                            {t('join_discord')}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Install */}
            {step === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                     <div className="space-y-1">
                        <h2 className="text-lg font-bold tracking-tight">{t('install')}</h2>
                        <p className="text-muted-foreground">
                            {t('install_location')}
                        </p>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">{t('path')}</label>
                            <div className="flex gap-1.5">
                                <div className="flex-1 px-2.5 py-1.5 bg-secondary/20 border border-border/60 rounded-sm font-mono text-xs truncate flex items-center text-muted-foreground">
                                    {installPath}
                                </div>
                                <button 
                                    onClick={handleFolderPick}
                                    className="px-2.5 bg-secondary/50 hover:bg-secondary text-secondary-foreground rounded-sm transition-colors border border-border/40"
                                >
                                    <Folder className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {isInstalling && (
                            <div className="space-y-1.5 pt-2">
                                <div className="flex justify-between text-[10px] uppercase font-semibold text-muted-foreground">
                                    <span>{t('installing')}</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="h-1 w-full bg-secondary/30 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-primary transition-all duration-200 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {installError && !isInstalling && (
                            <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-3 text-[11px] text-destructive">
                                <div className="font-semibold">{t("install_failed_title")}</div>
                                <div>{installError}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Step 4: Finish */}
            {step === 4 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                    <div className="flex items-start gap-4 py-2">
                        <div className="w-10 h-10 bg-green-500/10 text-green-500 rounded-sm flex items-center justify-center shrink-0">
                            <Check className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-lg font-bold tracking-tight">{t('success')}</h2>
                            <p className="text-muted-foreground">
                                {t('installation_complete_installer')}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <label className="flex items-center gap-2.5 p-2 bg-card border border-border/40 rounded-sm cursor-pointer hover:border-border/80 transition-colors">
                            <div className={`w-3.5 h-3.5 rounded-[2px] border flex items-center justify-center transition-colors ${createShortcut ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}>
                                {createShortcut && <Check className="w-2.5 h-2.5" />}
                            </div>
                            <input 
                                type="checkbox" 
                                checked={createShortcut} 
                                onChange={(e) => setCreateShortcut(e.target.checked)} 
                                className="hidden" 
                            />
                            <span className="font-medium">{t('create_desktop_shortcut')}</span>
                        </label>
                        <label className="flex items-center gap-2.5 p-2 bg-card border border-border/40 rounded-sm cursor-pointer hover:border-border/80 transition-colors">
                            <div className={`w-3.5 h-3.5 rounded-[2px] border flex items-center justify-center transition-colors ${launchNow ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}>
                                {launchNow && <Check className="w-2.5 h-2.5" />}
                            </div>
                            <input 
                                type="checkbox" 
                                checked={launchNow} 
                                onChange={(e) => setLaunchNow(e.target.checked)} 
                                className="hidden" 
                            />
                            <span className="font-medium">{t('launch_now')}</span>
                        </label>
                    </div>
                </div>
            )}
        </div>

        {/* Bottom Navigation */}
        <div className="mt-auto pt-4 border-t border-border/40 flex justify-end gap-2">
            {step > 1 && step < 4 && !isInstalling && (
                <button
                    onClick={() => setStep(step - 1)}
                    className="px-3 py-1.5 rounded-sm font-medium text-xs text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
                >
                    {t('back')}
                </button>
            )}
            
            {step < 3 && (
                <button
                    onClick={() => setStep(step + 1)}
                    className="px-4 py-1.5 bg-primary text-primary-foreground rounded-sm text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm"
                >
                    {t('next')} <ArrowRight className="w-3 h-3" />
                </button>
            )}

            {step === 3 && !isInstalling && (
                <button
                    onClick={handleInstall}
                    className="px-4 py-1.5 bg-primary text-primary-foreground rounded-sm text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm"
                >
                    <Download className="w-3 h-3" />
                    {t('install')}
                </button>
            )}

            {step === 4 && (
                <button
                    onClick={handleFinish}
                    className="px-4 py-1.5 bg-primary text-primary-foreground rounded-sm text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm"
                >
                    <PlayCircle className="w-3 h-3" />
                    {t('finish')}
                </button>
            )}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="installer-ui-theme">
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
