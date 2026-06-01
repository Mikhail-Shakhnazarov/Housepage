'use client';

import React, { useState, useEffect } from 'react';
import { useHousehold } from '@/components/HouseholdProvider';
import { useSession } from 'next-auth/react';

interface FeedItem {
    id: string;
    type: string;
    userId: string | null;
    action: string;
    time: string;
    icon: string;
}

const HouseFeed: React.FC = () => {
    const { activeHousehold } = useHousehold();
    const { data: session } = useSession();
    const [items, setItems] = useState<FeedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actorNames, setActorNames] = useState<Record<string, string>>({});
    const currentUserId = session?.user?.id;

    useEffect(() => {
        if (!activeHousehold) return;
        fetch(`/api/activity?householdId=${activeHousehold.id}&limit=20`)
            .then(res => res.json())
            .then((data: { events?: Array<Record<string, unknown>> }) => {
                const events = data.events || [];
                const mapped: FeedItem[] = events.map((e) => {
                    let icon = '📝';
                    const type = e.type as string;
                    if (type === 'chore' || type === 'task') icon = '♻️';
                    if (type === 'money') icon = '💳';
                    if (type === 'manual') icon = '🔥';
                    if (type === 'decision') icon = '🤝';
                    if (type === 'household') icon = '🏠';
                    if (type === 'scan') icon = '🔍';
                    if (type === 'deal') icon = '🃏';
                    return {
                        id: e.id as string,
                        type,
                        userId: (e.userId as string) || null,
                        action: e.action as string,
                        icon,
                        time: new Date(e.createdAt as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    };
                });
                setItems(mapped);
                setIsLoading(false);

                const userIds = [...new Set(mapped.map(i => i.userId).filter(Boolean))] as string[];
                const names: Record<string, string> = {};
                for (const uid of userIds) {
                    if (uid === currentUserId) {
                        names[uid] = 'You';
                    }
                }
                setActorNames(names);
            })
            .catch(() => setIsLoading(false));
    }, [activeHousehold, currentUserId]);

    const getActor = (userId: string | null) => {
        if (!userId) return 'WG';
        if (userId === currentUserId) return 'You';
        return actorNames[userId] || 'WG';
    };

    if (!activeHousehold) return null;

    return (
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-border overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-b border-border">
                <h3 className="font-bold text-sm uppercase tracking-tight text-foreground/70">House Feed</h3>
            </div>
            <div className="divide-y divide-border min-h-[200px] max-h-[400px] overflow-y-auto">
                {isLoading ? (
                    <div className="p-8 text-center text-sm opacity-50">Loading feed...</div>
                ) : items.length === 0 ? (
                    <div className="p-8 text-center text-sm opacity-30 italic">No events yet.</div>
                ) : (
                    items.map((item) => (
                        <div key={item.id} className="p-3 flex gap-3 hover:bg-slate-50 transition-colors">
                            <span className="text-lg flex-shrink-0">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm">
                                    <span className="font-bold">{getActor(item.userId)}</span>{' '}
                                    <span className="opacity-80">{item.action}</span>
                                </p>
                                <span className="text-xs opacity-40">{item.time}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
};

export default HouseFeed;
