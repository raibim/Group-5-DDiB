# InnovChain — Functional Requirements Document for Presentation

Purpose: define what content a PowerPoint presentation of InnovChain should cover, and which
functional requirements are **implemented in the working PoC** vs. **full concept / future
work** (per `InnovChain_Full_Concept_Document.pdf`). Use this as the source-of-truth outline
when building slides — each numbered FR below is a candidate bullet/slide item.

Legend: ✅ Implemented in PoC · 🔜 Designed, not built (future work) · 💡 Concept only

---

## 1. Problem Statement (slide: "The Problem")

- FR-P1 💡 Students lack a route to commercialize academic projects.
- FR-P2 💡 Companies have no visibility into university innovation output.
- FR-P3 💡 Universities cannot track or measure innovation impact.
- FR-P4 💡 Students fear idea theft with no proof of authorship.
- FR-P5 💡 Licensing agreements today are slow, manual, and trust-based.

## 2. Proposed Solution / Value Proposition (slide: "The Solution")

- FR-S1 💡 Decentralized marketplace connecting students, companies, and universities.
- FR-S2 💡 AI matches company needs to relevant student projects.
- FR-S3 ✅ Blockchain provides immutable, timestamped proof of ownership.
- FR-S4 ✅ Blockchain-enforced licensing and automatic royalty payout.
- FR-S5 ✅ Only hashes/agreements go on-chain, not full files — cost-efficient by design.

## 3. Actors & Role-Based Functional Requirements (slide per actor, or one combined slide)

### Student
- FR-U1 ✅ Register/login with role `student` and a wallet address.
- FR-U2 ✅ Upload a project (file + title + description + category + tags + visibility).
- FR-U3 ✅ Receive an on-chain ownership proof (registry id, tx hash, block, timestamp) at upload time.
- FR-U4 ✅ View own projects and incoming license requests.
- FR-U5 ✅ Accept or reject a license request.
- FR-U6 ✅ Trigger release of escrowed royalty once funded.
- FR-U7 🔜 Track cumulative earnings/royalties in a dashboard (view counts, interested companies, certificates).
- FR-U8 🔜 Chat with companies.

### Company
- FR-C1 ✅ Register/login with role `company` and a wallet address.
- FR-C2 ✅ Browse/search the public marketplace, filter by category/tag/keyword.
- FR-C3 ✅ Request a license on a project (duration, commercial-use flag, price).
- FR-C4 ✅ Fund the accepted license's escrow (student+university share only).
- FR-C5 ✅ Trigger release of the funded escrow.
- FR-C6 🔜 Post innovation challenges, request demos, hire students.
- FR-C7 🔜 Recommended/saved projects, active-license and hiring-pipeline dashboard.

### University
- FR-Un1 🔜 Verify project authenticity and certify student identity before publication.
- FR-Un2 ✅ Receive an automatic 5% royalty share on every released license (fixed demo wallet in PoC; not yet a real per-university account system).
- FR-Un3 🔜 University dashboard: published/commercialized projects, revenue, research-impact stats.

### Admin
- FR-A1 🔜 Manage users, moderate content, resolve disputes. (Schema field exists; no UI/flow in PoC.)

## 4. Core Functional Flow — the PoC's end-to-end slice (slide: "How It Works" / demo script)

1. FR-F1 ✅ Student uploads project → backend computes SHA-256 → `OwnershipRegistry.registerProject()` anchors `{owner, hash, timestamp}` on-chain.
2. FR-F2 ✅ Company discovers the project in the public marketplace and requests a license (duration, commercial-use, price in ETH).
3. FR-F3 ✅ Student accepts → backend deploys a dedicated `LicensingRoyalty` contract instance encoding a fixed 10% student / 5% university / 85% company split.
4. FR-F4 ✅ Company funds the contract with the student+university share only (15% of price) — the company's 85% never leaves its wallet unless it chooses to pay it directly.
5. FR-F5 ✅ Either party calls `release()` → one atomic transaction pays 10%/5% to student/university.

This flow is the recommended live-demo path for the presentation.

## 5. Blockchain / Smart Contract Requirements (slide: "Smart Contracts")

- FR-B1 ✅ `OwnershipRegistry.sol` — single shared contract; stores owner, file hash, timestamp per project; emits `ProjectRegistered`.
- FR-B2 ✅ `LicensingRoyalty.sol` — one instance per accepted license; holds student/university/company addresses and bps splits; `fund()` (payable, company-only, exact royalty amount) and `release()` (atomic payout, one transaction).
- FR-B3 ✅ Deployable unchanged to any EVM-compatible chain (Hardhat local for demo → any public testnet, e.g. Sepolia, or a university Ethereum platform).
- FR-B4 💡 Original concept allowed Cardano/Hedera/Ethereum; PoC narrows to EVM only, noted as a scoping decision.
- FR-B5 ✅ Design fix vs. original concept: company's 85% share is never escrowed/refunded on-chain (avoids the earlier "pay 85% back to payer" bug) — worth a slide callout as a concrete engineering decision made during the project.

