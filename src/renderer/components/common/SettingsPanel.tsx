import React, { useState, useEffect } from 'react';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [refreshInterval, setRefreshInterval] = useState('300');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.api.settings.get('refresh_interval').then(val => {
      if (val) setRefreshInterval(val);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.api.settings.set('refresh_interval', refreshInterval);
      onClose();
      // Reload to apply new interval (or use a context/callback)
      window.location.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-lg shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Feed Refresh Interval
            </label>
            <select
              value={refreshInterval}
              onChange={e => setRefreshInterval(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="60">Every minute</option>
              <option value="300">Every 5 minutes</option>
              <option value="900">Every 15 minutes</option>
              <option value="1800">Every 30 minutes</option>
              <option value="3600">Every hour</option>
              <option value="10800">Every 3 hours</option>
              <option value="21600">Every 6 hours</option>
              <option value="43200">Every 12 hours</option>
              <option value="86400">Daily</option>
            </select>
            <p className="mt-2 text-xs text-gray-500">How often the app checks for new articles in the background.</p>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
