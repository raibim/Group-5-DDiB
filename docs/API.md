# InnovChain — API & Data Contract (PoC scope)

Core end-to-end slice only: student uploads a project → SHA-256 hash anchored on-chain via
an `OwnershipRegistry` Solidity contract → company requests a license → student accepts →
company pays ETH into a `LicensingRoyalty` escrow contract instance → release splits funds
10% student / 5% university / 85% company automatically, matching
`InnovChain_Full_Concept_Document.pdf`.

Chain: Ethereum-compatible EVM (Hardhat local network for dev/demo; deployable unchanged to
any public testnet, e.g. Sepolia, or the UZH Ethereum platform).

Out of scope for this PoC: AI recommendation engine, university verification workflow,
admin moderation, dashboards beyond simple lists. These are noted as "Future Work" in the
report, not implemented.

## Roles
`student | company | university | admin` (only `student` and `company` have functional
flows in this PoC; `university` and `admin` exist as schema fields for future work).

## Data models (MongoDB / Mongoose)

### User
```
_id
email: string (unique)
passwordHash: string
role: 'student' | 'company' | 'university' | 'admin'
name: string
walletAddress: string      // EVM address (checksummed) used for payouts (student) or payments (company)
createdAt
```

### Project
```
_id
owner: ObjectId -> User (role student)
title: string
description: string
fileName: string
fileHash: string          // sha256 hex of the uploaded file, bytes32-compatible
storagePath: string       // local disk path for PoC ("would be IPFS CID in production")
tags: string[]
visibility: 'public' | 'private'
ownershipProof: {
  onChainId: number        // id returned by OwnershipRegistry.registerProject
  txHash: string
  blockNumber: number
  registeredAt: Date
}
createdAt
```

### LicenseRequest
```
_id
project: ObjectId -> Project
company: ObjectId -> User (role company)
durationMonths: number
commercialUse: boolean
priceWei: string           // stored as string (ethers BigNumber-safe)
status: 'pending' | 'accepted' | 'rejected' | 'funded' | 'released'
contract: {
  address: string           // deployed LicensingRoyalty instance address
  studentAddress: string
  universityAddress: string
  companyAddress: string
  studentBps: number        // 1000 = 10%
  universityBps: number     // 500 = 5%
  companyBps: number        // 8500 = 85%, derived = 10000 - studentBps - universityBps
  deployTxHash: string
}
funding: { txHash: string, amountWei: string } | null
release: {
  txHash: string
  studentAmountWei: string
  universityAmountWei: string
  companyAmountWei: string
} | null
createdAt
```

## REST endpoints (backend, prefix `/api`)

Every JSON response body wraps its payload in a named key matching the resource, not a bare
value: list/detail endpoints return `{ projects: Project[] }` / `{ project: Project }` /
`{ licenseRequests: LicenseRequest[] }` / `{ licenseRequest: LicenseRequest }`; auth returns
`{ token, user }` or `{ user }`; errors return `{ error: string }`. (This was the one place
the backend and frontend implementations, built independently against this doc, disagreed —
the frontend originally expected bare payloads and crashed on mount because `Project[]`
methods were called on a `{ projects: [...] }` object. Fixed in `frontend/src/api/client.ts`
by unwrapping the named key; noted here so it doesn't regress.)

Auth
- `POST /auth/register` `{ email, password, role, name, walletAddress }` → `{ token, user }`
- `POST /auth/login` `{ email, password }` → `{ token, user }`
- `GET  /auth/me` (auth) → `{ user }`

Projects
- `POST /projects` (auth: student, multipart form: file + title + description + tags[] + visibility)
  → creates Project, computes SHA-256, calls blockchain service `registerOwnership`, returns Project incl. `ownershipProof.txHash`
- `GET  /projects` (public, query: `tag`, `q`) → list of public projects (+ own private ones if authed)
- `GET  /projects/:id` → project detail incl. ownership proof
- `GET  /projects/mine` (auth: student) → own projects

License requests
- `POST /projects/:id/license-requests` (auth: company) `{ durationMonths, commercialUse, priceEth }`
  → creates LicenseRequest status=`pending` (priceEth converted to `priceWei` via ethers.parseEther)
- `GET  /license-requests/mine` (auth: student|company) → requests relevant to the caller
- `GET  /license-requests/:id` → detail
- `POST /license-requests/:id/accept` (auth: student, must own project)
  → derives royalty split addresses (student=owner, university=platform-fixed demo address,
    company=requester), calls blockchain service `deployLicensingContract`, status→`accepted`
- `POST /license-requests/:id/reject` (auth: student, must own project, only when `pending`)
  → status→`rejected`, no blockchain call
- `POST /license-requests/:id/fund` (auth: company)
  → calls blockchain service `fundContract(address, priceWei)`, status→`funded`
- `POST /license-requests/:id/release` (auth: student or company, only when `funded`)
  → calls blockchain service `releaseContract(address)`, splits 10/5/85, status→`released`

## Blockchain service interface (backend/src/services/blockchain)

`CHAIN_MODE=local|testnet` env var. `local` (default) talks to a Hardhat node
(`http://127.0.0.1:8545`) started via `npx hardhat node`, using the funded default Hardhat
dev accounts — fully demoable offline with zero real funds. `testnet` mode points
`RPC_URL`/`PRIVATE_KEY` env vars at a public testnet (e.g. Sepolia) for a live demo.
Contract addresses come from `contracts/deployments/<network>.json`, written by the deploy
script and read by the backend at startup.

```ts
interface BlockchainService {
  registerOwnership(input: { projectId: string; fileHash: string; ownerAddress: string }):
    Promise<{ onChainId: number; txHash: string; blockNumber: number }>;

  deployLicensingContract(input: {
    studentAddress: string; universityAddress: string; companyAddress: string;
    studentBps: number; universityBps: number; priceWei: string;
  }): Promise<{ address: string; deployTxHash: string }>;

  fundContract(input: { contractAddress: string; amountWei: string; fromRole: 'company' }):
    Promise<{ txHash: string }>;

  releaseContract(input: { contractAddress: string }): Promise<{
    txHash: string;
    studentAmountWei: string; universityAmountWei: string; companyAmountWei: string;
  }>;
}
```

## Solidity contracts

- `contracts/contracts/OwnershipRegistry.sol` — one shared registry. `registerProject(bytes32 fileHash)`
  stores `{ owner, fileHash, timestamp }` keyed by an incrementing id and emits
  `ProjectRegistered`. This is the on-chain embodiment of the concept doc's "Ownership
  Contract: Owner / Project ID / Hash / Timestamp".
- `contracts/contracts/LicensingRoyalty.sol` — one instance deployed per accepted license
  request (factory-less, deployed directly by the backend's signer for PoC simplicity).
  Holds `studentAddress/universityAddress/companyAddress` and `studentBps/universityBps`
  (companyBps = 10000 − the other two). `fund()` is `payable`, callable once by the company
  for the agreed price. `release()` splits the held balance 10/5/85 and pays out all three
  parties in one transaction, then marks itself released. This embodies both the concept
  doc's "Licensing Contract" (lock payment, transfer license) and "Royalty Contract" (10%
  Student / 5% University / 85% Company).

## Frontend routes (React Router)

- `/login`, `/register`
- `/` — public project marketplace (search/filter by tag)
- `/projects/:id` — project detail, ownership proof link, "Request License" (company) button
- `/student` — student dashboard: my projects, upload form, incoming license requests (accept/reject)
- `/company` — company dashboard: my license requests, fund/release actions, status
