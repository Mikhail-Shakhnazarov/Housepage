'use client';

import React, { useState, useEffect } from 'react';
import { useHousehold } from '@/components/HouseholdProvider';
import { Plus, X } from 'lucide-react';

interface Decision {
    id: string;
    title: string;
    context: string | null;
    status: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

const STATUS_STYLES: Record<string, string> = {
    PROPOSED: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30',
    AGREED: 'text-green-600 bg-green-50 dark:bg-green-900/30',
    BLOCKED: 'text-red-600 bg-red-50 dark:bg-red-900/30',
    ARCHIVED: 'text-slate-500 bg-slate-100 dark:bg-slate-800',
};

const DecisionsSection: React.FC = () => {
    const { activeHousehold } = useHousehold();
    const [decisions, setDecisions] = useState<Decision[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [context, setContext] = useState('');

    useEffect(() => {
        if (!activeHousehold) return;
        fetch(`/api/decisions?householdId=${activeHousehold.id}`)
            .then(res => res.json())
            .then(data => {
                setDecisions(data);
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    }, [activeHousehold]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeHousehold || !title) return;
        await fetch('/api/decisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, context, householdId: activeHousehold.id }),
        });
        setTitle('');
        setContext('');
        setShowForm(false);
        setDecisions([]);
        setIsLoading(true);
        fetch(`/api/decisions?householdId=${activeHousehold.id}`)
            .then(res => res.json())
            .then(data => {
                setDecisions(data);
                setIsLoading(false);
            });
    };

    const handleStatusChange = async (id: string, status: string) => {
        await fetch(`/api/decisions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        fetch(`/api/decisions?householdId=${activeHousehold?.id}`)
            .then(res => res.json())
            .then(setDecisions);
    };

    const getNextStatuses = (current: string): string[] => {
        const transitions: Record<string, string[]> = {
            PROPOSED: ['AGREED', 'BLOCKED'],
            AGREED: ['ARCHIVED'],
            BLOCKED: ['PROPOSED', 'ARCHIVED'],
            ARCHIVED: ['PROPOSED'],
        };
        return transitions[current] || [];
    };

    if (!activeHousehold) return null;

    return (
        <div className="bg-blue-50/30 dark:bg-blue-900/10 p-6 rounded-[2rem] border border-blue-100/50 dark:border-blue-900/30">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold tracking-tight">Decisions</h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowForm(true)} className="text-primary text-xs font-bold hover:underline flex items-center gap-1">
                        <Plus size={12} /> Propose
                    </button>
                </div>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 p-4 rounded-xl mb-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm">New Decision</h4>
                        <button type="button" onClick={() => setShowForm(false)}><X size={14} className="opacity-40" /></button>
                    </div>
                    <input
                        required
                        placeholder="What needs deciding?"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm"
                    />
                    <textarea
                        placeholder="Context (optional)"
                        value={context}
                        onChange={e => setContext(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm"
                    />
                    <button type="submit" className="w-full bg-primary text-white font-bold py-2 rounded-lg text-sm hover:bg-primary/90">
                        Propose Decision
                    </button>
                </form>
            )}

            <div className="space-y-3">
                {isLoading ? (
                    <div className="text-center text-sm opacity-50 py-4">Loading...</div>
                ) : decisions.length === 0 ? (
                    <div className="text-center py-6 text-sm opacity-30 italic">
                        No decisions yet. Propose one!
                    </div>
                ) : (
                    decisions.map(d => (
                        <div key={d.id} className="bg-white dark:bg-slate-800 border-none shadow-xl shadow-blue-900/5 p-4 rounded-xl">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded italic ${STATUS_STYLES[d.status] || 'bg-slate-100 text-slate-600'}`}>
                                    {d.status}
                                </span>
                                <span className="text-[10px] opacity-40">{new Date(d.updatedAt).toLocaleDateString()}</span>
                            </div>
                            <h4 className="font-bold text-base mb-1">{d.title}</h4>
                            {d.context && <p className="text-xs opacity-60 mb-3 leading-relaxed">{d.context}</p>}
                            <div className="flex gap-2 mt-3">
                                {getNextStatuses(d.status).map(s => (
                                    <button
                                        key={s}
                                        onClick={() => handleStatusChange(d.id, s)}
                                        className="flex-1 text-[10px] font-bold py-2 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                    >
                                        {s === 'AGREED' ? '✓ Agree' : s === 'BLOCKED' ? '✗ Block' : s === 'ARCHIVED' ? 'Archive' : s === 'PROPOSED' ? 'Re-propose' : s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DecisionsSection;
