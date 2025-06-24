"use client";

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export interface CompanyCardProps {
    id: string;
    name: string;
    description?: string;
}

const CompanyCard: React.FC<CompanyCardProps> = ({ id, name, description }) => {
    return (
        <Link href={`/companies/${id}`} className="block group h-full">
            <div className="relative bg-slate-900/50 border border-white/10 rounded-xl shadow-lg h-full flex flex-col p-8 transition-all duration-300 hover:border-amber-400/50 hover:bg-slate-900">
                
                {/* Icon */}
                <div className="mb-6 text-center">
                    <div className="inline-block p-2 bg-gradient-to-br from-amber-500/10 to-amber-600/20 rounded-full border border-white/10 overflow-hidden">
                        <div className="w-16 h-16 rounded-full overflow-hidden">
                            <Image
                                src="/company.jpg"
                                alt="Company"
                                width={64}
                                height={64}
                                className="w-full h-full object-cover rounded-full"
                            />
                        </div>
                    </div>
                </div>

                {/* Company Name */}
                <h3 className="text-2xl font-bold text-white text-center mb-3 font-serif">
                    {name}
                </h3>

                {/* Description */}
                <p className="text-gray-400 text-center text-sm leading-relaxed flex-grow mb-6">
                    {description || 'Discover premium treasury-backed NFT collections from this asset type.'}
                </p>

                {/* Action Button */}
                <div className="mt-auto text-center">
                    <div className="inline-flex items-center text-amber-300 font-semibold text-sm transition-all duration-300 group-hover:text-amber-200">
                        View Collections
                        <ArrowRight className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default CompanyCard; 