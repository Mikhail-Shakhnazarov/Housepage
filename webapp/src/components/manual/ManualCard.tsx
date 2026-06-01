import React from 'react';

interface ManualCardProps {
    title: string;
    category: string;
    content: string;
    icon?: string;
}

const ManualCard: React.FC<ManualCardProps> = ({ title, category, content, icon }) => {
    return (
        <div className="manual-card group cursor-pointer">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-anchor opacity-80">
                    {category}
                </span>
                {icon && <span className="text-xl">{icon}</span>}
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-anchor transition-colors">
                {title}
            </h3>
            <p className="text-sm text-foreground opacity-70 leading-relaxed whitespace-pre-line">
                {content}
            </p>
        </div>
    );
};

export default ManualCard;
