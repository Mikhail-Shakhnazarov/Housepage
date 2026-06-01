'use client';

import React, { useState } from 'react';
import { useHousehold } from '@/components/HouseholdProvider';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CreateChoreModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
    const { activeHousehold } = useHousehold();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeHousehold || !title) return;

        setIsSubmitting(true);
        const res = await fetch('/api/chores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description,
                dueDate,
                householdId: activeHousehold.id,
            }),
        });

        if (res.ok) {
            setTitle('');
            setDescription('');
            setDueDate('');
            onSuccess();
            onClose();
        }
        setIsSubmitting(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-xl font-bold mb-6">Create New Chore</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-foreground/50 uppercase mb-1">Task Title</label>
                        <input
                            required
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-4 py-2"
                            placeholder="e.g. Scouring the Bathroom"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-foreground/50 uppercase mb-1">Details (Optional)</label>
                        <textarea
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-4 py-2"
                            placeholder="Don't forget the mirror..."
                            rows={3}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-foreground/50 uppercase mb-1">Due Date</label>
                        <input
                            type="date"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-4 py-2"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-3 mt-8">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-border rounded-xl font-bold text-sm hover:bg-slate-50"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                        >
                            {isSubmitting ? 'CREATING...' : 'CREATE CHORE'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateChoreModal;
