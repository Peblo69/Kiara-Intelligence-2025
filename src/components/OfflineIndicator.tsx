import React from 'react';
import { useStore } from '../lib/store';
import { CloudOff } from 'lucide-react';

export function OfflineIndicator() {
  const { isOffline } = useStore();

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-900/80 text-white py-2 px-4 rounded-full flex items-center space-x-2 z-50">
      <CloudOff className="w-4 h-4" />
      <span className="text-sm font-medium">You're offline</span>
    </div>
  );
}