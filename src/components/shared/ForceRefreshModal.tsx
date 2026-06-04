import { useEffect, useState } from 'react';
import { RefreshCw, Shield, Zap, CheckCircle } from 'lucide-react';

const APP_VERSION = '2.1.0';
const VERSION_KEY = 'mgbit_app_version';

export function ForceRefreshModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(VERSION_KEY);
    if (stored !== APP_VERSION) {
      setShow(true);
    }
  }, []);

  function handleRefresh() {
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    window.location.reload();
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8f] px-6 py-5 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <RefreshCw className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Platform Update Available</h2>
          <p className="text-blue-200 text-sm mt-1">Version {APP_VERSION}</p>
        </div>

        <div className="p-6">
          <p className="text-gray-700 text-sm leading-relaxed mb-5 text-center">
            We've rolled out important security improvements and new features to MGBiT.
            Please refresh to continue with the latest version.
          </p>

          <div className="space-y-3 mb-6">
            {[
              { icon: Shield, text: 'Security & privacy enhancements', color: 'text-blue-600 bg-blue-50' },
              { icon: Zap,    text: 'Performance improvements',        color: 'text-amber-600 bg-amber-50' },
              { icon: CheckCircle, text: 'Bug fixes & stability updates', color: 'text-green-600 bg-green-50' },
            ].map(({ icon: Icon, text, color }) => (
              <div key={text} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm text-gray-700">{text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            className="w-full py-3.5 bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8f] hover:opacity-90 text-white font-bold text-base rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh & Continue
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">
            MGBiT · 855-826-4248 · mgbit.io
          </p>
        </div>
      </div>
    </div>
  );
}
