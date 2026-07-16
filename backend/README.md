# InnovChain Backend

Express + TypeScript + MongoDB (Mongoose) API implementing `docs/API.md`, wired to the
`contracts/` Solidity contracts (`OwnershipRegistry`, `LicensingRoyalty`) via ethers.js v6.

## Prerequisites

- Node.js 18+
- A running MongoDB instance (local `mongod`, Docker, or Atlas)
- The `contracts/` package's dependencies installed and compiled (`npm install && npx hardhat
  compile` inside `contracts/`) — already done in this repo.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # adjust values if needed; local defaults work out of the box
```

## Running the full local stack

Three processes, in order:

1. **Hardhat node** (local blockchain), from `contracts/`:
   ```bash
   cd contracts
   npm run node   # npx hardhat node - listens on http://127.0.0.1:8545
   ```
2. **Deploy the contracts** (in a second terminal), from `contracts/`:
   ```bash
   cd contracts
   npm run deploy:local
   ```
   This writes `contracts/deployments/localhost.json`, which the backend reads at startup
   to find `OwnershipRegistry`'s address (unless `OWNERSHIP_REGISTRY_ADDRESS` is set in
   `.env`, which takes priority).
3. **MongoDB**: make sure a `mongod` matching `MONGODB_URI` in `.env` is running.
4. **Backend** (in a third terminal), from `backend/`:
   ```bash
   npm run dev
   ```
   Starts on `http://localhost:4000` by default (`PORT` in `.env`), with CORS enabled for
   the Vite frontend dev origin (`CORS_ORIGIN`, default `http://localhost:5173`).

## Scripts

- `npm run dev` — start with ts-node-dev (auto-restart on change)
- `npm run build` — compile to `dist/`
- `npm start` — run the compiled build
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — run the Jest test suite (mocks MongoDB models and the blockchain service —
  no live Mongo/Hardhat connection required)

## Environment variables (`.env`)

See `.env.example` for the full list and inline docs. Key ones:

| Var | Purpose |
|---|---|
| `MONGODB_URI` | Mongo connection string |
| `JWT_SECRET` | HMAC secret for signed auth tokens |
| `PORT` | HTTP port |
| `CORS_ORIGIN` | Allowed frontend origin |
| `CHAIN_MODE` | `local` (Hardhat node, default) or `testnet` (e.g. Sepolia) |
| `RPC_URL` | JSON-RPC endpoint for the chosen chain |
| `OPERATOR_PRIVATE_KEY` | Backend's signer key. Defaults to Hardhat's well-known dev account #0 key, which is funded automatically on any local Hardhat node — **do not reuse this key for anything beyond local development.** |
| `OWNERSHIP_REGISTRY_ADDRESS` | Deployed registry address; falls back to `contracts/deployments/<network>.json` if unset |
| `UNIVERSITY_WALLET_ADDRESS` | Fixed demo "university" payout address (5% royalty share) |
| `UPLOAD_DIR` | Local disk folder for uploaded project files (would be IPFS in production) |

## Important PoC simplification: who signs on-chain transactions

Users only register a public `walletAddress` — the backend never custodies their private
keys. All on-chain writes are actually sent by a single **operator wallet**
(`OPERATOR_PRIVATE_KEY`, Hardhat dev account #0 by default), which acts on the caller's
behalf. In a production system, the frontend would collect a wallet-signed transaction
client-side (e.g. via MetaMask) instead.

`LicensingRoyalty.fund()`/`.release()` enforce `msg.sender` on-chain (only the licensee
company may fund, only the student or company may release), so simply calling them from the
operator wallet would revert. In `CHAIN_MODE=local`, `src/services/blockchain/localChainService.ts`
works around this using Hardhat's `hardhat_impersonateAccount` JSON-RPC method (dev-node
only) to sign as the actual student/company address for that one call, topping the account
up with test ETH from the operator wallet first if needed. This trick has no equivalent on a
real chain; `CHAIN_MODE=testnet` (`src/services/blockchain/testnetChainService.ts`) instead
sends every transaction directly from the operator wallet, which is documented there as a
known PoC limitation (matches `docs/API.md`'s "Out of scope for this PoC" framing).

## API surface

Implements every endpoint in `../docs/API.md`:

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `POST /api/projects` (multipart: `file`, `title`, `description`, `tags`, `visibility`),
  `GET /api/projects`, `GET /api/projects/:id`, `GET /api/projects/mine`
- `POST /api/projects/:id/license-requests`, `GET /api/license-requests/mine`,
  `GET /api/license-requests/:id`, `POST /api/license-requests/:id/accept`,
  `POST /api/license-requests/:id/reject` (extra convenience endpoint, not in the spec —
  needed so a student can decline a pending request; symmetric with `/accept`),
  `POST /api/license-requests/:id/fund`, `POST /api/license-requests/:id/release`

All error responses use the shape `{ "error": "..." }`. Request bodies are validated with
`zod`; validation failures return `400`.

## Testing

`npm test` runs Jest + Supertest against `src/app.ts` with the Mongoose models
(`User`, `Project`) and the blockchain service module mocked out — no live MongoDB or
Hardhat node needed. Covers:

- `tests/auth.test.ts` — register/login/me happy paths, duplicate email, bad wallet address,
  wrong password, missing token
- `tests/projects.test.ts` — role/file validation on project upload, a full create-project
  flow with a mocked `registerOwnership` call, and the public project listing endpoint
