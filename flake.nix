{
  description = "Housepage WG Coordination System - Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };
        
        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rust-analyzer" ];
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            rustToolchain
            nodejs_22
            postgresql_16
            python3
            just
            tree
            pkg-config
            openssl
            prisma
          ];

          shellHook = ''
            export PGDATA="$PWD/.db/data"
            export PGLOG="$PWD/.db/log"
            export PGPORT=5432
            export PGPASSWORD=housepage
            
            # Prisma Engines for NixOS
            export PRISMA_SCHEMA_ENGINE_BINARY="${pkgs.prisma-engines}/bin/schema-engine"
            export PRISMA_QUERY_ENGINE_BINARY="${pkgs.prisma-engines}/bin/query-engine"
            export PRISMA_QUERY_ENGINE_LIBRARY="${pkgs.prisma-engines}/lib/libquery_engine.node"
            export PRISMA_INTROSPECTION_ENGINE_BINARY="${pkgs.prisma-engines}/bin/introspection-engine"
            export PRISMA_FMT_BINARY="${pkgs.prisma-engines}/bin/prisma-fmt"
            
            # Setup local DB if it doesn't exist
            if [ ! -d "$PGDATA" ]; then
              mkdir -p "$PWD/.db"
              initdb -D "$PGDATA" --auth=trust
              echo "unix_socket_directories = '$PWD/.db'" >> "$PGDATA/postgresql.conf"
            fi
            
            echo "--- Housepage WG Dev Environment ---"
            echo "Node: $(node -v)"
            echo "Rust: $(rustc --version)"
            echo "Postgres: $(postgres --version)"
            echo "Use 'just' to see available commands."
          '';
        };
      });
}
