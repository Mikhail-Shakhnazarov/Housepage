'use client';

import { useState, useEffect } from 'react';
import { useHousehold } from '@/components/HouseholdProvider';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Check, UserPlus, UserMinus, Shield } from 'lucide-react';

interface Member {
    id: string;
    userId: string;
    email: string;
    name: string | null;
    role: string;
    joinedAt: string;
}

interface HouseholdData {
    id: string;
    name: string;
    address: string | null;
    createdAt: string;
    members: Member[];
    counts: { tasks: number; notes: number; expenses: number; decisions: number };
}

export default function SettingsPage() {
    const { activeHousehold, isLoading: isHouseholdLoading } = useHousehold();
    const { data: session } = useSession();
    const router = useRouter();
    const [data, setData] = useState<HouseholdData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteToken, setInviteToken] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [householdName, setHouseholdName] = useState('');

    useEffect(() => {
        if (!activeHousehold) return;
        fetch(`/api/households/${activeHousehold.id}`)
            .then(r => {
                if (!r.ok) throw new Error('Failed to load household');
                return r.json();
            })
            .then(d => {
                setData(d);
                setHouseholdName(d.name);
                setIsLoading(false);
            })
            .catch(e => {
                setError(e.message);
                setIsLoading(false);
            });
    }, [activeHousehold]);

    const currentUserMembership = data?.members.find(m => m.userId === session?.user?.id);
    const isOwner = currentUserMembership?.role === 'OWNER';

    const handleCreateInvite = async () => {
        if (!inviteEmail || !activeHousehold) return;
        try {
            const res = await fetch('/api/invitations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    householdId: activeHousehold.id,
                    email: inviteEmail,
                    role: 'MEMBER',
                }),
            });
            if (res.ok) {
                const inv = await res.json();
                setInviteToken(inv.token);
                setInviteEmail('');
            }
        } catch { }
    };

    const handleCopyToken = () => {
        if (inviteToken) {
            navigator.clipboard.writeText(inviteToken);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleRename = async () => {
        if (!householdName || !activeHousehold) return;
        await fetch(`/api/households/${activeHousehold.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: householdName }),
        });
    };

    const handleRemoveMember = async (membershipId: string) => {
        await fetch(`/api/memberships/${membershipId}`, { method: 'DELETE' });
        window.location.reload();
    };

    if (isHouseholdLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-lg font-bold opacity-20">Loading...</div></div>;
    }

    if (!activeHousehold) {
        router.push('/onboarding');
        return null;
    }

    return (
        <motion.main
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-h-screen bg-background p-4 md:p-8 max-w-4xl mx-auto"
        >
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm opacity-50 hover:opacity-100 mb-8 transition-opacity">
                <ArrowLeft size={16} /> Back to Dashboard
            </button>

            {isLoading && <div className="animate-pulse space-y-4">{' '}<div className="h-8 bg-slate-200 rounded w-1/3" /><div className="h-20 bg-slate-200 rounded" /></div>}
            {error && <div className="wedge-card text-red-600">{error}</div>}

            {data && (
                <div className="space-y-8">
                    <section>
                        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Household Settings</h1>
                        <p className="text-sm opacity-50">{data.members.length} member{data.members.length !== 1 ? 's' : ''}</p>
                    </section>

                    <section className="wedge-card">
                        <h2 className="font-bold text-lg mb-4">Household Name</h2>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={householdName}
                                onChange={e => setHouseholdName(e.target.value)}
                                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-4 py-2"
                                disabled={!isOwner}
                            />
                            {isOwner && (
                                <button onClick={handleRename} className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-primary/90">
                                    Save
                                </button>
                            )}
                        </div>
                        {!isOwner && <p className="text-xs opacity-40 mt-2">Only owners can rename the household.</p>}
                    </section>

                    <section className="wedge-card">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-lg">Members</h2>
                            {data.members.length} total
                        </div>
                        <div className="space-y-3">
                            {data.members.map(m => {
                                const soleOwner = m.role === 'OWNER' && data.members.filter(mm => mm.role === 'OWNER').length <= 1;
                                return (
                                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                                                {(m.name || m.email)[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{m.name || m.email}</p>
                                                <p className="text-xs opacity-40">{m.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded ${m.role === 'OWNER' ? 'bg-amber-100 text-amber-700' : m.role === 'MEMBER' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {m.role}
                                            </span>
                                            {isOwner && !(m.userId === session?.user?.id && soleOwner) && (
                                                <button onClick={() => handleRemoveMember(m.id)} className="p-1.5 hover:bg-red-50 rounded transition-colors" title="Remove member">
                                                    <UserMinus size={14} className="text-red-400" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {isOwner && (
                        <section className="wedge-card border-primary/20">
                            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <UserPlus size={18} /> Invite Member
                            </h2>
                            <div className="flex gap-3 mb-4">
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    placeholder="member@example.com"
                                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-4 py-2"
                                />
                                <button onClick={handleCreateInvite} disabled={!inviteEmail} className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-primary/90 disabled:opacity-50">
                                    Generate Token
                                </button>
                            </div>
                            {inviteToken && (
                                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                                    <p className="text-xs font-bold mb-2">Share this token with the invitee:</p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 bg-background px-3 py-2 rounded text-sm font-mono break-all">{inviteToken}</code>
                                        <button onClick={handleCopyToken} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
                                            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    <section className="wedge-card">
                        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Shield size={18} /> Household Statistics
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            {[
                                { label: 'Tasks', count: data.counts.tasks },
                                { label: 'Notes', count: data.counts.notes },
                                { label: 'Expenses', count: data.counts.expenses },
                                { label: 'Decisions', count: data.counts.decisions },
                            ].map(stat => (
                                <div key={stat.label} className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                                    <div className="text-2xl font-extrabold">{stat.count}</div>
                                    <div className="text-xs opacity-50">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </motion.main>
    );
}
