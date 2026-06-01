use anyhow::Result;
use chrono::Utc;
use serde::{de::DeserializeOwned, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

pub struct VaultPaths {
    pub root: PathBuf,
}

impl VaultPaths {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn settings_path(&self) -> PathBuf {
        self.root.join("settings.json")
    }

    pub fn tasks_path(&self) -> PathBuf {
        self.root.join("tasks.json")
    }

    pub fn checks_path(&self) -> PathBuf {
        self.root.join("checks.json")
    }

    pub fn events_path(&self) -> PathBuf {
        self.root.join("events.ndjson")
    }
}

pub fn read_json<T: DeserializeOwned>(path: &Path) -> Result<T> {
    let content = fs::read_to_string(path)?;
    let data = serde_json::from_str(&content)?;
    Ok(data)
}

pub fn append_event<T: Serialize>(path: &Path, event: &T) -> Result<()> {
    let mut line = serde_json::to_string(event)?;
    line.push('\n');

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;

    file.write_all(line.as_bytes())?;
    file.flush()?;
    Ok(())
}

pub fn file_sha256(path: &Path) -> String {
    let content = fs::read(path).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(content);
    hex::encode(hasher.finalize())
}

pub fn backup_file(path: &Path, backups_dir: &Path) -> Result<()> {
    if !path.exists() {
        return Ok(());
    }
    fs::create_dir_all(backups_dir)?;
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy())
        .unwrap_or_default();
    let ts = Utc::now().format("%Y%m%d_%H%M%S");
    let backup_name = format!("{}_backup_{}.{}", stem, ts, ext);
    let backup_path = backups_dir.join(&backup_name);
    fs::copy(path, backup_path)?;
    Ok(())
}

pub fn atomic_write_json<T: Serialize>(path: &Path, data: &T) -> Result<String> {
    let content = serde_json::to_string_pretty(data)?;
    let encoded = format!("{}\n", content).into_bytes();

    let tmp_path = path.with_extension("json.tmp");
    {
        let mut tmp = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&tmp_path)?;
        tmp.write_all(&encoded)?;
        tmp.flush()?;
    }

    let _ = fs::remove_file(path);
    fs::rename(&tmp_path, path)?;

    let mut hasher = Sha256::new();
    hasher.update(&encoded);
    Ok(hex::encode(hasher.finalize()))
}
