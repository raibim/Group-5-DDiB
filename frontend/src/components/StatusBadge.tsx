import type { LicenseRequestStatus } from '../types';

const STYLES: Record<LicenseRequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  accepted: 'bg-blue-100 text-blue-800 border-blue-200',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
  funded: 'bg-violet-100 text-violet-800 border-violet-200',
  released: 'bg-emerald-100 text-emerald-800 border-emerald-200',
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
