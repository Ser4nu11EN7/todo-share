'use client';

import { useAuth } from './context/AuthContext';
import AuthForm from './components/AuthForm';
import SpaceManager from './components/SpaceManager';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">正在加载...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-indigo-800 dark:text-indigo-600">
              Share Todo
            </h1>
          </div>
          <p className="mt-2 text-sm text-gray-600">简单、高效的双人协作待办事项管理</p>
        </div>
        
        {!user ? <AuthForm /> : <SpaceManager />}
      </div>
    </div>
  );
}
