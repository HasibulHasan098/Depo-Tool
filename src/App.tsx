import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./components/Sidebar";
import { DownloadStatus } from "./components/DownloadStatus";
import { StorePage } from "./components/StorePage";
import { LibraryPage } from "./components/LibraryPage";
import { GameDetailsPage } from "./components/GameDetailsPage";
import { GameInfo, DownloadProgress } from "@/types";
import { Toaster, toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { Moon, Sun, Laptop } from "lucide-react";

import { TitleBar } from "./components/TitleBar";
import { OnlineFixPage } from "./components/OnlineFixPage";
import { DlcUnlockerPage } from "./components/DLCUnlockerPage";
import { AchievementsPage } from "./components/AchievementsPage";
import { GameFixPage } from "./components/GameFixPage";

interface ReleaseInfo {
  version: string;
  tagName: string;
  name: string;
  body: string;
  publishedAt: string;
  downloadUrl: string | null;
  htmlUrl: string;
}

function compareVersions(current: string, latest: string): number {
  const currentParts = current.replace(/^v/, "").split(".").map(Number);
  const latestParts = latest.replace(/^v/, "").split(".").map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const a = currentParts[i] || 0;
    const b = latestParts[i] || 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
}

function parseRelease(release: any): ReleaseInfo {
  const assets = release.assets || [];
  let downloadAsset = assets.find((asset: any) =>
    asset.name.toLowerCase().includes("setup") && asset.name.endsWith(".exe")
  );

  if (!downloadAsset) {
    downloadAsset = assets.find((asset: any) => asset.name.endsWith(".exe"));
  }

  if (!downloadAsset) {
    downloadAsset = assets.find((asset: any) => asset.name.endsWith(".msi"));
  }

  const tagName = release.tag_name || "";
  const version = tagName.replace(/^v/, "") || release.name?.replace(/^v/, "") || "1.0.2";

  return {
    version,
    tagName,
    name: release.name || `Version ${version}`,
    body: release.body || "",
    publishedAt: release.published_at || "",
    downloadUrl: downloadAsset?.browser_download_url || null,
    htmlUrl: release.html_url || `https://github.com/HasibulHasan098/Depo-Tool/releases/tag/${tagName}`
  };
}

function App() {
  const { theme, setTheme } = useTheme();
  
  // Set default theme to dark on first load if not set
  useEffect(() => {
    const savedTheme = localStorage.getItem("vite-ui-theme");
    if (!savedTheme) {
        setTheme("dark");
    }
  }, []);

  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState("home");
  const [activeView, setActiveView] = useState<"list" | "details">("list");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GameInfo[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [steamPath, setSteamPath] = useState("C:\\Program Files (x86)\\Steam");
  const [isDownloading, setIsDownloading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [libraryGames, setLibraryGames] = useState<GameInfo[]>([]);
  const [currentVersion, setCurrentVersion] = useState("1.0.1");
  const [updateRelease, setUpdateRelease] = useState<ReleaseInfo | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<boolean | null>(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [language, setLanguage] = useState(localStorage.getItem("language") || "en");
  const [featuredGames, setFeaturedGames] = useState<GameInfo[]>([]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem("language", lang);
    i18n.changeLanguage(lang);
    toast.success(t("language_changed"), { description: t("language_changed_desc") });
  };

  useEffect(() => {
    i18n.changeLanguage(language);
  }, []);

  useEffect(() => {
    invoke<string | null>("get_steam_path").then((path) => {
      if (path) {
        setSteamPath(path);
        toast.info(t("steam_path_detected"), { description: path });
      }
    });

    getVersion()
      .then((version) => setCurrentVersion(version))
      .catch(() => setCurrentVersion("1.0.4"));

    loadLibrary();
    loadFeatured();

    const unlisten = listen<DownloadProgress>("download-progress", (event) => {
      setDownloadProgress(event.payload);
    });

    // Disable Right Click and DevTools shortcuts
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      unlisten.then((f) => f());
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  async function loadLibrary() {
    try {
      const games = await invoke<GameInfo[]>("get_library_games");
      setLibraryGames(games);
    } catch (e) {
      console.error("Failed to load library", e);
    }
  }

  async function loadFeatured() {
    try {
      const games = await invoke<GameInfo[]>("get_featured_games");
      setFeaturedGames(games.slice(0, 5)); // Keep top 5 for suggestions
      if (query.length === 0) {
        setResults(games.slice(0, 5));
      }
    } catch (e) {
      console.error("Failed to load featured", e);
    }
  }

  const handleRemoveGame = async (gameId: number) => {
    try {
      await invoke("remove_game_from_library", { gameId, steamPath });
      toast.success(t("game_removed"), { description: t("game_removed_desc") });
      loadLibrary(); // Refresh library
      if (selectedGame?.id === gameId) {
        // Optionally go back or just update state
      }
    } catch (e) {
      toast.error(t("failed_remove_game"), { description: String(e) });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 0) {
        performSearch(query);
      } else {
        setResults(featuredGames);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, featuredGames]);

  // Reset view when tab changes
  useEffect(() => {
    if (activeTab !== "home") {
      setActiveView("list");
    }
  }, [activeTab]);

  async function performSearch(q: string) {
    try {
      const games = await invoke<GameInfo[]>("search_games", { query: q });
      setResults(games);
    } catch (e) {
      console.error(e);
    }
  }

  const handleGameSelect = (game: GameInfo) => {
    setSelectedGame(game);
    setActiveTab("home"); // Switch to Home tab
    setActiveView("details");
  };

  const handleBackToStore = () => {
    setActiveView("list");
    setSelectedGame(null);
  };

  const handleDownload = async (game?: GameInfo) => {
    const targetGame = game || selectedGame;
    if (!targetGame) {
      toast.error(t("no_game_selected"));
      return;
    }
    
    // Wrap the download logic in an anonymous function so we can pass it to child components correctly
    // However, since handleDownload already takes an optional argument, we need to ensure 
    // that when it's called from an event handler (which passes an event object), 
    // we don't treat the event as a GameInfo object.
    
    // Fix: Check if 'game' is actually a GameInfo object or a SyntheticEvent
    // If it's an event (has preventDefault), ignore it and use selectedGame
    // But since GameInfo is an interface, we can check for properties like 'id'
    
    const actualGame = (game && 'id' in game) ? game : selectedGame;
    
    if (!actualGame) {
       toast.error(t("no_game_selected"));
       return;
    }

    setCheckingAvailability(true);
    try {
      const available = await invoke<boolean>("check_game_availability", { gameId: actualGame.id.toString() });
      if (!available) {
        toast.error(t("download_unavailable"), { description: t("download_unavailable_desc") });
        return;
      }
      
      setIsDownloading(true);
      setActiveView("list");
      setActiveTab("downloads");
      
      await invoke("download_and_install_cmd", { 
        gameId: actualGame.id.toString(), 
        steamPath: steamPath 
      });
      toast.success(t("installation_complete"), { description: t("installation_complete_desc") });
      loadLibrary(); // Refresh library
    } catch (e) {
      toast.error(t("error"), { description: String(e) });
    } finally {
      setIsDownloading(false);
      setCheckingAvailability(false);
      setDownloadProgress(null);
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateStatus(t("checking_updates"));
    try {
      const release = await invoke<any>("check_for_updates");
      if (!release) {
        setUpdateRelease(null);
        setUpdateAvailable(false);
        setUpdateStatus(t("no_releases_found"));
        return;
      }

      const parsed = parseRelease(release);
      setUpdateRelease(parsed);
      const comparison = compareVersions(currentVersion, parsed.version);
      if (comparison < 0) {
        setUpdateAvailable(true);
        setUpdateStatus(`${t("update_available")}: v${parsed.version}`);
      } else {
        setUpdateAvailable(false);
        setUpdateStatus(t("up_to_date"));
      }
    } catch (e) {
      setUpdateRelease(null);
      setUpdateAvailable(null);
      setUpdateStatus(t("update_check_failed"));
    } finally {
      setCheckingUpdates(false);
    }
  };

  const openReleasesPage = async () => {
    await openUrl("https://github.com/HasibulHasan098/Depo-Tool/releases");
  };

  const downloadUpdate = async () => {
    if (updateRelease?.downloadUrl) {
      await openUrl(updateRelease.downloadUrl);
      return;
    }
    await openReleasesPage();
  };

  const handleTabChange = (tab: string) => {
    // If clicking the current tab, reset the view to list/main view
    if (activeTab === tab) {
      if (tab === "home") {
        setActiveView("list");
        setSelectedGame(null);
      }
      return;
    }
    setActiveTab(tab);
  };

  return (
    <div className="flex h-screen bg-background font-sans selection:bg-primary/20 overflow-hidden">
      <TitleBar 
        query={query} 
        onSearch={setQuery} 
        suggestions={results}
        onSelectSuggestion={handleGameSelect}
        showUpdateNow={updateAvailable === true}
        onUpdateNow={downloadUpdate}
      />
      <Toaster position="top-center" />
      
      {/* Sidebar */}
      <div className="pt-10 h-full flex w-full">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Header Removed - Search is now in TitleBar */}
          
          <main className="flex-1 h-full relative overflow-hidden">
          {activeTab === "home" && (
            <div className="h-full">
               {activeView === "details" && selectedGame ? (
                 <GameDetailsPage 
                   game={selectedGame}
                   onBack={handleBackToStore}
                   onDownload={handleDownload}
                   onRemove={() => handleRemoveGame(selectedGame.id)}
                   isInstalled={libraryGames.some(g => g.id === selectedGame.id)}
                   isDownloading={isDownloading}
                   checkingAvailability={checkingAvailability}
                 />
               ) : (
                 <div className="h-full overflow-y-auto scrollbar-hide p-8 space-y-10 pb-24 animate-in fade-in duration-300">
                    {/* Search Results Display Removed - now using suggestions dropdown */}
                    <StorePage 
                      onSelectGame={handleGameSelect}
                      selectedGame={null}
                      onDownload={handleDownload}
                      isDownloading={isDownloading}
                      checkingAvailability={checkingAvailability}
                      libraryGames={libraryGames}
                    />
                 </div>
               )}
            </div>
          )}

          {activeTab === "library" && (
             <div className="h-full overflow-y-auto scrollbar-hide p-8 space-y-10 pb-24 animate-in fade-in duration-300">
               <LibraryPage 
                 games={libraryGames} 
                 onSelectGame={handleGameSelect} 
                 onRemoveGame={handleRemoveGame}
               />
             </div>
          )}

          {activeTab === "downloads" && (
             <div className="h-full overflow-y-auto scrollbar-hide p-8 space-y-10 pb-24">
                <div className="max-w-2xl mx-auto space-y-6">
                   <h2 className="text-3xl font-bold tracking-tight">{t("active_downloads")}</h2>
                   {isDownloading || downloadProgress ? (
                     <DownloadStatus progress={downloadProgress} isDownloading={isDownloading} />
                   ) : (
                     <div className="text-center p-12 border border-dashed rounded-3xl text-muted-foreground">
                       {t("no_active_downloads")}
                     </div>
                   )}
                </div>
             </div>
          )}

          {activeTab === "online-fix" && (
             <div className="h-full overflow-y-auto scrollbar-hide p-8 space-y-10 pb-24 animate-in fade-in duration-300">
               <OnlineFixPage />
             </div>
          )}

          {activeTab === "dlc" && (
             <div className="h-full overflow-y-auto scrollbar-hide p-8 pb-24">
               <DlcUnlockerPage />
             </div>
          )}

          {activeTab === "game-fix" && (
             <div className="h-full overflow-y-auto scrollbar-hide p-8 pb-24">
               <GameFixPage />
             </div>
          )}

          {activeTab === "achievements" && (
             <div className="h-full overflow-y-auto scrollbar-hide p-8 pb-24">
               <AchievementsPage />
             </div>
          )}

          {activeTab === "settings" && (
            <div className="h-full overflow-y-auto scrollbar-hide p-8 space-y-10 pb-24">
                <div className="max-w-xl mx-auto space-y-8">
                   <div className="space-y-2">
                     <h2 className="text-3xl font-bold tracking-tight">{t("settings")}</h2>
                     <p className="text-muted-foreground">{t("configure_preferences")}</p>
                   </div>
                   
                   <div className="space-y-4 p-6 border rounded-3xl bg-card">
                     <div className="space-y-2">
                       <h3 className="text-lg font-semibold">{t("appearance")}</h3>
                       <p className="text-sm text-muted-foreground">{t("customize_look")}</p>
                       <div className="flex gap-2 pt-2">
                         <Button 
                           variant={theme === 'light' ? "default" : "outline"} 
                           size="sm" 
                           onClick={() => setTheme('light')}
                           className="gap-2"
                         >
                           <Sun className="h-4 w-4" /> {t("light")}
                         </Button>
                         <Button 
                           variant={theme === 'dark' ? "default" : "outline"} 
                           size="sm" 
                           onClick={() => setTheme('dark')}
                           className="gap-2"
                         >
                           <Moon className="h-4 w-4" /> {t("dark")}
                         </Button>
                         <Button 
                           variant={theme === 'system' ? "default" : "outline"} 
                           size="sm" 
                           onClick={() => setTheme('system')}
                           className="gap-2"
                         >
                           <Laptop className="h-4 w-4" /> {t("system")}
                         </Button>
                       </div>
                     </div>
                   </div>

                   <div className="space-y-4 p-6 border rounded-3xl bg-card">
                     <div className="space-y-2">
                       <h3 className="text-lg font-semibold">{t("language")}</h3>
                       <p className="text-sm text-muted-foreground">{t("select_language")}</p>
                       <select
                           value={language}
                           onChange={(e) => handleLanguageChange(e.target.value)}
                           className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                       >
                           <option value="en">English</option>
                           <option value="es">Español</option>
                           <option value="fr">Français</option>
                           <option value="de">Deutsch</option>
                           <option value="zh">中文</option>
                           <option value="ru">Русский</option>
                       </select>
                     </div>
                   </div>

                   <div className="space-y-4 p-6 border rounded-3xl bg-card">
                     <div className="space-y-2">
                       <label className="text-sm font-medium">{t("steam_install_path")}</label>
                       <div className="flex gap-2">
                         <Input value={steamPath} onChange={(e) => setSteamPath(e.target.value)} />
                         <Button variant="outline" onClick={() => invoke("get_steam_path").then((p) => p && setSteamPath(p as string))}>
                           {t("detect")}
                         </Button>
                       </div>
                       <p className="text-xs text-muted-foreground">
                         {t("steam_path_hint")}
                       </p>
                     </div>
                   </div>

                  <div className="space-y-4 p-6 border rounded-3xl bg-card">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold">{t("updates")}</h3>
                        <p className="text-sm text-muted-foreground">{t("current_version")}: v{currentVersion}</p>
                      </div>
                      <Button onClick={checkForUpdates} disabled={checkingUpdates}>
                        {checkingUpdates ? t("checking") : t("check_for_updates")}
                      </Button>
                    </div>
                    {updateStatus && (
                      <p className="text-sm text-muted-foreground">{updateStatus}</p>
                    )}
                    {updateAvailable && updateRelease && (
                      <div className="space-y-3">
                        <div className="text-sm">
                          <div className="font-medium">{updateRelease.name}</div>
                          {updateRelease.publishedAt && (
                            <div className="text-muted-foreground">
                              {t("published")} {new Date(updateRelease.publishedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        {updateRelease.body && (
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {updateRelease.body}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button onClick={downloadUpdate}>{t("update_now")}</Button>
                          <Button variant="outline" onClick={openReleasesPage}>
                            {t("view_releases")}
                          </Button>
                        </div>
                      </div>
                    )}
                    {updateAvailable === false && (
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={openReleasesPage}>
                          {t("view_releases")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
            </div>
          )}
        </main>
      </div>
      </div>
    </div>
  );
}

export default App;
