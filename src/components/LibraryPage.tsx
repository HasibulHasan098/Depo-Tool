import { GameInfo } from "@/types";
import { GameGrid } from "./GameGrid";

interface LibraryPageProps {
  games: GameInfo[];
  onSelectGame: (game: GameInfo) => void;
  onRemoveGame: (gameId: number) => void;
}

export function LibraryPage({ games, onSelectGame, onRemoveGame }: LibraryPageProps) {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 text-muted-foreground">
        <p className="text-lg">No games installed yet.</p>
        <p className="text-sm">Downloaded games will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight px-2">My Library</h2>
      <GameGrid 
        games={games} 
        onSelect={onSelectGame} 
        onRemove={onRemoveGame}
      />
    </div>
  );
}
