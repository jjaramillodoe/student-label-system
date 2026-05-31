'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function DrawerMigrationPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<any>(null);

  // Check if user is authorized
  if (!session || ((session.user as any)?.role !== 'Admin' && (session.user as any)?.role !== 'Data Lead')) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600">Unauthorized</h1>
        <p className="mt-4">You do not have permission to access this page.</p>
      </div>
    );
  }

  const handleMigration = async () => {
    if (!confirm('Are you sure you want to migrate drawer references? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const response = await fetch('/api/migrate/drawers', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Migration failed');
      }

      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during migration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Drawer Reference Migration</h1>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              This migration will update all student records to use drawer IDs instead of drawer names.
              Please make sure you have a backup of your database before proceeding.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleMigration}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
      >
        {loading ? 'Migrating...' : 'Start Migration'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {results && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Migration Results</h2>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Total Students Processed:</p>
                <p className="text-2xl font-bold">{results.totalStudents}</p>
              </div>
              <div>
                <p className="text-gray-600">Successfully Updated:</p>
                <p className="text-2xl font-bold text-green-600">{results.updatedStudents}</p>
              </div>
              <div>
                <p className="text-gray-600">Cabinets Updated:</p>
                <p className="text-2xl font-bold text-blue-600">{results.updatedCabinets}</p>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-red-600 mb-2">Errors ({results.errors.length})</h3>
                <div className="bg-red-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  {results.errors.map((error: string, index: number) => (
                    <p key={index} className="text-red-700 text-sm mb-2">{error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 