import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function AchievementsPage() {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);

  const launchSam = async () => {
    setRunning(true);
    try {
      toast.info("SAM Picker is running");
      await invoke("launch_sam_picker");
    } catch (e) {
      toast.error("Failed to launch SAM Picker");
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <div className="text-xl font-semibold tracking-tight">{t("achievements_manager")}</div>
          <div className="text-sm text-muted-foreground">
            {t("external_tool_hint")}
          </div>
        </div>
        <div className="mt-6 flex justify-center">
          <Button 
            onClick={launchSam} 
            disabled={running}
            className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            {running ? t("running") : t("launch_sam_picker")}
          </Button>
        </div>
      </div>
    </div>
  );
}
