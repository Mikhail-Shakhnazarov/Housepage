'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, ArrowRight, Key } from 'lucide-react';

export default function Onboarding() {
    const [name, setName] = useState('');
    const [token, setToken] = useState('');
    const [showJoin, setShowJoin] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        setIsLoading(true);
        setError('');
        try {
            const res = await fetch('/api/households', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (res.ok) {
                const household = await res.json();
                localStorage.setItem('active_household_id', household.id);
                router.push('/dashboard');
            } else {
                setError('Failed to create household');
            }
        } catch {
            setError('An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;
        setIsLoading(true);
        setError('');
        try {
            const res = await fetch('/api/invitations/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('active_household_id', data.household.id);
                router.push('/dashboard');
            } else {
                const err = await res.json().catch(() => ({ error: 'Invalid token' }));
                setError(err.error || 'Failed to join household');
            }
        } catch {
            setError('An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md space-y-8"
            >
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary text-white shadow-2xl shadow-primary/30 mb-6">
                        <Home size={40} />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-2">Welcome to Housepage</h1>
                    <p className="text-foreground opacity-60">Let&apos;s set up your WG coordination space.</p>
                </div>

                {!showJoin ? (
                    <div className="glass-card p-8 rounded-3xl space-y-6">
                        <form onSubmit={handleCreate} className="space-y-6">
                            <div>
                                <label htmlFor="name" className="block text-sm font-bold text-foreground mb-2 opacity-70">
                                    Household Name
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Sonnenallee 123"
                                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary transition-all text-lg"
                                    required
                                />
                            </div>

                            {error && <p className="text-red-500 text-sm">{error}</p>}

                            <button
                                type="submit"
                                disabled={isLoading || !name}
                                className="w-full bg-primary text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                            >
                                {isLoading ? 'Creating...' : 'CREATE HOUSEHOLD'}
                                <ArrowRight size={20} />
                            </button>
                        </form>

                        <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border opacity-50"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-foreground opacity-50">OR</span>
                            </div>
                        </div>

                        <button
                            onClick={() => { setShowJoin(true); setError(''); }}
                            className="w-full border-2 border-primary/20 text-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/5 transition-all"
                        >
                            <Key size={18} /> JOIN EXISTING HOUSEHOLD
                        </button>

                        <p className="text-center text-xs opacity-50 px-8">
                            By creating a household, you become the owner and can invite your flatmates.
                        </p>
                    </div>
                ) : (
                    <div className="glass-card p-8 rounded-3xl space-y-6">
                        <form onSubmit={handleJoin} className="space-y-6">
                            <div>
                                <label htmlFor="token" className="block text-sm font-bold text-foreground mb-2 opacity-70">
                                    Invitation Token
                                </label>
                                <input
                                    id="token"
                                    type="text"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    placeholder="Paste your invitation token"
                                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary transition-all text-lg font-mono"
                                    required
                                />
                            </div>

                            {error && <p className="text-red-500 text-sm">{error}</p>}

                            <button
                                type="submit"
                                disabled={isLoading || !token}
                                className="w-full bg-primary text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                            >
                                {isLoading ? 'Joining...' : 'JOIN HOUSEHOLD'}
                                <ArrowRight size={20} />
                            </button>
                        </form>

                        <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border opacity-50"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-foreground opacity-50">OR</span>
                            </div>
                        </div>

                        <button
                            onClick={() => { setShowJoin(false); setError(''); }}
                            className="w-full border-2 border-primary/20 text-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/5 transition-all"
                        >
                            CREATE NEW HOUSEHOLD
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
