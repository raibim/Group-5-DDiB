import { Link } from 'react-router-dom';
import type { Project, User } from '../types';

function ownerName(owner: Project['owner']): string {
  if (typeof owner === 'string') return owner;
  return (owner as User).name ?? 'Unknown';
}

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/projects/${project._id}`}
      className="card block transition-all hover:border-brand-500/50 hover:shadow-glow"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-ink-50">
          {project.title}
        </h3>
        {project.visibility === 'private' && (
          <span className="shrink-0 rounded-full bg-ink-800 px-2 py-0.5 text-xs font-medium text-ink-400">
            Private
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-ink-300">
        {project.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {project.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-medium text-brand-300"
          >
            {tag}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-400">
        by <span className="font-medium">{ownerName(project.owner)}</span>
      </p>
    </Link>
  );
}
