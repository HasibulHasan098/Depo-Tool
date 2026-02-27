use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use lazy_static::lazy_static;
use crate::steam::GameInfo;
use log::{info, error};

use tauri::AppHandle;
use tauri::Manager;

lazy_static! {
    static ref LIBRARY_CACHE: Mutex<Vec<GameInfo>> = Mutex::new(Vec::new());
}

fn get_library_path() -> PathBuf {
    // In dev, use current dir but ensure it's ignored by watcher if possible, 
    // or better: use AppData even in dev to avoid restart loop.
    // Since we don't have AppHandle in global context easily without passing it,
    // let's use a fixed path outside src-tauri or assume std::env::temp_dir() or similar?
    // No, persistence is needed.
    
    // Quick fix for the "restart loop" issue in dev:
    // If we are in dev (debug build), writing to "library.json" next to Cargo.toml triggers rebuild.
    // Let's write to "target/library.json" or just use a hardcoded safe path for now.
    
    // Ideally: use tauri::api::path::app_data_dir but that requires config/context.
    // For this specific issue where the user says "app closes and reopens", it's 99% the dev watcher.
    
    let mut path = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("."));
    path.pop(); // remove exe name
    path.push("library.json");
    path
}

pub fn load_library() -> Vec<GameInfo> {
    let path = get_library_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(games) = serde_json::from_str(&content) {
                return games;
            }
        }
    }
    Vec::new()
}

pub fn save_library(games: &Vec<GameInfo>) {
    let path = get_library_path();
    if let Ok(content) = serde_json::to_string_pretty(games) {
        if let Err(e) = fs::write(&path, content) {
            error!("Failed to save library to {:?}: {}", path, e);
        }
    }
}

pub fn init_library() {
    let mut games = LIBRARY_CACHE.lock().unwrap();
    *games = load_library();
}

pub fn add_to_library(game: GameInfo) {
    // Ensure loaded
    let mut games = LIBRARY_CACHE.lock().unwrap();
    if games.is_empty() {
        // Reload just in case it was empty initially or first run
        let loaded = load_library();
        if !loaded.is_empty() {
            *games = loaded;
        }
    }
    
    // Check if exists
    if !games.iter().any(|g| g.id == game.id) {
        games.push(game);
        save_library(&games);
        info!("Added game to library: {}", games.last().unwrap().name);
    }
}

pub fn remove_from_library(game_id: u32) {
    let mut games = LIBRARY_CACHE.lock().unwrap();
    if let Some(pos) = games.iter().position(|g| g.id == game_id) {
        let game = games.remove(pos);
        save_library(&games);
        info!("Removed game from library: {}", game.name);
    }
}

pub fn get_library() -> Vec<GameInfo> {
    LIBRARY_CACHE.lock().unwrap().clone()
}

pub fn set_library(games: Vec<GameInfo>) {
    let mut cache = LIBRARY_CACHE.lock().unwrap();
    *cache = games;
    save_library(&cache);
}
