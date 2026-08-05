use serde_json::{json, Value};
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
#[cfg(feature = "embedded-core")]
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
#[cfg(feature = "embedded-core")]
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
#[cfg(mobile)]
use tauri_plugin_opener::OpenerExt;
#[cfg(feature = "embedded-core")]
use tauri_plugin_shell::{process::CommandChild, ShellExt};
use url::Url;

#[cfg(desktop)]
use tauri_plugin_updater::UpdaterExt;

const VAULT_FILE: &str = "wallet.aahvault";
const CALL_AUDIT_FILE: &str = "call-audit.jsonl";
const CEX_BASE_URL: &str = "https://cex.aah.name";

#[cfg(feature = "embedded-core")]
struct EmbeddedCore(Mutex<Option<CommandChild>>);

#[cfg(feature = "embedded-core")]
fn local_core_is_running() -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], 8989));
    TcpStream::connect_timeout(&address, std::time::Duration::from_millis(250)).is_ok()
}

#[cfg(feature = "embedded-core")]
fn start_embedded_core(app: &AppHandle) -> Result<Option<CommandChild>, String> {
    if local_core_is_running() {
        println!("[내장 Core] 127.0.0.1:8989에서 실행 중인 IEUM Core를 사용합니다.");
        return Ok(None);
    }

    let core_directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("내장 Core 데이터 경로 확인 실패: {error}"))?
        .join("core");
    fs::create_dir_all(&core_directory)
        .map_err(|error| format!("내장 Core 데이터 폴더 생성 실패: {error}"))?;

    let (mut events, child) = app
        .shell()
        .sidecar("ieum-chain")
        .map_err(|error| format!("내장 Core 실행 파일 확인 실패: {error}"))?
        .current_dir(core_directory)
        .args(["--mode", "client"])
        .spawn()
        .map_err(|error| format!("내장 Core 시작 실패: {error}"))?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line)
                | tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    eprintln!("[내장 Core] {}", String::from_utf8_lossy(&line));
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(status) => {
                    eprintln!("[내장 Core] 종료됨: {status:?}");
                }
                _ => {}
            }
        }
    });
    Ok(Some(child))
}

#[cfg(feature = "embedded-core")]
fn stop_embedded_core(app: &AppHandle) {
    if let Some(state) = app.try_state::<EmbeddedCore>() {
        if let Ok(mut child) = state.0.lock() {
            if let Some(mut process) = child.take() {
                let _ = process.kill();
            }
        }
    }
}

fn vault_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(VAULT_FILE))
        .map_err(|error| format!("지갑 저장 경로를 찾지 못했습니다: {error}"))
}

fn write_vault(path: &Path, contents: &str) -> Result<(), String> {
    if contents.len() > 128 * 1024 {
        return Err("지갑 파일 크기가 비정상적으로 큽니다.".into());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("지갑 폴더 생성 실패: {error}"))?;
    }
    // 임시 파일을 먼저 완성하고 rename하여 중간에 앱이 종료돼도 손상을 줄입니다.
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, contents).map_err(|error| format!("임시 지갑 저장 실패: {error}"))?;
    fs::rename(&temporary, path).map_err(|error| format!("지갑 저장 완료 처리 실패: {error}"))
}

fn append_call_audit(path: &Path, event: &Value) -> Result<(), String> {
    const ALLOWED_EVENTS: &[&str] = &[
        "permission_granted",
        "permission_denied",
        "call_started",
        "connected",
        "call_ended",
        "call_failed",
    ];
    let event_name = event.get("event").and_then(Value::as_str).unwrap_or("");
    let call_id = event.get("callId").and_then(Value::as_str).unwrap_or("");
    let room_id = event.get("roomId").and_then(Value::as_str).unwrap_or("");
    let occurred_at = event
        .get("occurredAt")
        .and_then(Value::as_str)
        .unwrap_or("");
    if !ALLOWED_EVENTS.contains(&event_name)
        || call_id.is_empty()
        || call_id.len() > 80
        || room_id.is_empty()
        || room_id.len() > 256
        || occurred_at.is_empty()
    {
        return Err("통화 감사 이벤트 형식이 올바르지 않습니다.".into());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("감사 폴더 생성 실패: {error}"))?;
    }
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| format!("감사 파일 열기 실패: {error}"))?;
    serde_json::to_writer(&mut file, event)
        .map_err(|error| format!("감사 기록 변환 실패: {error}"))?;
    file.write_all(b"\n")
        .map_err(|error| format!("감사 기록 저장 실패: {error}"))
}

