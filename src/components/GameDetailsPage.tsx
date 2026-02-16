import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { GameInfo, GameDetails } from "@/types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Download, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GameDetailsPageProps {
  game: GameInfo;
  onBack: () => void;
  onDownload: () => void;
  onRemove?: () => void;
  isInstalled?: boolean;
  isDownloading: boolean;
  checkingAvailability: boolean;
}

export function GameDetailsPage({ game, onBack, onDownload, onRemove, isInstalled, isDownloading, checkingAvailability }: GameDetailsPageProps) {
  const { t } = useTranslation();
  const [details, setDetails] = useState<GameDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMedia, setActiveMedia] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    invoke<GameDetails>("get_game_details", { gameId: game.id })
      .then((d) => {
        setDetails(d);
        if (d.movies.length > 0) setActiveMedia(d.movies[0]);
        else if (d.screenshots.length > 0) setActiveMedia(d.screenshots[0]);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [game]);

  const isVideo = (url: string) => url?.includes(".mp4") || url?.includes(".webm");

  return (
    <div className="flex flex-col h-full w-full bg-background animate-in fade-in duration-300 overflow-y-auto scrollbar-hide">
      
      {/* Hero Header */}
      <div className="relative w-full h-[50vh] min-h-[400px]">
        {/* Back Button */}
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 z-30 flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>{t("back_to_store")}</span>
        </button>

        {/* Media Background */}
        <div className="absolute inset-0 bg-black">
           {activeMedia ? (
              isVideo(activeMedia) ? (
                <video 
                  src={activeMedia} 
                  className="w-full h-full object-cover opacity-80" 
                  autoPlay 
                  loop 
                  muted
                />
              ) : (
                <img 
                  src={activeMedia} 
                  alt="Game Media" 
                  className="w-full h-full object-cover opacity-80"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )
           ) : (
              <img 
                src={game.library_hero} 
                alt={game.name} 
                className="w-full h-full object-cover opacity-50"
                onError={(e) => {
                   const target = e.currentTarget;
                   if (target.src === game.library_hero) {
                      target.src = game.header_image;
                   } else if (target.src === game.header_image) {
                      target.src = game.thumbnail;
                   } else {
                      target.style.display = 'none';
                   }
                }}
              />
           )}
           <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
        </div>

        {/* Title & Action */}
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 space-y-6">
           <div className="container mx-auto max-w-6xl">
             <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-2xl mb-4">{game.name}</h1>
             <div className="flex items-center gap-4">
               {isInstalled ? (
                 <>
                   <Button 
                      size="lg" 
                      className="rounded-full px-8 py-6 text-lg gap-3 shadow-2xl bg-green-600 hover:bg-green-700 text-white"
                      disabled
                    >
                      <Play className="w-6 h-6 fill-current" />
                      {t("installed")}
                    </Button>
                    {onRemove && (
                      <Button 
                        size="lg" 
                        variant="destructive"
                        onClick={onRemove}
                        className="rounded-full px-8 py-6 text-lg gap-3 shadow-2xl"
                      >
                        <Trash2 className="w-6 h-6" />
                        {t("uninstall")}
                      </Button>
                    )}
                 </>
               ) : (
                 <Button 
                    size="lg" 
                    onClick={onDownload}
                    disabled={isDownloading || checkingAvailability}
                    className="rounded-full px-8 py-6 text-lg gap-3 shadow-2xl bg-primary hover:bg-primary/90"
                  >
                    <Download className="w-6 h-6" />
                    {checkingAvailability ? t("checking") : isDownloading ? t("installing") : t("download_now")}
                  </Button>
               )}
             </div>
           </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto max-w-6xl p-8 md:p-12 grid grid-cols-1 lg:grid-cols-3 gap-12 pb-32">
        
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-10 min-w-0">
          
          {/* About */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight border-l-4 border-primary pl-4">{t("about_this_game")}</h2>
            {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-5/6"></div>
                <div className="h-4 bg-muted rounded w-4/6"></div>
              </div>
            ) : details ? (
              <div 
                className="prose prose-invert max-w-none text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: details.detailed_description }}
              />
            ) : (
              <p className="text-muted-foreground">{t("failed_load_description")}</p>
            )}
          </section>

          {/* System Requirements */}
          {details?.pc_requirements && (
             <section className="space-y-6 pt-6 border-t border-border/50">
               <h2 className="text-2xl font-bold tracking-tight border-l-4 border-primary pl-4">{t("system_requirements")}</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {details.pc_requirements.minimum && (
                    <div className="bg-card/50 p-6 rounded-2xl border border-border/50">
                      <h3 className="text-lg font-semibold mb-4 text-primary">{t("minimum")}</h3>
                      <div 
                        className="text-sm text-muted-foreground space-y-2 [&>ul]:list-disc [&>ul]:pl-4 [&>strong]:text-foreground"
                        dangerouslySetInnerHTML={{ __html: details.pc_requirements.minimum }} 
                      />
                    </div>
                  )}
                  {details.pc_requirements.recommended && (
                    <div className="bg-card/50 p-6 rounded-2xl border border-border/50">
                      <h3 className="text-lg font-semibold mb-4 text-primary">{t("recommended")}</h3>
                      <div 
                        className="text-sm text-muted-foreground space-y-2 [&>ul]:list-disc [&>ul]:pl-4 [&>strong]:text-foreground"
                        dangerouslySetInnerHTML={{ __html: details.pc_requirements.recommended }} 
                      />
                    </div>
                  )}
               </div>
             </section>
          )}
        </div>

        {/* Sidebar Column */}
        <div className="space-y-8">
           {/* Media Gallery Grid */}
           {details && (details.movies.length > 0 || details.screenshots.length > 0) && (
             <section className="space-y-4">
               <h3 className="font-semibold text-lg">{t("media_gallery")}</h3>
               <div className="grid grid-cols-2 gap-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
                 {details.movies.map((mov, i) => (
                   <div 
                     key={`mov-side-${i}`}
                     onClick={() => setActiveMedia(mov)}
                     className="aspect-video rounded-lg overflow-hidden cursor-pointer relative group border border-transparent hover:border-primary transition-all bg-black"
                   >
                     <video src={mov} className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" />
                     <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/50 rounded-full p-2 group-hover:bg-primary transition-colors">
                            <Play className="w-5 h-5 text-white fill-current" />
                        </div>
                     </div>
                   </div>
                 ))}
                 {details.screenshots.map((scr, i) => (
                   <div 
                     key={`scr-side-${i}`}
                     onClick={() => setActiveMedia(scr)}
                     className="aspect-video rounded-lg overflow-hidden cursor-pointer border border-transparent hover:border-primary transition-all"
                   >
                     <img src={scr} alt="Screenshot" className="w-full h-full object-cover" />
                   </div>
                 ))}
               </div>
             </section>
           )}

           {/* Info Card */}
           <div className="bg-card p-6 rounded-2xl border space-y-4 shadow-sm">
             <h3 className="font-semibold text-lg border-b pb-2">{t("game_info")}</h3>
             <div className="space-y-3 text-sm">
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">{t("app_id")}</span>
                 <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">{game.id}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">{t("platform")}</span>
                 <span>{t("windows")}</span>
               </div>
               {/* Add more metadata if available */}
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}
