use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder, Menu};
use std::sync::OnceLock;
static FULL_MENU: OnceLock<Menu<tauri::Wry>> = OnceLock::new();
use tauri::{Manager, Emitter};

mod ndi;

#[tauri::command]
fn get_system_fonts() -> Vec<String> {
    use std::collections::BTreeSet;
    use std::fs;
    use std::path::PathBuf;

    let mut fonts: BTreeSet<String> = BTreeSet::new();

    let home_fonts = dirs::home_dir()
        .map(|h: PathBuf| h.join("Library/Fonts"))
        .unwrap_or_default();

    let font_dirs: Vec<PathBuf> = vec![
        PathBuf::from("/System/Library/Fonts"),
        PathBuf::from("/Library/Fonts"),
        home_fonts,
        PathBuf::from("C:\\Windows\\Fonts"),
    ];

    for dir in font_dirs {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let ext = path.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if matches!(ext.as_str(), "ttf" | "otf" | "ttc") {
                    if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                        let name = stem.replace('-', " ").replace('_', " ");
                        let family = name
                            .split(|c: char| !c.is_alphanumeric() && c != ' ')
                            .next()
                            .unwrap_or(&name)
                            .trim()
                            .to_string();
                        if !family.is_empty() {
                            fonts.insert(family);
                        }
                    }
                }
            }
        }
    }

    fonts.into_iter().collect()
}


#[tauri::command]
fn open_media_inspector(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("media-inspector") {
        let _ = w.show();
        let _ = w.set_focus();
    } else {
        let _ = tauri::WebviewWindowBuilder::new(
            &app,
            "media-inspector",
            tauri::WebviewUrl::App("index.html#/media-inspector".into()),
        )
        .title("Inspector")
        .inner_size(820.0, 440.0)
        .min_inner_size(700.0, 380.0)
        .center()
        .build();
    }
}

#[tauri::command]
fn confirm_close(app: tauri::AppHandle) {
    for (_, window) in app.webview_windows() {
        let _ = window.destroy();
    }
}

#[tauri::command]
fn finish_splash(app: tauri::AppHandle) {
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.show().unwrap();
        main_win.set_focus().unwrap();
        // Tell main window to play the trailer
        let _ = main_win.emit("splash-done", ());
    }
    if let Some(splash_win) = app.get_webview_window("splash") {
        splash_win.close().unwrap();
    }
}

#[tauri::command]
fn launch_output_window(handle: tauri::AppHandle, label: String, x: i32, y: i32, w: f64, h: f64) {
    if let Some(window) = handle.get_webview_window(&label) {
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        let _ = tauri::WebviewWindowBuilder::new(
            &handle,
            &label,
            tauri::WebviewUrl::App("index.html".into()), // Loads App.jsx
        )
        .title("Output Display")
        .position(x as f64, y as f64)
        .inner_size(w, h)
        .fullscreen(true)
        .always_on_top(true)
        .decorations(false)
        .build();
    }
}

#[tauri::command]
fn next_slide(_window: tauri::Window) {
    println!("Next slide triggered");
    // later: emit to frontend or advance slide state
}

#[tauri::command]
fn prev_slide(_window: tauri::Window) {
    println!("Previous slide triggered");
}

#[tauri::command]
fn open_audience_window(handle: tauri::AppHandle) {
    if let Some(window) = handle.get_webview_window("audience") {
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        let _ = tauri::WebviewWindowBuilder::new(
            &handle,
            "audience",
            tauri::WebviewUrl::App("index.html".into()),
        )
        .title("Audience Display")
        .inner_size(800.0, 600.0)
        .build();
    }
}

#[tauri::command]
fn rebuild_full_menu(app: tauri::AppHandle) {
    // Signal that the full menu should be restored
    // The full menu is built in setup() — we trigger a re-setup via event
    // Simplest approach: just emit rebuild-menu so frontend knows, and
    // separately build a minimal-but-complete menu here
    let _ = app.emit("full-menu-active", ());
    // The actual full menu rebuild happens in set_app_menu_visible(visible=false→true)
}

