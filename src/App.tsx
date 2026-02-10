import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./components/Sidebar";
import { GameGrid } from "./components/GameGrid";
import { DownloadStatus } from "./components/DownloadStatus";
import { StorePage } from "./components/StorePage";
import { LibraryPage } from "./components/LibraryPage";
import { GameDetailsPage } from "./components/GameDetailsPage";
import { GameInfo, DownloadProgress } from "@/types";
import { Toaster, toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { TitleBar } from "./components/TitleBar";

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
  const version = tagName.replace(/^v/, "") || release.name?.replace(/^v/, "") || "0.0.0";

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
  const [currentVersion, setCurrentVersion] = useState("0.0.0");
  const [updateRelease, setUpdateRelease] = useState<ReleaseInfo | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<boolean | null>(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  useEffect(() => {
    invoke<string | null>("get_steam_path").then((path) => {
      if (path) {
        setSteamPath(path);
        toast.info("Steam Path Detected", { description: path });
      }
    });

    getVersion()
      .then((version) => setCurrentVersion(version))
      .catch(() => setCurrentVersion("0.0.0"));

    loadLibrary();

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

  const handleRemoveGame = async (gameId: number) => {
    try {
      await invoke("remove_game_from_library", { gameId, steamPath });
      toast.success("Game Removed", { description: "Game files deleted from library." });
      loadLibrary(); // Refresh library
      if (selectedGame?.id === gameId) {
        // Optionally go back or just update state
      }
    } catch (e) {
      toast.error("Failed to remove game", { description: String(e) });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 2) {
        performSearch(query);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

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
      toast.error("No game selected");
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
       toast.error("No game selected");
       return;
    }

    setCheckingAvailability(true);
    try {
      const available = await invoke<boolean>("check_game_availability", { gameId: actualGame.id.toString() });
      if (!available) {
        toast.error("Download unavailable", { description: "Sorry, this game is not available on our server yet." });
        return;
      }
      
      setIsDownloading(true);
      setActiveView("list");
      setActiveTab("downloads");
      
      await invoke("download_and_install_cmd", { 
        gameId: actualGame.id.toString(), 
        steamPath: steamPath 
      });
      toast.success("Installation Complete", { description: "Steam has been restarted." });
      loadLibrary(); // Refresh library
    } catch (e) {
      toast.error("Error", { description: String(e) });
    } finally {
      setIsDownloading(false);
      setCheckingAvailability(false);
      setDownloadProgress(null);
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateStatus("Checking for updates...");
    try {
      const release = await invoke<any>("check_for_updates");
      if (!release) {
        setUpdateRelease(null);
        setUpdateAvailable(false);
        setUpdateStatus("No releases found.");
        return;
      }

      const parsed = parseRelease(release);
      setUpdateRelease(parsed);
      const comparison = compareVersions(currentVersion, parsed.version);
      if (comparison < 0) {
        setUpdateAvailable(true);
        setUpdateStatus(`Update available: v${parsed.version}`);
      } else {
        setUpdateAvailable(false);
        setUpdateStatus("You're up to date.");
      }
    } catch (e) {
      setUpdateRelease(null);
      setUpdateAvailable(null);
      setUpdateStatus("Update check failed.");
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

  return (
    <div className="flex h-screen bg-background font-sans selection:bg-primary/20 overflow-hidden">
      <TitleBar query={query} onSearch={setQuery} />
      <Toaster position="top-center" />
      
      {/* Sidebar */}
      <div className="pt-10 h-full flex w-full">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

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
                    {query.length > 2 ? (
                      <div className="space-y-6">
                         <div className="flex items-center justify-between px-2">
                            <h2 className="text-xl font-semibold">Search Results for "{query}"</h2>
                         </div>
                         <GameGrid 
                          games={results} 
                          onSelect={handleGameSelect} 
                        />
                      </div>
                    ) : (
                      <StorePage 
                        onSelectGame={handleGameSelect}
                        selectedGame={null}
                        onDownload={handleDownload}
                        isDownloading={isDownloading}
                        checkingAvailability={checkingAvailability}
                        libraryGames={libraryGames}
                      />
                    )}
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
                   <h2 className="text-3xl font-bold tracking-tight">Active Downloads</h2>
                   {isDownloading || downloadProgress ? (
                     <DownloadStatus progress={downloadProgress} isDownloading={isDownloading} />
                   ) : (
                     <div className="text-center p-12 border border-dashed rounded-3xl text-muted-foreground">
                       No active downloads
                     </div>
                   )}
                </div>
             </div>
          )}

          {activeTab === "settings" && (
            <div className="h-full overflow-y-auto scrollbar-hide p-8 space-y-10 pb-24">
                <div className="max-w-xl mx-auto space-y-8">
                   <div className="space-y-2">
                     <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                     <p className="text-muted-foreground">Configure application preferences</p>
                   </div>
                   
                   <div className="space-y-4 p-6 border rounded-3xl bg-card">
                     <div className="space-y-2">
                       <label className="text-sm font-medium">Steam Installation Path</label>
                       <div className="flex gap-2">
                         <Input value={steamPath} onChange={(e) => setSteamPath(e.target.value)} />
                         <Button variant="outline" onClick={() => invoke("get_steam_path").then((p) => p && setSteamPath(p as string))}>
                           Detect
                         </Button>
                       </div>
                       <p className="text-xs text-muted-foreground">
                         This is usually C:\Program Files (x86)\Steam
                       </p>
                     </div>
                   </div>

                  <div className="space-y-4 p-6 border rounded-3xl bg-card">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold">Updates</h3>
                        <p className="text-sm text-muted-foreground">Current version: v{currentVersion}</p>
                      </div>
                      <Button onClick={checkForUpdates} disabled={checkingUpdates}>
                        {checkingUpdates ? "Checking..." : "Check for updates"}
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
                              Published {new Date(updateRelease.publishedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        {updateRelease.body && (
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {updateRelease.body}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button onClick={downloadUpdate}>Download update</Button>
                          <Button variant="outline" onClick={openReleasesPage}>
                            View releases
                          </Button>
                        </div>
                      </div>
                    )}
                    {updateAvailable === false && (
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={openReleasesPage}>
                          View releases
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
