.PHONY: dev dev-py build-rs build-fe setup-py setup-fe

VAULT ?= $(shell pwd)/vault_sample/chore_system
PORT ?= 8000
VITE_PORT ?= 5173

dev: setup-fe
	@echo "Starting Housepage (Rust Backend)..."
	@export CHORE_VAULT_PATH=$(VAULT) && \
	 export CHORE_PORT=$(PORT) && \
	 (cd backend-rs && cargo run &) && \
	 (cd frontend && npm run dev -- --port $(VITE_PORT))

dev-py: setup-py setup-fe
	@echo "Starting Housepage (Python Backend)..."
	@export CHORE_VAULT_PATH=$(VAULT) && \
	 export CHORE_PORT=$(PORT) && \
	 (cd backend && ../scripts/dev.sh --backend-port $(PORT) --vite-port $(VITE_PORT))

build-rs:
	cd backend-rs && cargo build --release

build-fe: setup-fe
	cd frontend && npm run build

setup-py:
	cd backend && python3 -m venv .venv && \
	. .venv/bin/activate && pip install -r requirements.txt

setup-fe:
	cd frontend && npm install
