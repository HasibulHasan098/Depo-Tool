import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import onlineGamesData from "@/data/online-games.json";
import { toast } from "sonner";
import { DownloadProgress, GameInfo } from "@/types";
import { useTranslation } from "react-i18next";

interface OnlineGame {
  appid: number;
  link: string;
}

export function OnlineFixPage() {
  const { t } = useTranslation();
  const [games, setGames] = useState<OnlineGame[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [localPaths, setLocalPaths] = useState<Record<number, string>>({});
  const [metadata, setMetadata] = useState<Record<number, { name: string; thumbnail: string }>>({});
  const [searchIds, setSearchIds] = useState<number[] | null>(null);
  const [installingId, setInstallingId] = useState<number | null>(null);
  const [installProgress, setInstallProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    // Force a reload if we see many failures or on explicit user action?
    // For now just standard load
    loadGames();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  useEffect(() => {
    if (!debouncedQuery) {
      setSearchIds(null);
      return;
    }
    const numeric = /^[0-9]+$/.test(debouncedQuery);
    if (numeric) {
      setSearchIds(null);
      return;
    }
    let cancelled = false;
    invoke<GameInfo[]>("search_games", { query: debouncedQuery })
      .then((results) => {
        if (cancelled) return;
        const ids = results.map((r) => r.id);
        setSearchIds(ids);
        if (results.length > 0) {
          setMetadata((prev) => {
            const next = { ...prev };
            for (const item of results) {
              next[item.id] = { name: item.name, thumbnail: item.thumbnail };
            }
            return next;
          });
        }
      })
      .catch(() => {
        if (!cancelled) setSearchIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const filteredGames = useMemo(() => {
    if (!debouncedQuery) return games;
    const lower = debouncedQuery.toLowerCase();
    const numeric = /^[0-9]+$/.test(lower);
    if (!numeric && searchIds) {
      const idSet = new Set(searchIds);
      return games.filter((g) => idSet.has(g.appid));
    }
    return games.filter((g) => {
      if (g.appid.toString().includes(lower)) return true;
      const name = metadata[g.appid]?.name;
      return name ? name.toLowerCase().includes(lower) : false;
    });
  }, [games, debouncedQuery, metadata, searchIds]);

  const totalPages = Math.max(1, Math.ceil(filteredGames.length / ITEMS_PER_PAGE));
  const displayedGames = useMemo(
    () => filteredGames.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [filteredGames, page]
  );

  const missingIds = useMemo(() => {
    const ids = displayedGames.map((g) => g.appid);
    return ids.filter((id) => !metadata[id]);
  }, [displayedGames, metadata]);

  useEffect(() => {
    if (missingIds.length === 0) return;
    let cancelled = false;
    invoke<GameInfo[]>("get_game_briefs", { appIds: missingIds })
      .then((results) => {
        if (cancelled || !results || results.length === 0) return;
        setMetadata((prev) => {
          const next = { ...prev };
          for (const item of results) {
            next[item.id] = { name: item.name, thumbnail: item.thumbnail };
          }
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [missingIds]);
  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  useEffect(() => {
    let unlisten: Promise<() => void> | null = null;
    if (installingId !== null) {
      unlisten = listen<any>("download-progress", (event) => {
        const payload = event.payload || {};
        setInstallProgress({
          percentage: typeof payload.percentage === "number" ? payload.percentage : 0,
          speed_mbps: typeof payload.speed_mbps === "number" ? payload.speed_mbps : 0,
          time_remaining_sec: typeof payload.time_remaining_sec === "number" ? payload.time_remaining_sec : 0,
          downloaded_bytes: typeof payload.downloaded_bytes === "number" ? payload.downloaded_bytes : 0,
          total_bytes: typeof payload.total_bytes === "number" ? payload.total_bytes : 0,
        });
      });
    }
    return () => {
      if (unlisten) {
        unlisten.then((f) => f());
      }
    };
  }, [installingId]);

  async function loadGames() {
    // Build base list from JSON
    setGames(onlineGamesData as OnlineGame[]);
    setLoading(false);
  }

  const handleBrowse = async (appid: number) => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("select_game_folder"),
      });

      if (selected && typeof selected === "string") {
        setLocalPaths((prev) => ({ ...prev, [appid]: selected }));
      } else if (selected && Array.isArray(selected) && selected.length > 0) {
        setLocalPaths((prev) => ({ ...prev, [appid]: selected[0] }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDetect = async (game: OnlineGame) => {
     try {
         toast.info(`Detecting Game ${game.appid} in Steam folder...`);
         const detectedPath = await invoke<string | null>("find_game_install_path", { appId: game.appid });
         
         if (detectedPath) {
             setLocalPaths((prev) => ({ ...prev, [game.appid]: detectedPath }));
             toast.success(`Found game in: ${detectedPath}`);
         } else {
             toast.error("No game path found in steam folder");
         }
     } catch (e) {
         console.error("Detection failed", e);
         toast.error("Failed to detect game path");
     }
  };

  const handleOnlineFix = async (game: OnlineGame) => {
      const localPath = localPaths[game.appid];
      if (!localPath) {
          toast.error("Please select a folder first");
          return;
      }
      
      const toastId = toast.loading(`Installing Online Fix for Game ${game.appid}...`);
      setInstallingId(game.appid);
      setInstallProgress(null);
      
      try {
          // Use the link from the JSON data
          await invoke("install_online_fix", { 
              gameId: game.appid.toString(), 
              installDir: localPath,
              downloadUrl: game.link 
          });
          toast.success("Online Fix installed successfully!", { id: toastId });
      } catch (e) {
          if (String(e) === "ELEVATION_REQUESTED") {
              toast.info(t("admin_required_title"), { description: t("admin_required_desc"), id: toastId });
          } else {
              console.error("Installation failed", e);
              toast.error(`Installation failed: ${e}`, { id: toastId });
          }
      } finally {
          setInstallingId(null);
      }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading Online Fix...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
        {/* Header Section */}
        <div className="p-8 pb-4 space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{t("online_fix")}</h1>
            <p className="text-muted-foreground">{t("select_game_folder")}</p>
            
            {/* Local Search for this page */}
            <div className="relative max-w-md mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                    placeholder={t("search_online_fix_placeholder")} 
                    className="pl-9 bg-secondary/50 border-transparent rounded-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </div>

        {/* List Section */}
        <div 
            className="flex-1 p-8 pt-0 space-y-4 pb-8"
        >
            {displayedGames.map((game) => {
                const meta = metadata[game.appid];
                const name = meta?.name || "";
                const thumbnail = meta?.thumbnail;
                const isLoaded = Boolean(meta?.name);
                return (
                <div key={game.appid} className="flex items-center gap-4 p-4 border rounded-xl bg-card hover:bg-accent/50 transition-colors">
                    <div className="w-16 h-20 bg-muted rounded-md overflow-hidden flex-shrink-0">
                        {thumbnail ? (
                            <img src={thumbnail} alt={name} className="w-full h-full object-cover" />
                        ) : (
                            <div className={`w-full h-full ${isLoaded ? "flex items-center justify-center text-xs text-muted-foreground" : "bg-muted animate-pulse"}`}>
                                {isLoaded ? "?" : null}
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="w-48 flex-shrink-0">
                        {isLoaded ? (
                            <>
                                <div className="font-bold text-lg truncate" title={name}>{name}</div>
                                <div className="text-xs text-muted-foreground">ID: {game.appid}</div>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <div className="h-5 w-32 bg-muted rounded animate-pulse"></div>
                                <div className="h-3 w-20 bg-muted rounded animate-pulse"></div>
                            </div>
                        )}
                    </div>

                    {/* Path Input */}
                    <div className="flex-1 flex items-center gap-2">
                        <div className="relative flex-1">
                             <Input 
                                value={localPaths[game.appid] || ""} 
                                onChange={(e) => {
                                    const newVal = e.target.value;
                                    setLocalPaths((prev) => ({ ...prev, [game.appid]: newVal }));
                                }}
                                placeholder="C:\\Games\\SomeGame" 
                                className="pr-10 bg-background/50"
                             />
                        </div>
                        <Button variant="outline" size="icon" onClick={() => handleBrowse(game.appid)}>
                            <Folder className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={() => handleDetect(game)}>
                            {t("detect")}
                        </Button>
                        {installingId === game.appid ? (
                          <Button 
                            className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                            disabled
                          >
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t("installing_percent", { percent: (installProgress?.percentage ?? 0).toFixed(0) })}
                          </Button>
                        ) : (
                          <Button 
                              className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                              onClick={() => handleOnlineFix(game)}
                          >
                              {t("install_online_fix_button")}
                          </Button>
                        )}
                    </div>
                    {installingId === game.appid && installProgress && (
                      <div className="text-xs text-muted-foreground">
                        {t("speed_label")}: {installProgress.speed_mbps.toFixed(2)} MB/s · {t("remaining_label")}: {installProgress.time_remaining_sec > 60 ? `${Math.ceil(installProgress.time_remaining_sec / 60)} ${t("minutes_short")}` : `${installProgress.time_remaining_sec} ${t("seconds_short")}`}
                      </div>
                    )}
                </div>
            );
            })}
            
            {filteredGames.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    {t("no_games_found", { query: searchQuery })}
                </div>
            )}

            {filteredGames.length > 0 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={goPrev} disabled={page <= 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-sm">{t("page_of", { current: page, total: totalPages })}</div>
                <Button variant="outline" size="sm" onClick={goNext} disabled={page >= totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
        </div>
    </div>
  );
}
