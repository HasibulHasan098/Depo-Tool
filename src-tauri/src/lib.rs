mod steam;
mod download;
mod processing;
mod commands;
mod utils;
mod library;

use commands::*;
use tauri::Window;
use log::info;

#[tauri::command]
async fn download_and_install_cmd(window: Window, gameId: String, steamPath: String) -> Result<(), String> {
    info!("Starting download for game: {}", gameId);
    
    // 1. Check availability first to avoid starting partial downloads
    let is_available = check_game_availability(gameId.clone()).await;
    if !is_available {
        return Err("Sorry, this game is not available on our server yet.".to_string());
    }

    commands::download_and_install(window, gameId, steamPath).await.map(|_| ())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    
    // Initialize library
    library::init_library();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            search_games,
            get_game_briefs,
            get_featured_games,
            get_game_details,
            get_library_games,
            check_game_availability,
            restore_backup,
            get_steam_path,
            check_for_updates,
            find_game_install_path,
            install_online_fix,
            check_external_tool_status,
            install_external_tool,
            get_url_file_size,
            launch_cream_installer,
            launch_sam_picker,
            launch_cw,
            download_and_install_cmd,
            remove_game_from_library
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
