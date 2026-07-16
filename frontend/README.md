# InnovChain Frontend

React + TypeScript + Tailwind CSS single-page app implementing the core
end-to-end slice of InnovChain: register/login, browse the project
marketplace, view on-chain ownership proof, request/accept/fund/release
licenses. Built against the contract in `../docs/API.md`.

## Setup

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `.env` if your backend isn't running on the default address:

```
VITE_API_BASE_URL=http://localhost:4000/api
```

## Run

```bash
npm run dev
```

Opens on http://localhost:5173. The backend (see `../backend`) must be
running and reachable at `VITE_API_BASE_URL` for any data to load — this
frontend was built against the documented API contract but has not been
smoke-tested against a live backend yet.

## Build

```bash
npm run build   # runs `tsc --noEmit` then `vite build`
```

## Project structure

```
src/
  api/client.ts          typed fetch/axios wrapper for every endpoint in docs/API.md,
                          attaches the JWT bearer token automatically
  context/AuthContext.tsx  current user + JWT (persisted in localStorage), login/register/logout
  components/             Navbar, ProjectCard, StatusBadge, ProtectedRoute
  pages/                  Login, Register, Marketplace, ProjectDetail,
                           StudentDashboard, CompanyDashboard
  types/                  shared TS types mirroring the Mongoose schemas in docs/API.md
  utils/format.ts          wei -> ETH formatting, address/hash shortening (no ethers dep)
```

## Routes

| Route             | Access            | Description                                   |
| ------------------ | ----------------- | ---------------------------------------------- |
| `/`                 | public            | Project marketplace, search + tag filter       |
| `/login`            | public            | Log in                                         |
| `/register`         | public            | Register as student or company                |
| `/projects/:id`     | public            | Project detail, ownership proof, request license (company) |
| `/student`          | student only      | My projects, upload form, incoming license requests |
| `/company`          | company only      | My license requests, fund/release actions      |

## Notes / deviations from docs/API.md

- `docs/API.md` doesn't explicitly list a `reject` endpoint, but the student
  dashboard spec requires Accept/Reject buttons on incoming requests. The
  client calls `POST /license-requests/:id/reject`, mirroring the `accept`
  endpoint's shape (`status` -> `rejected`). If the backend implements
  rejection differently, only `src/api/client.ts` (`licenseRequestsApi.reject`)
  needs to change.
- Wallet address is a plain labeled text input ("Wallet address (testnet)")
  with an explanatory note, per the PoC scope — no MetaMask/WalletConnect
  integration.
- No real block explorer exists locally, so ownership proof (on-chain id, tx
  hash, block number) and contract/funding/release tx hashes are rendered as
  monospace read-only blocks rather than links.
- ETH amounts are formatted client-side from `priceWei` / `*AmountWei`
  strings using a small BigInt-based helper (`src/utils/format.ts`) instead
  of pulling in `ethers` just for formatting.
