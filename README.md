# Housepage: The Scan-First Chore System

Managing a home usually results in one of two failure modes: either you have an infinite, demoralizing backlog of "todo" items that you never touch, or you spend more time managing the list than actually cleaning your kitchen. 

Most chore apps treat your home like a Jira board. **Housepage** treats it like a card game. You don't "manage" a backlog; you scan a room, state your energy level, and get dealt a small "hand" of three tasks. If you can't do them, you skip them. The goal is a calm, low-admin loop that keeps your house habitable without requiring you to become a project manager.

## The Loop

Housepage is built around a specific three-step ritual:

1.  **Scan**: Walk into a room (e.g., the Kitchen) and answer a few binary prompts. "Is the sink clear?", "Is the floor walkable?". 
2.  **Deal**: State how much energy you have (1–5) and how much time is available. 
3.  **Act**: The system deals you **three tasks** that fit your constraints. Tasks linked to "No" answers in your scan get an immediate priority boost.

When you finish a task, you mark it **Done**. If you can't face it, you **Skip** it. The system records these signals to improve future deals — no complex ML, just simple rules about what you've been avoiding.

## Local-First & Obsidian-First

Housepage doesn't have a database. It runs on your local network and stores everything as plain JSON files in your **Obsidian vault**. 

- **Definitions** (Tasks, Checks, Rooms) are plain JSON files you can edit directly in Obsidian or any text editor.
- **History** is an append-only event log (`events.ndjson`). Your data is never "trapped" in the app; it's just a folder on your drive.

### The Vault Structure

Point the app at a folder in your vault (e.g., `Documents/ChoreSystem/`) and it expects:

```text
chore_system/
├── settings.json   # Room definitions and defaults
├── tasks.json      # The full library of chores
├── checks.json     # Troubleshooting prompts for your "Scan"
└── events.ndjson   # The raw history of every scan, deal, and done
```

## Running the System

Housepage is a mono-repo containing a **Rust (Axum)** backend and a **React (Vite)** frontend. We provide a workspace `Makefile` to handle the plumbing.

### Quick Start (Dev)

1.  **Prepare your vault**: Copy the `vault_sample/` directory to your actual Obsidian vault.
2.  **Launch**:
    ```bash
    export CHORE_VAULT_PATH="/path/to/your/vault/chore_system"
    make dev
    ```
3.  **Access**: Open `http://localhost:5173` on your browser (or phone, if on the same Wi-Fi).

## Limitations & Project Status

This is a **Portfolio Prototype**. It works for the person who built it, but you should be aware of its "rough edges":

- **Single-User**: There is no concept of "users" or "assignees". It assumes one person (or one household sharing a device) is doing the work.
- **No Authentication**: The API is wide open. Do not expose this to the public internet. Run it only on your trusted home LAN.
- **Obsidianship**: It leans heavily on the Obsidian ecosystem. While the files are plain JSON, it assumes your primary "admin" interface is an Obsidian folder.
- **Rust Migration**: We recently verticalized the backend to Rust for performance. The Python implementation remains in `backend/` as a reference, but the Rust service in `backend-rs/` is the authoritative path forward.

## Architecture

- **Backend (Rust/Axum)**: A high-performance service that replays your `events.ndjson` to derive current task scores in sub-milliseconds.
- **Frontend (React)**: A mobile-friendly, minimal UI designed for use while walking around your house.
- **Data Contract**: Purely file-based. The backend only appends to the event log; it never overwrites your definitions.

---

(c) 2026 Mikhail Shakhnazarov. Part of the Earmark ecosystem.
