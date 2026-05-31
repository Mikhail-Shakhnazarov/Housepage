import React from 'react';

interface FeedItem {
    id: string;
    type: 'chore' | 'manual' | 'money' | 'decision';
    user: string;
    action: string;
    time: string;
    icon: string;
}

const HouseFeed: React.FC = () => {
    const items: FeedItem[] = [
        { id: '1', type: 'manual', user: 'Mikhail', action: 'updated "Heating Quirks"', time: '2h ago', icon: '🔥' },
        { id: '2', type: 'chore', user: 'Katja', action: 'completed "Take out Yellow Bins"', time: '4h ago', icon: '♻️' },
        { id: '3', type: 'money', user: 'Alex', action: 'settled "Internet" with Katja', time: '1d ago', icon: '💳' },
        { id: '4', type: 'decision', user: 'WG', action: 'agreed to "Quiet hours on Sunday"', time: '2d ago', icon: '🤫' },
    ];

    return (
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-border overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-b border-border">
                <h3 className="font-bold text-sm uppercase tracking-tight text-foreground/70">House Feed</h3>
            </div>
            <div className="divide-y divide-border">
                {items.map((item) => (
                    <div key={item.id} className="p-4 flex gap-4 hover:bg-slate-50 transition-colors">
                        <span className="text-xl flex-shrink-0">{item.icon}</span>
                        <div className="flex-1">
                            <p className="text-sm">
                                <span className="font-bold">{item.user}</span> {item.action}
                            </p>
                            <span className="text-xs opacity-50">{item.time}</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default HouseFeed;
