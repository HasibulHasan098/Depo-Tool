use crate::steam::{search_games as steam_search, check_availability as steam_check, get_featured_games as steam_featured, get_game_details as steam_details, get_game_briefs as steam_briefs, GameInfo, GameDetails};
use crate::download::download_game_files;
use crate::processing::{process_downloaded_file, restart_steam as steam_restart, restore_backups as processing_restore};
use crate::utils::{detect_steam_path, find_game_install_path_in_library};
use crate::library::{add_to_library, get_library, remove_from_library};
use std::path::PathBuf;
use tauri::{Window, WebviewWindow, Manager};
use reqwest::Client;
use serde_json::Value;
use std::process::Command as ProcCommand;
use std::fs;
use std::path::Path;
#[cfg(windows)]
use std::ffi::OsStr;
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
#[cfg(windows)]
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
#[cfg(windows)]
use windows_sys::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
#[cfg(windows)]
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
#[cfg(windows)]
use windows_sys::Win32::UI::Shell::ShellExecuteW;
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

// Helper to resolve external tools
fn resolve_external_tool(window: &Window, file: &str) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    
    // 1. App Resource Dir (Packaged)
    if let Ok(resource_dir) = window.path().resource_dir() {
         candidates.push(resource_dir.join(file));
         candidates.push(resource_dir.join("bin").join(file));
         candidates.push(resource_dir.join("resources").join(file));
    }
    
    // 2. Executable Dir (Portable/Dev)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join(file));
            candidates.push(dir.join("bin").join(file));
            candidates.push(dir.join("resources").join(file));
        }
    }
    
    // 3. Debug Env Var (Dev override)
    #[cfg(debug_assertions)]
    if let Ok(dev_path) = std::env::var("DEPO_TOOL_TOOLS_DIR") {
        candidates.push(PathBuf::from(dev_path).join(file));
    }

    candidates.into_iter().find(|p| p.exists())
}

use crate::download::download_online_fix_files;
use crate::processing::install_online_fix_files;

#[cfg(windows)]
fn to_wide(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
fn is_elevated() -> bool {
    let mut token: HANDLE = std::ptr::null_mut();
    unsafe {
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return false;
        }
    }
    let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
    let mut size = 0;
    let result = unsafe {
        GetTokenInformation(
            token,
            TokenElevation,
            &mut elevation as *mut _ as *mut _,
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut size,
        )
    };
    unsafe { CloseHandle(token) };
    result != 0 && elevation.TokenIsElevated != 0
}

#[cfg(not(windows))]
fn is_elevated() -> bool {
    true
}

#[cfg(windows)]
fn is_protected_path(path: &Path) -> bool {
    let lower = path.to_string_lossy().to_lowercase();
    lower.starts_with(r"c:\program files")
        || lower.starts_with(r"c:\program files (x86)")
        || lower.starts_with(r"c:\windows")
}

#[cfg(windows)]
fn has_write_access(path: &Path) -> bool {
    if !path.exists() && fs::create_dir_all(path).is_err() {
        return false;
    }
    let test_path = path.join(".depo_tool_write_test");
    match fs::OpenOptions::new().create(true).write(true).open(&test_path) {
        Ok(_) => {
            let _ = fs::remove_file(test_path);
            true
        }
        Err(_) => false,
    }
}

#[cfg(windows)]
fn relaunch_as_admin(params: &str) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_wide = to_wide(exe.to_string_lossy().as_ref());
    let params_wide = to_wide(params);
    let verb_wide = to_wide("runas");
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb_wide.as_ptr(),
            exe_wide.as_ptr(),
            params_wide.as_ptr(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if result as usize <= 32 {
        Err("Failed to request administrator privileges".to_string())
    } else {
        Ok(())
    }
}

#[cfg(windows)]
fn build_admin_params(url: &str, subfolder: &Option<String>) -> String {
    let mut parts = vec![format!("--admin-install-url {}", quote_arg(url))];
    if let Some(folder) = subfolder.as_ref() {
        parts.push(format!("--admin-install-subfolder {}", quote_arg(folder)));
    }
    parts.join(" ")
}

#[cfg(windows)]
fn quote_arg(value: &str) -> String {
    if value.contains(' ') || value.contains('"') {
        format!("\"{}\"", value.replace('"', "\\\""))
    } else {
        value.to_string()
    }
}

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
pub async fn check_external_tool_status(window: Window, tool_name: String) -> bool {
    resolve_external_tool(&window, &tool_name).is_some()
}

#[tauri::command]
pub async fn install_external_tool(window: WebviewWindow, url: String, subfolder: Option<String>) -> Result<String, String> {
    // 2. Determine Install Path
    let mut install_dir = if let Ok(exe) = std::env::current_exe() {
         exe.parent().unwrap().to_path_buf()
    } else {
         return Err("Could not determine install location".to_string());
    };
    
    // If subfolder is provided, append it
    if let Some(folder) = subfolder.as_ref() {
        install_dir = install_dir.join(folder);
    }

    #[cfg(windows)]
    if !is_elevated() && (is_protected_path(&install_dir) || !has_write_access(&install_dir)) {
        let params = build_admin_params(&url, &subfolder);
        relaunch_as_admin(&params)?;
        return Err("ELEVATION_REQUESTED".to_string());
    }

    // 1. Download
    let zip_path = download_online_fix_files(&url, &window).await?;
    
    // 3. Extract
    if !install_dir.exists() {
        std::fs::create_dir_all(&install_dir).map_err(|e| e.to_string())?;
    }
    install_online_fix_files(&zip_path, &install_dir)?;

    // 4. Cleanup
    let _ = std::fs::remove_file(zip_path);

    Ok("Success".to_string())
}

#[tauri::command]
pub async fn get_url_file_size(url: String) -> Result<String, String> {
    let client = Client::new();
    let response = client
        .head(&url)
        .header("User-Agent", "Depo-Tool")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Request failed: {}", response.status()));
    }

    // Try to get Content-Length from headers directly
    if let Some(length_header) = response.headers().get(reqwest::header::CONTENT_LENGTH) {
        if let Ok(length_str) = length_header.to_str() {
            if let Ok(length) = length_str.parse::<u64>() {
                let size_mb = length as f64 / (1024.0 * 1024.0);
                return Ok(format!("{:.2} MB", size_mb));
            }
        }
    }
    
    Err("Content-Length header missing or invalid".to_string())
}

#[tauri::command]
pub async fn launch_cream_installer(window: Window) -> Result<String, String> {
    let target = resolve_external_tool(&window, "CreamInstaller.exe")
        .ok_or_else(|| "CreamInstaller.exe not found".to_string())?;

    let mut child = ProcCommand::new(&target)
        .spawn()
        .map_err(|e| format!("Failed to start CreamInstaller: {}", e))?;

    child
        .wait()
        .map_err(|e| format!("CreamInstaller wait failed: {}", e))?;

    Ok("Launched".to_string())
}

#[tauri::command]
pub async fn launch_sam_picker(window: Window) -> Result<String, String> {
    let target = resolve_external_tool(&window, "SAM.Picker.exe")
        .ok_or_else(|| "SAM.Picker.exe not found".to_string())?;

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
pub async fn launch_cw(window: Window) -> Result<String, String> {
    let target = resolve_external_tool(&window, "CW/CrackWorld Library.exe")
        .or_else(|| resolve_external_tool(&window, "CrackWorld Library.exe"))
        .ok_or_else(|| "CrackWorld Library.exe not found".to_string())?;

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
    if let Ok(_details) = steam_details(id_u32).await {
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
