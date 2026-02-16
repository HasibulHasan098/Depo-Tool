import { Button } from "@/components/ui/button";
import { GameInfo } from "@/types";
import { Play, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HeroProps {
  game: GameInfo | null;
  onDownload: () => void;
  onSelect: (game: GameInfo) => void;
  isDownloading: boolean;
  checkingAvailability: boolean;
  isInstalled?: boolean;
}

export function Hero({ game, onDownload, onSelect, isDownloading, checkingAvailability, isInstalled }: HeroProps) {
  const { t } = useTranslation();

  if (!game) {
    return (
      <div className="w-full h-[500px] rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-background flex items-center justify-center border border-muted/20 relative overflow-hidden group">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10" />
        <div className="text-center z-10 space-y-4 max-w-lg p-6">
          <h2 className="text-4xl font-bold tracking-tight">{t("discover_next_game")}</h2>
          <p className="text-muted-foreground text-lg">
            {t("discover_hint")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[380px] rounded-3xl relative overflow-hidden group shadow-lg bg-muted">
      {/* Background Image with Fallback */}
      <img 
        src={game.library_hero}
        alt={game.name}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        onError={(e) => {
          const target = e.currentTarget;
          // Try header_image if library_hero fails
          if (target.src === game.library_hero) {
            target.src = game.header_image;
          } 
          // Try thumbnail if header_image fails
          else if (target.src === game.header_image) {
            target.src = game.thumbnail;
          }
          // Hide image if all fail (shows background color)
          else {
            target.style.display = 'none';
          }
        }}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
      
      <div className="absolute bottom-0 left-0 p-8 space-y-4 max-w-2xl">
        <div className="space-y-2">
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              {t("featured")}
            </span>
            <h2 className="text-4xl font-bold tracking-tight text-foreground drop-shadow-md">
            {game.name}
            </h2>
            <p className="text-muted-foreground font-mono text-sm">{t("app_id")}: {game.id}</p>
        </div>

        <div className="flex gap-4 pt-2">
          {isInstalled ? (
             <Button 
                size="default" 
                className="rounded-full px-6 gap-2 font-semibold shadow-lg bg-green-600 hover:bg-green-700 text-white cursor-default"
                disabled
              >
                <Play className="w-4 h-4 fill-current" />
                {t("installed")}
              </Button>
          ) : (
             <Button 
                size="default" 
                className="rounded-full px-6 gap-2 font-semibold shadow-lg shadow-primary/20"
                onClick={onDownload}
                disabled={isDownloading || checkingAvailability}
              >
                <Play className="w-4 h-4 fill-current" />
                {checkingAvailability ? t("checking") : isDownloading ? t("installing") : t("download_now")}
              </Button>
          )}
          <Button 
            variant="secondary"  
            size="default" 
            className="rounded-full px-6 gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border-white/10 text-foreground"
            onClick={() => onSelect(game)}
          >
            <Info className="w-4 h-4" />
            {t("details")}
          </Button>
        </div>
      </div>
    </div>
  );
}
