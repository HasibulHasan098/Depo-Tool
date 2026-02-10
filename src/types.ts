export interface GameInfo {
  id: number;
  name: string;
  thumbnail: string;
  header_image: string;
  library_image: string;
  library_hero: string;
}

export interface GameDetails {
  short_description: string;
  detailed_description: string;
  screenshots: string[];
  movies: string[];
  pc_requirements?: {
    minimum?: string;
    recommended?: string;
  };
}

export interface DownloadProgress {
  percentage: number;
  speed_mbps: number;
  time_remaining_sec: number;
  downloaded_bytes: number;
  total_bytes: number;
}
