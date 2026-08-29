import React, { useState } from 'react';
import { Layers, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { setStoredToken } from '../api/client';
import { toast } from 'sonner';
import { SecretInput } from '@/components/ui/secret-input';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      if (response.ok) {
        const data = await response.json();
        setStoredToken(data.token);
        localStorage.setItem('omniops_admin_logged_in', 'true');
        toast.success('Successfully logged in');
        onLoginSuccess();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || 'Invalid username or password.');
      }
    } catch (err) {
      toast.error('Connection to backend failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Login Glass Card */}
      <div className="glass-panel rounded-2xl border border-slate-800 bg-dark-900/90 max-w-md w-full p-8 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-700 text-white shadow-xl shadow-brand-500/20 mb-4">
            <Layers size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
            OmniOps Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sign in to access the OmniOps Control Plane
          </p>
        </div>

        <div className="mb-6 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-2.5">
          <ShieldCheck size={16} className="text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block text-indigo-200">Secure Access</span>
            <span>Use your configured Account password. If you haven't set one up, create a user via CLI: <code className="bg-indigo-950/60 px-1 py-0.5 rounded text-indigo-300 font-mono">omni users create admin &lt;password&gt;</code></span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Username
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-9 pr-4 py-2.5 text-xs font-mono bg-dark-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 z-10" />
              <SecretInput
                required
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 py-2.5 h-auto text-xs font-mono bg-dark-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 active:scale-[0.99] text-white text-xs font-semibold shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-[11px] text-slate-600">
          Docker Compose OmniOps Engine • v1.0.0
        </div>
      </div>
    </div>
  );
};
