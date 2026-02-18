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

enum AdminInstallRequest {
    ExternalTool { url: String, subfolder: Option<String> },
    OnlineFix { url: String, install_dir: String },
}

fn get_admin_install_request() -> Option<AdminInstallRequest> {
    let mut args = std::env::args().skip(1);
    let mut url: Option<String> = None;
    let mut subfolder: Option<String> = None;
    let mut online_fix_url: Option<String> = None;
    let mut online_fix_dir: Option<String> = None;
    while let Some(arg) = args.next() {
        if arg == "--admin-install-url" {
            url = args.next();
        } else if arg == "--admin-install-subfolder" {
            subfolder = args.next();
        } else if arg == "--admin-online-fix-url" {
            online_fix_url = args.next();
        } else if arg == "--admin-online-fix-dir" {
            online_fix_dir = args.next();
        }
    }
    if let (Some(url), Some(install_dir)) = (online_fix_url, online_fix_dir) {
        return Some(AdminInstallRequest::OnlineFix { url, install_dir });
    }
    url.map(|url| AdminInstallRequest::ExternalTool { url, subfolder })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    
    // Initialize library
    library::init_library();
    let admin_request = get_admin_install_request();

    if let Some(request) = admin_request {
        let result = match request {
            AdminInstallRequest::ExternalTool { url, subfolder } => {
                tauri::async_runtime::block_on(install_external_tool_headless(url, subfolder))
            }
            AdminInstallRequest::OnlineFix { url, install_dir } => {
                tauri::async_runtime::block_on(install_online_fix_headless(install_dir, url))
            }
        };
        if let Err(err) = result {
            eprintln!("{}", err);
        }
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            Ok(())
        })
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
