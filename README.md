# InnovChain

AI-powered blockchain innovation marketplace — DDiB '26 S4 final group project (core
proof-of-concept slice). Full concept: `InnovChain_Full_Concept_Document.pdf`. Course brief:
`S04 - Project  Introduction_DDiB26.pdf`. Shared data/API contract for this PoC:
`docs/API.md`.

## What this PoC demonstrates

The end-to-end slice from the concept doc's architecture, on an Ethereum-compatible EVM
chain (Hardhat locally; unchanged deploy path to any testnet):

1. A **student** uploads a project. Its SHA-256 hash is anchored on-chain in
   `OwnershipRegistry` (owner + hash + timestamp), giving an immutable, timestamped proof of
   authorship — the concept doc's "Ownership Contract".
2. A **company** browses the marketplace and requests a license (duration, commercial-use
   flag, price in ETH).
3. The student accepts. The backend deploys a fresh `LicensingRoyalty` contract instance
   encoding a fixed 10% student / 5% university / 85% company split.
4. The company funds the contract with the agreed price.
5. Either party triggers `release()`, which atomically pays out all three parties in one
   transaction — the concept doc's "Licensing Contract" + "Royalty Contract" combined.

AI recommendation, university verification, admin moderation, and rich dashboards are
explicitly out of scope for this PoC (see `docs/API.md`) and are called out as future work
in the report.

## Repo layout

```
contracts/   Solidity (OwnershipRegistry, LicensingRoyalty) + Hardhat + tests
backend/     Express + TypeScript + MongoDB API, wired to the contracts via ethers.js v6
frontend/    React + TypeScript + Tailwind (Vite) — marketplace, student/company dashboards
docs/API.md  Shared data model, REST endpoints, and blockchain-service contract
```

## Running the full stack locally

Prerequisites: Node.js 18+, a local MongoDB instance (`mongodb://127.0.0.1:27017` by
default — e.g. `mongod` or `docker run -p 27017:27017 mongo`).

```bash
# 1. Install everything
npm run install:all

# 2. Terminal A — start a local Ethereum node (keep running)
npm run chain:node

# 3. Terminal B — deploy OwnershipRegistry to it
npm run chain:deploy
# copy the printed ownershipRegistry address into backend/.env (OWNERSHIP_REGISTRY_ADDRESS),
# or leave it unset — the backend auto-reads contracts/deployments/localhost.json

# 4. Terminal B — configure and start the backend
cp backend/.env.example backend/.env   # defaults already point at the local chain + Mongo
npm run backend:dev

# 5. Terminal C — configure and start the frontend
cp frontend/.env.example frontend/.env
npm run frontend:dev
# open http://localhost:5173
```

Register a `student` account and a `company` account (any email/password, and any text in
the "wallet address" field — for the local demo, paste one of the addresses Hardhat prints
when `chain:node` starts, e.g. account #2/#3/#4, so payouts land somewhere real on the local
chain). Upload a project as the student, request a license as the company, then walk through
accept → fund → release from each dashboard.

### Demo data

Projects are organized into three categories: Final Year Projects, Hackathon, and Summer
School. To populate the marketplace with a realistic spread across all three (including
InnovChain itself and a "Group 5" entry under Summer School, each genuinely registered
on-chain), run, with the full stack up:

```bash
node backend/scripts/seed-demo-data.mjs
```

It registers a handful of demo student accounts and uploads ten projects — real files, real
SHA-256 hashes, real `OwnershipRegistry` transactions — via the running API.

## Tests

```bash
npm run contracts:test   # 11 Hardhat/Mocha tests for OwnershipRegistry + LicensingRoyalty
npm run backend:test     # 9 Jest/Supertest integration tests (blockchain service mocked)
```

Frontend has no unit tests in this PoC; `cd frontend && npm run build` verifies it compiles.

## Notes on the PoC's simplifications

- **Key custody**: the backend never holds real user private keys. On the local Hardhat
  network it uses `hardhat_impersonateAccount` to sign `fund()`/`release()` as the actual
  student/company address for the demo. On a real chain this would instead be a
  MetaMask/WalletConnect signature flow initiated client-side — noted in
  `backend/src/services/blockchain/testnetChainService.ts`.
- **University share**: routed to a single fixed demo wallet (`UNIVERSITY_WALLET_ADDRESS`)
  rather than a real per-university account system.
- **Storage**: uploaded files are written to `backend/uploads/` on local disk; the concept
  doc's IPFS storage layer is noted as future work, not implemented (only the file hash is
  what actually needs to be trustworthy on-chain).
