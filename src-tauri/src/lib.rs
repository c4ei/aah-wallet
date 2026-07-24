use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

const VAULT_FILE: &str = "wallet.aahvault";

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
        .map_err(|error| format!("AAH 노드 연결 실패: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("AAH 노드 HTTP 오류: {}", response.status()));
    }
    response
        .json::<Value>()
        .await
        .map_err(|error| format!("AAH 노드 응답 해석 실패: {error}"))
}

#[tauri::command]
fn open_aah_site(app: AppHandle) -> Result<(), String> {
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
        .title("AAH 공식 사이트")
        .inner_size(1100.0, 760.0)
        .min_inner_size(360.0, 640.0)
        .build()
        .map_err(|error| format!("AAH 사이트 창 생성 실패: {error}"))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            vault_exists,
            save_vault,
            load_vault,
            rpc_call,
            open_aah_site
        ])
        .run(tauri::generate_context!())
        .expect("AAH Wallet 실행 중 오류가 발생했습니다.");
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
    fn vault_write_is_atomic_and_readable() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join(VAULT_FILE);
        write_vault(&path, r#"{"version":1,"ciphertext":"test"}"#).unwrap();
        assert_eq!(
            fs::read_to_string(path).unwrap(),
            r#"{"version":1,"ciphertext":"test"}"#
        );
    }
}
