'use client';

import { useHousehold } from '@/components/HouseholdProvider';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Room {
    id: string;
    slug: string;
    name: string;
}

export default function RoomPicker({ onSelect }: { onSelect: (room: Room) => void }) {
    const { activeHousehold } = useHousehold();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const idRef = useRef(0);

    useEffect(() => {
        if (!activeHousehold) return;
        const id = ++idRef.current;
        fetch(`/api/scan/rooms?householdId=${activeHousehold.id}`)
            .then(r => {
                if (!r.ok) throw new Error('Failed to load rooms');
                return r.json();
            })
            .then(data => {
                if (id !== idRef.current) return;
                setRooms(data.rooms);
                setIsLoading(false);
            })
            .catch(e => {
                if (id !== idRef.current) return;
                setError(e.message);
                setIsLoading(false);
            });
    }, [activeHousehold]);

    if (!activeHousehold) return null;
    if (isLoading) {
        return <div className="animate-pulse space-y-3">{' '}<div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" /><div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" /><div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" /></div>;
    }
    if (error) {
        return <div className="wedge-card text-red-600 text-sm">{error}</div>;
    }
    if (rooms.length === 0) {
        return (
            <div className="wedge-card text-center py-8">
                <p className="opacity-40 text-lg mb-2">No rooms yet</p>
                <p className="opacity-30 text-sm">Add rooms in household settings to start scanning.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {rooms.map(room => (
                <motion.button
                    key={room.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onSelect(room)}
                    className="wedge-card text-center py-6 hover:border-primary hover:shadow-md transition-all cursor-pointer"
                >
                    <div className="text-3xl mb-2">{getRoomEmoji(room.slug)}</div>
                    <div className="font-bold text-sm">{room.name}</div>
                </motion.button>
            ))}
        </div>
    );
}

function getRoomEmoji(slug: string): string {
    const map: Record<string, string> = {
        kitchen: '🍳',
        bathroom: '🛁',
        living_room: '🛋️',
        bedroom: '🛏️',
        hallway: '🚪',
        balcony: '🌿',
        office: '💻',
        laundry: '🧺',
        basement: '🏗️',
        garage: '🚗',
        dining: '🍽️',
        toilet: '🚻',
        storage: '📦',
        garden: '🌻',
    };
    return map[slug] || '🚧';
}
