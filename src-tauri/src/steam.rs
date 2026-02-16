use serde::{Deserialize, Serialize};
use reqwest::Client;
use log::{info, error};
use futures_util::stream::{self, StreamExt};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameInfo {
    pub id: u32,
    pub name: String,
    pub thumbnail: String, // Keep for legacy/search API
    pub header_image: String,
    pub library_image: String,
    pub library_hero: String,
    #[serde(default)]
    pub installed_files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameDetails {
    pub short_description: String,
    pub detailed_description: String,
    pub screenshots: Vec<String>,
    pub movies: Vec<String>,
    pub pc_requirements: Option<Requirements>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Requirements {
    pub minimum: Option<String>,
    pub recommended: Option<String>,
}

#[derive(Deserialize)]
struct StoreSearchResults {
    items: Vec<StoreSearchResultItem>,
}

#[derive(Deserialize)]
struct StoreSearchResultItem {
    name: String,
    logo: String,
}

#[derive(Deserialize)]
struct AppDetailsResponse {
    #[serde(flatten)]
    games: HashMap<String, AppDetailsEntry>,
}

#[derive(Deserialize)]
struct AppDetailsEntry {
    success: bool,
    data: Option<AppDetailsData>,
}

#[derive(Deserialize)]
struct AppDetailsData {
    name: Option<String>,
    short_description: Option<String>,
    detailed_description: Option<String>,
    screenshots: Option<Vec<Screenshot>>,
    movies: Option<Vec<Movie>>,
    #[serde(default)] // It might be an array [] if empty in JSON, handling that might require custom deser, but let's try direct map first or generic value
    pc_requirements: Option<serde_json::Value>, 
}

#[derive(Deserialize)]
struct Screenshot {
    path_thumbnail: String,
    path_full: String,
}

#[derive(Deserialize)]
struct Movie {
    mp4: Option<MovieMp4>,
}

#[derive(Deserialize)]
struct MovieMp4 {
    #[serde(rename = "480")]
    _480: String,
    max: String,
}

pub async fn get_game_details(game_id: u32) -> Result<GameDetails, String> {
    info!("Fetching details for game {}", game_id);
    let client = Client::new();
    let url = format!("https://store.steampowered.com/api/appdetails?appids={}", game_id);
    
    let response = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Accept", "application/json, text/plain, */*")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Referer", "https://store.steampowered.com/")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let details_map: HashMap<String, AppDetailsEntry> = response.json()
        .await
        .map_err(|e| {
            error!("Failed to parse app details: {}", e);
            e.to_string()
        })?;

    if let Some(entry) = details_map.get(&game_id.to_string()) {
        if entry.success {
            if let Some(data) = &entry.data {
                let screenshots = data.screenshots.as_ref()
                    .map(|s| s.iter().map(|scr| scr.path_full.clone()).collect())
                    .unwrap_or_default();
                
                let movies = data.movies.as_ref()
                    .map(|m| m.iter().filter_map(|mov| mov.mp4.as_ref().map(|mp4| mp4.max.clone())).collect())
                    .unwrap_or_default();

                // Parse requirements manually from Value to handle array vs object
                let mut reqs = None;
                if let Some(val) = &data.pc_requirements {
                    if let Ok(parsed) = serde_json::from_value::<Requirements>(val.clone()) {
                        reqs = Some(parsed);
                    }
                }

                return Ok(GameDetails {
                    short_description: data.short_description.clone().unwrap_or_default(),
                    detailed_description: data.detailed_description.clone().unwrap_or_default(),
                    screenshots,
                    movies,
                    pc_requirements: reqs,
                });
            }
        }
    }

    // Return partial/default details instead of failing completely
    // This handles DLCs or items that don't have full store pages but exist in the ecosystem
    info!("Returning default details for game {}", game_id);
    Ok(GameDetails {
        short_description: "No description available.".to_string(),
        detailed_description: "<p>No details available for this item.</p>".to_string(),
        screenshots: Vec::new(),
        movies: Vec::new(),
        pc_requirements: None,
    })
}

#[derive(Deserialize)]
struct FeaturedCategoriesResponse {
    #[serde(rename = "top_sellers")]
    top_sellers: Option<FeaturedCategory>,
    #[serde(rename = "new_releases")]
    new_releases: Option<FeaturedCategory>,
    #[serde(rename = "specials")]
    specials: Option<FeaturedCategory>,
}

#[derive(Deserialize)]
struct FeaturedCategory {
    items: Vec<FeaturedItem>,
}

#[derive(Deserialize)]
struct FeaturedItem {
    id: u32,
    name: String,
    large_capsule_image: String,
}

pub async fn get_featured_games() -> Result<Vec<GameInfo>, String> {
    info!("Fetching featured games");
    let client = Client::new();
    let url = "https://store.steampowered.com/api/featuredcategories";
    
    let response = client.get(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Accept", "application/json, text/plain, */*")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Referer", "https://store.steampowered.com/")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Steam API error: {}", response.status()));
    }

    let featured_data: FeaturedCategoriesResponse = response.json()
        .await
        .map_err(|e| e.to_string())?;

    let mut games = Vec::new();

    // Helper to add games from category
    let mut add_category = |cat: Option<FeaturedCategory>| {
        if let Some(c) = cat {
            for item in c.items {
                // Filter out non-game items (DLCs, Hardware, Upgrades)
                // 54029: CS:GO Prime Status Upgrade
                // 1675200: Steam Deck
                // 1059530: Valve Index Headset
                // 1059550: Valve Index Controllers
                if [54029, 1675200, 1059530, 1059550].contains(&item.id) {
                    continue;
                }

                // Filter out Bundles by name heuristic since API doesn't provide type
                if item.name.contains("Bundle") || item.name.contains("Collection") {
                    continue;
                }

                games.push(GameInfo {
                    id: item.id,
                    name: item.name,
                    thumbnail: item.large_capsule_image,
                    header_image: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", item.id),
                    library_image: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_600x900.jpg", item.id),
                    library_hero: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_hero.jpg", item.id),
                    installed_files: Vec::new(),
                });
            }
        }
    };

    add_category(featured_data.top_sellers);
    add_category(featured_data.new_releases);
    add_category(featured_data.specials);

    // Dedup by ID
    games.sort_by_key(|g| g.id);
    games.dedup_by_key(|g| g.id);

    info!("Fetched {} featured games", games.len());
    Ok(games)
}

