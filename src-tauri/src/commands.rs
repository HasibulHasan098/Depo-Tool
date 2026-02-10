use crate::steam::{search_games as steam_search, check_availability as steam_check, get_featured_games as steam_featured, get_game_details as steam_details, GameInfo, GameDetails};
use crate::download::download_game_files;
use crate::processing::{process_downloaded_file, restart_steam as steam_restart, restore_backups as processing_restore};
use crate::utils::detect_steam_path;
use crate::library::{add_to_library, get_library, remove_from_library};
use std::path::PathBuf;
use tauri::Window;
use reqwest::Client;
use serde_json::Value;

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
