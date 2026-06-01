import React, { useState, useEffect } from 'react';
import { useHousehold } from '@/components/HouseholdProvider';

interface FeedItem {
    id: string;
    type: 'chore' | 'manual' | 'money' | 'decision';
    user?: string;
    action: string;
    time: string;
    icon: string;
}

const HouseFeed: React.FC = () => {
    const { activeHousehold } = useHousehold();
    const [items, setItems] = useState<FeedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (activeHousehold) {
            fetch(`/api/feed?householdId=${activeHousehold.id}`)
                .then(res => res.json())
                .then(data => {
                    setItems(data);
                    setIsLoading(false);
                });
        }
    }, [activeHousehold]);

    if (!activeHousehold) return null;

    return (
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-border overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-b border-border">
                <h3 className="font-bold text-sm uppercase tracking-tight text-foreground/70">House Feed</h3>
            </div>
            <div className="divide-y divide-border min-h-[200px]">
                {isLoading ? (
                    <div className="p-8 text-center text-sm opacity-50">Loading feed...</div>
                ) : items.length === 0 ? (
                    <div className="p-8 text-center text-sm opacity-30 italic">No events yet.</div>
                ) : (
                    items.map((item) => (
                        <div key={item.id} className="p-4 flex gap-4 hover:bg-slate-50 transition-colors">
                            <span className="text-xl flex-shrink-0">{item.icon}</span>
                            <div className="flex-1">
                                <p className="text-sm">
                                    <span className="font-bold">{item.user || 'WG'}</span> {item.action}
                                </p>
                                <span className="text-xs opacity-50">{item.time}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
};

export default HouseFeed;
