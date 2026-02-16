import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

export function GameFixPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [fileSize, setFileSize] = useState<string | null>(null);

  const TOOL_URL = "https://api.luagen.revobd.club/EXTERNAL/CW1.zip";

  const checkStatus = async () => {
    try {
      const installed1 = await invoke("check_external_tool_status", { toolName: "CW/CrackWorld Library.exe" });
      const installed2 = await invoke("check_external_tool_status", { toolName: "CrackWorld Library.exe" });
      const isInstalled = installed1 || installed2;
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
        toast.info("CrackWorld Library is running");
        await invoke("launch_cw");
      } else {
        toast.info("Downloading CrackWorld Library...");
        await invoke("install_external_tool", { 
          url: TOOL_URL,
          subfolder: "CW"
        });
        toast.success("Installed successfully");
        await checkStatus();
      }
    } catch (e) {
      toast.error(installed ? "Failed to launch" : "Failed to install");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-8 shadow-sm">
        <div className="space-y-3 text-center">
          <div className="text-xl font-semibold tracking-tight">{t("game_fix")}</div>
          <div className="text-sm text-muted-foreground">
            {t("game_fix_credit")}
          </div>
          <div className="text-xs text-muted-foreground">
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
                t("launch_cw_library")
            ) : (
                fileSize ? `Install (${fileSize})` : "Install"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
