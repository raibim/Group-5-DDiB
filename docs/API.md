# InnovChain — API & Data Contract (PoC scope)

Core end-to-end slice only: student uploads a project → SHA-256 hash anchored on-chain via
an `OwnershipRegistry` Solidity contract → company requests a license → student accepts →
company escrows the student+university royalty share (10% + 5% = 15% of the agreed price)
into a `LicensingRoyalty` contract instance → release pays that 15% out 10%/5% to
student/university automatically. The company's own 85% share never enters the contract —
it's the company's money and stays in the company's wallet unless they choose to fund it,
matching `InnovChain_Full_Concept_Document.pdf`'s "Royalty Contract" (10% Student / 5%
University / 85% Company), while avoiding the earlier design bug of literally paying 85%
of the license fee back to the payer.

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
category: 'final-year' | 'hackathon' | 'summer-school'
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
priceWei: string           // total agreed license value, stored as string (ethers BigNumber-safe)
status: 'pending' | 'accepted' | 'rejected' | 'funded' | 'released'
contract: {
  address: string           // deployed LicensingRoyalty instance address
  studentAddress: string
  universityAddress: string
  companyAddress: string
  studentBps: number        // 1000 = 10% (of priceWei)
  universityBps: number     // 500 = 5% (of priceWei)
  companyBps: number        // 8500 = 85%, derived = 10000 - studentBps - universityBps.
                             // Informational only - never escrowed or paid out on-chain.
  royaltyWei: string        // priceWei * (studentBps+universityBps)/10000 - the ONLY amount
                             // actually escrowed/funded/released; the company's 85% share
                             // stays in the company's wallet and is never touched.
  deployTxHash: string
}
funding: { txHash: string, amountWei: string } | null   // amountWei == contract.royaltyWei
release: {
  txHash: string
  studentAmountWei: string
  universityAmountWei: string
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
- `POST /projects` (auth: student, multipart form: file + title + description + category + tags[] + visibility)
  → creates Project, computes SHA-256, calls blockchain service `registerOwnership`, returns Project incl. `ownershipProof.txHash`
- `GET  /projects` (public, query: `tag`, `q`, `category`) → list of public projects (+ own private ones if authed)
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
  → calls blockchain service `releaseContract(address)`, splits the escrowed royalty 10:5
    between student and university (the company's 85% share was never escrowed, so nothing
    is paid back to them here), status→`released`

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
    studentBps: number; universityBps: number;
    royaltyWei: string; // student+university share ONLY - not the full license price
  }): Promise<{ address: string; deployTxHash: string }>;

  fundContract(input: { contractAddress: string; amountWei: string; fromRole: 'company' }):
    Promise<{ txHash: string }>;

  releaseContract(input: { contractAddress: string }): Promise<{
    txHash: string;
    studentAmountWei: string; universityAmountWei: string;
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
  (`companyBps` = 10000 − the other two, stored on-chain as informational metadata only).
  `fund()` is `payable`, callable once by the company, for exactly `royaltyWei` — the
  student+university share of the agreed price (e.g. 15% for 10%/5% bps), **not** the full
  license value. `release()` splits the held balance between student and university only,
  proportional to their relative bps, and pays both out in one transaction. The company
  never receives a payout from this contract, because its 85% share was never escrowed in
  the first place — that money simply stays in the company's own wallet. This embodies both
  the concept doc's "Licensing Contract" (lock payment, transfer license) and "Royalty
  Contract" (10% Student / 5% University / 85% Company) without the bug of literally routing
  85% of the license fee back to the party that paid it — an earlier version of this PoC
  escrowed the full price and refunded 85% to the company on release, which is functionally
  equivalent to the company only ever paying 15%, just obscured. `companyBps` remains useful
  as an on-chain, auditable record of what the company is understood to retain.

## Frontend routes (React Router)

- `/login`, `/register`
- `/` — public project marketplace (search/filter by tag)
- `/projects/:id` — project detail, ownership proof link, "Request License" (company) button
- `/student` — student dashboard: my projects, upload form, incoming license requests (accept/reject)
- `/company` — company dashboard: my license requests, fund/release actions, status
