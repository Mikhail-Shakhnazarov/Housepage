'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, ArrowRight } from 'lucide-react';

function SignInForm() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsLoading(true);
        setError('');

        try {
            const result = await signIn('credentials', {
                email,
                redirect: false,
            });

            if (result?.error) {
                setError('Sign in failed. Please try again.');
            } else {
                router.push(callbackUrl);
            }
        } catch {
            setError('An unexpected error occurred.');
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
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-2">Housepage</h1>
                    <p className="text-foreground opacity-60">Sign in to your WG coordination space.</p>
                </div>

                <div className="glass-card p-8 rounded-3xl space-y-6">
                    <form onSubmit={handleSignIn} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-bold text-foreground mb-2 opacity-70">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary transition-all text-lg"
                                required
                                autoFocus
                            />
                        </div>

                        {error && (
                            <p className="text-red-500 text-sm text-center">{error}</p>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !email}
                            className="w-full bg-primary text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            {isLoading ? 'Signing in...' : 'SIGN IN'}
                            <ArrowRight size={20} />
                        </button>
                    </form>

                    <p className="text-center text-xs opacity-50">
                        Development mode: enter any email to sign in.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

export default function SignInPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-pulse text-foreground opacity-50">Loading...</div>
            </div>
        }>
            <SignInForm />
        </Suspense>
    );
}
