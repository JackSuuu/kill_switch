// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{
    CustomMenuItem, Manager, PhysicalPosition, PhysicalSize, SystemTray,
    SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem, Window,
};
use tauri::api::notification::Notification;

// ─── Window geometry persistence ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
struct WindowGeometry {
    x:      i32,
    y:      i32,
    width:  u32,
    height: u32,
}

impl Default for WindowGeometry {
    fn default() -> Self {
        // Matches tauri.conf.json defaults
        Self { x: -1, y: -1, width: 1100, height: 780 }
    }
}

fn geometry_path(app: &tauri::AppHandle) -> PathBuf {
    app.path_resolver()
        .app_data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("window_geometry.json")
}

fn load_geometry(app: &tauri::AppHandle) -> WindowGeometry {
    let path = geometry_path(app);
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_geometry(app: &tauri::AppHandle, geo: &WindowGeometry) {
    let path = geometry_path(app);
    // Ensure parent dir exists
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string(geo) {
        let _ = fs::write(path, json);
    }
}

/// Apply saved geometry to the window on startup.
fn restore_geometry(win: &Window, geo: &WindowGeometry) {
    // Only apply saved position if it looks sane (not the -1 sentinel)
    if geo.x >= 0 && geo.y >= 0 {
        let _ = win.set_position(PhysicalPosition::new(geo.x, geo.y));
    } else {
        let _ = win.center();
    }
    let _ = win.set_size(PhysicalSize::new(geo.width, geo.height));
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

/// Called when a 25-min focus session completes
#[tauri::command]
fn notify_focus_done(app_handle: tauri::AppHandle) {
    let _ = Notification::new(&app_handle.config().tauri.bundle.identifier)
        .title("☢ FOCUS SEQUENCE COMPLETE")
        .body("25 minutes locked in. Take a 10-minute break — you earned it.")
        .show();
}

/// Called when a 10-min break session completes
#[tauri::command]
fn notify_break_done(app_handle: tauri::AppHandle) {
    let _ = Notification::new(&app_handle.config().tauri.bundle.identifier)
        .title("⚡ BREAK OVER — BACK TO WORK")
        .body("Rest cycle complete. Initiate next focus sequence.")
        .show();
}

/// Updates the system tray title to show live countdown
#[tauri::command]
fn update_tray_title(app_handle: tauri::AppHandle, text: String) {
    if let Some(tray) = app_handle.tray_handle_by_id("main") {
        let _ = tray.set_title(&text);
    }
}

/// Show the main window and bring it to front
#[tauri::command]
fn show_main_window(window: Window) {
    let _ = window.show();
    let _ = window.set_focus();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

fn main() {
    // Build tray menu
    let show  = CustomMenuItem::new("show".to_string(),  "Show Window");
    let sep   = SystemTrayMenuItem::Separator;
    let quit  = CustomMenuItem::new("quit".to_string(),  "Quit KILL_SWITCH");

    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_native_item(sep)
        .add_item(quit);

    let system_tray = SystemTray::new()
        .with_id("main")
        .with_menu(tray_menu)
        .with_title("☢");

    // Shared debounce state: (last_dirty_instant, pending_geometry)
    // We throttle saves so we don't hammer the disk on every pixel moved.
    type DebouncedGeo = Arc<Mutex<(Option<Instant>, WindowGeometry)>>;
    let debounce: DebouncedGeo =
        Arc::new(Mutex::new((None, WindowGeometry::default())));

    tauri::Builder::default()
        .system_tray(system_tray)
        // ── Restore saved geometry right after setup ──────────────────────
        .setup(|app| {
            if let Some(win) = app.get_window("main") {
                let geo = load_geometry(&app.handle());
                restore_geometry(&win, &geo);
                win.show()?;
            }
            Ok(())
        })
        // ── Tray events ───────────────────────────────────────────────────
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                if let Some(win) = app.get_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => {
                    if let Some(win) = app.get_window("main") {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
                "quit" => std::process::exit(0),
                _ => {}
            },
            _ => {}
        })
        // ── Window events: persist geometry + hide-to-tray ────────────────
        .on_window_event(move |event| {
            match event.event() {
                // ── Hide to tray on close ─────────────────────────────────
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // Save geometry one final time before hiding
                    if let (Ok(size), Ok(pos)) = (
                        event.window().inner_size(),
                        event.window().outer_position(),
                    ) {
                        let geo = WindowGeometry {
                            x:      pos.x,
                            y:      pos.y,
                            width:  size.width,
                            height: size.height,
                        };
                        save_geometry(&event.window().app_handle(), &geo);
                    }
                    event.window().hide().unwrap();
                    api.prevent_close();
                }

                // ── Track resize ──────────────────────────────────────────
                tauri::WindowEvent::Resized(size) => {
                    let win = event.window();
                    if let Ok(pos) = win.outer_position() {
                        let geo = WindowGeometry {
                            x:      pos.x,
                            y:      pos.y,
                            width:  size.width,
                            height: size.height,
                        };
                        let mut state = debounce.lock().unwrap();
                        state.0 = Some(Instant::now());
                        state.1 = geo;
                        drop(state);

                        // Spawn a short-lived thread to flush after 600ms quiet
                        let debounce2 = Arc::clone(&debounce);
                        let app_handle = win.app_handle();
                        std::thread::spawn(move || {
                            std::thread::sleep(Duration::from_millis(600));
                            let mut state = debounce2.lock().unwrap();
                            if let Some(t) = state.0 {
                                if t.elapsed() >= Duration::from_millis(599) {
                                    save_geometry(&app_handle, &state.1);
                                    state.0 = None;
                                }
                            }
                        });
                    }
                }

                // ── Track move ────────────────────────────────────────────
                tauri::WindowEvent::Moved(pos) => {
                    let win = event.window();
                    if let Ok(size) = win.inner_size() {
                        let geo = WindowGeometry {
                            x:      pos.x,
                            y:      pos.y,
                            width:  size.width,
                            height: size.height,
                        };
                        let mut state = debounce.lock().unwrap();
                        state.0 = Some(Instant::now());
                        state.1 = geo;
                        drop(state);

                        let debounce2 = Arc::clone(&debounce);
                        let app_handle = win.app_handle();
                        std::thread::spawn(move || {
                            std::thread::sleep(Duration::from_millis(600));
                            let mut state = debounce2.lock().unwrap();
                            if let Some(t) = state.0 {
                                if t.elapsed() >= Duration::from_millis(599) {
                                    save_geometry(&app_handle, &state.1);
                                    state.0 = None;
                                }
                            }
                        });
                    }
                }

                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            notify_focus_done,
            notify_break_done,
            update_tray_title,
            show_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running KILL_SWITCH");
}
