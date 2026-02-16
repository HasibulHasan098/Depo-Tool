import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAIN_APP_PATH = path.resolve(__dirname, '..');
const INSTALLER_PATH = __dirname;

const MAIN_PACKAGE_JSON = path.join(MAIN_APP_PATH, 'package.json');
const INSTALLER_PACKAGE_JSON = path.join(INSTALLER_PATH, 'package.json');
const INSTALLER_TAURI_CONF = path.join(INSTALLER_PATH, 'src-tauri', 'tauri.conf.json');

const MAIN_EXE_PATH = path.join(MAIN_APP_PATH, 'src-tauri', 'target', 'release', 'depo-tool.exe');
const INSTALLER_RESOURCES_DIR = path.join(INSTALLER_PATH, 'src-tauri', 'resources');
const INSTALLER_EXE_TARGET = path.join(INSTALLER_RESOURCES_DIR, 'depo-tool.exe');

async function main() {
    console.log('Starting Installer Update...');

    // 1. Read Main App Version
    if (!fs.existsSync(MAIN_PACKAGE_JSON)) {
        console.error('Main package.json not found!');
        process.exit(1);
    }
    const mainPkg = await fs.readJson(MAIN_PACKAGE_JSON);
    const version = mainPkg.version;
    console.log(`Main App Version: ${version}`);

    // 2. Update Installer package.json
    const installerPkg = await fs.readJson(INSTALLER_PACKAGE_JSON);
    if (installerPkg.version !== version) {
        installerPkg.version = version;
        await fs.writeJson(INSTALLER_PACKAGE_JSON, installerPkg, { spaces: 2 });
        console.log(`Updated installer package.json to ${version}`);
    } else {
        console.log('Installer package.json is already up to date.');
    }

    // 3. Update Installer tauri.conf.json
    const tauriConf = await fs.readJson(INSTALLER_TAURI_CONF);
    if (tauriConf.version !== version) {
        tauriConf.version = version;
        await fs.writeJson(INSTALLER_TAURI_CONF, tauriConf, { spaces: 2 });
        console.log(`Updated installer tauri.conf.json to ${version}`);
    } else {
        console.log('Installer tauri.conf.json is already up to date.');
    }

    // 4. Copy Executable
    if (fs.existsSync(MAIN_EXE_PATH)) {
        await fs.ensureDir(INSTALLER_RESOURCES_DIR);
        await fs.copy(MAIN_EXE_PATH, INSTALLER_EXE_TARGET);
        console.log(`Copied depo-tool.exe from release folder to resources.`);
    } else {
        console.warn(`WARNING: Main app executable not found at ${MAIN_EXE_PATH}. Skipping copy.`);
        console.warn('Ensure you have built the main app using "npm run tauri build" first if you want to bundle the latest version.');
    }

    console.log('Installer Update Complete.');
}

main().catch(console.error);
