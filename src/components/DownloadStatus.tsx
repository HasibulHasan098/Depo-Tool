import { DownloadProgress } from "@/types";
import { Progress } from "@/components/ui/progress";

interface DownloadStatusProps {
  progress: DownloadProgress | null;
  isDownloading: boolean;
}

export function DownloadStatus({ progress, isDownloading }: DownloadStatusProps) {
  if (!isDownloading || !progress) return null;

  return (
    <div className="space-y-2 w-full max-w-2xl mx-auto p-4 border rounded-md bg-card shadow-sm">
      <div className="flex justify-between text-sm font-medium">
        <span>Downloading...</span>
        <span>{progress.percentage.toFixed(1)}%</span>
      </div>
      <Progress value={progress.percentage} />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{progress.speed_mbps.toFixed(2)} MB/s</span>
        <span>{progress.time_remaining_sec > 60 ? `${Math.ceil(progress.time_remaining_sec / 60)} min` : `${progress.time_remaining_sec} sec`} remaining</span>
      </div>
    </div>
  );
}