#[tauri::command]
fn write_call_audit(app: AppHandle, event: Value) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("감사 저장 경로를 찾지 못했습니다: {error}"))?
        .join(CALL_AUDIT_FILE);
    append_call_audit(&path, &event)
}

fn call_audit_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(CALL_AUDIT_FILE))
        .map_err(|error| format!("감사 저장 경로를 찾지 못했습니다: {error}"))
}

fn read_call_audit_file(path: &Path) -> Result<Vec<Value>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path).map_err(|error| format!("감사 기록 읽기 실패: {error}"))?;
    let mut entries = raw
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            serde_json::from_str::<Value>(line)
                .map_err(|error| format!("감사 기록 형식 오류: {error}"))
        })
        .collect::<Result<Vec<_>, _>>()?;
    if entries.len() > 200 {
        entries.drain(..entries.len() - 200);
    }
    entries.reverse();
    Ok(entries)
}

#[tauri::command]
fn read_call_audit(app: AppHandle) -> Result<Vec<Value>, String> {
    read_call_audit_file(&call_audit_path(&app)?)
}

#[tauri::command]
fn clear_call_audit(app: AppHandle) -> Result<(), String> {
    let path = call_audit_path(&app)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("감사 기록 삭제 실패: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
fn vault_exists(app: AppHandle) -> Result<bool, String> {
    Ok(vault_path(&app)?.exists())
}

#[tauri::command]
fn save_vault(app: AppHandle, contents: String) -> Result<(), String> {
    write_vault(&vault_path(&app)?, &contents)
}

#[tauri::command]
fn load_vault(app: AppHandle) -> Result<String, String> {
    fs::read_to_string(vault_path(&app)?).map_err(|error| format!("지갑 읽기 실패: {error}"))
}

fn validate_rpc_url(value: &str) -> Result<Url, String> {
    let parsed = Url::parse(value).map_err(|_| "RPC 주소 형식이 올바르지 않습니다.")?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("RPC 주소는 http 또는 https만 사용할 수 있습니다.".into());
    }
    if parsed.username() != "" || parsed.password().is_some() {
        return Err("사용자 정보가 포함된 RPC 주소는 사용할 수 없습니다.".into());
    }
    Ok(parsed)
}

#[tauri::command]
async fn rpc_call(
    rpc_url: String,
    method: String,
    params: Vec<Value>,
    id: u64,
) -> Result<Value, String> {
    let url = validate_rpc_url(&rpc_url)?;
    // 임의의 메서드를 호출하지 못하게 지갑에 필요한 읽기/전송 메서드만 허용합니다.
    const ALLOWED: &[&str] = &[
        "eth_chainId",
        "eth_getBalance",
        "eth_getTransactionCount",
        "eth_sendRawTransaction",
        "eth_getTransactionByHash",
        "eth_getTransactionReceipt",
        "eth_blockNumber",
        "ieum_nodeStatus",
        "ieum_syncStatus",
        "ieum_finalizedBlock",
        "ieum_networkIdentity",
        "ieum_protocolVersion",
        "ieum_recoveryStatus",
        "ieum_getRecoveryByTransaction",
        "ieum_sendCommunication",
        "ieum_pollCommunication",
    ];
    if !ALLOWED.contains(&method.as_str()) {
        return Err(format!("지갑에서 허용하지 않은 RPC 메서드입니다: {method}"));
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|error| format!("HTTP 클라이언트 생성 실패: {error}"))?;
    let response = client
        .post(url)
        .json(&json!({"jsonrpc": "2.0", "id": id, "method": method, "params": params}))
        .send()
        .await
        .map_err(|error| format!("IEUM 노드 연결 실패: {error}"))?;
    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|error| format!("IEUM 노드 응답 읽기 실패(HTTP {status}): {error}"))?;
    if !status.is_success() {
        return Err(format!(
            "IEUM 노드 HTTP 오류: {status}. 서버 응답: {}",
            response_preview(&response_text)
        ));
    }
    if response_text.trim().is_empty() {
        return Err(format!(
            "IEUM 노드가 빈 응답을 반환했습니다(HTTP {status})."
        ));
    }
    serde_json::from_str::<Value>(&response_text).map_err(|error| {
        format!(
            "IEUM 노드가 JSON이 아닌 응답을 반환했습니다(HTTP {status}): {error}. 서버 응답: {}",
            response_preview(&response_text)
        )
    })
}

