use enigo::{Enigo, Keyboard, Settings};
use tauri::Manager;

#[tauri::command]
async fn type_text(text: String) {
    let mut enigo = Enigo::new(&Settings::default()).unwrap();
    // Type slower to avoid overwhelming the target application
    for c in text.chars() {
        let _ = enigo.text(&c.to_string());
        // 10ms delay between characters seems robust for most apps
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      let show_i = tauri::menu::MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
      let hide_i = tauri::menu::MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
      let menu = tauri::menu::Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

      println!("Initializing Tray...");
      if let Some(icon) = app.default_window_icon() {
          let _tray = tauri::tray::TrayIconBuilder::new()
            .icon(icon.clone())
            .menu(&menu)
            .on_menu_event(|app, event| match event.id.as_ref() {
              "quit" => {
                app.exit(0);
              }
              "show" => {
                 if let Some(win) = app.get_webview_window("main") {
                     let _ = win.show();
                     let _ = win.set_focus();
                 }
              }
              "hide" => {
                 if let Some(win) = app.get_webview_window("main") {
                     let _ = win.hide();
                 }
              }
              _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                    let app = tray.app_handle();
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            })
            .build(app)?;
          println!("Tray initialized successfully!");
      } else {
          eprintln!("ERROR: Could not load default window icon for tray!");
      }

      Ok(())
    })
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_clipboard_manager::init())
    .invoke_handler(tauri::generate_handler![type_text, quit_app])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
