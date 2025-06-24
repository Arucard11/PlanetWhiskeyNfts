"use client";

import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Zap, Star, Shield, Trophy, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import CompanyCard from '@/components/CompanyCard';

interface ICompany {
  _id: string;
  name: string;
  description?: string;
}

export default function Home() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [companies, setCompanies] = useState<ICompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 300], [0, 100]);
  const y2 = useTransform(scrollY, [0, 300], [0, -100]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch('/api/companies');
        const data = await response.json();
        if (data.success) {
          setCompanies(data.data);
        }
      } catch (error) {
        console.error('Error fetching companies:', error);
      } finally {
        setLoadingCompanies(false);
      }
    };

    fetchCompanies();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 z-0">
        {/* Gradient Orbs */}
        <motion.div 
          className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full blur-3xl"
          animate={{ 
            x: mousePosition.x * 0.02,
            y: mousePosition.y * 0.02,
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ 
            scale: { duration: 4, repeat: Infinity },
            opacity: { duration: 3, repeat: Infinity }
          }}
        />
        <motion.div 
          className="absolute bottom-20 right-20 w-80 h-80 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
          animate={{ 
            x: -mousePosition.x * 0.015,
            y: -mousePosition.y * 0.015,
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ 
            scale: { duration: 5, repeat: Infinity },
            opacity: { duration: 4, repeat: Infinity }
          }}
        />
        
        {/* Floating Particles */}
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-amber-400/40 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>



      {/* Revolutionary Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Advanced Background */}
        <motion.div
          className="absolute inset-0 z-0"
          style={{ y: y1 }}
        >
          <Image
            src="/background.jpg"
            alt="Treasury assets background"
            fill
            style={{ objectFit: 'cover' }}
            quality={90}
            priority
            className="opacity-40"
          />
        </motion.div>
        
        {/* Multi-layer Gradient Overlays */}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/80 via-black/40 to-black/90" />
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-amber-900/20 via-transparent to-purple-900/20" />
        
        <div className="relative z-20 text-center px-4 max-w-7xl mx-auto">
          {/* Premium Header Icon */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mb-12"
          >
            <div className="relative inline-block">
              <div className="w-48 h-48 mx-auto rounded-full shadow-2xl shadow-amber-500/40 overflow-hidden border-4 border-amber-400/50">
                <Image
                  src="/header.jpg"
                  alt="NFT Treasury"
                  width={192}
                  height={192}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full blur-2xl opacity-30" />

              {/* Floating elements around header */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-amber-400 rounded-full"
                  style={{
                    left: `${10 + i * 15}%`,
                    top: `${-10 + (i % 2) * 20}%`,
                  }}
                  animate={{
                    y: [0, -10, 0],
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 2 + i * 0.3,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          </motion.div>
          
          {/* Epic Title */}
          <motion.h1 
            className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-white mb-8 leading-[0.9] font-serif"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            Own part of the{' '}
            <motion.span 
              className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 relative inline-block"
              animate={{ 
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity,
                ease: "linear"
              }}
              style={{
                backgroundSize: "200% 200%",
              }}
            >
              Planet Whiskey Treasury
              <motion.div
                className="absolute -top-4 -right-4 text-amber-400"
                animate={{ 
                  rotate: [0, 360],
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  rotate: { duration: 10, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity }
                }}
              >
                <Star size={24} fill="currentColor" />
              </motion.div>
            </motion.span>
          </motion.h1>
          
          {/* Enhanced Subtitle */}
          <motion.p 
            className="text-xl md:text-3xl font-light max-w-5xl mx-auto text-gray-200 mb-16 leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            Mint NFTs backed by <span className="text-amber-400 font-semibold">Whiskey, Gold, or Bitcoin</span>.
          </motion.p>
          
          {/* Premium Action Button */}
          <motion.div 
            className="flex justify-center items-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                href="#assets"
                className="group relative inline-flex items-center justify-center px-12 py-6 text-2xl font-bold text-black bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 rounded-2xl shadow-2xl shadow-amber-500/40 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-amber-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-300 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Zap size={28} className="mr-4 -ml-1 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 relative z-10" />
                <span className="relative z-10">Explore Collections</span>
                <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              </Link>
            </motion.div>
          </motion.div>
          
          {/* Trust Indicators */}
          <motion.div
            className="mt-16 flex flex-wrap justify-center items-center gap-8 opacity-60"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 0.6, y: 0 }}
            transition={{ duration: 1, delay: 1.2 }}
          >
            {[
              { icon: Shield, text: "Blockchain Secured" },
              { icon: Trophy, text: "Premium Quality" },
              { icon: Users, text: "Global Community" }
            ].map((item, index) => (
              <motion.div
                key={index}
                className="flex items-center space-x-2 text-gray-400"
                whileHover={{ scale: 1.05, color: "#FCD34D" }}
              >
                <item.icon size={20} />
                <span className="text-sm font-medium">{item.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
        

      </section>



      {/* Treasury Assets Section */}
      <section id="assets" className="py-32 bg-gradient-to-b from-black via-slate-900 to-black relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/background.jpg')] bg-cover bg-center opacity-5" />
        
        {/* Animated background elements */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-amber-400/30 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: Math.random() * 4 + 2,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            />
          ))}
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-6xl sm:text-7xl font-bold text-white mb-8 font-serif">
              Treasury{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500">
                Assets
              </span>
            </h2>
            <p className="text-2xl text-gray-400 max-w-5xl mx-auto leading-relaxed">
              Explore asset-backed NFT collections of <span className="text-amber-400">Whiskey barrels, Gold, and Bitcoin</span>.
            </p>
          </motion.div>
          
          {loadingCompanies ? (
            <motion.div 
              className="text-center max-w-6xl mx-auto"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-amber-500/30 rounded-3xl p-20 shadow-2xl backdrop-blur-sm overflow-hidden">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="h-full w-full bg-gradient-to-br from-amber-500/20 to-purple-500/20" />
                </div>
                
                <motion.div 
                  className="w-24 h-24 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-amber-500/40"
                  animate={{ 
                    rotate: [0, 360],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 4, repeat: Infinity }
                  }}
                >
                  <span className="text-4xl filter drop-shadow-lg">🏭</span>
                </motion.div>
                
                <h3 className="text-5xl font-bold text-white mb-6 font-serif">Loading Distilleries</h3>
                <p className="text-2xl text-gray-300 mb-12 leading-relaxed">Fetching our partner distilleries...</p>
                
                <div className="inline-flex items-center text-amber-400 font-bold text-lg">
                  <motion.div 
                    className="w-3 h-3 bg-amber-400 rounded-full mr-4"
                    animate={{ 
                      scale: [1, 1.5, 1],
                      opacity: [1, 0.5, 1]
                    }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity 
                    }}
                  />
                  Loading premium distillery partnerships...
                </div>
              </div>
            </motion.div>
          ) : companies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {companies.map((company, index) => (
                <motion.div
                  key={company._id}
                  initial={{ opacity: 0, y: 60 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: index * 0.2 }}
                >
                  <CompanyCard
                    id={company._id}
                    name={company.name}
                    description={company.description}
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div 
              className="text-center max-w-6xl mx-auto"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-amber-500/30 rounded-3xl p-20 shadow-2xl backdrop-blur-sm overflow-hidden">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="h-full w-full bg-gradient-to-br from-amber-500/20 to-purple-500/20" />
                </div>
                
                <motion.div 
                  className="w-24 h-24 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-amber-500/40"
                  animate={{ 
                    rotate: [0, 360],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 4, repeat: Infinity }
                  }}
                >
                  <span className="text-4xl filter drop-shadow-lg">🏭</span>
                </motion.div>
                
                <h3 className="text-5xl font-bold text-white mb-6 font-serif">Coming Soon</h3>
                <p className="text-2xl text-gray-300 mb-12 leading-relaxed">Our treasury assets are preparing <span className="text-amber-400 font-semibold">exclusive NFT collections</span> for launch</p>
                
                <div className="inline-flex items-center text-amber-400 font-bold text-lg">
                  <motion.div 
                    className="w-3 h-3 bg-amber-400 rounded-full mr-4"
                    animate={{ 
                      scale: [1, 1.5, 1],
                      opacity: [1, 0.5, 1]
                    }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity 
                    }}
                  />
                  Loading premium treasury assets...
                </div>
                
                {/* Floating NFT symbols */}
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute text-2xl opacity-20"
                    style={{
                      left: `${10 + i * 20}%`,
                      top: `${20 + (i % 2) * 60}%`,
                    }}
                    animate={{
                      y: [0, -20, 0],
                      rotate: [0, 10, 0],
                    }}
                    transition={{
                      duration: 3 + i * 0.5,
                      repeat: Infinity,
                      delay: i * 0.4,
                    }}
                  >
                    💎
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Revolutionary How It Works Section */}
      <section id="how-it-works" className="py-32 bg-gradient-to-b from-black via-slate-900 to-black relative">
        <div className="container mx-auto px-4">
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-6xl sm:text-7xl font-bold text-white mb-8 font-serif">
              How It{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500">
                Works
              </span>
            </h2>
            <p className="text-2xl text-gray-400 max-w-4xl mx-auto leading-relaxed">
              Four simple steps to claim your share of the Planet Whiskey Treasury
            </p>
          </motion.div>
          
          <div className="relative max-w-7xl mx-auto">
            {/* Enhanced connecting line */}
            <div className="hidden lg:block absolute top-24 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 rounded-full opacity-20" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
              {[
                { 
                  step: "1", 
                  title: "Browse Collections", 
                  description: "Explore asset-backed NFT collections of Whiskey barrels, Gold, and Bitcoin.",
                  image: "/connect.jpg",
                  gradient: "from-blue-400 to-blue-600",
                  bgGradient: "from-blue-500/10 to-blue-600/10"
                },
                { 
                  step: "2", 
                  title: "Connect Wallet", 
                  description: "Securely connect your Solana wallet to our marketplace. This is your first step to start a journey into premium treasury investments.",
                  image: "/browse.jpg",
                  gradient: "from-purple-400 to-purple-600",
                  bgGradient: "from-purple-500/10 to-purple-600/10"
                },
                { 
                  step: "3", 
                  title: "Mint Your NFT", 
                  description: "Mint your NFT and obtain fractional ownership of assets in the Planet Whiskey Treasury.",
                  image: "/mint.jpg",
                  gradient: "from-amber-400 to-amber-600",
                  bgGradient: "from-amber-500/10 to-amber-600/10"
                },
                { 
                  step: "4", 
                  title: "Own & Trade", 
                  description: "Trade your NFTs, or hold and showcase them to earn regular $WHISKEY token rewards.",
                  image: "/tradeandhold.jpg",
                  gradient: "from-green-400 to-green-600",
                  bgGradient: "from-green-500/10 to-green-600/10"
                }
              ].map((item, index) => (
                <motion.div 
                  key={index}
                  className="relative text-center"
                  initial={{ opacity: 0, y: 60 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: index * 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Step Circle with enhanced effects */}
                  <div className="relative inline-flex items-center justify-center mb-8">
                    <motion.div 
                      className={`w-28 h-28 bg-gradient-to-br ${item.gradient} rounded-full flex items-center justify-center shadow-2xl relative z-10 overflow-hidden`}
                      whileHover={{ 
                        scale: 1.1,
                        rotate: 5,
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    >
                      <div className="w-full h-full rounded-full overflow-hidden">
                        <Image
                          src={item.image}
                          alt={item.title}
                          width={112}
                          height={112}
                          className="w-full h-full object-cover rounded-full"
                        />
                      </div>
                    </motion.div>
                    <div className={`absolute inset-0 w-28 h-28 bg-gradient-to-br ${item.gradient} rounded-full blur-2xl opacity-40`} />
                    
                    {/* Step number */}
                    <motion.div 
                      className="absolute -top-3 -right-3 w-8 h-8 bg-white text-black rounded-full flex items-center justify-center text-sm font-bold shadow-lg"
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.2 + 0.5, type: "spring", stiffness: 500 }}
                    >
                      {item.step}
                    </motion.div>
                  </div>
                  
                  <motion.div 
                    className={`relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 border border-white/10 rounded-3xl p-8 backdrop-blur-sm hover:border-amber-500/40 transition-all duration-500 overflow-hidden group h-80 flex flex-col`}
                    whileHover={{ y: -4, scale: 1.02 }}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl`} />
                    
                    <h3 className="font-bold text-3xl mb-6 text-white relative z-10">
                      {item.title}
                    </h3>
                    <div className="flex-grow flex items-center">
                      <p className="text-gray-400 text-lg leading-relaxed relative z-10">
                        {item.description}
                      </p>
                    </div>
                    
                    {/* Decorative elements */}
                    <motion.div
                      className="absolute top-4 right-4 w-16 h-16 opacity-5 rounded-full overflow-hidden"
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    >
                      <Image
                        src={item.image}
                        alt={item.title}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover rounded-full"
                      />
                    </motion.div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Epic CTA Section */}
      <section className="py-32 bg-gradient-to-br from-amber-900/30 via-slate-900 to-black relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <motion.div 
            className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-amber-500/10 to-purple-500/10"
            animate={{ 
              backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
            }}
            transition={{ 
              duration: 10, 
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </div>
        
        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <motion.h2 
              className="text-6xl sm:text-7xl font-bold text-white mb-10 font-serif"
              animate={{ 
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{ 
                duration: 5, 
                repeat: Infinity,
                ease: "linear"
              }}
            >
              Ready to Start Your{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500">
                Collection?
              </span>
            </motion.h2>
            
            <p className="text-2xl text-gray-300 max-w-4xl mx-auto mb-16 leading-relaxed">
              Join thousands of collectors who have already secured their place in treasury history. Start building your <span className="text-amber-400 font-semibold">premium portfolio</span> today.
            </p>
            
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                href="#assets"
                className="group relative inline-flex items-center justify-center px-16 py-8 text-3xl font-bold text-black bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 rounded-3xl shadow-2xl shadow-amber-500/40 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-amber-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-300 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <motion.span 
                  className="text-4xl mr-6 relative z-10"
                  animate={{ 
                    rotate: [0, 15, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity 
                  }}
                >
                  🚀
                </motion.span>
                <span className="relative z-10">Explore Collections Now</span>
                <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              </Link>
            </motion.div>
            
            {/* Additional trust signals */}
            <motion.div
              className="mt-16 flex flex-wrap justify-center items-center gap-12 opacity-70"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.7 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.5 }}
            >
              {[
                "🔒 Blockchain Secured",
                "💎 Premium Assets",
                "🌍 Global Access",
                "⚡ Instant Trading"
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  className="text-gray-400 text-lg font-medium"
                  whileHover={{ scale: 1.1, color: "#FCD34D" }}
                >
                  {feature}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