fn validate_cex_path(path: &str) -> Result<Url, String> {
    if !path.starts_with("/api/v1/simple-swap/") || path.contains("..") {
        return Err("허용하지 않은 CEX API 경로입니다.".into());
    }
    Url::parse(&format!("{CEX_BASE_URL}{path}"))
        .map_err(|error| format!("CEX API 주소 오류: {error}"))
}

#[tauri::command]
async fn cex_call(path: String, method: String, body: Option<Value>) -> Result<Value, String> {
    let url = validate_cex_path(&path)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| format!("CEX 연결 준비 실패: {error}"))?;
    let request = match method.as_str() {
        "GET" => client.get(url),
        "POST" => client.post(url).json(&body.unwrap_or(Value::Null)),
        _ => return Err("CEX API는 GET과 POST만 허용합니다.".into()),
    };
    let response = request
        .send()
        .await
        .map_err(|error| format!("CEX 연결 실패: {error}"))?;
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_owned();
    let response_text = response
        .text()
        .await
        .map_err(|error| format!("CEX 응답 읽기 실패(HTTP {status}): {error}"))?;

    if !status.is_success() {
        let detail = cex_error_detail(&response_text);
        if status == reqwest::StatusCode::NOT_FOUND {
            return Err(format!(
                "CEX 간편교환 API가 아직 서버에 배포되지 않았습니다(HTTP {status}). \
                 cex.aah.name에 {path} 구현 또는 Caddy 연결이 필요합니다. 서버 응답: {detail}"
            ));
        }
        return Err(format!("CEX 오류(HTTP {status}): {detail}"));
    }

    if response_text.trim().is_empty() {
        return Err(format!(
            "CEX가 빈 응답을 반환했습니다(HTTP {status}). API 서버 또는 Caddy 연결을 확인해 주세요."
        ));
    }

    serde_json::from_str::<Value>(&response_text).map_err(|error| {
        let preview = response_preview(&response_text);
        format!(
            "CEX가 JSON이 아닌 응답을 반환했습니다(HTTP {status}, Content-Type: {content_type}): \
             {error}. 서버 응답: {preview}"
        )
    })
}

