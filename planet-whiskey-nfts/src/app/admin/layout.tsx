'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Define a type for the session user data we expect
interface AdminUser {
  username: string;
}

interface SessionStatus {
  isLoggedIn: boolean;
  user?: AdminUser;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (pathname === '/admin/login') {
      setIsLoading(false);
      setSessionStatus({ isLoggedIn: false });
      return;
    }

    async function checkSession() {
      try {
        const response = await fetch('/api/admin/session-status');
        if (response.ok) {
          const data: SessionStatus = await response.json();
          setSessionStatus(data);
          if (!data.isLoggedIn) {
            router.push('/admin/login');
          }
        } else {
          setSessionStatus({ isLoggedIn: false });
          router.push('/admin/login'); 
        }
      } catch (error) {
        console.error('Failed to fetch session status:', error);
        setSessionStatus({ isLoggedIn: false });
        router.push('/admin/login');
      } finally {
        setIsLoading(false);
      }
    }

    checkSession();
  }, [router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
          <p className="ml-3 text-lg text-gray-400">Loading admin section...</p>
        </div>
      </div>
    );
  }

  if (!sessionStatus?.isLoggedIn && pathname !== '/admin/login') {
    return null;
  }

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Logout handler
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        setSessionStatus({ isLoggedIn: false });
        router.push('/admin/login');
        router.refresh();
      } else {
        console.error('Logout failed:', await response.json());
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 admin-page">
      {/* Header */}
      <div className="bg-slate-900/95 shadow-lg border-b border-amber-500/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-amber-400 font-serif">NFT Treasury Admin</h1>
              <div className="hidden sm:block w-px h-6 bg-amber-500/30"></div>
              {sessionStatus?.user && (
                <span className="hidden sm:block text-gray-400">
                  Welcome, <span className="font-semibold text-amber-400">{sessionStatus.user.username}</span>
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <a 
                href="/" 
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors duration-200"
              >
                ← Back to Site
              </a>
              <button
                onClick={handleLogout}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-gradient-to-r from-amber-700/80 via-amber-800/80 to-amber-900/80 shadow-md border-b border-amber-500/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="py-4">
            <ul className="flex flex-wrap gap-x-8 gap-y-2 items-center">
              <li>
                <a 
                  href="/admin" 
                  className={`text-white hover:text-amber-200 font-medium transition-colors duration-200 pb-1 border-b-2 ${
                    pathname === '/admin' ? 'border-amber-300' : 'border-transparent hover:border-amber-400'
                  }`}
                >
                  Dashboard
                </a>
              </li>
              <li>
                <a 
                  href="/admin/lending" 
                  className={`text-white hover:text-amber-200 font-medium transition-colors duration-200 pb-1 border-b-2 ${
                    pathname === '/admin/lending' ? 'border-amber-300' : 'border-transparent hover:border-amber-400'
                  }`}
                >
                  🏦 Lending Protocol
                </a>
              </li>
              <li>
                <a 
                  href="/admin/companies" 
                  className={`text-white hover:text-amber-200 font-medium transition-colors duration-200 pb-1 border-b-2 ${
                    pathname === '/admin/companies' ? 'border-amber-300' : 'border-transparent hover:border-amber-400'
                  }`}
                >
                  Assets
                </a>
              </li>
              <li>
                <a 
                  href="/admin/collections" 
                  className={`text-white hover:text-amber-200 font-medium transition-colors duration-200 pb-1 border-b-2 ${
                    pathname === '/admin/collections' ? 'border-amber-300' : 'border-transparent hover:border-amber-400'
                  }`}
                >
                  Create Collections
                </a>
              </li>
              <li>
                <a 
                  href="/admin/collections/manage" 
                  className={`text-white hover:text-amber-200 font-medium transition-colors duration-200 pb-1 border-b-2 ${
                    pathname === '/admin/collections/manage' ? 'border-amber-300' : 'border-transparent hover:border-amber-400'
                  }`}
                >
                  Manage Collections
                </a>
              </li>
              <li>
                <a 
                  href="/admin/purchases" 
                  className={`text-white hover:text-amber-200 font-medium transition-colors duration-200 pb-1 border-b-2 ${
                    pathname === '/admin/purchases' ? 'border-amber-300' : 'border-transparent hover:border-amber-400'
                  }`}
                >
                  Purchases
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <main className="bg-slate-900/80 shadow-xl rounded-xl p-8 border border-white/10">
          {children}
        </main>
      </div>
    </div>
  );
} 