pub async fn search_games(query: &str) -> Result<Vec<GameInfo>, String> {
    info!("Searching for games with query: {}", query);
    let client = Client::new();

    // Check if query is an App ID
    if let Ok(app_id) = query.parse::<u32>() {
        info!("Query detected as App ID: {}", app_id);
        // Try to fetch app details directly
        let url = format!("https://store.steampowered.com/api/appdetails?appids={}", app_id);
        if let Ok(response) = client.get(&url)
            // Use same headers as browser to avoid 403
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .header("Accept", "application/json, text/plain, */*")
            .header("Accept-Language", "en-US,en;q=0.9")
            .header("Referer", "https://store.steampowered.com/")
            .send().await 
        {
            if let Ok(details_map) = response.json::<HashMap<String, AppDetailsEntry>>().await {
                if let Some(entry) = details_map.get(&app_id.to_string()) {
                    if entry.success {
                        if let Some(data) = &entry.data {
                            if let Some(name) = &data.name {
                                info!("Found game by ID: {}", name);
                                return Ok(vec![GameInfo {
                                    id: app_id,
                                    name: name.clone(),
                                    thumbnail: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", app_id),
                                    header_image: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", app_id),
                                    library_image: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_600x900.jpg", app_id),
                                    library_hero: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_hero.jpg", app_id),
                                    installed_files: Vec::new(),
                                }]);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Switch to the main store search endpoint with json=1, which returns better results
    let url = format!("https://store.steampowered.com/search/results/?term={}&json=1&cc=US&l=english", query);
    
    // Add user agent to avoid 403 Forbidden
    let response = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Accept", "application/json, text/plain, */*")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Referer", "https://store.steampowered.com/")
        .send()
        .await
        .map_err(|e| {
            error!("Network error searching games: {}", e);
            e.to_string()
        })?;

    if !response.status().is_success() {
        error!("Steam API returned error: {}", response.status());
        return Err(format!("Steam API error: {}", response.status()));
    }

    let search_data: StoreSearchResults = response.json()
        .await
        .map_err(|e| {
            error!("Failed to parse search response: {}", e);
            e.to_string()
        })?;

    let games: Vec<GameInfo> = search_data.items.into_iter()
        .filter_map(|item| {
            // Extract ID from logo URL: https://shared.fastly.steamstatic.com/.../apps/{ID}/...
            let parts: Vec<&str> = item.logo.split("/apps/").collect();
            if parts.len() < 2 {
                return None;
            }
            let id_part = parts[1].split('/').next()?;
            let id = id_part.parse::<u32>().ok()?;

            Some(GameInfo {
                id,
                name: item.name,
                thumbnail: item.logo, // Use the logo provided by search
                header_image: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", id),
                library_image: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_600x900.jpg", id),
                library_hero: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_hero.jpg", id),
                installed_files: Vec::new(),
            })
        })
        .collect();

    info!("Found {} games for query '{}'", games.len(), query);
    Ok(games)
}

pub async fn get_game_briefs(app_ids: Vec<u32>) -> Result<Vec<GameInfo>, String> {
    if app_ids.is_empty() {
        return Ok(Vec::new());
    }

    let client = Client::new();
    let results = stream::iter(app_ids)
        .map(|id| {
            let client = client.clone();
            async move {
                let url = format!("https://store.steampowered.com/api/appdetails?appids={}", id);
                let response = client
                    .get(&url)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .header("Accept", "application/json, text/plain, */*")
                    .header("Accept-Language", "en-US,en;q=0.9")
                    .header("Referer", "https://store.steampowered.com/")
                    .send()
                    .await
                    .ok()?;

                if !response.status().is_success() {
                    return None;
                }

                let details_map: HashMap<String, AppDetailsEntry> = response.json().await.ok()?;
                let entry = details_map.get(&id.to_string())?;
                if !entry.success {
                    return None;
                }
                let data = entry.data.as_ref()?;
                let name = data.name.as_ref()?;
                Some(GameInfo {
                    id,
                    name: name.clone(),
                    thumbnail: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", id),
                    header_image: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", id),
                    library_image: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_600x900.jpg", id),
                    library_hero: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_hero.jpg", id),
                    installed_files: Vec::new(),
                })
            }
        })
        .buffer_unordered(6)
        .collect::<Vec<_>>()
        .await;

    let games = results.into_iter().flatten().collect();
    Ok(games)
}

pub async fn check_availability(game_id: &str) -> bool {
    let client = Client::new();
    let url1 = format!("https://api.luagen.revobd.club/{}.zip", game_id);
    let url2 = format!("https://codeload.github.com/SteamAutoCracks/ManifestHub/zip/refs/heads/{}", game_id);

    if let Ok(resp) = client.head(&url1).send().await {
        if resp.status().is_success() {
            return true;
        }
    }

    if let Ok(resp) = client.head(&url2).send().await {
        if resp.status().is_success() {
            return true;
        }
    }

    false
}
