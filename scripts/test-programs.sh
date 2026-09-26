#!/usr/bin/env bash
# Runs the program tests. LiteSVM 0.10 cannot load SBPF v3, which `anchor build` emits for deploy,
# so tests use a v1 build in a separate directory and never overwrite the deploy artefacts.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/env.sh
mkdir -p target/test-sbf
for p in keyholder example-vault; do
  cargo build-sbf --arch v1 --manifest-path "programs/$p/Cargo.toml" --sbf-out-dir target/test-sbf >/dev/null
done
cargo test --workspace "$@"