fn cex_error_detail(text: &str) -> String {
    serde_json::from_str::<Value>(text)
        .ok()
        .and_then(|value| {
            value
                .get("message")
                .or_else(|| value.get("error"))
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
        .filter(|message| !message.trim().is_empty())
        .unwrap_or_else(|| response_preview(text))
}

fn response_preview(text: &str) -> String {
    let single_line = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if single_line.is_empty() {
        return "(응답 본문 없음)".into();
    }
    const MAX_CHARS: usize = 240;
    let mut preview = single_line.chars().take(MAX_CHARS).collect::<String>();
    if single_line.chars().count() > MAX_CHARS {
        preview.push('…');
    }
    preview
}

#[tauri::command]
fn open_aah_site(app: AppHandle) -> Result<(), String> {
    #[cfg(mobile)]
    {
        // 모바일은 다중 WebView 창 대신 운영체제 기본 브라우저를 사용합니다.
        // 원격 사이트가 지갑 WebView 및 Tauri IPC와 섞이지 않도록 하기 위한 분기입니다.
        return app
            .opener()
            .open_url("https://aah.name", None::<&str>)
            .map_err(|error| format!("기본 브라우저 열기 실패: {error}"));
    }

    #[cfg(desktop)]
    {
        if let Some(window) = app.get_webview_window("aah-site") {
            window
                .set_focus()
                .map_err(|error| format!("사이트 창 열기 실패: {error}"))?;
            return Ok(());
        }

        let url =
            Url::parse("https://aah.name").map_err(|error| format!("사이트 주소 오류: {error}"))?;
        // 원격 사이트는 main 지갑 창과 분리하며 capabilities에 등록하지 않아 IPC를 사용할 수 없습니다.
        WebviewWindowBuilder::new(&app, "aah-site", WebviewUrl::External(url))
            .title("IEUM 공식 사이트")
            .inner_size(1100.0, 760.0)
            .min_inner_size(360.0, 640.0)
            .build()
            .map_err(|error| format!("IEUM 사이트 창 생성 실패: {error}"))?;
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());
    #[cfg(feature = "embedded-core")]
    let builder = builder.plugin(tauri_plugin_shell::init());

    let builder = builder
        .setup(|app| {
            #[cfg(feature = "embedded-core")]
            {
                let child = start_embedded_core(app.handle())?;
                app.manage(EmbeddedCore(Mutex::new(child)));
            }
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = check_and_install_update(handle).await {
                        eprintln!("[월렛 자동 업데이트] 확인 또는 설치 실패: {error}");
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            vault_exists,
            save_vault,
            load_vault,
            rpc_call,
            cex_call,
            write_call_audit,
            read_call_audit,
            clear_call_audit,
            open_aah_site
        ]);

    #[cfg(feature = "embedded-core")]
    let builder = builder.on_window_event(|window, event| {
        if window.label() == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
            stop_embedded_core(window.app_handle());
        }
    });

    builder
        .run(tauri::generate_context!())
        .expect("IEUM Wallet 실행 중 오류가 발생했습니다.");
}

#[cfg(desktop)]
async fn check_and_install_update(app: AppHandle) -> Result<(), String> {
    let Some(update) = app
        .updater()
        .map_err(|error| format!("업데이트 기능 초기화 실패: {error}"))?
        .check()
        .await
        .map_err(|error| format!("최신 버전 확인 실패: {error}"))?
    else {
        println!("[월렛 자동 업데이트] 현재 버전이 최신입니다.");
        return Ok(());
    };

    println!(
        "[월렛 자동 업데이트] 새 버전 {}을 내려받습니다.",
        update.version
    );
    update
        .download_and_install(
            |downloaded, total| {
                if let Some(total) = total {
                    println!("[월렛 자동 업데이트] {downloaded}/{total} bytes");
                }
            },
            || println!("[월렛 자동 업데이트] 다운로드 완료, 설치를 시작합니다."),
        )
        .await
        .map_err(|error| format!("업데이트 다운로드 또는 설치 실패: {error}"))?;

    println!("[월렛 자동 업데이트] 설치 완료, 월렛을 다시 시작합니다.");
    app.restart();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rpc_url_rejects_unsafe_schemes_and_credentials() {
        assert!(validate_rpc_url("http://127.0.0.1:8545").is_ok());
        assert!(validate_rpc_url("file:///etc/passwd").is_err());
        assert!(validate_rpc_url("http://user:pass@127.0.0.1:8545").is_err());
    }

    #[test]
    fn cex_proxy_only_allows_simple_swap_api() {
        assert!(validate_cex_path("/api/v1/simple-swap/status/s1").is_ok());
        assert!(validate_cex_path("/api/v1/price").is_err());
        assert!(validate_cex_path("/api/v1/simple-swap/../admin").is_err());
    }

    #[test]
    fn cex_error_detail_supports_json_html_and_empty_bodies() {
        assert_eq!(cex_error_detail(r#"{"message":"not found"}"#), "not found");
        assert_eq!(
            cex_error_detail("<html><body>404 Not Found</body></html>"),
            "<html><body>404 Not Found</body></html>"
        );
        assert_eq!(cex_error_detail(""), "(응답 본문 없음)");
    }

    #[test]
    fn response_preview_is_single_line_and_bounded() {
        assert_eq!(response_preview("hello\n  world"), "hello world");
        assert!(response_preview(&"가".repeat(300)).chars().count() <= 241);
    }

    #[test]
    fn vault_write_is_atomic_and_readable() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join(VAULT_FILE);
        write_vault(&path, r#"{"version":1,"ciphertext":"test"}"#).unwrap();
        assert_eq!(
            fs::read_to_string(path).unwrap(),
            r#"{"version":1,"ciphertext":"test"}"#
        );
    }

    #[test]
    fn call_audit_accepts_metadata_but_rejects_unknown_events() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join(CALL_AUDIT_FILE);
        append_call_audit(
            &path,
            &json!({
                "event": "call_started",
                "callId": "call-1",
                "roomId": "room-1",
                "occurredAt": "2026-07-29T00:00:00Z"
            }),
        )
        .unwrap();
        assert!(fs::read_to_string(&path).unwrap().contains("call_started"));
        assert!(append_call_audit(
            &path,
            &json!({"event":"recording","callId":"x","roomId":"y","occurredAt":"z"})
        )
        .is_err());
    }

    #[test]
    fn call_audit_read_is_newest_first_and_clearable() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join(CALL_AUDIT_FILE);
        for index in 1..=2 {
            append_call_audit(
                &path,
                &json!({
                    "event": "call_started",
                    "callId": format!("call-{index}"),
                    "roomId": "room-1",
                    "occurredAt": format!("2026-07-29T00:00:0{index}Z")
                }),
            )
            .unwrap();
        }
        let entries = read_call_audit_file(&path).unwrap();
        assert_eq!(entries[0]["callId"], "call-2");
        assert_eq!(entries[1]["callId"], "call-1");
        fs::remove_file(&path).unwrap();
        assert!(read_call_audit_file(&path).unwrap().is_empty());
    }
}
