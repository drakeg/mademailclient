#[cfg(any(target_os = "macos", target_os = "windows"))]
pub struct NativeMenus {
    _menu: muda::Menu,
}
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub struct NativeMenus;

impl NativeMenus {
    pub fn install(
        _cc: &eframe::CreationContext<'_>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        #[cfg(any(target_os = "macos", target_os = "windows"))]
        {
            use muda::{Menu, MenuItem, PredefinedMenuItem, Submenu};
            let menu = Menu::new();
            #[cfg(target_os = "macos")]
            {
                let app = Submenu::new("Made Mail", true);
                app.append_items(&[
                    &MenuItem::with_id("about", "About Made Mail", true, None),
                    &MenuItem::with_id("accounts", "Accounts…", true, None),
                    &PredefinedMenuItem::separator(),
                    &PredefinedMenuItem::services(None),
                    &PredefinedMenuItem::hide(None),
                    &PredefinedMenuItem::hide_others(None),
                    &PredefinedMenuItem::show_all(None),
                    &PredefinedMenuItem::separator(),
                    &PredefinedMenuItem::quit(None),
                ])?;
                menu.append(&app)?;
            }
            let file = Submenu::new("File", true);
            file.append_items(&[
                &MenuItem::with_id("accounts", "Add Account…", true, None),
                &PredefinedMenuItem::close_window(None),
            ])?;
            menu.append(&file)?;
            let edit = Submenu::new("Edit", true);
            edit.append_items(&[
                &PredefinedMenuItem::copy(None),
                &PredefinedMenuItem::select_all(None),
            ])?;
            menu.append(&edit)?;
            let view = Submenu::new("View", true);
            view.append(&MenuItem::with_id("all-inboxes", "All Inboxes", true, None))?;
            menu.append(&view)?;
            let mailbox = Submenu::new("Mailbox", true);
            mailbox.append_items(&[
                &MenuItem::new("Rules…", false, None),
                &MenuItem::new("Empty Junk…", false, None),
                &MenuItem::new("Empty Deleted Items…", false, None),
            ])?;
            menu.append(&mailbox)?;
            let window = Submenu::new("Window", true);
            window.append_items(&[
                &PredefinedMenuItem::minimize(None),
                &PredefinedMenuItem::maximize(None),
            ])?;
            menu.append(&window)?;
            #[cfg(target_os = "macos")]
            {
                window.set_as_windows_menu_for_nsapp();
                menu.init_for_nsapp();
            }
            #[cfg(target_os = "windows")]
            {
                use raw_window_handle::{HasWindowHandle, RawWindowHandle};
                if let RawWindowHandle::Win32(handle) = _cc.window_handle()?.as_raw() {
                    // SAFETY: eframe owns a live Win32 window on this thread. Menu outlives attachment.
                    unsafe {
                        menu.init_for_hwnd(handle.hwnd.get() as _)?;
                    }
                } else {
                    return Err("Expected a Win32 window".into());
                }
            }
            Ok(Self { _menu: menu })
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        Ok(Self)
    }
}
pub fn next_command() -> Option<String> {
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        muda::MenuEvent::receiver()
            .try_recv()
            .ok()
            .map(|event| event.id.0)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        None
    }
}
