import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-10 border-b border-ink-800 bg-ink-950/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white shadow-glow">
            IC
          </span>
          <span className="bg-gradient-to-r from-brand-300 to-accent-300 bg-clip-text text-lg font-extrabold text-transparent">
            InnovChain
          </span>
        </Link>

        <div className="flex items-center gap-4 text-sm font-medium text-ink-300">
          <Link to="/" className="hover:text-brand-400">
            Marketplace
          </Link>

          {user?.role === 'student' && (
            <Link to="/student" className="hover:text-brand-400">
              Student Dashboard
            </Link>
          )}

          {user?.role === 'company' && (
            <Link to="/company" className="hover:text-brand-400">
              Company Dashboard
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-ink-400">
                {user.name}{' '}
                <span className="rounded bg-ink-800 px-1.5 py-0.5 text-xs uppercase tracking-wide text-ink-400">
                  {user.role}
                </span>
              </span>
              <button className="btn-secondary" onClick={handleLogout}>
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary">
                Log in
              </Link>
              <Link to="/register" className="btn-primary">
                Register
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
