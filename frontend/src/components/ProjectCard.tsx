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
      className="card block transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">
          {project.title}
        </h3>
        {project.visibility === 'private' && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            Private
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
        {project.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {project.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
          >
            {tag}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        by <span className="font-medium">{ownerName(project.owner)}</span>
      </p>
    </Link>
  );
}
