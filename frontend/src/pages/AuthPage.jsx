import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../context/authStore.js';
import toast from 'react-hot-toast';
import { Zap, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function AuthPage({ mode }) {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const { login, register, loading } = useAuthStore();
  const isLogin = mode === 'login';

  const handleSubmit = async (e) => {
    e.preventDefault();
    let result;
    if (isLogin) {
      result = await login(form.email, form.password);
    } else {
      if (!form.username.trim()) return toast.error('Username is required');
      result = await register(form.username, form.email, form.password);
    }
    if (!result.success) toast.error(result.error);
    else toast.success(isLogin ? 'Welcome back!' : 'Account created!');
  };

  return (
    <div className="h-full flex items-center justify-center bg-void relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-blue-accent/5 blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 animate-fade-in">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
            <Zap size={20} className="text-accent" />
          </div>
          <span className="font-display text-xl font-bold text-text-primary tracking-tight">DevMind</span>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-panel">
          <h1 className="font-display text-2xl font-bold text-text-primary mb-1">
            {isLogin ? 'Sign in' : 'Create account'}
          </h1>
          <p className="text-text-secondary text-sm mb-8">
            {isLogin ? 'Welcome back to your workspace' : 'Start building with AI assistance'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-widest">Username</label>
                <input
                  className="input-field"
                  placeholder="johndoe"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-widest">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-widest">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field pr-11"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 mt-6 py-3"
            >
              {loading ? (
                <div className="w-4 h-4 rounded-full border-2 border-void border-t-transparent animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign in' : 'Create account'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-text-secondary text-sm mt-6">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Link
              to={isLogin ? '/register' : '/login'}
              className="text-accent hover:text-accent/80 transition-colors font-medium"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
