fn main() {
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

