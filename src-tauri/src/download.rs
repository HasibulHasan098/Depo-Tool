use tauri::{Emitter, Runtime, Window};
use reqwest::Client;
use futures_util::StreamExt;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use std::time::Instant;
use std::cmp::min;
use log::{info, error, debug};

#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    percentage: f64,
    speed_mbps: f64,
    time_remaining_sec: u64,
    downloaded_bytes: u64,
    total_bytes: u64,
}

pub async fn download_online_fix_files<R: Runtime>(url: &str, window: &impl Emitter<R>) -> Result<PathBuf, String> {
    info!("Initiating online fix download from: {}", url);
    let client = Client::new();
    
    let res = client.get(url).send().await.map_err(|e| {
        error!("Failed to start download: {}", e);
        e.to_string()
    })?;
    
    if !res.status().is_success() {
        return Err(format!("Download failed with status: {}", res.status()));
    }

    let total_size = res.content_length().unwrap_or(0);
    let temp_dir = std::env::temp_dir();
    // Use a unique name to avoid conflicts
    let file_path = temp_dir.join(format!("online_fix_{}.zip", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
    
    let mut file = File::create(&file_path).map_err(|e| {
        error!("Failed to create file: {}", e);
        e.to_string()
    })?;

    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();
    let start_time = Instant::now();
    let mut last_update = Instant::now();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| {
            error!("Download interrupted: {}", e);
            e.to_string()
        })?;
        file.write_all(&chunk).map_err(|e| {
            error!("File write error: {}", e);
            e.to_string()
        })?;
        downloaded += chunk.len() as u64;

        let now = Instant::now();
        if now.duration_since(last_update).as_millis() > 100 || (total_size > 0 && downloaded >= total_size) {
            let elapsed_sec = now.duration_since(start_time).as_secs_f64();
            let speed_bps = if elapsed_sec > 0.0 { downloaded as f64 / elapsed_sec } else { 0.0 };
            let speed_mbytes_ps = speed_bps / 1_048_576.0;
            
            let percentage = if total_size > 0 { 
                min((downloaded as f64 / total_size as f64 * 100.0) as u64, 100) as f64 
            } else { 
                0.0 
            };
            
            let time_remaining_sec = if speed_bps > 0.0 && total_size > 0 && total_size > downloaded {
                ((total_size - downloaded) as f64 / speed_bps) as u64
            } else {
                0
            };

            // Use a distinct event name so it doesn't conflict with main game downloads if we want separate UI
            // But for now, reusing "download-progress" is easiest for UI if we only do one thing at a time.
            let _ = window.emit("download-progress", DownloadProgress {
                percentage,
                speed_mbps: speed_mbytes_ps,
                time_remaining_sec,
                downloaded_bytes: downloaded,
                total_bytes: total_size,
            });
            last_update = now;
        }
    }
    
    info!("Online fix download completed");
    Ok(file_path)
}

pub async fn download_online_fix_files_silent(url: &str) -> Result<PathBuf, String> {
    info!("Initiating online fix download from: {}", url);
    let client = Client::new();
    
    let res = client.get(url).send().await.map_err(|e| {
        error!("Failed to start download: {}", e);
        e.to_string()
    })?;
    
    if !res.status().is_success() {
        return Err(format!("Download failed with status: {}", res.status()));
    }

    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(format!("online_fix_{}.zip", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
    
    let mut file = File::create(&file_path).map_err(|e| {
        error!("Failed to create file: {}", e);
        e.to_string()
    })?;

    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| {
            error!("Download interrupted: {}", e);
            e.to_string()
        })?;
        file.write_all(&chunk).map_err(|e| {
            error!("File write error: {}", e);
            e.to_string()
        })?;
    }
    
    info!("Online fix download completed");
    Ok(file_path)
}

pub async fn download_game_files(game_id: &str, window: &Window) -> Result<PathBuf, String> {
    info!("Initiating download for game ID: {}", game_id);
    let client = Client::new();
    let url1 = format!("https://api.luagen.revobd.club/{}.zip", game_id);
    let url2 = format!("https://codeload.github.com/SteamAutoCracks/ManifestHub/zip/refs/heads/{}", game_id);

    let mut target_url = String::new();

    // Check URL 1
    debug!("Checking source 1: {}", url1);
    if let Ok(resp) = client.head(&url1).send().await {
        if resp.status().is_success() {
            target_url = url1;
            info!("Source 1 available.");
        }
    }

    // Check URL 2 if 1 failed
    if target_url.is_empty() {
        debug!("Checking source 2: {}", url2);
        if let Ok(resp) = client.head(&url2).send().await {
            if resp.status().is_success() {
                target_url = url2;
                info!("Source 2 available.");
            }
        }
    }

    if target_url.is_empty() {
        error!("No download sources available for game ID: {}", game_id);
        return Err("No download source available for this game.".to_string());
    }

    info!("Downloading from: {}", target_url);
    let res = client.get(&target_url).send().await.map_err(|e| {
        error!("Failed to start download: {}", e);
        e.to_string()
    })?;
    let total_size = res.content_length().unwrap_or(0);

    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(format!("{}.zip", game_id));
    let mut file = File::create(&file_path).map_err(|e| {
        error!("Failed to create file: {}", e);
        e.to_string()
    })?;

    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();
    let start_time = Instant::now();
    let mut last_update = Instant::now();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| {
            error!("Download interrupted: {}", e);
            e.to_string()
        })?;
        file.write_all(&chunk).map_err(|e| {
            error!("File write error: {}", e);
            e.to_string()
        })?;
        downloaded += chunk.len() as u64;

        let now = Instant::now();
        if now.duration_since(last_update).as_millis() > 100 || (total_size > 0 && downloaded >= total_size) {
            let elapsed_sec = now.duration_since(start_time).as_secs_f64();
            // Calculate instantaneous speed based on last update to avoid "stuck" average speed
            // Or better: keep average speed but make sure it updates.
            // If download is super fast, elapsed might be small.
            
            let speed_bps = if elapsed_sec > 0.0 { downloaded as f64 / elapsed_sec } else { 0.0 };
            let speed_mbps = speed_bps / 1_000_000.0 * 8.0; // Convert bytes/sec to bits/sec then Mbps (standard is bits) OR user likely wants MB/s (Bytes)
            // If user wants MB/s (Megabytes per second):
            let speed_mbytes_ps = speed_bps / 1_048_576.0; // 1024*1024
            
            // Let's stick to MB/s (Bytes) as it's more common for file downloads
            
            let percentage = if total_size > 0 { 
                min((downloaded as f64 / total_size as f64 * 100.0) as u64, 100) as f64 
            } else { 
                0.0 
            };
            
            let time_remaining_sec = if speed_bps > 0.0 && total_size > 0 && total_size > downloaded {
                ((total_size - downloaded) as f64 / speed_bps) as u64
            } else {
                0
            };

            let _ = window.emit("download-progress", DownloadProgress {
                percentage,
                speed_mbps: speed_mbytes_ps, // Send MB/s
                time_remaining_sec,
                downloaded_bytes: downloaded,
                total_bytes: total_size,
            });
            last_update = now;
        }
    }
    
    info!("Download completed for game ID: {}", game_id);
    Ok(file_path)
}
