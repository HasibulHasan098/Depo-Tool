import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GameInfo } from "@/types";
import { Search as SearchIcon } from "lucide-react";

interface SearchProps {
  onSelect: (game: GameInfo) => void;
}

export function Search({ onSelect }: SearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 2) {
        performSearch(query);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  async function performSearch(q: string) {
    setLoading(true);
    try {
      const games = await invoke<GameInfo[]>("search_games", { query: q });
      setResults(games);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search game by name or ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button onClick={() => performSearch(query)} disabled={loading}>
          {loading ? "Searching..." : <SearchIcon className="w-4 h-4" />}
        </Button>
      </div>
      
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto p-2 border rounded-md bg-background/50 backdrop-blur-sm">
          {results.map((game) => (
            <div
              key={game.id}
              className="flex items-center gap-3 p-2 hover:bg-accent rounded-md cursor-pointer transition-colors"
              onClick={() => onSelect(game)}
            >
              <img src={game.thumbnail} alt={game.name} className="w-12 h-12 object-cover rounded" />
              <div className="overflow-hidden">
                <p className="font-medium truncate text-sm" title={game.name}>{game.name}</p>
                <p className="text-xs text-muted-foreground">ID: {game.id}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
