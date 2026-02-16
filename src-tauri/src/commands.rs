use crate::steam::{search_games as steam_search, check_availability as steam_check, get_featured_games as steam_featured, get_game_details as steam_details, get_game_briefs as steam_briefs, GameInfo, GameDetails};
use crate::download::download_game_files;
use crate::processing::{process_downloaded_file, restart_steam as steam_restart, restore_backups as processing_restore};
use crate::utils::{detect_steam_path, find_game_install_path_in_library};
use crate::library::{add_to_library, get_library, remove_from_library};
use std::path::PathBuf;
use tauri::Window;
use reqwest::Client;
use serde_json::Value;
use std::process::Command as ProcCommand;
use std::fs;

use crate::download::download_online_fix_files;
use crate::processing::install_online_fix_files;

#[tauri::command]
pub async fn install_online_fix(window: Window, game_id: String, install_dir: String, download_url: String) -> Result<String, String> {
    // 1. Download the fix
    let zip_path = download_online_fix_files(&download_url, &window).await?;
    
    // 2. Install (extract and overwrite)
    let target_path = PathBuf::from(install_dir);
    install_online_fix_files(&zip_path, &target_path)?;
    
    // 3. Cleanup
    let _ = std::fs::remove_file(zip_path);
    
    Ok("Success".to_string())
}

#[tauri::command]
pub async fn launch_cream_installer() -> Result<String, String> {
    // Candidate locations: bundled next to exe, in resources folder, dev path provided by user
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("CreamInstaller.exe"));
            candidates.push(dir.join("resources").join("CreamInstaller.exe"));
        }
    }
    candidates.push(PathBuf::from(r"D:\Downloads\Depo Tool\CreamInstaller.exe"));

    let target = candidates.into_iter().find(|p| p.exists())
        .ok_or_else(|| "CreamInstaller.exe not found in bundle or dev path".to_string())?;

    let mut child = ProcCommand::new(&target)
        .spawn()
        .map_err(|e| format!("Failed to start CreamInstaller: {}", e))?;

    child
        .wait()
        .map_err(|e| format!("CreamInstaller wait failed: {}", e))?;

    Ok("Launched".to_string())
}

#[tauri::command]
pub async fn launch_sam_picker() -> Result<String, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("SAM.Picker.exe"));
            candidates.push(dir.join("resources").join("SAM.Picker.exe"));
        }
    }
    candidates.push(PathBuf::from(r"D:\Downloads\Depo Tool\SAM.Picker.exe"));

    let target = candidates.into_iter().find(|p| p.exists())
        .ok_or_else(|| "SAM.Picker.exe not found in bundle or dev path".to_string())?;

    let mut child = ProcCommand::new(&target)
        .current_dir(target.parent().unwrap_or(&target))
        .spawn()
        .map_err(|e| format!("Failed to start SAM.Picker: {}", e))?;

    child
        .wait()
        .map_err(|e| format!("SAM.Picker wait failed: {}", e))?;

    Ok("Launched".to_string())
}

#[tauri::command]
pub async fn launch_cw() -> Result<String, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("CW").join("CrackWorld Library.exe"));
            candidates.push(dir.join("resources").join("CW").join("CrackWorld Library.exe"));
        }
    }
    candidates.push(PathBuf::from(r"D:\Downloads\Depo Tool\CW\CrackWorld Library.exe"));

    let target = candidates.into_iter().find(|p| p.exists())
        .ok_or_else(|| "CrackWorld Library.exe not found in bundle or dev path".to_string())?;

    let mut child = ProcCommand::new(&target)
        .current_dir(target.parent().unwrap_or(&target))
        .spawn()
        .map_err(|e| format!("Failed to start CrackWorld Library: {}", e))?;

    child
        .wait()
        .map_err(|e| format!("CrackWorld Library wait failed: {}", e))?;

    Ok("Launched".to_string())
}

