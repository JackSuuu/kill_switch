// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    CustomMenuItem, Manager, SystemTray,
    SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem, Window,
};
use tauri::api::notification::Notification;

// ─── Tauri Commands ───────────────────────────────────────────────────────────

#[tauri::command]
fn notify_focus_done(app_handle: tauri::AppHandle) {
    let _ = Notification::new(&app_handle.config().tauri.bundle.identifier)
        .title("☢ FOCUS SEQUENCE COMPLETE")
        .body("25 minutes locked in. Take a 10-minute break — you earned it.")
        .show();
}

#[tauri::command]
fn notify_break_done(app_handle: tauri::AppHandle) {
    let _ = Notification::new(&app_handle.config().tauri.bundle.identifier)
        .title("⚡ BREAK OVER — BACK TO WORK")
        .body("Rest cycle complete. Initiate next focus sequence.")
        .show();
}

#[tauri::command]
fn update_tray_title(app_handle: tauri::AppHandle, text: String) {
    if let Some(tray) = app_handle.tray_handle_by_id("main") {
        let _ = tray.set_title(&text);
    }
}

#[tauri::command]
fn show_main_window(window: Window) {
    let _ = window.show();
    let _ = window.set_focus();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

fn main() {
    let show = CustomMenuItem::new("show".to_string(), "Show Window");
    let sep  = SystemTrayMenuItem::Separator;
    let quit = CustomMenuItem::new("quit".to_string(), "Quit KILL_SWITCH");

    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_native_item(sep)
        .add_item(quit);

    let system_tray = SystemTray::new()
        .with_id("main")
        .with_menu(tray_menu)
        .with_title("☢");

    tauri::Builder::default()
        .system_tray(system_tray)
        .setup(|app| {
            if let Some(win) = app.get_window("main") {
                let _ = win.center();
                win.show()?;
            }
            Ok(())
        })
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
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                event.window().hide().unwrap();
                api.prevent_close();
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
