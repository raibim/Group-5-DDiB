import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError, licenseRequestsApi, projectsApi } from '../api/client';
import type { Project, User } from '../types';

function ownerName(owner: Project['owner']): string {
  if (typeof owner === 'string') return owner;
  return (owner as User).name ?? 'Unknown';
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [durationMonths, setDurationMonths] = useState(12);
  const [commercialUse, setCommercialUse] = useState(false);
  const [priceEth, setPriceEth] = useState('0.1');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    projectsApi
      .getById(id)
      .then((data) => {
        if (!cancelled) setProject(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load project');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleRequestLicense(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setRequestError(null);
    setRequestSubmitting(true);
    setRequestSuccess(false);
    try {
      await licenseRequestsApi.create(id, {
        durationMonths,
        commercialUse,
        priceEth,
      });
      setRequestSuccess(true);
    } catch (err) {
      setRequestError(
        err instanceof ApiError ? err.message : 'Failed to submit request',
      );
    } finally {
      setRequestSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-ink-400">
        Loading project...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error ?? 'Project not found'}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="card">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-ink-50">{project.title}</h1>
          {project.visibility === 'private' && (
            <span className="shrink-0 rounded-full bg-ink-800 px-2 py-0.5 text-xs font-medium text-ink-400">
              Private
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-400">
          by <span className="font-medium">{ownerName(project.owner)}</span>
        </p>

        <p className="mt-4 whitespace-pre-wrap text-ink-200">
          {project.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-medium text-brand-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <p className="mt-4 text-sm text-ink-400">
          File: <span className="font-medium text-ink-200">{project.fileName}</span>
        </p>
      </div>

      <div className="card mt-6">
        <h2 className="text-lg font-semibold text-ink-50">
          On-chain Ownership Proof
        </h2>
        <p className="mt-1 text-sm text-ink-400">
          Registered via the <code>OwnershipRegistry</code> contract. No local
          block explorer is available in this PoC, so the raw values are
          shown below.
        </p>
        <dl className="mt-4 space-y-2 rounded-xl border border-lime-500/20 bg-black/40 p-4 font-mono text-xs text-lime-300 shadow-[inset_0_0_20px_rgba(163,230,53,0.05)]">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="w-40 shrink-0 text-ink-500">On-chain ID</dt>
            <dd className="break-all">{project.ownershipProof.onChainId}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="w-40 shrink-0 text-ink-500">File hash (SHA-256)</dt>
            <dd className="break-all">{project.fileHash}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="w-40 shrink-0 text-ink-500">Tx hash</dt>
            <dd className="break-all">{project.ownershipProof.txHash}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="w-40 shrink-0 text-ink-500">Block number</dt>
            <dd className="break-all">{project.ownershipProof.blockNumber}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="w-40 shrink-0 text-ink-500">Registered at</dt>
            <dd className="break-all">
              {new Date(project.ownershipProof.registeredAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      {user?.role === 'company' && (
        <div className="card mt-6">
          <h2 className="text-lg font-semibold text-ink-50">
            Request a License
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            Submit terms to the student owner. If accepted, you'll be able to
            fund and release payment on-chain from your Company Dashboard.
          </p>

          <form className="mt-4 space-y-4" onSubmit={handleRequestLicense}>
            <div>
              <label className="label" htmlFor="durationMonths">
                Duration (months)
              </label>
              <input
                id="durationMonths"
                type="number"
                min={1}
                required
                className="input"
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="label" htmlFor="priceEth">
                Price (ETH)
              </label>
              <input
                id="priceEth"
                type="text"
                inputMode="decimal"
                required
                className="input"
                value={priceEth}
                onChange={(e) => setPriceEth(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-ink-200">
              <input
                type="checkbox"
                checked={commercialUse}
                onChange={(e) => setCommercialUse(e.target.checked)}
                className="h-4 w-4 rounded border-ink-600 text-brand-400 focus:ring-brand-500"
              />
              Commercial use
            </label>

            {requestError && (
              <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {requestError}
              </p>
            )}
            {requestSuccess && (
              <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                License request submitted. Track its status from your Company
                Dashboard.
              </p>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={requestSubmitting}
            >
              {requestSubmitting ? 'Submitting...' : 'Request License'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
