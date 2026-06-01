'use client';

import ManualList from '@/components/manual/ManualList';
import HouseFeed from '@/components/Feed';
import ChoreList from '@/components/chores/ChoreList';
import ExpensesList from '@/components/money/ExpensesList';
import ScanLoop from '@/components/scan/ScanLoop';
import DecisionsSection from '@/components/DecisionsSection';
import { useHousehold } from '@/components/HouseholdProvider';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, Settings, BookOpen } from 'lucide-react';
import { useState } from 'react';

export default function Dashboard() {
    const { activeHousehold, isLoading: isHouseholdLoading } = useHousehold();
    const [showLibrary, setShowLibrary] = useState(false);
    const router = useRouter();

    if (isHouseholdLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-pulse text-lg font-bold opacity-20">Initializing Housepage...</div>
            </div>
        );
    }

    if (!activeHousehold) return null;

    return (
        <motion.main
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-h-screen bg-background p-4 md:p-8 max-w-6xl mx-auto"
        >
            <header className="mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary text-white p-3 rounded-[2rem] shadow-2xl shadow-primary/30 rotate-3">
                            <Home size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{activeHousehold.name}</h1>
                            <p className="text-foreground opacity-50 flex items-center gap-2 text-sm">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Active Household
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowLibrary(v => !v)}
                            className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Library / Backlog"
                        >
                            <BookOpen size={18} className="opacity-50" />
                        </button>
                        <button
                            onClick={() => router.push('/settings')}
                            className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Settings"
                        >
                            <Settings size={18} className="opacity-50" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                <section className="lg:col-span-7 order-first">
                    <ScanLoop />
                </section>

                <aside className="lg:col-span-5 space-y-6">
                    <HouseFeed />

                    {showLibrary && (
                        <motion.section
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-bold tracking-tight">Library / Backlog</h2>
                                <button
                                    onClick={() => setShowLibrary(false)}
                                    className="text-xs opacity-40 hover:opacity-100"
                                >
                                    Collapse
                                </button>
                            </div>
                            <ChoreList />
                        </motion.section>
                    )}

                    {!showLibrary && (
                        <button
                            onClick={() => setShowLibrary(true)}
                            className="w-full text-center text-xs font-bold opacity-40 hover:opacity-100 py-3 border-2 border-dashed border-border rounded-xl transition-opacity"
                        >
                            + Show Library / Backlog
                        </button>
                    )}

                    <section>
                        <ManualList />
                    </section>

                    <section>
                        <ExpensesList />
                    </section>

                    <DecisionsSection />
                </aside>
            </div>
        </motion.main>
    );
}
