use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let embedded_path = out_dir.join("embedded_depo_tool.exe");
    let source_path = PathBuf::from("resources").join("depo-tool.exe");
    if fs::copy(&source_path, &embedded_path).is_err() {
        let _ = fs::write(&embedded_path, []);
    }

    #[cfg(windows)]
    {
        // Don't add manifest via linker arg OR winres if tauri-build adds one.
        // Tauri v2 by default adds a manifest with "asInvoker".
        // To change it to "requireAdministrator", we can try to use `tauri.conf.json` if it supports it (it didn't).
        
        // Alternatively, we can use a linker flag to modify the UAC level of the EXISTING manifest?
        // /MANIFESTUAC:level='requireAdministrator' is supposed to update the manifest.
        // But the previous attempt failed with duplicate resource because we also used /MANIFEST:EMBED?
        
        // Let's try ONLY /MANIFESTUAC.
        // And NOT /MANIFEST:EMBED (which implies adding a NEW manifest).
        
        println!("cargo:rustc-link-arg-bin=installer=/MANIFESTUAC:level='requireAdministrator'");
        println!("cargo:rustc-link-arg-bin=installer=/MANIFESTUAC:uiAccess='false'");
    }
    tauri_build::build()
}

