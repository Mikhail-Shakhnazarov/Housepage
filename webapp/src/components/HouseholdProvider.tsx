'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';

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

const ONBOARDING_PATH = '/onboarding';
const DASHBOARD_PATH = '/dashboard';
const SIGNIN_PATH = '/auth/signin';

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { status } = useSession();
    const [activeHousehold, setActiveHousehold] = useState<Household | null>(null);
    const [households, setHouseholds] = useState<Household[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const selectHousehold = useCallback((id: string) => {
        const selected = households.find(h => h.id === id);
        if (selected) {
            setActiveHousehold(selected);
            localStorage.setItem('active_household_id', id);
        }
    }, [households]);

    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            if (pathname !== SIGNIN_PATH) {
                router.replace(SIGNIN_PATH);
            }
            const id = setTimeout(() => setIsLoading(false), 0);
            return () => clearTimeout(id);
        }

        if (status === 'authenticated') {
            fetch('/api/memberships')
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch memberships');
                    return res.json();
                })
                .then(data => {
                    setHouseholds(data);

                    if (data.length === 0) {
                        setActiveHousehold(null);
                        if (pathname !== ONBOARDING_PATH) {
                            router.replace(ONBOARDING_PATH);
                        }
                        setIsLoading(false);
                        return;
                    }

                    const savedId = localStorage.getItem('active_household_id');
                    const isValid = savedId && data.some((h: Household) => h.id === savedId);
                    const selected = isValid
                        ? data.find((h: Household) => h.id === savedId)
                        : data[0];

                    setActiveHousehold(selected);
                    localStorage.setItem('active_household_id', selected.id);

                    if (pathname === ONBOARDING_PATH) {
                        router.replace(DASHBOARD_PATH);
                    }

                    setIsLoading(false);
                })
                .catch(() => {
                    setHouseholds([]);
                    setIsLoading(false);
                });
        }
    }, [status, pathname, router]);

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
