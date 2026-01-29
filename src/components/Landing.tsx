import { Sparkles, Search, Shield, Zap } from 'lucide-react';
import { useState } from 'react';
import { AuthModal } from './auth/AuthModal';

export function Landing() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-400 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">RenovateAI</h1>
            </div>

            <button
              onClick={() => setShowAuthModal(true)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/30"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-4xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">AI-Powered Renovation Platform</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Smart Renovations,
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
              Verified Contractors
            </span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            The AI-first platform connecting property owners with trusted contractors.
            Upload photos, get instant analysis, and find the perfect match for your renovation project.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105"
            >
              Start Your Project
            </button>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all"
            >
              Join as Contractor
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">AI Analysis</h3>
            <p className="text-gray-600 leading-relaxed">
              Upload photos and get instant AI-powered analysis of your renovation needs, budget estimates, and timeline predictions.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
              <Search className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Smart Matching</h3>
            <p className="text-gray-600 leading-relaxed">
              Our AI matches you with verified contractors based on experience, location, pricing, and quality ratings.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Secure Payments</h3>
            <p className="text-gray-600 leading-relaxed">
              Milestone-based escrow payments ensure your money is safe and contractors get paid for completed work.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-500 rounded-3xl p-12 text-center text-white">
          <Zap className="w-12 h-12 mx-auto mb-4 opacity-90" />
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Property?</h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto text-lg">
            Join thousands of property owners and contractors using AI to make renovations smarter, faster, and more reliable.
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:shadow-xl transition-all hover:scale-105"
          >
            Get Started Today
          </button>
        </div>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
