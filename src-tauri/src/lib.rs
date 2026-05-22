use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeTabStatus {
    title: String,
    url: String,
    favicon_url: String,
    is_loading: bool,
}

fn parse_webview_url(url: &str) -> Result<WebviewUrl, String> {
    Ok(WebviewUrl::External(
        url.parse().map_err(|error| format!("URL không hợp lệ: {error}"))?,
    ))
}

fn sanitize_path_part(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect();

    if sanitized.is_empty() {
        "default".to_string()
    } else {
        sanitized
    }
}

fn profile_session_directory(app: &tauri::AppHandle, profile_id: &str) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("pane-sessions");
    let session_dir = base_dir.join(sanitize_path_part(profile_id));

    std::fs::create_dir_all(&session_dir).map_err(|error| error.to_string())?;

    Ok(session_dir)
}

#[tauri::command]
async fn native_webview_upsert(
    app: tauri::AppHandle,
    profile_id: String,
    label: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if width < 1.0 || height < 1.0 {
        return Ok(());
    }

    if let Some(webview) = app.get_webview(&label) {
        webview
            .set_position(LogicalPosition::new(x, y))
            .map_err(|error| error.to_string())?;
        webview
            .set_size(LogicalSize::new(width, height))
            .map_err(|error| error.to_string())?;
        webview.show().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let window = app
        .get_window("main")
        .ok_or_else(|| "Không tìm thấy cửa sổ chính".to_string())?;
    let session_dir = profile_session_directory(&app, &profile_id)?;
    let webview_builder = WebviewBuilder::new(&label, parse_webview_url(&url)?)
        .data_directory(session_dir)
        .enable_clipboard_access();

    window
        .add_child(
            webview_builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
async fn delete_profile_session(app: tauri::AppHandle, profile_id: String) -> Result<(), String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("pane-sessions")
        .join(sanitize_path_part(&profile_id));

    if base_dir.exists() {
        std::fs::remove_dir_all(&base_dir).map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn native_webview_hide(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&label) {
        webview.hide().map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn native_webview_close(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&label) {
        webview.close().map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn native_webview_navigate(app: tauri::AppHandle, label: String, action: String) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| "Không tìm thấy webview đang mở".to_string())?;

    match action.as_str() {
        "back" => webview.eval("history.back()"),
        "forward" => webview.eval("history.forward()"),
        "reload" => webview.reload(),
        _ => return Err(format!("Hành động điều hướng không hợp lệ: {action}")),
    }
    .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
async fn native_webview_tab_status(app: tauri::AppHandle, label: String) -> Result<NativeTabStatus, String> {
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| "Không tìm thấy webview đang mở".to_string())?;
    let current_url = webview.url().map(|url| url.to_string()).unwrap_or_default();
    let (sender, receiver) = mpsc::channel::<String>();

    webview
        .eval_with_callback(
            r#"
            (() => {
              const favicon = document.querySelector('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]');
              const faviconHref = favicon ? favicon.href : '';

              return {
                title: document.title || '',
                url: '',
                faviconUrl: faviconHref,
                isLoading: document.readyState !== 'complete'
              };
            })()
            "#,
            move |result| {
                let _ = sender.send(result);
            },
        )
        .map_err(|error| error.to_string())?;

    let raw_status = receiver.recv_timeout(Duration::from_millis(700)).unwrap_or_else(|_| {
        "{\"title\":\"\",\"url\":\"\",\"faviconUrl\":\"\",\"isLoading\":false}".to_string()
    });
    let json_status: String = serde_json::from_str(&raw_status).unwrap_or(raw_status);
    let mut status = serde_json::from_str::<NativeTabStatus>(&json_status).unwrap_or(NativeTabStatus {
        title: String::new(),
        url: String::new(),
        favicon_url: String::new(),
        is_loading: false,
    });

    status.url = current_url;

    Ok(status)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            native_webview_upsert,
            native_webview_hide,
            native_webview_close,
            native_webview_navigate,
            native_webview_tab_status,
            delete_profile_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