#[tauri::command]
pub async fn find_game_install_path(app_id: u32) -> Result<Option<String>, String> {
    Ok(find_game_install_path_in_library(app_id).map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn remove_game_from_library(game_id: u32, steam_path: String) -> Result<(), String> {
    // 1. Get Game Info to find installed files
    let games = get_library();
    let game = games.iter().find(|g| g.id == game_id);

    if let Some(g) = game {
        let root = PathBuf::from(&steam_path);
        
        // Delete recorded files
        for file_rel_path in &g.installed_files {
            let file_path = root.join(file_rel_path);
            if file_path.exists() {
                if let Err(e) = std::fs::remove_file(&file_path) {
                    // Log error but continue
                    eprintln!("Failed to delete file {:?}: {}", file_path, e);
                }
            }
        }
    }

    // 2. Remove from JSON library
    remove_from_library(game_id);

    // 3. Fallback cleanup (Legacy or if installed_files empty)
    let root = PathBuf::from(&steam_path);
    let lua_path = root.join("config").join("stplug-in").join(format!("{}.lua", game_id));
    if lua_path.exists() {
        let _ = std::fs::remove_file(lua_path);
    }
    
    // We can't easily guess manifest name without ID, but usually it's in depotcache/manifests. 
    // Without specific file tracking, we can't safely delete manifests as they have random IDs.
    // The installed_files tracking solves this.

    Ok(())
}

#[tauri::command]
pub async fn search_games(query: String) -> Result<Vec<GameInfo>, String> {
    steam_search(&query).await
}

#[tauri::command]
pub async fn get_game_briefs(app_ids: Vec<u32>) -> Result<Vec<GameInfo>, String> {
    steam_briefs(app_ids).await
}

#[tauri::command]
pub async fn get_featured_games() -> Result<Vec<GameInfo>, String> {
    steam_featured().await
}

#[tauri::command]
pub async fn get_game_details(game_id: u32) -> Result<GameDetails, String> {
    steam_details(game_id).await
}

#[tauri::command]
pub async fn get_library_games() -> Vec<GameInfo> {
    get_library()
}

#[tauri::command]
pub async fn get_steam_path() -> Option<String> {
    detect_steam_path()
}

#[tauri::command]
pub async fn check_game_availability(game_id: String) -> bool {
    steam_check(&game_id).await
}

#[tauri::command]
pub async fn restore_backup(steam_path: String) -> Result<(), String> {
    processing_restore(&PathBuf::from(steam_path))
}

#[tauri::command]
pub async fn check_for_updates() -> Result<Option<Value>, String> {
    let url = "https://api.github.com/repos/HasibulHasan098/Depo-Tool/releases/latest";
    let client = Client::new();
    let response = client
        .get(url)
        .header("User-Agent", "Depo-Tool")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().as_u16() == 404 {
        return Ok(None);
    }

    if !response.status().is_success() {
        return Err(format!("GitHub response error: {}", response.status()));
    }

    let release = response.json::<Value>().await.map_err(|e| e.to_string())?;
    Ok(Some(release))
}

#[tauri::command]
pub async fn download_and_install(window: Window, game_id: String, steam_path: String) -> Result<String, String> {
    // 1. Get Game Info for Library (We need to fetch it again or pass it, but fetching is safer/easier here)
    // We can just use search or details to get info. For now, let's fetch details to construct GameInfo
    // Or simpler: The frontend passes ID, but we need Name/Images for Library.
    // Let's do a quick fetch of details to get the name/images.
    
    let id_u32 = game_id.parse::<u32>().map_err(|_| "Invalid ID")?;

    // 1. Check availability
    let is_available = steam_check(&game_id).await;
    if !is_available {
        return Err("Sorry, this game is not available on our server yet.".to_string());
    }
    
    // We'll proceed with download first
    let zip_path = download_game_files(&game_id, &window).await?;
    
    // 2. Process
    let steam_path_buf = PathBuf::from(steam_path);
    let installed_files = process_downloaded_file(&zip_path, &steam_path_buf)?;
    
    // 3. Add to Library (Async/Background)
    // We need to reconstruct GameInfo. Since we don't have it passed, we can fetch it.
    // This might fail if network is down but we just downloaded? 
    // Ideally we pass the GameInfo object to this command, but that requires changing signature.
    // Let's try to fetch details quickly.
    if let Ok(details) = steam_details(id_u32).await {
        // We need name and images. Details gives description/media.
        // We might need to use store search or featured to get the exact "GameInfo" structure or just manual construct.
        // Actually, let's just make a simple helper or assume we can get it.
        // For robustness, let's look it up via the search API with the ID? Or just `appdetails` returns name?
        // `appdetails` usually has `name`.
        // Let's update `steam.rs` to allow fetching basic info by ID if needed, or just construct it best effort.
        
        // Hack: We will fetch via search_games using the ID as query, usually returns the exact game.
        if let Ok(games) = steam_search(&game_id).await {
            if let Some(game) = games.iter().find(|g| g.id == id_u32) {
                let mut game_with_files = game.clone();
                game_with_files.installed_files = installed_files;
                add_to_library(game_with_files);
            }
        }
    }

    // 4. Cleanup
    let _ = std::fs::remove_file(zip_path);
    
    // 5. Restart Steam
    steam_restart(&steam_path_buf)?;
    
    Ok("Success".to_string())
}
