'use client';

import React, { useState, useEffect, FormEvent } from 'react';

interface ICompany {
  _id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export default function ManageCompaniesPage() {
  const [companies, setCompanies] = useState<ICompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDescription, setNewCompanyDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function fetchCompanies() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/companies');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch companies');
      }
      const data = await response.json();
      setCompanies(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleAddCompany = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCompanyName, description: newCompanyDescription }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add company');
      }
      setNewCompanyName('');
      setNewCompanyDescription('');
      await fetchCompanies(); // Refresh the list
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold text-whiskey-brown-dark">Manage Companies</h2>

      <div className="bg-cream shadow-lg rounded-lg p-6 border border-whiskey-brown-light">
        <h3 className="text-xl font-serif font-medium mb-4 text-whiskey-brown-dark">Add New Company</h3>
        <form onSubmit={handleAddCompany} className="space-y-4">
          <div>
            <label htmlFor="newCompanyName" className="block text-sm font-sans font-medium text-stone-gray-700">
              Company Name
            </label>
            <input
              type="text"
              id="newCompanyName"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 font-sans border border-stone-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-gold-DEFAULT focus:border-amber-gold-DEFAULT sm:text-sm text-stone-gray-900 placeholder-stone-gray-400"
            />
          </div>
          <div>
            <label htmlFor="newCompanyDescription" className="block text-sm font-sans font-medium text-stone-gray-700">
              Description (Optional)
            </label>
            <textarea
              id="newCompanyDescription"
              value={newCompanyDescription}
              onChange={(e) => setNewCompanyDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 font-sans border border-stone-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-gold-DEFAULT focus:border-amber-gold-DEFAULT sm:text-sm text-stone-gray-900 placeholder-stone-gray-400"
            />
          </div>
          {submitError && <p className="text-sm text-red-600 font-sans">{submitError}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-sans font-medium rounded-md text-white bg-amber-gold-DEFAULT hover:bg-amber-gold-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-gold-dark disabled:opacity-70 disabled:bg-stone-gray-400 transition-colors"
          >
            {isSubmitting ? 'Adding...' : 'Add Company'}
          </button>
        </form>
      </div>

      <div className="bg-cream shadow-lg rounded-lg p-6 border border-whiskey-brown-light">
        <h3 className="text-xl font-serif font-medium mb-4 text-whiskey-brown-dark">Existing Companies</h3>
        {isLoading && <p className="font-sans text-stone-gray-600">Loading companies...</p>}
        {error && <p className="text-sm text-red-600 font-sans">Error: {error}</p>}
        {!isLoading && !error && companies.length === 0 && <p className="font-sans text-stone-gray-500">No companies found.</p>}
        {!isLoading && !error && companies.length > 0 && (
          <ul className="divide-y divide-stone-gray-300">
            {companies.map((company) => (
              <li key={company._id} className="py-4">
                <h4 className="text-lg font-serif font-semibold text-whiskey-brown-dark">{company.name}</h4>
                {company.description && <p className="text-sm font-sans text-stone-gray-700 mt-1">{company.description}</p>}
                <p className="text-xs font-sans text-stone-gray-500 mt-1">Created: {new Date(company.createdAt).toLocaleDateString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 