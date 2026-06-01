# Housepage Justfile - WG Operational Interface

# Default: show help
default:
    @just --list

# Database Management
db-start:
    @if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then \
        echo "Postgres already running."; \
    else \
        mkdir -p .db && touch .db/log; \
        postgres -D .db/data -k .db -p 5432 > .db/log 2>&1 & \
        echo "Postgres starting..."; \
    fi

db-stop:
    @pg_ctl -D .db/data stop

db-init:
    @if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then \
        just db-start; \
        sleep 5; \
    fi
    @createdb -h localhost -p 5432 housepage || true
    @echo "Database 'housepage' is ready."

# Development
dev: db-start
    @echo "Starting Housepage WG Ecosystem..."
    @concurrently -n "WEB,BACK" -c "blue,green" \
        "cd webapp && npm run dev" \
        "cd backend-rs && cargo run"

# Install dependencies
install:
    cd webapp && npm install
    cd backend-rs && cargo build

# Manual cleanup
clean:
    rm -rf .db/ webapp/.next/ webapp/node_modules/ backend-rs/target/

# Orchestration (Hut Simulator)
housepage_inventory:
	@echo "Running Housepage Repository Inventory"
	@tree -L 2

housepage_baseline:
	@echo "Running Baseline Checks"
	@just install
	@cd webapp && npm run lint || true

housepage_packet packet_name:
	@echo "Executing Packet: {{packet_name}}"
	@git checkout -b work/{{packet_name}} 2>/dev/null || git checkout work/{{packet_name}}

housepage_review:
	@echo "Producing Final Review Summary..."
	@git status
