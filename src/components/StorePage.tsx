import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { GameInfo } from "@/types";
import { GameGrid } from "./GameGrid";
import { Hero } from "./Hero";
import { useTranslation } from "react-i18next";

interface StorePageProps {
  onSelectGame: (game: GameInfo) => void;
  selectedGame: GameInfo | null;
  onDownload: (game: GameInfo) => void;
  isDownloading: boolean;
  checkingAvailability: boolean;
  libraryGames?: GameInfo[];
}

export function StorePage({ onSelectGame, selectedGame, onDownload, isDownloading, checkingAvailability, libraryGames = [] }: StorePageProps) {
  const { t } = useTranslation();
  const [featuredGames, setFeaturedGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeatured();
  }, []);

  async function loadFeatured() {
    const CACHE_KEY = "featured_games_cache";
    const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
    const curatedIds = [
      271590,
      1593500,
      2208920,
      1174180,
      1091500,
      1245620,
      1850570,
      292030,
      578080,
      730,
      440,
      570,
      620,
      252490,
      275850,
      553850,
      1172470,
      381210,
      359550,
      945360,
      1145360
    ];

    let curated: GameInfo[] = [];
    try {
      curated = await invoke<GameInfo[]>("get_game_briefs", { appIds: curatedIds });
    } catch (e) {
      console.warn("Failed to load curated games", e);
    }

    // Try loading from cache first
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          console.log("Loaded featured games from cache");
          const curatedSet = new Set(curated.map((g) => g.id));
          const merged = curated.length > 0 ? [...curated, ...data.filter((g: GameInfo) => !curatedSet.has(g.id))] : data;
          setFeaturedGames(merged);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to parse cache", e);
    }

    try {
      const games = await invoke<GameInfo[]>("get_featured_games");
      const curatedSet = new Set(curated.map((g) => g.id));
      const merged = curated.length > 0 ? [...curated, ...games.filter((g) => !curatedSet.has(g.id))] : games;
      setFeaturedGames(merged);
      
      // Save to cache
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: merged,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error("Failed to load featured games, using mock data", e);
      // Mock data for preview/fallback
      const mockData = [
        {
          id: 275850,
          name: "No Man's Sky",
          thumbnail: "https://cdn.cloudflare.steamstatic.com/steam/apps/275850/capsule_616x353.jpg",
          header_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/275850/header.jpg",
          library_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/275850/library_600x900.jpg",
          library_hero: "https://cdn.cloudflare.steamstatic.com/steam/apps/275850/library_hero.jpg"
        },
        {
          id: 553850,
          name: "HELLDIVERS™ 2",
          thumbnail: "https://cdn.cloudflare.steamstatic.com/steam/apps/553850/capsule_616x353.jpg",
          header_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/553850/header.jpg",
          library_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/553850/library_600x900.jpg",
          library_hero: "https://cdn.cloudflare.steamstatic.com/steam/apps/553850/library_hero.jpg"
        },
        {
          id: 686060,
          name: "Mewgenics",
          thumbnail: "https://cdn.cloudflare.steamstatic.com/steam/apps/686060/capsule_616x353.jpg",
          header_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/686060/header.jpg",
          library_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/686060/library_600x900.jpg",
          library_hero: "https://cdn.cloudflare.steamstatic.com/steam/apps/686060/library_hero.jpg"
        },
        {
          id: 1426210,
          name: "It Takes Two",
          thumbnail: "https://cdn.cloudflare.steamstatic.com/steam/apps/1426210/capsule_616x353.jpg",
          header_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1426210/header.jpg",
          library_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1426210/library_600x900.jpg",
          library_hero: "https://cdn.cloudflare.steamstatic.com/steam/apps/1426210/library_hero.jpg"
        },
        {
          id: 1808500,
          name: "ARC Raiders",
          thumbnail: "https://cdn.cloudflare.steamstatic.com/steam/apps/1808500/capsule_616x353.jpg",
          header_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1808500/header.jpg",
          library_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1808500/library_600x900.jpg",
          library_hero: "https://cdn.cloudflare.steamstatic.com/steam/apps/1808500/library_hero.jpg"
        },
        {
          id: 1850570,
          name: "DEATH STRANDING DIRECTOR'S CUT",
          thumbnail: "https://cdn.cloudflare.steamstatic.com/steam/apps/1850570/capsule_616x353.jpg",
          header_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1850570/header.jpg",
          library_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1850570/library_600x900.jpg",
          library_hero: "https://cdn.cloudflare.steamstatic.com/steam/apps/1850570/library_hero.jpg"
        },
        // Add more mock data to fill lists if needed
        {
          id: 1245620,
          name: "ELDEN RING",
          thumbnail: "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/capsule_616x353.jpg",
          header_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg",
          library_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/library_600x900.jpg",
          library_hero: "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/library_hero.jpg"
        },
         {
          id: 1091500,
          name: "Cyberpunk 2077",
          thumbnail: "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/capsule_616x353.jpg",
          header_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg",
          library_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/library_600x900.jpg",
          library_hero: "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/library_hero.jpg"
        },
         {
          id: 230410,
          name: "Warframe",
          thumbnail: "https://cdn.cloudflare.steamstatic.com/steam/apps/230410/capsule_616x353.jpg",
          header_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/230410/header.jpg",
          library_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/230410/library_600x900.jpg",
          library_hero: "https://cdn.cloudflare.steamstatic.com/steam/apps/230410/library_hero.jpg"
        },
         {
          id: 271590,
          name: "Grand Theft Auto V",
          thumbnail: "https://cdn.cloudflare.steamstatic.com/steam/apps/271590/capsule_616x353.jpg",
          header_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg",
          library_image: "https://cdn.cloudflare.steamstatic.com/steam/apps/271590/library_600x900.jpg",
          library_hero: "https://cdn.cloudflare.steamstatic.com/steam/apps/271590/library_hero.jpg"
        }
      ];
      const curatedSet = new Set(curated.map((g) => g.id));
      const merged = curated.length > 0 ? [...curated, ...mockData.filter((g) => !curatedSet.has(g.id))] : mockData;
      setFeaturedGames(merged);
      
      // Also cache mock data to test caching behavior
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: merged,
        timestamp: Date.now()
      }));
    } finally {
      setLoading(false);
    }
  }

  // Split games for different sections for visual variety
  // Note: This is a simplification. Ideally backend should return categorized lists.
  const heroGame = selectedGame || featuredGames[0] || null;
  const SECTION_SIZE = 14;
  const blockedTerms = ["hentai", "sex", "porn", "erotic", "nude", "nsfw", "18+"];
  const filteredFeatured = featuredGames.filter((g) => {
    const lower = g.name?.toLowerCase() || "";
    return !blockedTerms.some((term) => lower.includes(term));
  });
  const topSellerIds = [
    730,
    570,
    440,
    271590,
    1245620,
    1091500,
    1174180,
    292030,
    578080,
    1172470,
    381210,
    620,
    252490,
    275850,
    553850,
    1593500,
    2208920,
    1850570,
    359550,
    945360,
    1145360
  ];
  const topSellerSet = new Set(topSellerIds);
  const topSellerPriority = topSellerIds
    .map((id) => filteredFeatured.find((g) => g.id === id))
    .filter(Boolean) as GameInfo[];
  const topSellerSource = [
    ...topSellerPriority,
    ...filteredFeatured.filter((g) => !topSellerSet.has(g.id))
  ];
  const topSellers = topSellerSource.slice(0, SECTION_SIZE);
  const topSellerIdsInUse = new Set(topSellers.map((g) => g.id));
  const trendingGames = filteredFeatured
    .filter((g) => !topSellerIdsInUse.has(g.id))
    .slice(0, SECTION_SIZE);
  const trendingIdsInUse = new Set(trendingGames.map((g) => g.id));
  const newReleases = filteredFeatured
    .filter((g) => !topSellerIdsInUse.has(g.id) && !trendingIdsInUse.has(g.id))
    .slice(0, SECTION_SIZE);

  if (loading) {
    return (
      <div className="space-y-12 pb-12 max-w-[1600px] mx-auto">
        <div className="relative w-full h-[50vh] min-h-[400px] rounded-3xl bg-muted/60 animate-pulse" />
        {Array.from({ length: 3 }).map((_, sectionIndex) => (
          <section key={sectionIndex} className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="h-6 w-48 bg-muted rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
              {Array.from({ length: 7 }).map((_, cardIndex) => (
                <div key={cardIndex} className="flex flex-col gap-3">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted animate-pulse" />
                  <div className="space-y-2 px-1">
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-12 max-w-[1600px] mx-auto">
      <Hero 
        game={heroGame} 
        onDownload={() => heroGame && onDownload(heroGame)}
        onSelect={onSelectGame}
        isDownloading={isDownloading}
        checkingAvailability={checkingAvailability}
        isInstalled={heroGame ? libraryGames.some(g => g.id === heroGame.id) : false}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-bold tracking-tight">{t("trending_now")}</h2>
        </div>
        <GameGrid games={trendingGames} onSelect={onSelectGame} selectedId={selectedGame?.id} maxRows={2} />
      </section>

      {newReleases.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold tracking-tight">{t("new_releases")}</h2>
          </div>
          <GameGrid games={newReleases} onSelect={onSelectGame} selectedId={selectedGame?.id} maxRows={2} />
        </section>
      )}

      {topSellers.length > 0 && (
        <section className="space-y-4">
           <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold tracking-tight">{t("top_sellers")}</h2>
          </div>
          <GameGrid games={topSellers} onSelect={onSelectGame} selectedId={selectedGame?.id} maxRows={2} />
        </section>
      )}
    </div>
  );
}
