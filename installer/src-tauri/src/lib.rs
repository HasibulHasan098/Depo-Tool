use std::env;
use std::ffi::OsStr;
use std::fs;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use tauri::{AppHandle, Manager};
use winreg::enums::*;
use winreg::RegKey;
use std::process::Command;
use std::os::windows::process::CommandExt;
use sysinfo::System;
use windows_sys::Win32::Foundation::CloseHandle;
use windows_sys::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
use windows_sys::Win32::UI::Shell::ShellExecuteW;
use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

const CREATE_NO_WINDOW: u32 = 0x08000000;

fn to_wide(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain(std::iter::once(0)).collect()
}

fn create_windows_shortcut(target_dir: &Path, target_app_path: &Path, shortcut_path: &Path) -> Result<(), String> {
    let target = target_app_path.to_str().ok_or("Invalid target path")?;
    let working_dir = target_dir.to_str().ok_or("Invalid working directory")?;
    let shortcut = shortcut_path.to_str().ok_or("Invalid shortcut path")?;

    let vbs_content = format!(
        "Set oWS = WScript.CreateObject(\"WScript.Shell\")\r\n\
         Set oLink = oWS.CreateShortcut(\"{}\")\r\n\
         oLink.TargetPath = \"{}\"\r\n\
         oLink.WorkingDirectory = \"{}\"\r\n\
         oLink.Save",
        shortcut,
        target,
        working_dir
    );

    let vbs_path = target_dir.join("create_shortcut.vbs");
    fs::write(&vbs_path, vbs_content).map_err(|e| e.to_string())?;
    let _ = Command::new("wscript")
        .arg(&vbs_path)
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    let _ = fs::remove_file(vbs_path);

    Ok(())
}

