use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::webview::DownloadEvent;
use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl};
use tauri_plugin_dialog::DialogExt;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
enum DownloadProgress {
    #[serde(rename = "started")]
    Started {
        label: String,
        url: String,
        path: String,
    },
    #[serde(rename = "finished")]
    Finished {
        label: String,
        url: String,
        path: Option<String>,
        success: bool,
    },
    #[serde(rename = "cancelled")]
    Cancelled { label: String, url: String },
}

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

fn suggested_filename(destination: &Path, url: &str) -> String {
    if let Some(name) = destination.file_name().and_then(|n| n.to_str()) {
        if !name.is_empty() {
            return name.to_string();
        }
    }

    if let Ok(parsed) = url::Url::parse(url) {
        if let Some(segment) = parsed.path_segments().and_then(|mut s| s.next_back()) {
            let decoded = urlencoding_decode(segment);
            let trimmed = decoded.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }

    "download".to_string()
}

fn urlencoding_decode(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("");
            if let Ok(code) = u8::from_str_radix(hex, 16) {
                out.push(code as char);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
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
    let download_app = app.clone();
    let download_label = label.clone();
    let webview_builder = WebviewBuilder::new(&label, parse_webview_url(&url)?)
        .data_directory(session_dir)
        .enable_clipboard_access()
        .on_download(move |_webview, event| match event {
            DownloadEvent::Requested { url, destination } => {
                let suggested = suggested_filename(&destination, url.as_str());
                let chosen = download_app
                    .dialog()
                    .file()
                    .set_title("Lưu file đã tải")
                    .set_file_name(&suggested)
                    .blocking_save_file();

                match chosen {
                    Some(file_path) => match file_path.into_path() {
                        Ok(path) => {
                            *destination = path.clone();
                            let _ = download_app.emit(
                                "native-webview-download",
                                DownloadProgress::Started {
                                    label: download_label.clone(),
                                    url: url.to_string(),
                                    path: path.to_string_lossy().into_owned(),
                                },
                            );

                            // Workaround: WebView2 on Windows often does NOT fire
                            // DownloadEvent::Finished. Poll the file size; when it
                            // stops growing for a few ticks, assume the download
                            // is complete and emit Finished ourselves.
                            let watch_app = download_app.clone();
                            let watch_label = download_label.clone();
                            let watch_url = url.to_string();
                            let watch_path = path.clone();
                            std::thread::spawn(move || {
                                let mut last_size: u64 = 0;
                                let mut stable_ticks: u32 = 0;
                                let mut total_ticks: u32 = 0;
                                // Poll up to ~10 minutes (600s).
                                while total_ticks < 1200 {
                                    std::thread::sleep(Duration::from_millis(500));
                                    total_ticks += 1;
                                    let size = std::fs::metadata(&watch_path)
                                        .map(|m| m.len())
                                        .unwrap_or(0);
                                    if size > 0 && size == last_size {
                                        stable_ticks += 1;
                                        // 3 ticks * 500ms = 1.5s of no growth.
                                        if stable_ticks >= 3 {
                                            let _ = watch_app.emit(
                                                "native-webview-download",
                                                DownloadProgress::Finished {
                                                    label: watch_label.clone(),
                                                    url: watch_url.clone(),
                                                    path: Some(
                                                        watch_path.to_string_lossy().into_owned(),
                                                    ),
                                                    success: true,
                                                },
                                            );
                                            return;
                                        }
                                    } else {
                                        stable_ticks = 0;
                                        last_size = size;
                                    }
                                }
                                // Timeout — emit a finished/error so the UI doesn't hang.
                                let _ = watch_app.emit(
                                    "native-webview-download",
                                    DownloadProgress::Finished {
                                        label: watch_label.clone(),
                                        url: watch_url.clone(),
                                        path: Some(watch_path.to_string_lossy().into_owned()),
                                        success: false,
                                    },
                                );
                            });

                            true
                        }
                        Err(_) => {
                            let _ = download_app.emit(
                                "native-webview-download",
                                DownloadProgress::Cancelled {
                                    label: download_label.clone(),
                                    url: url.to_string(),
                                },
                            );
                            false
                        }
                    },
                    None => {
                        let _ = download_app.emit(
                            "native-webview-download",
                            DownloadProgress::Cancelled {
                                label: download_label.clone(),
                                url: url.to_string(),
                            },
                        );
                        false
                    }
                }
            }
            DownloadEvent::Finished { url, path, success } => {
                eprintln!(
                    "[download] finished label={} url={} path={:?} success={}",
                    download_label,
                    url,
                    path,
                    success,
                );
                let _ = download_app.emit(
                    "native-webview-download",
                    DownloadProgress::Finished {
                        label: download_label.clone(),
                        url: url.to_string(),
                        path: path.as_ref().map(|p| p.to_string_lossy().into_owned()),
                        success,
                    },
                );
                true
            }
            _ => true,
        });

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
async fn native_webview_load_url(app: tauri::AppHandle, label: String, url: String) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| "Không tìm thấy webview đang mở".to_string())?;
    let parsed: url::Url = url
        .parse()
        .map_err(|error| format!("URL không hợp lệ: {error}"))?;
    webview
        .navigate(parsed)
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

fn pane_sessions_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("pane-sessions"))
}

