'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Define a type for the session user data we expect
interface AdminUser {
  username: string;
  // Add other user properties if your session-status API returns them
}

interface SessionStatus {
  isLoggedIn: boolean;
  user?: AdminUser;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname(); // Get current path
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Don't run auth check if we are already on the login page
    if (pathname === '/admin/login') {
      setIsLoading(false);
      setSessionStatus({ isLoggedIn: false }); // Assume not logged in for login page itself
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
          // Handle non-ok response, e.g., server error
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
      <div className="min-h-screen flex items-center justify-center bg-brand-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
        <p className="ml-3 text-brand-text-secondary font-sans">Loading admin section...</p>
      </div>
    );
  }

  // If not logged in and not on the login page (initial load might briefly pass isLoading)
  if (!sessionStatus?.isLoggedIn && pathname !== '/admin/login') {
    // This case should ideally be handled by the redirect in useEffect,
    // but as a fallback or for very fast navigations, return null or a loading indicator.
    // Or, if router.push hasn't completed, it might render children briefly.
    // To be absolutely sure, you might not render children until isLoggedIn is true.
    return null; // Or a minimal loading state
  }

  // If on the login page, just render children (which is the login form)
  if (pathname === '/admin/login') {
    return <div className="min-h-screen bg-brand-background flex items-center justify-center p-4">{children}</div>;
  }

  // If logged in, render the admin layout and its children
  return (
    <div className="min-h-screen bg-brand-background text-brand-text-primary py-8 font-sans">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 pb-4 border-b border-brand-border">
          <h1 className="text-3xl font-semibold text-brand-text-primary mb-4 sm:mb-0">Admin Dashboard</h1>
          {sessionStatus?.user && <span className="text-brand-text-secondary">Welcome, {sessionStatus.user.username}!</span>}
        </div>
        <nav className="mb-8">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 sm:gap-x-6 items-center">
            <li><a href="/admin" className="text-brand-text-secondary hover:text-brand-primary transition-colors pb-1 border-b-2 border-transparent hover:border-brand-primary">Dashboard</a></li>
            <li><a href="/admin/companies" className="text-brand-text-secondary hover:text-brand-primary transition-colors pb-1 border-b-2 border-transparent hover:border-brand-primary">Companies</a></li>
            <li><a href="/admin/collections" className="text-brand-text-secondary hover:text-brand-primary transition-colors pb-1 border-b-2 border-transparent hover:border-brand-primary">Collections</a></li>
            <li><a href="/admin/purchases" className="text-brand-text-secondary hover:text-brand-primary transition-colors pb-1 border-b-2 border-transparent hover:border-brand-primary">Purchases</a></li>
            <li className="ml-auto mt-2 sm:mt-0">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/auth/logout', {
                      method: 'POST',
                    });
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
                }}
                className="px-4 py-2 text-sm text-brand-text-primary bg-brand-surface hover:bg-brand-primary border border-brand-border hover:border-brand-primary rounded-md transition-colors shadow-sm hover:shadow-md"
              >
                Logout
              </button>
            </li>
          </ul>
        </nav>
        <main className="bg-brand-surface shadow-lg rounded-lg p-6 min-h-[calc(100vh-280px)]">
          {children}
        </main>
      </div>
    </div>
  );
} 