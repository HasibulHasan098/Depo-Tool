use std::collections::HashMap;
use std::path::{Path, PathBuf};
use log::{info, error};
use regex::Regex;
use std::fs;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

pub fn detect_steam_path() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        info!("Attempting to detect Steam path from Registry...");
        let hklm = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(steam_key) = hklm.open_subkey("Software\\Valve\\Steam") {
            if let Ok(path) = steam_key.get_value::<String, _>("SteamPath") {
                let path = path.replace("/", "\\");
                info!("Detected Steam path: {}", path);
                return Some(path);
            }
        }
        // Fallback or if key missing
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
    
    // Explicit return for Windows fallback case
    #[cfg(target_os = "windows")]
    None
}

pub fn get_library_folders(steam_path: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let steam_path = PathBuf::from(steam_path);
    paths.push(steam_path.clone()); // Default library

    let vdf_path = steam_path.join("steamapps").join("libraryfolders.vdf");
    if vdf_path.exists() {
        if let Ok(content) = fs::read_to_string(&vdf_path) {
            // Regex to find "path" "..."
            // VDF format: "path"		"C:\\Program Files (x86)\\Steam"
            let re = Regex::new(r#""path"\s+"(.+?)""#).unwrap();
            for cap in re.captures_iter(&content) {
                if let Some(path_match) = cap.get(1) {
                    let path_str = path_match.as_str().replace("\\\\", "\\");
                    let p = PathBuf::from(path_str);
                    if p.exists() && p != steam_path {
                        paths.push(p);
                    }
                }
            }
        }
    }
    paths
}

pub fn find_game_install_path_in_library(app_id: u32) -> Option<PathBuf> {
    let steam_path_str = detect_steam_path()?;
    let library_folders = get_library_folders(&steam_path_str);

    for lib_path in library_folders {
        let manifest_path = lib_path.join("steamapps").join(format!("appmanifest_{}.acf", app_id));
        if manifest_path.exists() {
            if let Ok(content) = fs::read_to_string(&manifest_path) {
                let re = Regex::new(r#""installdir"\s+"(.+?)""#).unwrap();
                if let Some(cap) = re.captures(&content) {
                    if let Some(dir_match) = cap.get(1) {
                        let install_dir_name = dir_match.as_str();
                        let full_install_path = lib_path.join("steamapps").join("common").join(install_dir_name);
                        if full_install_path.exists() {
                            return Some(full_install_path);
                        }
                    }
                }
            }
        }
    }
    None
}

fn parse_game_id_from_stem(stem: &str) -> Option<u32> {
    let re = Regex::new(r"^(\d+)$").ok()?;
    let caps = re.captures(stem)?;
    let value = caps.get(1)?.as_str();
    value.parse::<u32>().ok()
}

fn parse_game_id_from_manifest_stem(stem: &str) -> Option<u32> {
    let re = Regex::new(r"^(\d+)").ok()?;
    let caps = re.captures(stem)?;
    let value = caps.get(1)?.as_str();
    value.parse::<u32>().ok()
}

pub fn collect_installed_game_files(steam_path: &Path) -> HashMap<u32, Vec<PathBuf>> {
    let mut result: HashMap<u32, Vec<PathBuf>> = HashMap::new();
    let stplugin_dir = steam_path.join("config").join("stplug-in");
    let depotcache_dir = steam_path.join("config").join("depotcache");

    if let Ok(entries) = fs::read_dir(&stplugin_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            if ext != "lua" {
                continue;
            }
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            if let Some(app_id) = parse_game_id_from_stem(stem) {
                result.entry(app_id).or_default().push(path);
            }
        }
    }

    if let Ok(entries) = fs::read_dir(&depotcache_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            if ext != "manifest" {
                continue;
            }
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            if let Some(app_id) = parse_game_id_from_manifest_stem(stem) {
                if result.contains_key(&app_id) {
                    result.entry(app_id).or_default().push(path);
                }
            }
        }
    }

    result
}
