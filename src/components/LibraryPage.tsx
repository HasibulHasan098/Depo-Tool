import { GameInfo } from "@/types";
import { GameGrid } from "./GameGrid";
import { useTranslation } from "react-i18next";

interface LibraryPageProps {
  games: GameInfo[];
  onSelectGame: (game: GameInfo) => void;
  onRemoveGame: (gameId: number) => void;
}

export function LibraryPage({ games, onSelectGame, onRemoveGame }: LibraryPageProps) {
  const { t } = useTranslation();

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 text-muted-foreground">
        <p className="text-lg">{t("no_games_installed")}</p>
        <p className="text-sm">{t("downloaded_games_hint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight px-2">{t("my_library")}</h2>
      <GameGrid  
        games={games} 
        onSelect={onSelectGame} 
        onRemove={onRemoveGame}
      />
    </div>
  );
}