#[tauri::command]
fn set_app_menu_visible(app: tauri::AppHandle, visible: bool) {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
    // Build minimal menu (Launcher) or restore system menu signal
    // We emit to the setup handler via a stored state approach
    // For simplicity: emit event so JS can react if needed
    let _ = app.emit("app-menu-visibility", visible);
    // Rebuild menu inline
    if let Ok(about) = MenuItemBuilder::new("About ElevateFlow").id("about_min").build(&app) {
        if let Ok(quit) = MenuItemBuilder::new("Quit ElevateFlow").id("quit_min").accelerator("Cmd+Q").build(&app) {
            if let Ok(ef_menu) = SubmenuBuilder::new(&app, "ElevateFlow").item(&about).separator().item(&quit).build() {
                if !visible {
                    // Launcher: minimal menu — ElevateFlow only
                    if let Ok(menu) = MenuBuilder::new(&app).item(&ef_menu).build() {
                        let _ = app.set_menu(menu);
                    }
                } else {
                    // Flow: restore the full menu
                    if let Some(full) = FULL_MENU.get() {
                        let _ = app.set_menu(full.clone());
                    }
                }
            }
        }
    }
}

#[tauri::command]
fn get_monitors(app: tauri::AppHandle) -> Vec<serde_json::Value> {
    let mut result = Vec::new();
    if let Some(win) = app.get_webview_window("main") {
        if let Ok(monitors) = win.available_monitors() {
            // Find the primary monitor (position 0,0 or closest to it)
            let primary_idx = monitors.iter().enumerate()
                .min_by_key(|(_, m)| {
                    let p = m.position();
                    (p.x.abs() as i64) + (p.y.abs() as i64)
                })
                .map(|(i, _)| i)
                .unwrap_or(0);

            for (i, m) in monitors.iter().enumerate() {
                let size = m.size();
                let pos  = m.position();
                let sf   = m.scale_factor();
                let logical_w = (size.width as f64 / sf).round() as u32;
                let logical_h = (size.height as f64 / sf).round() as u32;
                let is_primary = i == primary_idx;

                // Build a useful display name
                let position_label = if is_primary {
                    "Primary".to_string()
                } else if pos.x > 0 { "Right".to_string() }
                  else if pos.x < 0 { "Left".to_string() }
                  else if pos.y > 0 { "Below".to_string() }
                  else { format!("Display {}", i + 1) };

                let name = format!("{} — {}×{}", position_label, logical_w, logical_h);

                result.push(serde_json::json!({
                    "name":        name,
                    "width":       logical_w,
                    "height":      logical_h,
                    "x":           (pos.x as f64 / sf).round() as i32,
                    "y":           (pos.y as f64 / sf).round() as i32,
                    "scaleFactor": sf,
                    "index":       i,
                    "isPrimary":   is_primary,
                }));
            }
        }
    }
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            open_media_inspector,
            confirm_close,
            get_system_fonts,
            finish_splash,
            next_slide,
            prev_slide,
            launch_output_window,
            ndi::ndi_capture_start,
            ndi::ndi_capture_stop,
            ndi::ndi_start,
            ndi::ndi_stop,
            ndi::ndi_send_frame,
            ndi::ndi_status,
            presentation_start_hosting,
            presentation_broadcast,
            presentation_stop_hosting,
            get_local_ip,
            get_monitors,
            set_app_menu_visible,
            rebuild_full_menu,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label().to_string();
                // Only intercept the main window — let others close freely
                if label == "main" {
                    api.prevent_close();
                    let app = window.app_handle().clone();
                    if let Some(w) = app.get_webview_window("close-confirm") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    } else {
                        let _ = tauri::WebviewWindowBuilder::new(
                            &app,
                            "close-confirm",
                            tauri::WebviewUrl::App("index.html#/close-confirm".into()),
                        )
                        .title("Close ElevateFlow")
                        .inner_size(360.0, 220.0)
                        .resizable(false)
                        .center()
                        .always_on_top(true)
                        .decorations(false)
                        .build();
                    }
                }
            }
        })
        .setup(|app| {
            // Ensure main window exists
            if app.get_webview_window("main").is_none() {
                tauri::WebviewWindowBuilder::new(
                    app,
                    "main",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("ElevateFlow")
                .build()?;
            }

            // -------- ElevateFlow --------
            let about = MenuItemBuilder::new("About ElevateFlow")
                .id("about")
                .build(app)?;
            let settings = MenuItemBuilder::new("Settings")
                .id("settings")
                .build(app)?;
            let quit = MenuItemBuilder::new("Quit ElevateFlow")
                .id("quit")
                .accelerator("Cmd+Q")
                .build(app)?;

            let elevateflow_menu = SubmenuBuilder::new(app, "ElevateFlow")
                .item(&about)
                .separator()
                .item(&settings)
                .separator()
                .item(&quit)
                .build()?;

            // -------- File --------
            let new_presentation = MenuItemBuilder::new("New Presentation")
                .id("new_presentation")
                .accelerator("Cmd+N")
                .build(app)?;
            let new_playlist = MenuItemBuilder::new("New Playlist")
                .id("new_playlist")
                .build(app)?;
            let new_library = MenuItemBuilder::new("New Library")
                .id("new_library")
                .build(app)?;

            let import_ef = MenuItemBuilder::new("Import Song (.ef)…")
                .id("import_ef")
                .accelerator("Cmd+Shift+I")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_presentation)
                .item(&new_playlist)
                .item(&new_library)
                .separator()
                .item(&import_ef)
                .build()?;

            // -------- Edit --------
            let undo = MenuItemBuilder::new("Undo")
                .id("undo")
                .accelerator("Cmd+Z")
                .build(app)?;
            let redo = MenuItemBuilder::new("Redo")
                .id("redo")
                .build(app)?;
            let cut = MenuItemBuilder::new("Cut")
                .id("cut")
                .accelerator("Cmd+X")
                .build(app)?;
            let copy = MenuItemBuilder::new("Copy")
                .id("copy")
                .accelerator("Cmd+C")
                .build(app)?;
            let paste = MenuItemBuilder::new("Paste")
                .id("paste")
                .accelerator("Cmd+V")
                .build(app)?;
            let duplicate = MenuItemBuilder::new("Duplicate")
                .id("duplicate")
                .accelerator("Cmd+D")
                .build(app)?;
            let delete = MenuItemBuilder::new("Delete")
                .id("delete")
                .accelerator("Backspace")
                .build(app)?;
            let select_all = MenuItemBuilder::new("Select All")
                .id("select_all")
                .accelerator("Cmd+A")
                .build(app)?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&undo)
                .item(&redo)
                .separator()
                .item(&cut)
                .item(&copy)
                .item(&paste)
                .separator()
                .item(&duplicate)
                .item(&delete)
                .separator()
                .item(&select_all)
                .build()?;

            // -------- Presentation --------
            let new_slide = MenuItemBuilder::new("New Slide")
                .id("new_slide")
                .build(app)?;
            let next_slide = MenuItemBuilder::new("Next Slide")
                .id("next_slide")
                .accelerator("Right")
                .build(app)?;
            let prev_slide = MenuItemBuilder::new("Previous Slide")
                .id("prev_slide")
                .accelerator("Left")
                .build(app)?;

            let presentation_menu = SubmenuBuilder::new(app, "Presentation")
                .item(&new_slide)
                .separator()
                .item(&next_slide)
                .item(&prev_slide)
                .build()?;

            // -------- Presentation Mode --------
            let start_hosting = MenuItemBuilder::new("Start Hosting")
                .id("presentation_start_hosting")
                .accelerator("Cmd+Shift+H")
                .build(app)?;
            let join_session = MenuItemBuilder::new("Join Session…")
                .id("presentation_join_session")
                .accelerator("Cmd+Shift+J")
                .build(app)?;
            let stop_hosting = MenuItemBuilder::new("Stop Hosting")
                .id("presentation_stop_hosting")
                .build(app)?;

            let presentation_menu = SubmenuBuilder::new(app, "Presentation Mode")
                .item(&start_hosting)
                .item(&join_session)
                .separator()
                .item(&stop_hosting)
                .build()?;
            let audience = MenuItemBuilder::new("Enable Audience")
                .id("audience")
                .accelerator("Cmd+1")
                .build(app)?;
            let stage = MenuItemBuilder::new("Enable Stage")
                .id("stage")
                .accelerator("Cmd+2")
                .build(app)?;
            let stage_edit = MenuItemBuilder::new("Edit Layouts")
                .id("stage_edit")
                .accelerator("Cmd+4")
                .build(app)?;
            let configure_screens = MenuItemBuilder::new("Configure Screens")
                .id("configure_screens")
                .accelerator("Opt+Cmd+1")
                .build(app)?;

            let windowed_output = MenuItemBuilder::new("Windowed Output")
                .id("windowed_output")
                .accelerator("Cmd+3")
                .build(app)?;

            let screens_menu = SubmenuBuilder::new(app, "Screens")
                .item(&audience)
                .separator()
                .item(&stage)
                .item(&stage_edit)
                .separator()
                .item(&windowed_output)
                .separator()
                .item(&configure_screens)
                .build()?;

            // -------- Graphics (NEW) --------
            let graphics = MenuItemBuilder::new("Graphics")
                .id("graphics")
                .build(app)?;

            // -------- View --------
            let editor = MenuItemBuilder::new("Editor")
                .id("view_editor")
                .accelerator("Ctrl+E")
                .build(app)?;

            let timecode = MenuItemBuilder::new("Timecode")
                .id("view_timecode")
                .accelerator("Ctrl+Shift+T")
                .build(app)?;

            let sync = MenuItemBuilder::new("Sync")
                .id("view_sync")
                .accelerator("Cmd+S")
                .build(app)?;

                let audience_sync = MenuItemBuilder::new("Audience Sync")
                .id("audience_sync")
                .accelerator("Cmd+S")
                .build(app)?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&editor)
                .item(&timecode)
                .separator()
                .item(&graphics)
                .item(&sync)
                .item(&audience_sync)
                .build()?;

            // -------- Build Menu --------
            let menu = MenuBuilder::new(app)
                .item(&elevateflow_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&presentation_menu)
                .item(&screens_menu)
                .item(&view_menu)
                .build()?;

            let _ = FULL_MENU.set(menu.clone());
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "about" => {
                    if let Some(window) = app.get_webview_window("about") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    } else {
                        let _ = tauri::WebviewWindowBuilder::new(
                            app,
                            "about",
                            tauri::WebviewUrl::App("index.html#/about".into()),
                        )
                        .title("About ElevateFlow")
                        .inner_size(340.0, 420.0)
                        .resizable(false)
                        .center()
                        .decorations(false)
                                                .always_on_top(true)
                        .build()
                        .unwrap();
                    }
                }
                "import_ef" => {
                    if let Some(main_win) = app.get_webview_window("main") {
                        let _ = main_win.emit("menu-import-ef", ());
                    }
                }
                "audience" => {
                    // Corrected: 'app' in this context is already the handle
                    open_audience_window(app.clone());
                }
                "audience_sync" => {
    // This tells the Audience window specifically to show its code input
    app.emit("toggle-audience-hud", ()).unwrap();
}
                "view_sync" => {
                    app.emit("toggle-sync-panel", ()).unwrap();
                }
                "settings" => {
                    if let Some(window) = app.get_webview_window("settings") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    } else {
                        tauri::WebviewWindowBuilder::new(
                            app,
                            "settings",
                            tauri::WebviewUrl::App("index.html#/settings".into()),
                        )
                        .title("Settings")
                        .inner_size(600.0, 400.0)
                        .build()
                        .unwrap();
                    }
                }
                "account" => {
                    if let Some(window) = app.get_webview_window("account") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    } else {
                        tauri::WebviewWindowBuilder::new(
                            app,
                            "account",
                            tauri::WebviewUrl::App("index.html#/account".into()),
                        )
                        .title("ElevateFlow Account")
                        .inner_size(420.0, 580.0)
                        .resizable(false)
                        .build()
                        .unwrap();
                    }
                }
                "configure_screens" => {
                    if let Some(window) = app.get_webview_window("configure_screens") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    } else {
                        tauri::WebviewWindowBuilder::new(
                            app,
                            "configure_screens",
                            tauri::WebviewUrl::App("index.html#/configure-screens".into()),
                        )
                        .title("Configure Screens")
                        .inner_size(1100.0, 700.0)
                        .resizable(true)
                        .build()
                        .unwrap();
                    }
                }
                "graphics" => {
                    if let Some(window) = app.get_webview_window("graphics") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    } else {
                        tauri::WebviewWindowBuilder::new(
                            app,
                            "graphics",
                            tauri::WebviewUrl::App("index.html#/graphics".into()),
                        )
                        .title("Graphics")
                        .inner_size(1400.0, 800.0)
                        .build()
                        .unwrap();
                    }
                }
                "presentation_start_hosting" => {
                    if let Some(main_win) = app.get_webview_window("main") {
                        let _ = main_win.emit("menu-presentation-start-hosting", ());
                    }
                }
                "presentation_join_session" => {
                    if let Some(main_win) = app.get_webview_window("main") {
                        let _ = main_win.emit("menu-presentation-join-session", ());
                    }
                }
                "presentation_stop_hosting" => {
                    if let Some(main_win) = app.get_webview_window("main") {
                        let _ = main_win.emit("menu-presentation-stop-hosting", ());
                    }
                }
                "windowed_output" => {
                    if let Some(main_win) = app.get_webview_window("main") {
                        let _ = main_win.emit("menu-windowed-output", ());
                    }
                }
                "view_timecode" => {
                    if let Some(window) = app.get_webview_window("timecode") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    } else {
                        tauri::WebviewWindowBuilder::new(
                            app,
                            "timecode",
                            tauri::WebviewUrl::App("index.html#/timecode".into()),
                        )
                        .title("Timecode")
                        .inner_size(500.0, 600.0)
                        .build()
                        .unwrap();
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
// ══════════════════════════════════════════════════════════════════
// PRESENTATION MODE — WebSocket server (host) + client connection
// ══════════════════════════════════════════════════════════════════
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tokio::sync::broadcast;

// Global broadcast channel for slide payloads
lazy_static::lazy_static! {
    static ref PRESENTATION_TX: Mutex<Option<broadcast::Sender<String>>> = Mutex::new(None);
    static ref PRESENTATION_PORT: Mutex<u16> = Mutex::new(0);
}

#[tauri::command]
async fn presentation_start_hosting(app: tauri::AppHandle) -> Result<String, String> {
    use warp::Filter;
    use futures_util::{StreamExt, SinkExt};

    // Pick a random port
    let port: u16 = 47823;

    // Create broadcast channel
    let (tx, _rx) = broadcast::channel::<String>(64);
    {
        let mut lock = PRESENTATION_TX.lock().unwrap();
        *lock = Some(tx.clone());
        let mut p = PRESENTATION_PORT.lock().unwrap();
        *p = port;
    }

    let tx_filter = warp::any().map(move || tx.clone());

    let ws_route = warp::path("ef-presentation")
        .and(warp::ws())
        .and(tx_filter)
        .map(|ws: warp::ws::Ws, tx: broadcast::Sender<String>| {
            ws.on_upgrade(move |websocket| async move {
                let mut rx = tx.subscribe();
                let (mut ws_tx, _ws_rx) = websocket.split();
                // Forward every broadcast message to this client
                while let Ok(msg) = rx.recv().await {
                    if ws_tx.send(warp::ws::Message::text(msg)).await.is_err() {
                        break;
                    }
                }
            })
        });

    // Get local IP
    let ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    // Spawn server
    tokio::spawn(async move {
        warp::serve(ws_route)
            .run(([0, 0, 0, 0], port))
            .await;
    });

    // Notify frontend
    let _ = app.emit("presentation-hosting-started", serde_json::json!({
        "ip": ip,
        "port": port,
        "code": &ip.split('.').last().unwrap_or("??").to_string()
    }));

    Ok(format!("{}:{}", ip, port))
}

#[tauri::command]
fn presentation_broadcast(payload: String) -> Result<(), String> {
    let lock = PRESENTATION_TX.lock().unwrap();
    if let Some(tx) = lock.as_ref() {
        let _ = tx.send(payload);
    }
    Ok(())
}

#[tauri::command]
fn presentation_stop_hosting(app: tauri::AppHandle) -> Result<(), String> {
    let mut lock = PRESENTATION_TX.lock().unwrap();
    *lock = None;
    let _ = app.emit("presentation-hosting-stopped", ());
    Ok(())
}

#[tauri::command]
fn get_local_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string())
}