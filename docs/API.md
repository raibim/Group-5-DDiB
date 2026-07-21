# InnovChain — API & Data Contract (PoC scope)

Core end-to-end slice only: student uploads a project → SHA-256 hash anchored on-chain via
an `OwnershipRegistry` Solidity contract → company requests a license → student accepts →
company escrows the FULL agreed sale price into a `LicensingRoyalty` contract instance →
release pays that full amount out 85%/5%/10% to student/university/platform automatically →
**a `LicenseNFT` is minted to the company**, so holding the token IS holding the license. If
the company later resells ("sublicenses") that right to another company, a smaller *resale
royalty* (`RESALE_ROYALTY_BPS`, 10% by default — not the original sale's full 85/5/10) is
enforced again automatically on the resale price, and again on any resale after that, since
the split travels with the token. The remaining 90% is the reselling company's own resale
profit; reapplying the full 100%-of-price sale split on every resale would leave it with
nothing to gain from reselling at all.

This is a **sale model**: the company pays the entire price up front, and the contract is the
one that divides it — a deliberate flip from an earlier revenue-share framing (10% Student /
5% University / 85% Company, per `InnovChain_Full_Concept_Document.pdf`'s "Royalty Contract")
where the company was treated as a majority stakeholder who never actually paid in its own
share. The sale model is more intuitive for a one-time licensing transaction: the student
lists a price, and a fixed 85%/5%/10% cut goes to student/university/platform once that price
is paid.

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
company: ObjectId -> User (role company)   // the CURRENT license holder - moves on each sublicense
durationMonths: number
commercialUse: boolean
priceWei: string           // total agreed license value, stored as string (ethers BigNumber-safe)
status: 'pending' | 'accepted' | 'rejected' | 'funded' | 'released'
contract: {
  address: string           // deployed LicensingRoyalty instance address
  studentAddress: string
  universityAddress: string
  companyAddress: string    // the ORIGINAL buyer's address, fixed at accept time
  platformAddress: string   // InnovChain's own cut - see PLATFORM_WALLET_ADDRESS below
  studentBps: number        // 8500 = 85% (of priceWei)
  universityBps: number     // 500 = 5% (of priceWei)
  platformBps: number       // 1000 = 10% (of priceWei); the three bps values sum to 10000
  priceWei: string          // the FULL sale price - escrowed and paid out in full on release
  deployTxHash: string
}
funding: { txHash: string, amountWei: string } | null   // amountWei == contract.priceWei
release: {
  txHash: string
  studentAmountWei: string
  universityAmountWei: string
  platformAmountWei: string
} | null
licenseNft: {
  tokenId: number          // LicenseNFT token id, minted to `contract.companyAddress` on release
  mintTxHash: string
  studentBps: number       // RESALE royalty split - deliberately smaller than and independent
  universityBps: number    // of contract.studentBps/universityBps/platformBps above, so a
  platformBps: number      // reselling company keeps most of any future resale price
} | null
sublicenses: [{             // one entry per resale; `company` above is updated to `toCompany` each time
  toCompany: ObjectId -> User (role company)
  toAddress: string
  priceWei: string
  txHash: string
  studentAmountWei: string
  universityAmountWei: string
  platformAmountWei: string
  sellerAmountWei: string   // what's left of priceWei after the resale royalty split (licenseNft's bps, not contract's) - paid to the reselling company
  createdAt: Date
}]
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
- `GET  /auth/companies` (auth: company) → `{ companies: User[] }` — other registered
  companies, for the sublicense "transfer to" picker

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
  → derives sale split addresses (student=owner, university=fixed demo address,
    company=requester, platform=fixed demo address), calls blockchain service
    `deployLicensingContract`, status→`accepted`
- `POST /license-requests/:id/reject` (auth: student, must own project, only when `pending`)
  → status→`rejected`, no blockchain call
- `POST /license-requests/:id/fund` (auth: company)
  → calls blockchain service `fundContract(address, priceWei)` with the FULL price,
    status→`funded`
- `POST /license-requests/:id/release` (auth: student or company, only when `funded`)
  → calls blockchain service `releaseContract(address)`, splits the full escrowed price
    85:5:10 between student, university, and platform, status→`released`; then calls
    `mintLicense` to mint the `LicenseNFT` to the company, recording `licenseNft`. The bps
    passed to `mintLicense` (and stored on `licenseNft`) are `RESALE_ROYALTY_BPS` (10% total,
    default) scaled proportionally across the original 85:5:10 ratio - NOT the original sale's
    full bps - so a future resale doesn't give away the entire resale price again.
- `POST /license-requests/:id/sublicense` (auth: company, must be the current holder,
  only when `status='released'`) `{ toCompanyId, priceEth }`
  → looks up the target company's wallet, calls blockchain service `sublicense(tokenId,
    toAddress, priceWei)` (enforces `licenseNft`'s resale-royalty split on the resale price
    atomically, then transfers the NFT), appends to `sublicenses`, and updates `company` to
    the new holder

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
    platformAddress: string;
    studentBps: number; universityBps: number; platformBps: number; // sum to 10000
    priceWei: string; // the FULL sale price
  }): Promise<{ address: string; deployTxHash: string }>;

  fundContract(input: { contractAddress: string; amountWei: string; fromRole: 'company' }):
    Promise<{ txHash: string }>;

  releaseContract(input: { contractAddress: string }): Promise<{
    txHash: string;
    studentAmountWei: string; universityAmountWei: string; platformAmountWei: string;
  }>;

  mintLicense(input: {
    toAddress: string; sourceLicenseRequestId: number;
    studentAddress: string; universityAddress: string; platformAddress: string;
    studentBps: number; universityBps: number; platformBps: number;
  }): Promise<{ tokenId: number; mintTxHash: string }>;

  sublicense(input: {
    tokenId: number; fromAddress: string; toAddress: string; priceWei: string;
  }): Promise<{
    txHash: string;
    studentAmountWei: string; universityAmountWei: string; platformAmountWei: string;
    sellerAmountWei: string;
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
  Implements a **sale model**: holds `studentAddress/universityAddress/companyAddress/
  platformAddress` and `studentBps/universityBps/platformBps` (must sum to exactly 10000).
  `fund()` is `payable`, callable once by the company, for exactly `priceWei` — the FULL
  agreed sale price, not a fraction of it. `release()` splits the entire held balance three
  ways between student, university, and platform, proportional to their bps, and pays all
  three out in one transaction. The company never receives a payout from this contract — it
  is purely the payer. This is a deliberate flip from an earlier revenue-share design (10%
  Student / 5% University / 85% Company, matching the concept doc's "Royalty Contract"
  literally) where the company was treated as a majority stakeholder entitled to a payout of
  its own share; that design either had to (a) refund 85% of the price back to the company on
  release — pointless, since it's the company's own money — or (b) only ever escrow the 15%
  minority share, which read confusingly against an advertised "price" that implied the full
  amount would change hands. The current sale model avoids both: the advertised price *is*
  the real amount paid, and the 85/5/10 split is simply how that real payment is divided.
- `contracts/contracts/LicenseNFT.sol` — a single shared ERC-721 collection (OpenZeppelin
  `ERC721`/`ERC2981`/`Ownable`). `mint()` is owner-only (the backend's operator wallet, since
  it deployed the contract), called right after a `LicensingRoyalty` sale's `release()`
  succeeds — holding the token IS holding the license from that point on. Each token stores
  its own copy of a **resale royalty** `studentBps/universityBps/platformBps` split and the
  three payee addresses; the backend computes this split as `RESALE_ROYALTY_BPS` (10% by
  default) divided proportionally across the original sale's 85:5:10 ratio, not the original
  sale's full bps — so a future resale doesn't re-escrow the entire resale price, leaving the
  reselling company nothing. That smaller split is then enforced again on every resale, and
  again after that, since it travels with the token.
  `sublicense(tokenId, to)` is the enforced resale path: the current holder sends `msg.value`
  as the new price, the contract splits and forwards the royalty portion to
  student/university/platform and the remainder to the seller, and transfers the NFT to
  `to` — all atomically in one transaction, so a resale cannot complete without the split
  happening. `royaltyInfo` (ERC-2981) is also implemented for standards compliance with
  external NFT marketplaces, but ERC-2981 is advisory only — it lets a marketplace *ask* what
  royalty is owed, it does not force anyone to pay it. This contract deliberately has no
  `receive()`/`fallback()`, so a marketplace that reads `royaltyInfo` and then sends a plain
  ETH transfer straight to the contract (instead of calling `sublicense()`) gets a reverted
  transaction, not silently stuck funds. `sublicense()` remains the only path in this PoC that
  actually guarantees the payout happens.

## Frontend routes (React Router)

- `/login`, `/register`
- `/` — public project marketplace (search/filter by tag)
- `/projects/:id` — project detail, ownership proof link, "Request License" (company) button
- `/student` — student dashboard: my projects, upload form, incoming license requests (accept/reject)
- `/company` — company dashboard: my license requests, fund/release actions, status
