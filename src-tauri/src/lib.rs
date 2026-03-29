use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
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

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_presentation)
                .item(&new_playlist)
                .item(&new_library)
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

            // -------- Screens --------
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