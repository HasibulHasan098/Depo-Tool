use std::path::PathBuf;
use log::{info, error};

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

pub fn detect_steam_path() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        info!("Attempting to detect Steam path from Registry...");
        let hklm = RegKey::predef(HKEY_CURRENT_USER);
        let steam_key = hklm.open_subkey("Software\\Valve\\Steam").ok()?;
        let path: String = steam_key.get_value("SteamPath").ok()?;
        
        // Steam Registry path uses forward slashes often, we can normalize it or just return
        // It's usually something like "C:/Program Files (x86)/Steam"
        // Let's replace forward slashes with backslashes for consistency on Windows if needed, 
        // but Windows APIs generally handle both. Let's keep as is or normalize.
        let path = path.replace("/", "\\");
        
        info!("Detected Steam path: {}", path);
        return Some(path);
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Simple fallback for linux/mac if needed in future
        let home = std::env::var("HOME").ok()?;
        let common_paths = vec![
            format!("{}/.steam/steam", home),
            format!("{}/.local/share/Steam", home),
            format!("{}/Library/Application Support/Steam", home),
        ];

        for p in common_paths {
            if std::path::Path::new(&p).exists() {
                return Some(p);
            }
        }
        None
    }
}
