"use client";

import React from 'react';
import Link from 'next/link';

export interface CompanyCardProps {
    id: string;
    name: string;
    description?: string;
}

const CompanyCard: React.FC<CompanyCardProps> = ({ id, name, description }) => {
    return (
        <Link href={`/companies/${id}`} className="block group h-full focus:outline-none focus:ring-2 focus:ring-yellow-700 focus:ring-opacity-50 rounded-2xl">
            <div className="glass-card gold-gradient-border border-2 border-yellow-700 rounded-3xl shadow-card-hover transition-all duration-300 ease-in-out cursor-pointer h-full flex flex-col p-10 group-hover:shadow-[0_0_32px_0_rgba(176,141,87,0.25)] group-hover:border-yellow-500">
                <h3 className="mb-4 luxury-heading text-center">
                    {name}
                </h3>
                {description && (
                    <p className="font-sans text-base text-[#f5ede3] group-hover:text-yellow-200 flex-grow mb-6 line-clamp-4 text-center leading-relaxed">
                        {description}
                    </p>
                )}
                {!description && <div className="flex-grow mb-6"></div>}
                <div className="mt-auto pt-4 text-center">
                    <span className="inline-block bg-gradient-to-r from-yellow-700 via-yellow-600 to-amber-700 text-[#fffbe8] font-sans font-bold text-base py-3 px-8 rounded-xl transition-all duration-300 shadow-lg hover:shadow-yellow-700/40 transform group-hover:scale-105 border border-yellow-800/40 group-hover:border-yellow-400" style={{letterSpacing: '0.03em', textShadow: '0 1px 8px #b08d57cc'}}>View Collections &rarr;</span>
                </div>
            </div>
        </Link>
    );
};

export default CompanyCard; 