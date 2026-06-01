'use client';

import React, { useState, useEffect } from 'react';
import { useHousehold } from '@/components/HouseholdProvider';

interface Expense {
    id: string;
    title: string;
    amount: number;
    payerId: string;
    createdAt: string;
}

const ExpensesList: React.FC = () => {
    const { activeHousehold } = useHousehold();
    const [expenses, setExpenses] = useState<Expense[]>([]);

    useEffect(() => {
        if (activeHousehold) {
            fetch(`/api/expenses?householdId=${activeHousehold.id}`)
                .then(res => res.json())
                .then(setExpenses);
        }
    }, [activeHousehold]);

    if (!activeHousehold) return null;

    return (
        <div className="space-y-4">
            {expenses.map(expense => (
                <div key={expense.id} className="wedge-card bg-anchor-soft/10">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="font-semibold text-sm">{expense.title}</h4>
                            <p className="text-[10px] opacity-40">{new Date(expense.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-bold text-foreground">{expense.amount.toFixed(2)} €</div>
                            <div className="text-[10px] font-medium opacity-50">paid by You</div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ExpensesList;