## 6. AI Recommendation Layer (slide: "AI — Future Work") — 🔜 all items, none implemented in PoC

- FR-AI1 🔜 Semantic-embedding project/company matching (Sentence Transformers / OpenAI embeddings / FAISS / ChromaDB).
- FR-AI2 🔜 Company recommendation, similar-projects, automatic tagging, project summarization.
- FR-AI3 🔜 Innovation Score (novelty, sustainability, market potential, technical complexity).
- FR-AI4 🔜 Duplicate detection (similarity %).
- FR-AI5 🔜 SDG sustainability labeling.

## 7. Security Requirements (slide: "Security")

- FR-Sec1 ✅ JWT authentication, password hashing.
- FR-Sec2 ✅ Role-based access control on every mutating endpoint (student-only upload/accept/reject, company-only fund/request).
- FR-Sec3 ✅ Server-side SHA-256 hashing for tamper-evident ownership proof.
- FR-Sec4 🔜 MFA, wallet-signature authentication (MetaMask/WalletConnect) — PoC uses `hardhat_impersonateAccount` as a local-only stand-in, explicitly flagged as a simplification.
- FR-Sec5 🔜 File encryption, malware scanning, audit logs, rate limiting, full OWASP hardening pass.

## 8. Non-Functional / Data Requirements (slide: "Data Model" or appendix)

- FR-D1 ✅ MongoDB collections: `User`, `Project`, `LicenseRequest` (schemas in `docs/API.md`).
- FR-D2 ✅ REST API under `/api` with consistent named-key JSON envelopes.
- FR-D3 ✅ File storage on local disk for PoC (`storagePath`); IPFS noted as the production replacement (only the hash needs to be trustworthy on-chain, not the storage layer).
- FR-D4 🔜 Redux Toolkit / richer frontend state management — PoC frontend uses simpler local/React state.

## 9. Technology Stack (slide: "Tech Stack")

| Layer | PoC (implemented) | Full concept (future) |
|---|---|---|
| Frontend | React, TypeScript, Tailwind, Vite, React Router | + Redux Toolkit |
| Backend | Node.js, Express, TypeScript | same |
| Database | MongoDB | same |
| Blockchain | Hardhat local / any EVM testnet, ethers.js v6 | Cardano / Hedera / Ethereum (multi-chain) |
| Storage | Local disk | + IPFS |
| AI | — | Python, FastAPI, Sentence Transformers, FAISS, LangChain |
| Auth | JWT | + Wallet auth, OAuth, MFA |

## 10. Testing & Quality (slide: "Testing")

- FR-T1 ✅ 11 Hardhat/Mocha tests — `OwnershipRegistry` + `LicensingRoyalty`.
- FR-T2 ✅ 9 Jest/Supertest backend integration tests (blockchain service mocked).
- FR-T3 ✅ Frontend build-compiles as its verification gate (no unit tests in this PoC).

## 11. Scope Summary / Roadmap (slide: "Scope & Future Work") — good closing slide

**In scope (built):** ownership registration, marketplace browse/search, license request →
accept → fund → release flow, automatic on-chain royalty split, role-based auth, REST API,
contract + integration tests.

**Explicitly out of scope for this PoC (future work):** AI recommendation/matching engine,
university verification workflow, admin moderation tools, rich dashboards (earnings,
research-impact, hiring pipeline), chat, wallet-signature auth, IPFS storage, multi-chain
support, patent-readiness checker, pitch generator, hackathon/challenge modules, soulbound NFT
certificates.

## 12. Suggested Slide Order

1. Title
2. The Problem (§1)
3. The Solution / Value Proposition (§2)
4. Actors & Roles (§3) — one diagram, PoC-supported roles highlighted
5. Architecture diagram (frontend → backend → MongoDB → blockchain; grey out AI/IPFS as future)
6. Core Flow walkthrough (§4) — this is your live-demo slide
7. Smart Contracts deep-dive (§5) — good place to show the 85%-refund-bug fix as a "what we learned" moment
8. Security (§7)
9. Tech Stack (§9)
10. Testing & Quality (§10)
11. Live Demo
12. Scope Summary & Roadmap (§11)
13. Q&A
