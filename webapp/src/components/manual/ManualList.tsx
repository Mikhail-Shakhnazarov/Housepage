'use client';

import React, { useState, useEffect } from 'react';
import { useHousehold } from '@/components/HouseholdProvider';
import ManualCard from './ManualCard';

interface Note {
    id: string;
    title: string;
    content: string;
    category: string;
    pinned: boolean;
}

const ManualList: React.FC = () => {
    const { activeHousehold } = useHousehold();
    const [notes, setNotes] = useState<Note[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (activeHousehold) {
            fetch(`/api/notes?householdId=${activeHousehold.id}`)
                .then(res => res.json())
                .then(data => {
                    setNotes(data);
                    setIsLoading(false);
                });
        }
    }, [activeHousehold]);

    if (!activeHousehold) return null;

    // Helper to get icon based on category
    const getIcon = (category: string) => {
        const cat = category.toLowerCase();
        if (cat.includes('wifi') || cat.includes('access')) return '📶';
        if (cat.includes('heat') || cat.includes('util')) return '🔥';
        if (cat.includes('legal') || cat.includes('anmeldung')) return '📜';
        if (cat.includes('trash') || cat.includes('recycle')) return '♻️';
        return '📝';
    };

    return (
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
    );
};

export default ManualList;
