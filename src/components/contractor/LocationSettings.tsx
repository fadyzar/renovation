import { useState } from 'react';
import { MapPin, Navigation, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LocationPermissionRequest } from '../shared/LocationPermissionRequest';

export function LocationSettings() {
  const { profile } = useAuth();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [serviceRadius, setServiceRadius] = useState(profile?.service_radius_km || 50);
  const [locationEnabled, setLocationEnabled] = useState(profile?.location_enabled || false);
  const [saving, setSaving] = useState(false);

  const hasLocation = profile?.service_latitude && profile?.service_longitude;

  const handleLocationGranted = async (latitude: number, longitude: number) => {
    if (!profile?.id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          service_latitude: latitude,
          service_longitude: longitude,
          location_enabled: true
        })
        .eq('id', profile.id);

      if (error) throw error;

      setLocationEnabled(true);
      setShowLocationModal(false);
      window.location.reload();
    } catch (error) {
      console.error('Error saving location:', error);
      alert('Failed to save location. Please try again.');
    }
  };

  const handleSaveRadius = async () => {
    if (!profile?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          service_radius_km: serviceRadius
        })
        .eq('id', profile.id);

      if (error) throw error;
      alert('Service radius updated successfully!');
    } catch (error) {
      console.error('Error updating service radius:', error);
      alert('Failed to update service radius. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLocation = async () => {
    if (!profile?.id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          location_enabled: !locationEnabled
        })
        .eq('id', profile.id);

      if (error) throw error;
      setLocationEnabled(!locationEnabled);
    } catch (error) {
      console.error('Error toggling location:', error);
      alert('Failed to update location settings.');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
          <MapPin className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Location Services</h3>
          <p className="text-sm text-gray-600">Manage your service area and location settings</p>
        </div>
      </div>

      {!hasLocation ? (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Navigation className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 mb-2">Enable Location Services</h4>
              <p className="text-sm text-gray-700 mb-4">
                Get matched with nearby projects and see distances to job sites. Help property owners find you faster.
              </p>
              <button
                onClick={() => setShowLocationModal(true)}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Enable Location
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Location Enabled</p>
                <p className="text-sm text-gray-600">Receiving location-based project matches</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={locationEnabled}
                onChange={handleToggleLocation}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="font-semibold text-gray-900">Service Radius</label>
              <span className="text-2xl font-bold text-blue-600">{serviceRadius}km</span>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Set the maximum distance you're willing to travel for projects
            </p>

            <input
              type="range"
              min="5"
              max="200"
              step="5"
              value={serviceRadius}
              onChange={(e) => setServiceRadius(Number(e.target.value))}
              className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(serviceRadius / 200) * 100}%, #DBEAFE ${(serviceRadius / 200) * 100}%, #DBEAFE 100%)`
              }}
            />

            <div className="flex justify-between text-xs text-gray-500 mt-2 mb-4">
              <span>5km</span>
              <span>50km</span>
              <span>100km</span>
              <span>150km</span>
              <span>200km</span>
            </div>

            <button
              onClick={handleSaveRadius}
              disabled={saving}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Service Radius'}
            </button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm text-yellow-900">
              <strong>Privacy Note:</strong> Your exact location is never shared publicly. Only the distance to projects is shown to property owners.
            </p>
          </div>
        </div>
      )}

      {showLocationModal && (
        <LocationPermissionRequest
          onLocationGranted={handleLocationGranted}
          onClose={() => setShowLocationModal(false)}
          title="Enable Service Location"
          description="Set your service area to receive location-based project notifications and see distances to job sites."
        />
      )}
    </div>
  );
}
