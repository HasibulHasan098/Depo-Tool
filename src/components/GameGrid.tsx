import { useEffect, useMemo, useState } from "react";
import { GameInfo } from "@/types";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GameGridProps {
  games: GameInfo[];
  onSelect: (game: GameInfo) => void;
  selectedId?: number;
  onRemove?: (gameId: number) => void;
  maxRows?: number;
}

export function GameGrid({ games, onSelect, selectedId, onRemove, maxRows }: GameGridProps) {
  const [columns, setColumns] = useState(2);

  useEffect(() => {
    const getColumns = (width: number) => {
      if (width >= 1536) return 7;
      if (width >= 1280) return 6;
      if (width >= 1024) return 5;
      if (width >= 768) return 4;
      return 2;
    };

    const updateColumns = () => setColumns(getColumns(window.innerWidth));
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  const visibleGames = useMemo(() => {
    if (!maxRows) return games;
    const limit = columns * maxRows;
    return games.slice(0, limit);
  }, [games, maxRows, columns]);

  if (visibleGames.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
        {visibleGames.map((game) => (
          <div
            key={game.id}
            onClick={() => onSelect(game)}
            className={cn(
              "group relative flex flex-col gap-3 cursor-pointer",
              selectedId === game.id ? "opacity-100" : "hover:opacity-90"
            )}
          >
            <div className={cn(
                "relative aspect-[2/3] overflow-hidden rounded-xl shadow-sm",
                selectedId === game.id ? "ring-2 ring-primary shadow-xl shadow-primary/20" : "group-hover:shadow-md"
            )}>
              <img
                src={game.library_image}
                alt={game.name}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  // Fallback to thumbnail if library image fails (rare but possible)
                  e.currentTarget.src = game.thumbnail;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              
              {/* Remove Button (Only if onRemove provided) */}
              {onRemove && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Button
                     variant="destructive"
                     size="icon"
                     className="h-8 w-8 rounded-full shadow-lg"
                     onClick={(e) => {
                       e.stopPropagation();
                       onRemove(game.id);
                     }}
                   >
                     <Trash2 className="w-4 h-4" />
                   </Button>
                </div>
              )}
            </div>
            
            <div className="space-y-1 px-1">
              <h4 className={cn(
                  "font-medium leading-tight line-clamp-1 transition-colors",
                  selectedId === game.id ? "text-primary" : "group-hover:text-primary"
              )} title={game.name}>
                {game.name}
              </h4>
              <p className="text-xs text-muted-foreground">{game.id}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
