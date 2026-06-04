import { useState } from 'react';
import { MapPin, X, CheckCircle, AlertCircle } from 'lucide-react';

interface LocationPermissionRequestProps {
  onLocationGranted: (latitude: number, longitude: number, accuracy: number) => void;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function LocationPermissionRequest({
  onLocationGranted,
  onClose,
  title = "Enable Location Services",
  description = "To provide the best experience and match you with nearby opportunities, we need access to your location."
}: LocationPermissionRequestProps) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestLocation = () => {
    setRequesting(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setRequesting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        onLocationGranted(latitude, longitude, accuracy);
        setRequesting(false);
      },
      (error) => {
        let errorMessage = 'Unable to retrieve your location';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please try again.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
        }

        setError(errorMessage);
        setRequesting(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="relative p-6 border-b border-gray-200">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-gray-700 leading-relaxed">
            {description}
          </p>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Find Nearby Projects</p>
                <p className="text-xs text-gray-600">Discover opportunities in your service area</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Distance-Based Matching</p>
                <p className="text-xs text-gray-600">See exact distances to project locations</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Privacy Protected</p>
                <p className="text-xs text-gray-600">Your exact location is never shared publicly</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleRequestLocation}
              disabled={requesting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <MapPin className="w-5 h-5" />
              {requesting ? 'Getting Location...' : 'Enable Location'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Skip
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            You can change this setting anytime in your account preferences
          </p>
        </div>
      </div>
    </div>
  );
}
