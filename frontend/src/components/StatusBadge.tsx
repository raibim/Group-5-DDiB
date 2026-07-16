import type { LicenseRequestStatus } from '../types';

const STYLES: Record<LicenseRequestStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  accepted: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  rejected: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  funded: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  released: 'bg-lime-500/15 text-lime-300 border-lime-500/40 shadow-[0_0_12px_0_rgba(163,230,53,0.25)]',
};

const LABELS: Record<LicenseRequestStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  funded: 'Funded',
  released: 'Released',
};

export default function StatusBadge({
  status,
}: {
  status: LicenseRequestStatus;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
