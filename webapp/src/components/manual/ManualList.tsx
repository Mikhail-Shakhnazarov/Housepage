'use client';

import React, { useState, useEffect } from 'react';
import { useHousehold } from '@/components/HouseholdProvider';
import ManualCard from './ManualCard';
import { Plus, X } from 'lucide-react';

interface Note {
    id: string;
    title: string;
    content: string;
    category: string;
    pinned: boolean;
}

const CATEGORIES = ['Access', 'Utilities', 'Norms', 'Maintenance', 'Trash', 'General'];

const ManualList: React.FC = () => {
    const { activeHousehold } = useHousehold();
    const [notes, setNotes] = useState<Note[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('General');

    useEffect(() => {
        if (!activeHousehold) return;
        fetch(`/api/notes?householdId=${activeHousehold.id}`)
            .then(res => res.json())
            .then(data => {
                setNotes(data);
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    }, [activeHousehold]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeHousehold || !title || !content) return;
        await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, category, householdId: activeHousehold.id }),
        });
        setTitle('');
        setContent('');
        setCategory('General');
        setShowForm(false);
        setNotes([]);
        setIsLoading(true);
        fetch(`/api/notes?householdId=${activeHousehold.id}`)
            .then(res => res.json())
            .then(data => {
                setNotes(data);
                setIsLoading(false);
            });
    };

    const getIcon = (category: string) => {
        const cat = category.toLowerCase();
        if (cat.includes('wifi') || cat.includes('access')) return '📶';
        if (cat.includes('heat') || cat.includes('util')) return '🔥';
        if (cat.includes('legal') || cat.includes('anmeldung')) return '📜';
        if (cat.includes('trash') || cat.includes('recycle')) return '♻️';
        if (cat.includes('maintenance')) return '🔧';
        if (cat.includes('norms')) return '📋';
        return '📝';
    };

    if (!activeHousehold) return null;

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold tracking-tight">House Manual</h2>
                <button onClick={() => setShowForm(true)} className="text-primary text-xs font-bold hover:underline flex items-center gap-1">
                    <Plus size={12} /> Add Note
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="wedge-card space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm">New Note</h4>
                        <button type="button" onClick={() => setShowForm(false)}><X size={14} className="opacity-40" /></button>
                    </div>
                    <input
                        required
                        placeholder="Title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm"
                    />
                    <textarea
                        required
                        placeholder="Content"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm"
                    />
                    <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm"
                    >
                        {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <button type="submit" className="w-full bg-primary text-white font-bold py-2 rounded-lg text-sm hover:bg-primary/90">
                        Add Note
                    </button>
                </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isLoading ? (
                    <div className="col-span-2 text-center p-8 opacity-50">Loading manual...</div>
                ) : notes.length === 0 ? (
                    <div className="col-span-2 text-center p-12 border-2 border-dashed border-border rounded-3xl opacity-30">
                        <p className="text-sm">Your house manual is empty.</p>
                        <p className="text-[10px] mt-1">Add details like Wi-Fi, trash schedules, or quirks.</p>
                    </div>
                ) : (
                    notes.map(note => (
                        <ManualCard
                            key={note.id}
                            category={note.category}
                            title={note.title}
                            content={note.content}
                            icon={getIcon(note.category)}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default ManualList;
