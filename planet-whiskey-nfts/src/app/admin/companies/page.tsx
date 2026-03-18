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
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);

  async function fetchCompanies() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/companies');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch assets');
      }
      const data = await response.json();
      setCompanies(data.companies || []);
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
        throw new Error(errorData.message || 'Failed to add asset');
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

  const handleDeleteCompany = async (companyId: string) => {
    if (!confirm('Are you sure you want to delete this asset? This action cannot be undone.')) {
      return;
    }

    setDeletingCompanyId(companyId);
    try {
      const response = await fetch(`/api/admin/companies/${companyId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete asset');
      }
      await fetchCompanies(); // Refresh the list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingCompanyId(null);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold text-amber-400">Manage Assets</h2>

      <div className="bg-slate-800/50 shadow-lg rounded-lg p-6 border border-white/10">
        <h3 className="text-xl font-serif font-medium mb-4 text-amber-400">Add New Asset</h3>
        <form onSubmit={handleAddCompany} className="space-y-4">
          <div>
            <label htmlFor="newCompanyName" className="block text-sm font-sans font-medium text-gray-300">
              Asset Name
            </label>
            <input
              type="text"
              id="newCompanyName"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 font-sans bg-slate-700/50 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm text-white placeholder-gray-500"
            />
          </div>
          <div>
            <label htmlFor="newCompanyDescription" className="block text-sm font-sans font-medium text-gray-300">
              Description (Optional)
            </label>
            <textarea
              id="newCompanyDescription"
              value={newCompanyDescription}
              onChange={(e) => setNewCompanyDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 font-sans bg-slate-700/50 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm text-white placeholder-gray-500"
            />
          </div>
          {submitError && <p className="text-sm text-red-400 font-sans">{submitError}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-sans font-medium rounded-md text-black bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-amber-500 disabled:opacity-70 disabled:bg-slate-600 transition-colors"
          >
            {isSubmitting ? 'Adding...' : 'Add Asset'}
          </button>
        </form>
      </div>

      <div className="bg-slate-800/50 shadow-lg rounded-lg p-6 border border-white/10">
        <h3 className="text-xl font-serif font-medium mb-4 text-amber-400">Existing Assets</h3>
        {isLoading && <p className="font-sans text-gray-400">Loading assets...</p>}
        {error && <p className="text-sm text-red-400 font-sans">Error: {error}</p>}
        {!isLoading && !error && companies.length === 0 && <p className="font-sans text-gray-500">No assets found.</p>}
        {!isLoading && !error && companies.length > 0 && (
          <ul className="divide-y divide-slate-700">
            {companies.map((company) => (
              <li key={company._id} className="py-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="text-lg font-serif font-semibold text-amber-300">{company.name}</h4>
                    {company.description && <p className="text-sm font-sans text-gray-400 mt-1">{company.description}</p>}
                    <p className="text-xs font-sans text-gray-500 mt-1">Created: {new Date(company.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteCompany(company._id)}
                    disabled={deletingCompanyId === company._id}
                    className="ml-4 inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deletingCompanyId === company._id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 