fn build_args() -> String {
    env::args_os()
        .skip(1)
        .map(|arg| {
            let value = arg.to_string_lossy().to_string();
            if value.contains(' ') || value.contains('"') {
                format!("\"{}\"", value.replace('"', "\\\""))
            } else {
                value
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_elevated() -> bool {
    unsafe {
        let mut token: isize = 0;
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return false;
        }

        let mut elevation: TOKEN_ELEVATION = std::mem::zeroed();
        let mut size = std::mem::size_of::<TOKEN_ELEVATION>() as u32;
        let result = GetTokenInformation(
            token,
            TokenElevation,
            &mut elevation as *mut _ as *mut _,
            size,
            &mut size,
        );

        CloseHandle(token);
        result != 0 && elevation.TokenIsElevated != 0
    }
}

fn relaunch_as_admin() -> bool {
    let exe_path = match env::current_exe() {
        Ok(path) => path,
        Err(_) => return false,
    };

    let args = build_args();
    let operation = to_wide("runas");
    let exe = to_wide(&exe_path.to_string_lossy());
    let params = to_wide(&args);

    let result = unsafe {
        ShellExecuteW(
            0,
            operation.as_ptr(),
            exe.as_ptr(),
            if args.is_empty() { std::ptr::null() } else { params.as_ptr() },
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };

    result > 32
}

fn ensure_elevated() {
    if !is_elevated() && relaunch_as_admin() {
        std::process::exit(0);
    }
}

fn kill_process_by_name(name: &str) {
    let mut system = System::new_all();
    system.refresh_all();
    
    for process in system.processes_by_name(name) {
        println!("Killing process: {}", process.pid());
        process.kill();
    }
}

#[tauri::command]
fn check_if_uninstalling() -> bool {
    if let Ok(exe_path) = env::current_exe() {
        if let Some(file_name) = exe_path.file_name() {
            if let Some(name_str) = file_name.to_str() {
                // If named "uninstall.exe" or similar
                return name_str.to_lowercase().contains("uninstall");
            }
        }
    }
    false
}

#[tauri::command]
async fn launch_app(install_path: String) -> Result<(), String> {
    let target_dir = Path::new(&install_path);
    let target_app_path = target_dir.join("depo-tool.exe");
    
    if target_app_path.exists() {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        // DETACHED_PROCESS (0x00000008) is usually better for completely independent processes
        const DETACHED_PROCESS: u32 = 0x00000008;

        Command::new(&target_app_path)
            .current_dir(target_dir) // Important to set working directory
            .creation_flags(DETACHED_PROCESS) // Detach from parent
            .spawn()
            .map_err(|e| format!("Failed to launch app: {}", e))?;
            
        Ok(())
    } else {
        Err("App executable not found".to_string())
    }
}

#[tauri::command]
async fn install_app(app_handle: AppHandle, install_path: String, create_shortcut: bool) -> Result<(), String> {
    let target_dir = Path::new(&install_path);
    
    // 1. Kill running app if exists
    kill_process_by_name("depo-tool");
    
    // 2. Create Directory
    if !target_dir.exists() {
        fs::create_dir_all(target_dir).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // 2. Extract Resources (Main App)
    let resource_path = app_handle.path().resolve("resources/depo-tool.exe", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve resource: {}", e))?;
    
    let target_app_path = target_dir.join("depo-tool.exe");
    fs::copy(&resource_path, &target_app_path)
        .map_err(|e| format!("Failed to copy app file: {}", e))?;

    // 3. Copy Installer as Uninstaller
    if let Ok(current_exe) = env::current_exe() {
        let uninstall_path = target_dir.join("uninstall.exe");
        let _ = fs::copy(&current_exe, &uninstall_path);
    }

    // 4. Create Desktop Shortcut using VBScript (Silent, no PowerShell/CMD)
    if create_shortcut {
        if let Ok(desktop_dir) = dirs::desktop_dir().ok_or("Could not find desktop directory") {
            let shortcut_path = desktop_dir.join("Depo Tool.lnk");
            let _ = create_windows_shortcut(target_dir, &target_app_path, &shortcut_path);
        }
    }

    if let Some(start_menu_dir) = dirs::data_dir().map(|dir| dir.join("Microsoft\\Windows\\Start Menu\\Programs")) {
        let _ = fs::create_dir_all(&start_menu_dir);
        let start_menu_shortcut = start_menu_dir.join("Depo Tool.lnk");
        let _ = create_windows_shortcut(target_dir, &target_app_path, &start_menu_shortcut);
    }

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let uninstall_key_path = "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DepoTool";
    let (key, _) = hkcu.create_subkey(uninstall_key_path)
        .map_err(|e| format!("Failed to create registry key: {}", e))?;

    let _ = key.set_value("DisplayName", &"Depo Tool");
    let _ = key.set_value("DisplayIcon", &target_app_path.to_str().unwrap_or(""));
    let _ = key.set_value("UninstallString", &target_dir.join("uninstall.exe").to_str().unwrap_or(""));
    let _ = key.set_value("Publisher", &"Depo Tool Team");
    let _ = key.set_value("DisplayVersion", &"1.0.2");
    let _ = key.set_value("NoModify", &1u32);
    let _ = key.set_value("NoRepair", &1u32);

    Ok(())
}

#[tauri::command]
async fn uninstall_app() -> Result<(), String> {
    // Determine install path from current exe location
    if let Ok(current_exe) = env::current_exe() {
        let install_dir = current_exe.parent().unwrap();
        
        // Kill running app if exists
        kill_process_by_name("depo-tool");

        // 1. Remove Registry Key
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let _ = hkcu.delete_subkey_all("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DepoTool");

        if let Some(desktop_dir) = dirs::desktop_dir() {
            let shortcut_path = desktop_dir.join("Depo Tool.lnk");
            if shortcut_path.exists() {
                let _ = fs::remove_file(shortcut_path);
            }
        }

        if let Some(start_menu_dir) = dirs::data_dir().map(|dir| dir.join("Microsoft\\Windows\\Start Menu\\Programs")) {
            let shortcut_path = start_menu_dir.join("Depo Tool.lnk");
            if shortcut_path.exists() {
                let _ = fs::remove_file(shortcut_path);
            }
        }

        if let Ok(entries) = fs::read_dir(install_dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if let Some(name) = path.file_name() {
                        if name.to_string_lossy().to_lowercase() != "uninstall.exe" {
                            if path.is_dir() {
                                let _ = fs::remove_dir_all(path);
                            } else {
                                let _ = fs::remove_file(path);
                            }
                        }
                    }
                }
            }
        }
        
        // 4. Self-delete using VBScript (Silent, no PowerShell/CMD)
        let vbs_path = install_dir.join("cleanup.vbs");
        // VBScript to delete the exe and then itself
        let vbs_content = format!(
            "WScript.Sleep 1000\r\n\
             Set fso = CreateObject(\"Scripting.FileSystemObject\")\r\n\
             On Error Resume Next\r\n\
             fso.DeleteFile \"{}\", True\r\n\
             fso.DeleteFile \"{}\", True",
             current_exe.to_str().unwrap(),
             vbs_path.to_str().unwrap()
        );
        
        if fs::write(&vbs_path, vbs_content).is_ok() {
             // Execute VBScript with wscript (invisible) detached
             let _ = Command::new("wscript")
                .arg(&vbs_path)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }
        
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    ensure_elevated();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![install_app, uninstall_app, check_if_uninstalling, launch_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
