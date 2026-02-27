import { Button } from "@/components/ui/button";
import { Github, Heart, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";

export function OnlineFixPage() {
  const { t } = useTranslation();

  const handleContribute = async () => {
    try {
      await openUrl("https://github.com/HasibulHasan098/Depo-Tool");
    } catch (error) {
      console.error("Failed to open URL:", error);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-primary/10 rounded-full">
            <Users className="w-16 h-16 text-primary" />
          </div>
        </div>

        <h1 className="text-4xl font-bold tracking-tight">{t("online_fix")}</h1>
        
        <div className="space-y-4 text-lg text-muted-foreground">
          <p>
            We need contributors who can help provide Online Fix APIs or servers to grow our community!
          </p>
          <p>
            If you have access to Online Fix resources or can help set up distribution servers, 
            your contribution would be invaluable to the community.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
          <Button 
            size="lg"
            className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
            onClick={handleContribute}
          >
            <Github className="w-5 h-5 mr-2" />
            Contribute on GitHub
          </Button>
          
          <Button 
            size="lg"
            variant="outline"
            onClick={handleContribute}
          >
            <Heart className="w-5 h-5 mr-2" />
            Support the Project
          </Button>
        </div>

        <div className="pt-8 text-sm text-muted-foreground">
          <p>Join us in making gaming more accessible for everyone!</p>
        </div>
      </div>
    </div>
  );
}
