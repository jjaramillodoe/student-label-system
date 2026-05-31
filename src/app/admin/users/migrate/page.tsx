'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MigrateUsers() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleMigrate = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/users/migrate', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        // Redirect back to users page after 2 seconds
        setTimeout(() => {
          router.push('/admin/users');
        }, 2000);
      } else {
        setMessage(data.error || 'Failed to migrate users');
      }
    } catch (error) {
      setMessage('An error occurred during migration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Migrate Users
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            This will add timestamp fields to all existing users
          </p>
        </div>

        {message && (
          <div className={`rounded-md p-4 ${
            message.includes('Failed') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
          }`}>
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}

        <div>
          <button
            onClick={handleMigrate}
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Migrating...' : 'Start Migration'}
          </button>
        </div>
      </div>
    </div>
  );
} 