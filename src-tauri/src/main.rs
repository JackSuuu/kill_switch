// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{
    CustomMenuItem, Manager, PhysicalPosition, SystemTray,
    SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem, Window,
};
use tauri::api::notification::Notification;

// ─── Window geometry persistence ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
struct WindowGeometry {
    x: i32,
    y: i32,
}

impl Default for WindowGeometry {
    fn default() -> Self {
        Self { x: -1, y: -1 }
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
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string(geo) {
        let _ = fs::write(path, json);
    }
}

/// Restore only position, clamped so the window stays fully on-screen.
fn restore_geometry(win: &Window, geo: &WindowGeometry) {
    if geo.x < 0 || geo.y < 0 {
        let _ = win.center();
        return;
    }

    // Get current window size (set by tauri.conf.json, fixed)
    let (win_w, win_h) = win.inner_size()
        .map(|s| (s.width as i32, s.height as i32))
        .unwrap_or((520, 680));

    // Find the monitor that best contains the saved position
    let monitors = win.available_monitors().unwrap_or_default();
    let target_monitor = monitors.iter().find(|m| {
        let p = m.position();
        let s = m.size();
        geo.x >= p.x && geo.x < p.x + s.width as i32
            && geo.y >= p.y && geo.y < p.y + s.height as i32
    });

    match target_monitor {
        Some(monitor) => {
            let mp = monitor.position();
            let ms = monitor.size();
            // Clamp so the window is fully visible on this monitor
            let x = geo.x.max(mp.x).min(mp.x + ms.width as i32 - win_w);
            let y = geo.y.max(mp.y).min(mp.y + ms.height as i32 - win_h);
            let _ = win.set_position(PhysicalPosition::new(x, y));
        }
        None => {
            // Saved position is off all monitors — center instead
            let _ = win.center();
        }
    }
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
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    if let Ok(pos) = event.window().outer_position() {
                        let geo = WindowGeometry { x: pos.x, y: pos.y };
                        save_geometry(&event.window().app_handle(), &geo);
                    }
                    event.window().hide().unwrap();
                    api.prevent_close();
                }

                // ── Track move ────────────────────────────────────────────
                tauri::WindowEvent::Moved(pos) => {
                    let geo = WindowGeometry { x: pos.x, y: pos.y };
                    let mut state = debounce.lock().unwrap();
                    state.0 = Some(Instant::now());
                    state.1 = geo;
                    drop(state);

                    let debounce2 = Arc::clone(&debounce);
                    let app_handle = event.window().app_handle();
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
