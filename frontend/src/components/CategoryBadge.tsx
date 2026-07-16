import { PROJECT_CATEGORY_LABELS, type ProjectCategory } from '../types';

const STYLES: Record<ProjectCategory, string> = {
  'final-year': 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  hackathon: 'bg-accent-500/15 text-accent-300 border-accent-500/40',
  'summer-school': 'bg-brand-500/15 text-brand-300 border-brand-500/40',
};

export default function CategoryBadge({
  category,
}: {
  category: ProjectCategory;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STYLES[category]}`}
    >
      {PROJECT_CATEGORY_LABELS[category]}
    </span>
  );
}
