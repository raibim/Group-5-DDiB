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
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
            IC
          </span>
          <span className="text-lg font-bold text-slate-900">InnovChain</span>
        </Link>

        <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
          <Link to="/" className="hover:text-brand-600">
            Marketplace
          </Link>

          {user?.role === 'student' && (
            <Link to="/student" className="hover:text-brand-600">
              Student Dashboard
            </Link>
          )}

          {user?.role === 'company' && (
            <Link to="/company" className="hover:text-brand-600">
              Company Dashboard
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                {user.name}{' '}
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs uppercase tracking-wide text-slate-500">
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
