#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  SentinelPeg — Project Setup
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

echo "🛡️  SentinelPeg — Setting up project…"
echo ""

# ── 1. Check prerequisites ────────────────────────────────────
command -v forge >/dev/null 2>&1 || {
  echo "❌  Foundry not found. Install it first:"
  echo "   curl -L https://foundry.paradigm.xyz | bash && foundryup"
  exit 1
}
echo "✅  Foundry found: $(forge --version | head -1)"

# ── 2. Install dependencies ──────────────────────────────────
echo ""
echo "📦  Installing dependencies…"

forge install uniswap/v4-core --no-commit --no-git 2>/dev/null || true
forge install uniswap/v4-periphery --no-commit --no-git 2>/dev/null || true
forge install foundry-rs/forge-std --no-commit --no-git 2>/dev/null || true
forge install OpenZeppelin/openzeppelin-contracts --no-commit --no-git 2>/dev/null || true
forge install Reactive-Network/reactive-lib --no-commit --no-git 2>/dev/null || true

# Handle the case where the project is already in a git repo
if [ ! -d ".git" ]; then
  git init -q
  git add -A
  git commit -qm "initial commit" 2>/dev/null || true
fi

# Re-try with git commit
forge install uniswap/v4-core --no-commit 2>/dev/null || echo "  ⚠️  v4-core may already be installed"
forge install uniswap/v4-periphery --no-commit 2>/dev/null || echo "  ⚠️  v4-periphery may already be installed"
forge install foundry-rs/forge-std --no-commit 2>/dev/null || echo "  ⚠️  forge-std may already be installed"
forge install OpenZeppelin/openzeppelin-contracts --no-commit 2>/dev/null || echo "  ⚠️  OpenZeppelin may already be installed"
forge install Reactive-Network/reactive-lib --no-commit 2>/dev/null || echo "  ⚠️  reactive-lib may already be installed"

echo "✅  Dependencies installed"

# ── 3. Create .env from template ─────────────────────────────
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✅  Created .env from template (fill in your keys)"
else
  echo "ℹ️   .env already exists, skipping"
fi

# ── 4. Build ─────────────────────────────────────────────────
echo ""
echo "🔨  Building contracts…"
forge build

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅  SentinelPeg setup complete!"
echo ""
echo "  Next steps:"
echo "    1. Fill in .env with your private keys & RPC URLs"
echo "    2. Run tests:     forge test -vvv"
echo "    3. Deploy hook:   forge script script/DeployHook.s.sol --broadcast"
echo "    4. Deploy reactive: forge script script/DeployReactive.s.sol --broadcast"
echo "═══════════════════════════════════════════════════════════"
