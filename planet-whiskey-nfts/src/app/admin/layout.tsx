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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-white">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          <p className="ml-3 text-lg text-gray-600">Loading admin section...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-amber-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-amber-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-amber-800 font-serif">NFT Treasury Admin</h1>
              <div className="hidden sm:block w-px h-6 bg-amber-300"></div>
              {sessionStatus?.user && (
                <span className="hidden sm:block text-gray-600">
                  Welcome, <span className="font-semibold text-amber-700">{sessionStatus.user.username}</span>
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <a 
                href="/" 
                className="text-amber-600 hover:text-amber-800 font-medium transition-colors duration-200"
              >
                ← Back to Site
              </a>
              <button
                onClick={handleLogout}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="py-4">
            <ul className="flex flex-wrap gap-x-8 gap-y-2 items-center">
              <li>
                <a 
                  href="/admin" 
                  className={`text-white hover:text-amber-200 font-medium transition-colors duration-200 pb-1 border-b-2 ${
                    pathname === '/admin' ? 'border-amber-200' : 'border-transparent hover:border-amber-300'
                  }`}
                >
                  Dashboard
                </a>
              </li>
              <li>
                <a 
                  href="/admin/companies" 
                  className={`text-white hover:text-amber-200 font-medium transition-colors duration-200 pb-1 border-b-2 ${
                    pathname === '/admin/companies' ? 'border-amber-200' : 'border-transparent hover:border-amber-300'
                  }`}
                >
                  Companies
                </a>
              </li>
              <li>
                <a 
                  href="/admin/collections" 
                  className={`text-white hover:text-amber-200 font-medium transition-colors duration-200 pb-1 border-b-2 ${
                    pathname === '/admin/collections' ? 'border-amber-200' : 'border-transparent hover:border-amber-300'
                  }`}
                >
                  Collections
                </a>
              </li>
              <li>
                <a 
                  href="/admin/purchases" 
                  className={`text-white hover:text-amber-200 font-medium transition-colors duration-200 pb-1 border-b-2 ${
                    pathname === '/admin/purchases' ? 'border-amber-200' : 'border-transparent hover:border-amber-300'
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
        <main className="bg-white shadow-xl rounded-xl p-8 border border-amber-100">
          {children}
        </main>
      </div>
    </div>
  );
} 