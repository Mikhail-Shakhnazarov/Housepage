'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface Household {
    id: string;
    name: string;
    role: string;
}

interface HouseholdContextType {
    activeHousehold: Household | null;
    households: Household[];
    selectHousehold: (id: string) => void;
    isLoading: boolean;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { data: session, status } = useSession();
    const [activeHousehold, setActiveHousehold] = useState<Household | null>(null);
    const [households, setHouseholds] = useState<Household[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (status === 'authenticated') {
            // Fetch memberships
            fetch('/api/memberships')
                .then(res => res.json())
                .then(data => {
                    setHouseholds(data);
                    // Auto-select first if none selected
                    const savedId = localStorage.getItem('active_household_id');
                    const selected = data.find((h: Household) => h.id === savedId) || data[0];
                    if (selected) {
                        setActiveHousehold(selected);
                        localStorage.setItem('active_household_id', selected.id);
                    }
                    setIsLoading(false);
                });
        } else if (status === 'unauthenticated') {
            setIsLoading(false);
        }
    }, [status]);

    const selectHousehold = (id: string) => {
        const selected = households.find(h => h.id === id);
        if (selected) {
            setActiveHousehold(selected);
            localStorage.setItem('active_household_id', id);
        }
    };

    return (
        <HouseholdContext.Provider value={{ activeHousehold, households, selectHousehold, isLoading }}>
            {children}
        </HouseholdContext.Provider>
    );
};

export const useHousehold = () => {
    const context = useContext(HouseholdContext);
    if (context === undefined) {
        throw new Error('useHousehold must be used within a HouseholdProvider');
    }
    return context;
};
