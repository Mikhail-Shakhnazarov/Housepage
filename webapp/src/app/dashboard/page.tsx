'use client';

import ManualList from '@/components/manual/ManualList';
import HouseFeed from '@/components/Feed';
import ChoreList from '@/components/chores/ChoreList';
import ExpensesList from '@/components/money/ExpensesList';
import CreateChoreModal from '@/components/chores/CreateChoreModal';
import { useHousehold } from '@/components/HouseholdProvider';
import { motion } from 'framer-motion';
import { Home, Plus, Settings } from 'lucide-react';
import { useState } from 'react';

export default function Dashboard() {
    const { activeHousehold, isLoading: isHouseholdLoading } = useHousehold();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    if (isHouseholdLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-pulse text-lg font-bold opacity-20">Initializing Housepage...</div>
            </div>
        );
    }

    if (!activeHousehold) return null; // Provider handles redirecting to onboarding

    return (
        <motion.main
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-h-screen bg-background p-4 md:p-8 max-w-6xl mx-auto"
        >
            {/* House Identity Header */}
            <header className="mb-12">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="bg-primary text-white p-4 rounded-[2rem] shadow-2xl shadow-primary/30 rotate-3">
                            <Home size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-extrabold text-foreground tracking-tight">{activeHousehold.name}</h1>
                            <p className="text-foreground opacity-50 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Active Household
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors opacity-50">
                            <Settings size={20} />
                        </button>
                        <div className="flex -space-x-3">
                            {[0, 1].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-10 h-10 rounded-full border-4 border-background bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold"
                                >
                                    ?
                                </div>
                            ))}
                            <button className="w-10 h-10 rounded-full border-4 border-background bg-primary text-white flex items-center justify-center hover:scale-105 transition-transform">
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: Friction (Chores & Money) - Span 4 */}
                <div className="lg:col-span-4 space-y-8">
                    <HouseFeed />

                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold tracking-tight">Chore Loop</h2>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5"
                            >
                                <Plus size={14} /> NEW
                            </button>
                        </div>
                        <ChoreList />
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold tracking-tight mb-6">Shared Costs</h2>
                        <ExpensesList />
                    </section>
                </div>

                {/* Right Column: Anchor (House Manual & Decisions) - Span 8 */}
                <div className="lg:col-span-8 space-y-12">
                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold tracking-tight text-foreground">House Manual</h2>
                            <button className="text-primary text-sm font-bold hover:underline">Add Note +</button>
                        </div>
                        <ManualList />
                    </section>

                    <section className="bg-blue-50/30 dark:bg-blue-900/10 p-8 rounded-[3rem] border border-blue-100/50 dark:border-blue-900/30">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold tracking-tight">Decisions</h2>
                            <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2 py-1 rounded-full">COMMUNITY CONSENSUS</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="manual-card bg-white dark:bg-slate-800 border-none shadow-xl shadow-blue-900/5">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 bg-blue-50 px-2 py-1 rounded italic">Proposed</span>
                                </div>
                                <h4 className="font-extrabold text-xl mb-3">Governance: No Parties on Weeknights?</h4>
                                <p className="text-sm opacity-60 mb-6 leading-relaxed">
                                    Alex needs quiet for early shifts. Should we restrict loud music to weekends?
                                </p>
                                <div className="flex gap-3">
                                    <button className="flex-1 bg-blue-600 text-white text-xs font-bold py-3 rounded-2xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">VOTE YES</button>
                                    <button className="flex-1 border-2 border-slate-100 dark:border-slate-700 text-xs font-bold py-3 rounded-2xl hover:bg-slate-50 transition-colors">DISCUSS</button>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center p-6 text-sm opacity-40 italic space-y-4 border-l-2 border-blue-100 dark:border-blue-900 ml-4">
                                <p>"We should define 'loud' more clearly." — Mikhail</p>
                                <p>"Agree, but let's allow occasional exceptions with notice." — Katja</p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <CreateChoreModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </motion.main>
    );
}
