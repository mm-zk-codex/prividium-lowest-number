# Prividium PoC — Lowest Unique Number (1..256)

Minimal proof-of-concept with:
- Solidity game contract (`LowestUniqueGame.sol`)
- Solidity tests (`test/LowestUniqueGame.t.sol`)
- Frontend-only React app (`frontend/`) using Prividium authenticated reads and authorized writes

## Game Rules
Per round:
- Players can bet integers in **[1..256]**
- Winner is the **lowest number bet by exactly one player**
- If no number is unique, winner is `address(0)` and winning number is `0`
- Admin can close betting early (`finishNow`)
- Anyone can finalize after end time or after early finish

## Repository Layout
- `src/LowestUniqueGame.sol` — contract
- `test/LowestUniqueGame.t.sol` — unit tests
- `foundry.toml` — Foundry config
- `frontend/` — Vite + React app

## Prerequisites
- Foundry (`forge`, `cast`)
- Node.js 18+ and npm
- A deployed Prividium-compatible chain/network and app credentials

## Contract Setup (Foundry)

### 1) Run tests
```bash
forge test
```

### 2) Build
```bash
forge build
```

### 3) Deploy (example)
```bash
export PRIVATE_KEY=0x...
export RPC_URL=https://YOUR-PRIVIDIUM-ENDPOINT/rpc

forge create src/LowestUniqueGame.sol:LowestUniqueGame \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$RPC_URL"
```

## Frontend Setup

### 1) Install dependencies
```bash
cd frontend
npm install
```

### 2) Configure environment
Create `frontend/.env.local`:

```bash
VITE_CHAIN_ID=7777
VITE_RPC_URL=https://YOUR-PRIVIDIUM-ENDPOINT/rpc
VITE_PRIVIDIUM_CLIENT_ID=YOUR_OAUTH_CLIENT_ID
VITE_AUTH_BASE_URL=https://user-panel.prividium.dev
VITE_PRIVIDIUM_API_BASE_URL=https://api.prividium.dev
VITE_GAME_ADDRESS=0xYourDeployedGameContract
```

### 3) Run app
```bash
npm run dev
```

Open the shown URL (typically `http://localhost:5173`).

## Frontend Behavior Notes
- On load, app checks auth with `prividium.isAuthorized()` and calls `prividium.authorize(...)` if needed.
- Reads are sent through `prividium.transport`.
- All writes use one helper (`sendPrividiumTx`) that:
  1. Fetches `nonce`, `gas`, `gasPrice` from authenticated read client
  2. Calls `prividium.authorizeTransaction(...)`
  3. Sends the tx with wallet client using the **same nonce/gas/gasPrice**

## App Routes
- `/` — rounds list
- `/round/:id` — round details, bet/finalize
- `/admin` — create round, finish now, finalize
- `/auth/callback` — OAuth callback handler page for Prividium popup flow

## Quick Manual Flow
1. Connect/authenticate in browser.
2. Admin creates a round with participants and `betsPerPlayer`.
3. Whitelisted players place bets during active window.
4. Admin can call `finishNow` to close betting immediately.
5. Anyone calls `finalize`.
6. UI shows winner or “No winner”.
