'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', { // Using the existing auth endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to admin dashboard or the page they were trying to access
        // For simplicity, redirecting to /admin
        router.push('/admin');
        router.refresh(); // Important to re-trigger layout/page logic
      } else {
        setError(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login request failed:', err);
      setError('An unexpected error occurred. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-gray-100 p-4">
      <div className="bg-cream p-8 rounded-lg shadow-xl w-full max-w-md border border-whiskey-brown-light">
        <h1 className="text-3xl font-serif font-semibold mb-8 text-center text-whiskey-brown-dark">Admin Portal</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-stone-gray-700 font-sans mb-1">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2 font-sans border border-stone-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-gold-DEFAULT focus:border-amber-gold-DEFAULT sm:text-sm text-stone-gray-900 placeholder-stone-gray-400"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-gray-700 font-sans mb-1">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2 font-sans border border-stone-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-gold-DEFAULT focus:border-amber-gold-DEFAULT sm:text-sm text-stone-gray-900 placeholder-stone-gray-400"
              placeholder="Enter your password"
            />
          </div>
          {error && <p className="text-red-600 text-sm text-center font-sans">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold font-sans text-white bg-amber-gold-DEFAULT hover:bg-amber-gold-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-gold-dark disabled:opacity-70 disabled:bg-stone-gray-400 transition-colors"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
} 