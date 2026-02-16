use std::fs;
use std::path::{Path, PathBuf};
use std::io;
use zip::ZipArchive;
use sysinfo::System;
use std::process::Command;
use log::{info, error, warn};

pub fn install_online_fix_files(zip_path: &PathBuf, target_dir: &PathBuf) -> Result<(), String> {
    info!("Installing online fix from {:?} to {:?}", zip_path, target_dir);
    
    let file = fs::File::open(zip_path).map_err(|e| {
        error!("Failed to open zip file: {}", e);
        e.to_string()
    })?;
    
    let mut archive = ZipArchive::new(file).map_err(|e| {
        error!("Failed to read zip archive: {}", e);
        e.to_string()
    })?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().to_string();
        
        // Skip directories if they are just entries, but we need to create them for files
        if file.is_dir() {
            continue;
        }

        let target_path = target_dir.join(&name);
        
        // Ensure parent directory exists
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                error!("Failed to create directory {:?}: {}", parent, e);
                e.to_string()
            })?;
        }

        // Extract and overwrite
        info!("Extracting {} to {:?}", name, target_path);
        let mut outfile = fs::File::create(&target_path).map_err(|e| {
            error!("Failed to create target file: {}", e);
            e.to_string()
        })?;
        
        io::copy(&mut file, &mut outfile).map_err(|e| {
            error!("Failed to write file content: {}", e);
            e.to_string()
        })?;
    }

    info!("Online fix installation completed.");
    Ok(())
}

pub fn process_downloaded_file(zip_path: &PathBuf, steam_path: &PathBuf) -> Result<Vec<String>, String> {
    info!("Processing downloaded file: {:?}", zip_path);
    let file = fs::File::open(zip_path).map_err(|e| {
        error!("Failed to open zip file: {}", e);
        e.to_string()
    })?;
    let mut archive = ZipArchive::new(file).map_err(|e| {
        error!("Failed to read zip archive: {}", e);
        e.to_string()
    })?;

    let stplugin_dir = steam_path.join("config").join("stplug-in");
    let depotcache_dir = steam_path.join("config").join("depotcache");

    // Ensure directories exist
    fs::create_dir_all(&stplugin_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&depotcache_dir).map_err(|e| e.to_string())?;

    let mut installed_files = Vec::new();

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().to_string();
        
        // Skip directories
        if file.is_dir() {
            continue;
        }

        let extension = Path::new(&name).extension().and_then(|s| s.to_str()).unwrap_or("");
        let target_dir = match extension {
            "lua" => &stplugin_dir,
            "manifest" => &depotcache_dir,
            _ => continue, // Skip other files
        };

        // Extract filename only (ignore internal zip structure if flat or handle it)
        let file_name = Path::new(&name).file_name().ok_or("Invalid filename")?;
        let target_path = target_dir.join(file_name);

        // Record installed file (relative to steam path or full path)
        // Storing relative path to Steam Root is better for portability/display, 
        // but absolute path is safer for deletion. Let's store relative to Steam Root if possible, 
        // or just the end part. 
        // Actually, we know where they go based on extension.
        // Let's store the full path for simplicity in deletion, or relative path string.
        // Relative: "config/stplug-in/123.lua"
        if let Ok(rel_path) = target_path.strip_prefix(steam_path) {
             installed_files.push(rel_path.to_string_lossy().to_string());
        }

        // Backup if exists
        if target_path.exists() {
            let backup_path = target_path.with_extension(format!("{}.bak", extension));
            warn!("Backing up existing file to: {:?}", backup_path);
            let _ = fs::copy(&target_path, &backup_path);
        }

        // Extract
        info!("Extracting {} to {:?}", name, target_path);
        let mut outfile = fs::File::create(&target_path).map_err(|e| {
            error!("Failed to create target file: {}", e);
            e.to_string()
        })?;
        io::copy(&mut file, &mut outfile).map_err(|e| {
            error!("Failed to write file content: {}", e);
            e.to_string()
        })?;
    }

    info!("File processing completed.");
    Ok(installed_files)
}

pub fn restore_backups(steam_path: &PathBuf) -> Result<(), String> {
    info!("Restoring backups...");
    let dirs = [
        steam_path.join("config").join("stplug-in"),
        steam_path.join("config").join("depotcache"),
    ];

    let mut restored_count = 0;
    for dir in dirs.iter() {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                // Check if it ends with .bak (simple string check or extension)
                if path.extension().map_or(false, |ext| ext == "bak") {
                    // Assuming structure file.ext.bak -> restore to file.ext
                    // with_extension("") removes the last extension (.bak)
                    let target = path.with_extension("");
                    
                    // We need to know the real extension to be safe?
                    // My backup logic produced `file.lua.bak` or `file.manifest.bak`.
                    // So removing .bak leaves `file.lua` or `file.manifest`.
                    
                    info!("Restoring {:?} to {:?}", path, target);
                    if let Err(e) = fs::rename(&path, &target) {
                        error!("Failed to restore backup: {}", e);
                    } else {
                        restored_count += 1;
                    }
                }
            }
        }
    }
    
    if restored_count == 0 {
        warn!("No backups found to restore.");
        return Err("No backups found.".to_string());
    }
    
    info!("Restored {} files.", restored_count);
    Ok(())
}

pub fn restart_steam(steam_path: &PathBuf) -> Result<(), String> {
    info!("Attempting to restart Steam...");
    // Kill Steam
    let mut system = System::new_all();
    system.refresh_all(); // Must refresh to get latest process list
    for process in system.processes_by_name("steam") {
        info!("Killing steam process: {}", process.pid());
        process.kill();
    }
    
    // Wait a bit?
    std::thread::sleep(std::time::Duration::from_secs(2));

    // Start Steam
    let steam_exe = steam_path.join("steam.exe");
    if steam_exe.exists() {
        info!("Starting Steam from: {:?}", steam_exe);
        // Use standard Command::spawn instead of open::that to avoid blocking the current process
        Command::new(&steam_exe).spawn().map_err(|e| {
            error!("Failed to start Steam executable: {}", e);
            e.to_string()
        })?;
    } else {
        warn!("Steam executable not found at expected path. Trying global command.");
        // Try simple command if path is not exe
        Command::new("steam").spawn().map_err(|_| {
            error!("Failed to start Steam via command.");
            "Failed to start Steam via command, and path not found".to_string()
        })?;
    }

    Ok(())
}
