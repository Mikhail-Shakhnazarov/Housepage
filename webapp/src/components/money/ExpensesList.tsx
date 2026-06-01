'use client';

import React, { useState, useEffect } from 'react';
import { useHousehold } from '@/components/HouseholdProvider';
import { useSession } from 'next-auth/react';
import { Plus, X } from 'lucide-react';

interface Expense {
    id: string;
    title: string;
    amount: number;
    payerId: string;
    createdAt: string;
    splits?: { userId: string; amount: number }[];
}

interface Member {
    userId: string;
    name: string | null;
    email: string;
}

const ExpensesList: React.FC = () => {
    const { activeHousehold } = useHousehold();
    const { data: session } = useSession();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [payerId, setPayerId] = useState('');
    const [members, setMembers] = useState<Member[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!activeHousehold) return;
        fetch(`/api/expenses?householdId=${activeHousehold.id}`)
            .then(res => res.json())
            .then(data => {
                setExpenses(data);
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    }, [activeHousehold]);

    useEffect(() => {
        if (!activeHousehold || !showForm) return;
        fetch(`/api/households/${activeHousehold.id}`)
            .then(r => r.json())
            .then(data => {
                setMembers(data.members || []);
                if (data.members?.length > 0) {
                    setPayerId(prev => prev || session?.user?.id || data.members[0].userId);
                }
            });
    }, [activeHousehold, showForm, session?.user?.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeHousehold || !title || !amount) return;
        setIsSubmitting(true);
        await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                amount: parseFloat(amount),
                householdId: activeHousehold.id,
                payerId: payerId || undefined,
            }),
        });
        setTitle('');
        setAmount('');
        setShowForm(false);
        setIsSubmitting(false);
        setExpenses([]);
        setIsLoading(true);
        fetch(`/api/expenses?householdId=${activeHousehold.id}`)
            .then(res => res.json())
            .then(data => {
                setExpenses(data);
                setIsLoading(false);
            });
    };

    const getPayerName = (payerId: string) => {
        if (payerId === session?.user?.id) return 'You';
        const member = members.find(m => m.userId === payerId);
        return member?.name || member?.email || 'Someone';
    };

    if (!activeHousehold) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase tracking-tight text-foreground/50">Expenses</h3>
                <button onClick={() => setShowForm(true)} className="text-primary text-xs font-bold hover:underline flex items-center gap-1">
                    <Plus size={12} /> Add
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="wedge-card bg-anchor-soft/10 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm">New Expense</h4>
                        <button type="button" onClick={() => setShowForm(false)}><X size={14} className="opacity-40" /></button>
                    </div>
                    <input
                        required
                        placeholder="Title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                        required
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm"
                    />
                    <select
                        value={payerId}
                        onChange={e => setPayerId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm"
                    >
                        {members.map(m => (
                            <option key={m.userId} value={m.userId}>{m.name || m.email}</option>
                        ))}
                    </select>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-primary text-white font-bold py-2 rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50">
                        {isSubmitting ? 'Adding...' : 'Add Expense'}
                    </button>
                </form>
            )}

            {isLoading ? (
                <div className="text-center text-sm opacity-50 py-4">Loading...</div>
            ) : expenses.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-border rounded-xl opacity-30">
                    <p className="text-sm">No expenses yet.</p>
                </div>
            ) : (
                expenses.map(expense => (
                    <div key={expense.id} className="wedge-card bg-anchor-soft/10">
                        <div className="flex justify-between items-center">
                            <div>
                                <h4 className="font-semibold text-sm">{expense.title}</h4>
                                <p className="text-[10px] opacity-40">{new Date(expense.createdAt).toLocaleDateString()}</p>
                                <p className="text-[10px] opacity-50 mt-1">paid by {getPayerName(expense.payerId)}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-bold text-foreground">{expense.amount.toFixed(2)} €</div>
                                {expense.splits && expense.splits.length > 1 && (
                                    <div className="text-[10px] opacity-40">{expense.splits.length}-way split</div>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default ExpensesList;
