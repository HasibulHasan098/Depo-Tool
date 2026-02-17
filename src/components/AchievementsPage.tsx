import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

export function AchievementsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [fileSize, setFileSize] = useState<string | null>(null);

  const TOOL_URL = "https://api.luagen.revobd.club/EXTERNAL/SAM.zip";

  const checkStatus = async () => {
    try {
      const isInstalled = await invoke("check_external_tool_status", { toolName: "SAM.Picker.exe" });
      setInstalled(isInstalled as boolean);

      if (!isInstalled) {
          try {
              const size = await invoke("get_url_file_size", { url: TOOL_URL });
              setFileSize(size as string);
          } catch (e) {
              console.error("Failed to get file size", e);
          }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleAction = async () => {
    setLoading(true);
    try {
      if (installed) {
        toast.info("SAM Picker is running");
        await invoke("launch_sam_picker");
      } else {
        toast.info("Downloading SAM Picker...");
        await invoke("install_external_tool", { 
          url: TOOL_URL,
          subfolder: null
        });
        toast.success("Installed successfully");
        await checkStatus();
      }
    } catch (e) {
      const message = String(e);
      if (message.includes("ELEVATION_REQUESTED")) {
        toast.info(t("admin_required_title"), { description: t("admin_required_desc") });
      } else {
        toast.error(installed ? "Failed to launch" : "Failed to install");
      }
      console.error(e);
    } finally {
      setLoading(false);
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
            onClick={handleAction} 
            disabled={loading || checking}
            className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 min-w-[150px]"
          >
            {loading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {installed ? t("running") : "Installing..."}
                </>
            ) : checking ? (
                "Checking..."
            ) : installed ? (
                t("launch_sam_picker")
            ) : (
                fileSize ? `Install (${fileSize})` : "Install"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
