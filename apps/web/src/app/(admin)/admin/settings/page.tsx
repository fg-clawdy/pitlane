'use client';

import { useEffect, useState } from 'react';
import { 
  getSystemSettings, 
  updateSystemSetting, 
  SystemSetting 
} from '@/lib/api';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoading(true);
    try {
      const data = await getSystemSettings(token);
      setSettings(data);
    } catch (err) {
      setError('Failed to load settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleUpdateSetting = async (key: string, value: string | number | boolean | object) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setSaving(key);
    setError(null);
    setSuccess(null);

    try {
      const result = await updateSystemSetting(token, { key, value });
      if (result.success) {
        setSuccess(`Setting "${key}" updated successfully`);
        await fetchSettings();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Failed to update setting');
      }
    } catch (err) {
      console.error('Failed to update setting:', err);
      setError('Failed to update setting');
    } finally {
      setSaving(null);
    }
  };

  const renderSettingInput = (setting: SystemSetting) => {
    const isSaving = saving === setting.key;

    // Determine input type based on the value
    if (typeof setting.value === 'boolean') {
      return (
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleUpdateSetting(setting.key, !setting.value)}
            disabled={isSaving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              setting.value ? 'bg-green-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                setting.value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-sm text-gray-600">{setting.value ? 'Enabled' : 'Disabled'}</span>
          {isSaving && <span className="text-sm text-gray-400">Saving...</span>}
        </div>
      );
    }

    if (typeof setting.value === 'number') {
      return (
        <div className="flex items-center space-x-3">
          <input
            type="number"
            defaultValue={setting.value}
            onBlur={(e) => {
              const newValue = parseInt(e.target.value, 10);
              if (newValue !== setting.value) {
                handleUpdateSetting(setting.key, newValue);
              }
            }}
            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {isSaving && <span className="text-sm text-gray-400">Saving...</span>}
        </div>
      );
    }

    if (typeof setting.value === 'object') {
      return (
        <div className="space-y-2">
          <textarea
            defaultValue={JSON.stringify(setting.value, null, 2)}
            onBlur={(e) => {
              try {
                const newValue = JSON.parse(e.target.value);
                if (JSON.stringify(newValue) !== JSON.stringify(setting.value)) {
                  handleUpdateSetting(setting.key, newValue);
                }
              } catch {
                setError('Invalid JSON format');
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm min-h-[100px]"
          />
          {isSaving && <span className="text-sm text-gray-400">Saving...</span>}
        </div>
      );
    }

    // Default: string input
    return (
      <div className="flex items-center space-x-3">
        <input
          type="text"
          defaultValue={String(setting.value)}
          onBlur={(e) => {
            if (e.target.value !== String(setting.value)) {
              handleUpdateSetting(setting.key, e.target.value);
            }
          }}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        {isSaving && <span className="text-sm text-gray-400">Saving...</span>}
      </div>
    );
  };

  // Group settings by category
  const groupedSettings = settings.reduce((acc, setting) => {
    const category = setting.key.split('_')[0].toUpperCase();
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(setting);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  if (loading) {
    return <div className="text-center py-12">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          {success}
        </div>
      )}

      <div className="space-y-8">
        {Object.entries(groupedSettings).map(([category, categorySettings]) => (
          <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">{category}</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {categorySettings.map((setting) => (
                <div key={setting.key} className="px-6 py-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="mb-2 md:mb-0 md:mr-4">
                      <div className="font-medium text-gray-900">{setting.key}</div>
                      <div className="text-sm text-gray-500">{setting.description}</div>
                    </div>
                    <div className="flex-shrink-0">
                      {renderSettingInput(setting)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-red-200">
        <div className="bg-red-50 px-6 py-4 border-b border-red-200">
          <h3 className="text-lg font-semibold text-red-800">⚠️ Danger Zone</h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium text-gray-900">Reset All Settings to Default</div>
              <div className="text-sm text-gray-500">This will reset all system settings to their default values</div>
            </div>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
                  // This would need a backend endpoint to implement
                  alert('This feature requires a backend endpoint to reset settings');
                }
              }}
              className="mt-2 md:mt-0 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Reset to Default
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}