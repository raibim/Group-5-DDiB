import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import type { Role } from '../types';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Extract<Role, 'student' | 'company'>>(
    'student',
  );
  const [walletAddress, setWalletAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await register({
        name,
        email,
        password,
        role,
        walletAddress,
      });
      navigate(user.role === 'student' ? '/student' : '/company');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <div className="card">
        <h1 className="text-xl font-bold text-ink-50">Create an account</h1>
        <p className="mt-1 text-sm text-ink-400">
          Join InnovChain as a student inventor or a licensing company.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="role">
              I am a...
            </label>
            <select
              id="role"
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              <option value="student">Student (inventor)</option>
              <option value="company">Company (licensee)</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="walletAddress">
              Wallet address (testnet)
            </label>
            <input
              id="walletAddress"
              type="text"
              required
              placeholder="0x..."
              className="input font-mono text-xs"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-500">
              For this PoC, paste any EVM address (e.g. a Hardhat dev
              account). A real deployment would connect via MetaMask or
              WalletConnect instead of a text field.
            </p>
          </div>

          {error && (
            <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={submitting}
          >
            {submitting ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-400">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
