import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, licenseRequestsApi, projectsApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import CategoryBadge from '../components/CategoryBadge';
import {
  PROJECT_CATEGORIES,
  PROJECT_CATEGORY_LABELS,
  type LicenseRequest,
  type Project,
  type ProjectCategory,
  type User,
} from '../types';
import { shortenAddress, shortenHash, weiToEth } from '../utils/format';

function projectTitle(project: LicenseRequest['project']): string {
  if (typeof project === 'string') return project;
  return (project as Project).title ?? 'Unknown project';
}

function companyName(company: LicenseRequest['company']): string {
  if (typeof company === 'string') return company;
  return (company as User).name ?? 'Unknown company';
}

export default function StudentDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [requests, setRequests] = useState<LicenseRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProjectCategory>('final-year');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function loadProjects() {
    setProjectsLoading(true);
    projectsApi
      .mine()
      .then(setProjects)
      .catch((err) =>
        setProjectsError(
          err instanceof ApiError ? err.message : 'Failed to load projects',
        ),
      )
      .finally(() => setProjectsLoading(false));
  }

  function loadRequests() {
    setRequestsLoading(true);
    licenseRequestsApi
      .mine()
      .then(setRequests)
      .catch((err) =>
        setRequestsError(
          err instanceof ApiError ? err.message : 'Failed to load requests',
        ),
      )
      .finally(() => setRequestsLoading(false));
  }

  useEffect(() => {
    loadProjects();
    loadRequests();
  }, []);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setUploadError('Please choose a file to upload.');
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      await projectsApi.upload({
        file,
        title,
        description,
        category,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        visibility,
      });
      setTitle('');
      setDescription('');
      setCategory('final-year');
      setTags('');
      setVisibility('public');
      setFile(null);
      loadProjects();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleAccept(id: string) {
    setActioningId(id);
    try {
      await licenseRequestsApi.accept(id);
      loadRequests();
    } catch (err) {
      setRequestsError(
        err instanceof ApiError ? err.message : 'Failed to accept request',
      );
    } finally {
      setActioningId(null);
    }
  }

  async function handleReject(id: string) {
    setActioningId(id);
    try {
      await licenseRequestsApi.reject(id);
      loadRequests();
    } catch (err) {
      setRequestsError(
        err instanceof ApiError ? err.message : 'Failed to reject request',
      );
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
      setRequestsError(
        err instanceof ApiError ? err.message : 'Failed to release funds',
      );
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-ink-50">Student Dashboard</h1>
      <p className="mt-1 text-sm text-ink-400">
        Manage your projects and incoming license requests.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold text-ink-50">
            Upload a project
          </h2>
          <form className="card mt-3 space-y-4" onSubmit={handleUpload}>
            <div>
              <label className="label" htmlFor="file">
                File
              </label>
              <input
                id="file"
                type="file"
                required
                className="block w-full text-sm text-ink-300 file:mr-3 file:rounded-md file:border-0 file:bg-brand-500/150/15 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-300 hover:file:bg-brand-500/150/25"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div>
              <label className="label" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                type="text"
                required
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                required
                rows={3}
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="category">
                Category
              </label>
              <select
                id="category"
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value as ProjectCategory)}
              >
                {PROJECT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PROJECT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="tags">
                Tags (comma-separated)
              </label>
              <input
                id="tags"
                type="text"
                placeholder="robotics, iot, energy"
                className="input"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="visibility">
                Visibility
              </label>
              <select
                id="visibility"
                className="input"
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as 'public' | 'private')
                }
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>

            {uploadError && (
              <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {uploadError}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload & register ownership'}
            </button>
          </form>

          <h2 className="mt-8 text-lg font-semibold text-ink-50">
            My Projects
          </h2>
          {projectsLoading && (
            <p className="mt-2 text-sm text-ink-400">Loading...</p>
          )}
          {projectsError && (
            <p className="mt-2 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {projectsError}
            </p>
          )}
          {!projectsLoading && projects.length === 0 && (
            <p className="mt-2 text-sm text-ink-400">
              You haven't uploaded any projects yet.
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {projects.map((p) => (
              <li key={p._id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/projects/${p._id}`}
                    className="font-medium text-brand-300 hover:underline"
                  >
                    {p.title}
                  </Link>
                  <CategoryBadge category={p.category} />
                </div>
                <p className="mt-1 text-xs text-ink-400">
                  {p.visibility} &middot; on-chain id{' '}
                  {p.ownershipProof.onChainId}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink-50">
            Incoming License Requests
          </h2>
          {requestsLoading && (
            <p className="mt-2 text-sm text-ink-400">Loading...</p>
          )}
          {requestsError && (
            <p className="mt-2 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {requestsError}
            </p>
          )}
          {!requestsLoading && requests.length === 0 && (
            <p className="mt-2 text-sm text-ink-400">
              No license requests yet.
            </p>
          )}

          <ul className="mt-3 space-y-3">
            {requests.map((r) => (
              <li key={r._id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink-50">
                      {projectTitle(r.project)}
                    </p>
                    <p className="text-xs text-ink-400">
                      from {companyName(r.company)}
                    </p>
                  </div>
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

                {r.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn-primary"
                      disabled={actioningId === r._id}
                      onClick={() => handleAccept(r._id)}
                    >
                      Accept
                    </button>
                    <button
                      className="btn-danger"
                      disabled={actioningId === r._id}
                      onClick={() => handleReject(r._id)}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {r.contract && (
                  <div className="mt-3 rounded-md bg-ink-800/70 border border-ink-700 p-3 font-mono text-[11px] text-ink-300">
                    <p>Escrow contract: {shortenAddress(r.contract.address)}</p>
                    <p>Deploy tx: {shortenHash(r.contract.deployTxHash)}</p>
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
                      Royalty released ({r.contract.studentBps / 100}% student /{' '}
                      {r.contract.universityBps / 100}% university)
                    </p>
                    <p>Student: {weiToEth(r.release.studentAmountWei)} ETH</p>
                    <p>University: {weiToEth(r.release.universityAmountWei)} ETH</p>
                    <p className="mt-1 text-lime-400">
                      Company retains the remaining {r.contract.companyBps / 100}% (
                      {weiToEth(
                        (BigInt(r.priceWei) - BigInt(r.contract.royaltyWei)).toString(),
                      )}{' '}
                      ETH) — it was never escrowed.
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-lime-300">
                      tx: {shortenHash(r.release.txHash)}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
