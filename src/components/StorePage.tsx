import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { GameInfo } from "@/types";
import { GameGrid } from "./GameGrid";
import { Hero } from "./Hero";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface StorePageProps {
  onSelectGame: (game: GameInfo) => void;
  selectedGame: GameInfo | null;
  onDownload: (game: GameInfo) => void;
  isDownloading: boolean;
  checkingAvailability: boolean;
  libraryGames?: GameInfo[];
}

export function StorePage({ onSelectGame, selectedGame, onDownload, isDownloading, checkingAvailability, libraryGames = [] }: StorePageProps) {
  const [featuredGames, setFeaturedGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewSection, setViewSection] = useState<string | null>(null);

  useEffect(() => {
    loadFeatured();
  }, []);

  async function loadFeatured() {
    try {
      const games = await invoke<GameInfo[]>("get_featured_games");
      setFeaturedGames(games);
    } catch (e) {
      console.error("Failed to load featured games", e);
    } finally {
      setLoading(false);
    }
  }

  // Split games for different sections for visual variety
  // Note: This is a simplification. Ideally backend should return categorized lists.
  const heroGame = selectedGame || featuredGames[0] || null;
  const trendingGames = featuredGames.slice(0, 10);
  const newReleases = featuredGames.slice(10, 20);
  const topSellers = featuredGames.slice(20, 30);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading Store...
      </div>
    );
  }

  // View All Section
  if (viewSection) {
    let sectionGames: GameInfo[] = [];
    let sectionTitle = "";

    switch (viewSection) {
      case "trending":
        sectionGames = trendingGames;
        sectionTitle = "Trending Now";
        break;
      case "new":
        sectionGames = newReleases;
        sectionTitle = "New Releases";
        break;
      case "top":
        sectionGames = topSellers;
        sectionTitle = "Top Sellers";
        break;
    }

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setViewSection(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">{sectionTitle}</h2>
        </div>
        <GameGrid games={sectionGames} onSelect={onSelectGame} selectedId={selectedGame?.id} />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-12">
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
          <h2 className="text-2xl font-bold tracking-tight">Trending Now</h2>
          <Button variant="ghost" size="sm" onClick={() => setViewSection("trending")}>View All</Button>
        </div>
        <GameGrid games={trendingGames} onSelect={onSelectGame} selectedId={selectedGame?.id} />
      </section>

      {newReleases.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold tracking-tight">New Releases</h2>
            <Button variant="ghost" size="sm" onClick={() => setViewSection("new")}>View All</Button>
          </div>
          <GameGrid games={newReleases} onSelect={onSelectGame} selectedId={selectedGame?.id} />
        </section>
      )}

      {topSellers.length > 0 && (
        <section className="space-y-4">
           <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold tracking-tight">Top Sellers</h2>
            <Button variant="ghost" size="sm" onClick={() => setViewSection("top")}>View All</Button>
          </div>
          <GameGrid games={topSellers} onSelect={onSelectGame} selectedId={selectedGame?.id} />
        </section>
      )}
    </div>
  );
}
