import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, authApi, licenseRequestsApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import type { LicenseRequest, Project, User } from '../types';
import { shortenAddress, shortenHash, weiToEth } from '../utils/format';

function projectRef(project: LicenseRequest['project']): {
  id: string;
  title: string;
} {
  if (typeof project === 'string') return { id: project, title: project };
  const p = project as Project;
  return { id: p._id, title: p.title };
}

function companyLabel(company: LicenseRequest['company']): string {
  if (typeof company === 'string') return company;
  return (company as User).name ?? 'Unknown company';
}

export default function CompanyDashboard() {
  const [requests, setRequests] = useState<LicenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const [otherCompanies, setOtherCompanies] = useState<User[]>([]);
  const [sublicenseTarget, setSublicenseTarget] = useState<Record<string, string>>({});
  const [sublicensePrice, setSublicensePrice] = useState<Record<string, string>>({});
  const [sublicenseError, setSublicenseError] = useState<string | null>(null);

  function loadRequests() {
    setLoading(true);
    licenseRequestsApi
      .mine()
      .then(setRequests)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load requests'),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadRequests();
    authApi.companies().then(setOtherCompanies).catch(() => {});
  }, []);

  async function handleFund(id: string) {
    setActioningId(id);
    try {
      await licenseRequestsApi.fund(id);
      loadRequests();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to fund contract');
    } finally {
      setActioningId(null);
    }
  }

  async function handleRelease(id: string) {
    setActioningId(id);
    try {
      await licenseRequestsApi.release(id);
      loadRequests();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to release funds');
    } finally {
      setActioningId(null);
    }
  }

  async function handleSublicense(id: string) {
    const toCompanyId = sublicenseTarget[id];
    const priceEth = sublicensePrice[id];
    if (!toCompanyId || !priceEth) {
      setSublicenseError('Choose a company and a price first.');
      return;
    }
    setSublicenseError(null);
    setActioningId(id);
    try {
      await licenseRequestsApi.sublicense(id, { toCompanyId, priceEth });
      loadRequests();
    } catch (err) {
      setSublicenseError(
        err instanceof ApiError ? err.message : 'Failed to sublicense',
      );
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-ink-50">Company Dashboard</h1>
      <p className="mt-1 text-sm text-ink-400">
        Track your license requests, fund the full sale price in escrow, and
        release payment.
      </p>

      {loading && <p className="mt-4 text-sm text-ink-400">Loading...</p>}
      {error && (
        <p className="mt-4 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}
      {!loading && requests.length === 0 && (
        <p className="mt-4 text-sm text-ink-400">
          You haven't requested any licenses yet. Browse the{' '}
          <Link to="/" className="text-brand-400 hover:underline">
            marketplace
          </Link>{' '}
          to get started.
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {requests.map((r) => {
          const project = projectRef(r.project);
          return (
            <li key={r._id} className="card">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={`/projects/${project.id}`}
                  className="font-medium text-brand-300 hover:underline"
                >
                  {project.title}
                </Link>
                <StatusBadge status={r.status} />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-ink-300">
                <dt className="text-ink-500">Duration</dt>
                <dd>{r.durationMonths} months</dd>
                <dt className="text-ink-500">Commercial use</dt>
                <dd>{r.commercialUse ? 'Yes' : 'No'}</dd>
                <dt className="text-ink-500">Price</dt>
                <dd>{weiToEth(r.priceWei)} ETH</dd>
              </dl>

              {r.contract && (
                <div className="mt-3 rounded-md bg-ink-800/70 border border-ink-700 p-3 font-mono text-[11px] text-ink-300">
                  <p>Escrow contract: {shortenAddress(r.contract.address)}</p>
                  <p>Deploy tx: {shortenHash(r.contract.deployTxHash)}</p>
                </div>
              )}

              {r.status === 'accepted' && r.contract && (
                <div className="mt-3">
                  <button
                    className="btn-primary"
                    disabled={actioningId === r._id}
                    onClick={() => handleFund(r._id)}
                  >
                    Fund ({weiToEth(r.contract.priceWei)} ETH)
                  </button>
                  <p className="mt-1 text-xs text-ink-400">
                    You pay the full agreed price. On release it splits{' '}
                    {r.contract.studentBps / 100}% student / {r.contract.universityBps / 100}%
                    university / {r.contract.platformBps / 100}% platform.
                  </p>
                </div>
              )}

              {r.funding && (
                <div className="mt-3 rounded-md bg-violet-500/10 p-3 font-mono text-[11px] text-violet-300">
                  <p>Funded: {weiToEth(r.funding.amountWei)} ETH</p>
                  <p>tx: {shortenHash(r.funding.txHash)}</p>
                </div>
              )}

              {r.status === 'funded' && (
                <div className="mt-3">
                  <button
                    className="btn-primary"
                    disabled={actioningId === r._id}
                    onClick={() => handleRelease(r._id)}
                  >
                    Release funds
                  </button>
                </div>
              )}

              {r.release && r.contract && (
                <div className="mt-3 rounded-md bg-lime-500/10 p-3 text-xs text-lime-300">
                  <p className="font-semibold">
                    Sale released ({r.contract.studentBps / 100}% student /{' '}
                    {r.contract.universityBps / 100}% university /{' '}
                    {r.contract.platformBps / 100}% platform)
                  </p>
                  <p>Student: {weiToEth(r.release.studentAmountWei)} ETH</p>
                  <p>University: {weiToEth(r.release.universityAmountWei)} ETH</p>
                  <p>Platform: {weiToEth(r.release.platformAmountWei)} ETH</p>
                  <p className="mt-1 font-mono text-[11px] text-lime-300">
                    tx: {shortenHash(r.release.txHash)}
                  </p>
                </div>
              )}

              {r.licenseNft && (
                <div className="mt-3 rounded-md bg-brand-500/10 p-3 text-xs text-brand-300">
                  <p className="font-semibold">
                    License NFT #{r.licenseNft.tokenId} — you hold this license
                  </p>
                  <p className="mt-1 font-mono text-[11px]">
                    mint tx: {shortenHash(r.licenseNft.mintTxHash)}
                  </p>
                </div>
              )}

              {r.licenseNft && (
                <div className="mt-3 rounded-md border border-ink-700 p-3">
                  <p className="text-sm font-medium text-ink-200">Sublicense (resell)</p>
                  <p className="mt-1 text-xs text-ink-400">
                    Transfer this license to another company for a price. A{' '}
                    {(r.licenseNft.studentBps + r.licenseNft.universityBps + r.licenseNft.platformBps) /
                      100}
                    % resale royalty ({r.licenseNft.studentBps / 100}% student /{' '}
                    {r.licenseNft.universityBps / 100}% university /{' '}
                    {r.licenseNft.platformBps / 100}% platform) is paid out automatically,
                    on-chain, before the license transfers — you keep the rest.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select
                      className="input max-w-[14rem]"
                      value={sublicenseTarget[r._id] ?? ''}
                      onChange={(e) =>
                        setSublicenseTarget((s) => ({ ...s, [r._id]: e.target.value }))
                      }
                    >
                      <option value="">Select a company...</option>
                      {otherCompanies.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Price (ETH)"
                      className="input max-w-[8rem]"
                      value={sublicensePrice[r._id] ?? ''}
                      onChange={(e) =>
                        setSublicensePrice((s) => ({ ...s, [r._id]: e.target.value }))
                      }
                    />
                    <button
                      className="btn-primary"
                      disabled={actioningId === r._id}
                      onClick={() => handleSublicense(r._id)}
                    >
                      Sublicense
                    </button>
                  </div>
                </div>
              )}

              {r.sublicenses.length > 0 && (
                <div className="mt-3 rounded-md bg-ink-800/70 border border-ink-700 p-3 text-xs text-ink-300">
                  <p className="font-semibold text-ink-200">Sublicense history</p>
                  <ul className="mt-1 space-y-2">
                    {r.sublicenses.map((s, i) => (
                      <li key={i} className="font-mono text-[11px]">
                        <p>
                          → {companyLabel(s.toCompany)} for {weiToEth(s.priceWei)} ETH
                        </p>
                        <p>
                          student {weiToEth(s.studentAmountWei)} / university{' '}
                          {weiToEth(s.universityAmountWei)} / platform{' '}
                          {weiToEth(s.platformAmountWei)} / seller {weiToEth(s.sellerAmountWei)}
                        </p>
                        <p>tx: {shortenHash(s.txHash)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {sublicenseError && (
        <p className="mt-4 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {sublicenseError}
        </p>
      )}
    </div>
  );
}
