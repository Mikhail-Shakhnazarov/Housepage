use std::fs;
use std::path::{Path, PathBuf};
use serde::{de::DeserializeOwned, Serialize};
use anyhow::Result;

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
    
    use std::fs::OpenOptions;
    use std::io::Write;
    
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;
        
    file.write_all(line.as_bytes())?;
    file.flush()?;
    Ok(())
}