fn add_dir_to_zip<W: Write + std::io::Seek>(
    zip: &mut ZipWriter<W>,
    base_dir: &Path,
    src: &Path,
    options: SimpleFileOptions,
) -> Result<(), String> {
    for entry in WalkDir::new(src) {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let relative = path
            .strip_prefix(base_dir)
            .map_err(|error| error.to_string())?;
        let name = relative.to_string_lossy().replace('\\', "/");

        if path.is_dir() {
            if !name.is_empty() {
                zip.add_directory(format!("{}/", name), options)
                    .map_err(|error| error.to_string())?;
            }
            continue;
        }

        zip.start_file(&name, options)
            .map_err(|error| error.to_string())?;
        let mut file = File::open(path).map_err(|error| error.to_string())?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|error| error.to_string())?;
        zip.write_all(&buffer)
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn backup_sessions_zip(app: tauri::AppHandle, output_path: String) -> Result<(), String> {
    let root = pane_sessions_root(&app)?;
    if !root.exists() {
        return Err("Chưa có session nào để backup".to_string());
    }

    let file = File::create(&output_path).map_err(|error| error.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    add_dir_to_zip(&mut zip, &root, &root, options)?;
    zip.finish().map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
async fn restore_sessions_zip(app: tauri::AppHandle, input_path: String) -> Result<(), String> {
    let root = pane_sessions_root(&app)?;
    std::fs::create_dir_all(&root).map_err(|error| error.to_string())?;

    let file = File::open(&input_path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        let outpath = match entry.enclosed_name() {
            Some(path) => root.join(path),
            None => continue,
        };

        if entry.is_dir() {
            std::fs::create_dir_all(&outpath).map_err(|error| error.to_string())?;
            continue;
        }

        if let Some(parent) = outpath.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
        }

        let mut outfile = File::create(&outpath).map_err(|error| error.to_string())?;
        std::io::copy(&mut entry, &mut outfile).map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn reveal_path_in_folder(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    let folder = if target.is_file() {
        target.parent().map(|p| p.to_path_buf()).unwrap_or(target)
    } else {
        target
    };

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(folder)
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(folder)
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(folder)
            .spawn()
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn quit_app(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            native_webview_upsert,
            native_webview_hide,
            native_webview_close,
            native_webview_navigate,
            native_webview_load_url,
            native_webview_tab_status,
            delete_profile_session,
            backup_sessions_zip,
            restore_sessions_zip,
            reveal_path_in_folder,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
