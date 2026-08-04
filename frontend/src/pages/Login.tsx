import React, { useState } from 'react';
import { api } from '../services/api';
import { ShieldAlert, ArrowRight, UserPlus, LogIn, Mail, Lock, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        await api.auth.register({ username, email, password });
        const tokenRes = await api.auth.login({ username, password });
        localStorage.setItem('token', tokenRes.access_token);
        const userRes = await api.auth.getMe();
        onLoginSuccess(userRes, tokenRes.access_token);
      } else {
        const tokenRes = await api.auth.login({ username, password });
        localStorage.setItem('token', tokenRes.access_token);
        const userRes = await api.auth.getMe();
        onLoginSuccess(userRes, tokenRes.access_token);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'An unexpected authentication error occurred.';
      setError(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setUsername('');
    setEmail('');
    setPassword('');
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-200 dark:shadow-none mb-4">
            <LogIn size={32} />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isRegistering ? 'Create your Account' : 'Welcome Back'}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
            {isRegistering ? 'Setup your support workspace' : 'Sign in to access your customer database'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
          
          {error && (
            <div className="mb-6 flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-red-700 dark:text-red-400">
              <ShieldAlert className="shrink-0 mt-0.5" size={18} />
              <div className="text-xs font-medium leading-relaxed">
                {error}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <UserIcon size={16} />
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="johndoe"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
                />
              </div>
            </div>

            {isRegistering && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all hover:shadow-lg disabled:opacity-50 disabled:hover:shadow-none"
            >
              <span>{loading ? 'Processing...' : isRegistering ? 'Create Workspace' : 'Sign In'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              onClick={toggleMode}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline inline-flex items-center space-x-1"
            >
              {isRegistering ? (
                <>
                  <LogIn size={13} className="mr-1" /> Already have an account? Sign In
                </>
              ) : (
                <>
                  <UserPlus size={13} className="mr-1" /> Need an account? Create one
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
export default Login;
