'use client';

import ManualCard from '@/components/manual/ManualCard';
import HouseFeed from '@/components/Feed';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Users, Settings, Plus, Info } from 'lucide-react';

export default function Dashboard() {
    return (
        <motion.main
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-h-screen bg-background p-4 md:p-8 max-w-5xl mx-auto"
        >
            {/* House Identity Header */}
            <header className="mb-12">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/20">
                            <Home size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">WG Sonnenallee</h1>
                            <p className="text-foreground opacity-60">Berlin, Neukölln</p>
                        </div>
                    </div>
                    {/* ... (rest of header) */}
                    <div className="flex -space-x-2">
                        {['M', 'A', 'K'].map((initial, i) => (
                            <div
                                key={i}
                                className="w-10 h-10 rounded-full border-2 border-background bg-primary flex items-center justify-center text-white text-sm font-bold"
                            >
                                {initial}
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Left Column: Friction (Chores & Money) */}
                <div className="md:col-span-1 space-y-8">
                    <HouseFeed />
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Chore Loop</h2>
                            <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded">3 NEW</span>
                        </div>
                        <div className="space-y-3">
                            <div className="wedge-card">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-semibold text-sm">Take out Blue Bins</h4>
                                        <p className="text-xs opacity-60">Due tomorrow</p>
                                    </div>
                                    <span className="text-xs font-medium bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Mikhail</span>
                                </div>
                            </div>
                            <div className="wedge-card border-l-4 border-red-400">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-semibold text-sm">Clean Bathroom</h4>
                                        <p className="text-xs text-red-500 font-medium">Overdue 2 days</p>
                                    </div>
                                    <span className="text-xs font-medium bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Alex</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">Shared Costs</h2>
                        <div className="wedge-card bg-anchor-soft/30 border-anchor/20">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">Open Balance</span>
                                <span className="text-lg font-bold text-foreground">12.50 €</span>
                            </div>
                            <p className="text-xs opacity-50 mt-1">You owe Katja for internet</p>
                        </div>
                    </section>
                </div>

                {/* Right Column: Anchor (House Manual & Decisions) */}
                <div className="md:col-span-2 space-y-8">
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground">House Manual</h2>
                            <button className="text-anchor text-sm font-bold hover:underline">See all →</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <ManualCard
                                category="Access"
                                title="Wi-Fi Password"
                                content="SSID: SonnenWG_5G\nKey: fritz_box_829_sky"
                                icon="📶"
                            />
                            <ManualCard
                                category="Utilities"
                                title="Heating Quirks"
                                content="The radiator in the hallway takes 10 mins to start. Do not turn it past level 3."
                                icon="🔥"
                            />
                            <ManualCard
                                category="Legal"
                                title="Anmeldung Notes"
                                content="The landlord is slow with Wohnungsgeberbestätigung. Mail him directly at: haus@berlin.de"
                                icon="📜"
                            />
                            <ManualCard
                                category="Household"
                                title="Trash Schedule"
                                content="Blue bin: Tuesday晨\nYellow bin: Friday晨\nBio: Thursday"
                                icon="♻️"
                            />
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">Decisions</h2>
                        <div className="manual-card border-blue-400">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold uppercase text-blue-500">Proposed</span>
                                <span className="text-xs opacity-50">Ends in 2 days</span>
                            </div>
                            <h4 className="font-bold text-lg mb-2">Buy a new vacuum?</h4>
                            <p className="text-sm opacity-70 mb-4">
                                The current Miele is dying. Found a refurbished Dyson for 120€. Shared cost?
                            </p>
                            <div className="flex space-x-2">
                                <button className="flex-1 bg-blue-500 text-white text-xs font-bold py-2 rounded-lg hover:bg-blue-600 transition-colors">VOTE YES</button>
                                <button className="flex-1 border border-border text-xs font-bold py-2 rounded-lg hover:bg-slate-50 transition-colors">DISCUSS</button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </motion.main>
    );
}
