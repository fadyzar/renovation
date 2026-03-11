import { useState } from 'react';
import { Upload, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LocationPermissionRequest } from '../shared/LocationPermissionRequest';
import { reverseGeocode } from '../../utils/geolocation';

interface ProjectFormData {
  renovationType: string;
  description: string;
  images: File[];
  length: string;
  width: string;
  budget: string;
  finishLevel: string;
  timeline: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  fullName: string;
  email: string;
  phone: string;
  agreeToTerms: boolean;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  searchRadius: number;
}

export function CreateProjectWizard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationObtained, setLocationObtained] = useState(false);

  const [formData, setFormData] = useState<ProjectFormData>({
    renovationType: '',
    description: '',
    images: [],
    length: '',
    width: '',
    budget: '',
    finishLevel: 'standard',
    timeline: 'flexible',
    address: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    fullName: profile?.full_name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    agreeToTerms: false,
    latitude: null,
    longitude: null,
    locationAccuracy: null,
    searchRadius: 50
  });

  const updateField = (field: keyof ProjectFormData, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setFormData({ ...formData, images: files });
    }
  };

  const validateStep1 = () => {
    if (!formData.renovationType) {
      alert('Please select a renovation type');
      return false;
    }
    if (!formData.description.trim()) {
      alert('Please describe your project');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.budget) {
      alert('Please enter your budget');
      return false;
    }
    if (!formData.address.trim()) {
      alert('Please enter project address');
      return false;
    }
    if (!formData.city.trim()) {
      alert('Please enter city');
      return false;
    }
    if (!formData.state) {
      alert('Please select state/province');
      return false;
    }
    if (!formData.zipCode.trim()) {
      alert('Please enter ZIP/postal code');
      return false;
    }
    if (!formData.country) {
      alert('Please select country');
      return false;
    }
    return true;
  };

  const handleLocationGranted = async (latitude: number, longitude: number, accuracy: number) => {
    setFormData({
      ...formData,
      latitude,
      longitude,
      locationAccuracy: accuracy
    });

    const address = await reverseGeocode(latitude, longitude);
    if (address && !formData.address) {
      const parts = address.split(',');
      setFormData(prev => ({
        ...prev,
        latitude,
        longitude,
        locationAccuracy: accuracy,
        address: parts[0]?.trim() || '',
        city: parts[1]?.trim() || prev.city,
      }));
    }

    setLocationObtained(true);
    setShowLocationModal(false);
  };

  const validateStep3 = () => {
    if (!formData.fullName.trim()) {
      alert('Please enter your full name');
      return false;
    }
    if (!formData.email.trim()) {
      alert('Please enter your email');
      return false;
    }
    if (!formData.phone.trim()) {
      alert('Please enter your phone number');
      return false;
    }
    if (!formData.agreeToTerms) {
      alert('Please agree to the terms and conditions');
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    setIsSubmitting(true);

    try {
      const budget = parseFloat(formData.budget);
      const budgetMax = budget * 1.1;

      const { error } = await supabase
        .from('projects')
        .insert({
          owner_id: profile?.id,
          title: `${formData.renovationType} Renovation`,
          description: formData.description,
          budget_min: budget,
          budget_max: budgetMax,
          work_types: [formData.renovationType],
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zipCode,
          country: formData.country,
          apartment_unit: formData.apartment,
          room_length: formData.length ? parseFloat(formData.length) : null,
          room_width: formData.width ? parseFloat(formData.width) : null,
          finish_level: formData.finishLevel,
          timeline: formData.timeline,
          latitude: formData.latitude,
          longitude: formData.longitude,
          location_accuracy: formData.locationAccuracy,
          search_radius_km: formData.searchRadius,
          status: 'seeking_quotes'
        });

      if (error) throw error;

      setShowLoading(true);

      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (showLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-20 h-20 border-8 border-orange-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            We are looking for constructors...
          </h2>
          <p className="text-gray-600">
            You will receive a notification when we made a match.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Create Your Project - Get Matched with Verified Contractors.
          </h1>
          <p className="text-gray-600">
            Fill out the details below to receive contractor offers tailored to your needs.
          </p>
        </div>

        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center w-full max-w-2xl">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
              currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              1
            </div>
            <div className={`flex-1 h-1 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
              currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              2
            </div>
            <div className={`flex-1 h-1 ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
              currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              3
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Renovation Type
                </label>
                <select
                  value={formData.renovationType}
                  onChange={(e) => updateField('renovationType', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Select Project Type</option>
                  <option value="Kitchen">Kitchen Renovation</option>
                  <option value="Bathroom">Bathroom Renovation</option>
                  <option value="Bedroom">Bedroom Renovation</option>
                  <option value="Living Room">Living Room Renovation</option>
                  <option value="Basement">Basement Renovation</option>
                  <option value="Exterior">Exterior Renovation</option>
                  <option value="Roofing">Roofing</option>
                  <option value="Flooring">Flooring</option>
                  <option value="Painting">Painting</option>
                  <option value="Full House">Full House Renovation</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Briefly describe your project
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Example: Full kitchen renovation including cabinet replacements, countertop installation, and painting"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload images of the renovation area <span className="text-gray-500">(optional but recommended)</span>
                </label>
                <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <span className="text-blue-600 font-semibold">Choose Files</span>
                    {formData.images.length > 0 && (
                      <p className="text-sm text-gray-600 mt-2">
                        {formData.images.length} file{formData.images.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room Dimensions <span className="text-gray-500">| Enter dimensions (Length x Width in feet)</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Length</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.length}
                        onChange={(e) => updateField('length', e.target.value)}
                        placeholder="24"
                        className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">ft</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Width</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.width}
                        onChange={(e) => updateField('width', e.target.value)}
                        placeholder="75"
                        className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">ft</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleContinue}
                className="w-full px-6 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget
                </label>
                <input
                  type="number"
                  value={formData.budget}
                  onChange={(e) => updateField('budget', e.target.value)}
                  placeholder="$17,500"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-600 mt-2">
                  *Your final price will not exceed your budget by more than 10%
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Finish Level
                </label>
                <select
                  value={formData.finishLevel}
                  onChange={(e) => updateField('finishLevel', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="luxury">Luxury</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How soon do you need this done?
                </label>
                <select
                  value={formData.timeline}
                  onChange={(e) => updateField('timeline', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="flexible">Flexible - No rush</option>
                  <option value="1-2 months">1-2 months</option>
                  <option value="2-4 weeks">2-4 weeks</option>
                  <option value="urgent">Urgent (ASAP)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    placeholder="Enter your project address"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Apartment/Suite/Unit
                  </label>
                  <input
                    type="text"
                    value={formData.apartment}
                    onChange={(e) => updateField('apartment', e.target.value)}
                    placeholder="Apartment, suite, or unit"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="Enter your city"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State/Province/Region
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select your state/province</option>
                    <option value="CA">California</option>
                    <option value="NY">New York</option>
                    <option value="TX">Texas</option>
                    <option value="FL">Florida</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ZIP/Postal Code
                  </label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => updateField('zipCode', e.target.value)}
                    placeholder="Enter your ZIP or postal code"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country
                  </label>
                  <select
                    value={formData.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select your country</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="UK">United Kingdom</option>
                  </select>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-2">Enable Precise Location (Recommended)</h4>
                    <p className="text-sm text-gray-700 mb-4">
                      Help contractors find your project with accurate distance matching. Your exact location is never shared publicly - only distance from contractors.
                    </p>
                    {locationObtained ? (
                      <div className="flex items-center gap-2 text-green-700 font-semibold">
                        <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M5 13l4 4L19 7"></path>
                          </svg>
                        </div>
                        Location enabled - contractors within {formData.searchRadius}km will see your project
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowLocationModal(true)}
                          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <MapPin className="w-4 h-4" />
                          Enable Location
                        </button>
                        <p className="text-xs text-gray-600 mt-2">
                          Optional but highly recommended for better contractor matching
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {locationObtained && (
                  <div className="border-t border-blue-200 pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <label className="font-semibold text-gray-900">Contractor Search Radius</label>
                      <span className="text-2xl font-bold text-blue-600">{formData.searchRadius}km</span>
                    </div>

                    <p className="text-sm text-gray-700 mb-4">
                      Set the maximum distance to search for contractors from your project location
                    </p>

                    <input
                      type="range"
                      min="5"
                      max="200"
                      step="5"
                      value={formData.searchRadius}
                      onChange={(e) => updateField('searchRadius', Number(e.target.value))}
                      className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(formData.searchRadius / 200) * 100}%, #DBEAFE ${(formData.searchRadius / 200) * 100}%, #DBEAFE 100%)`
                      }}
                    />

                    <div className="flex justify-between text-xs text-gray-600 mt-2">
                      <span>5km</span>
                      <span>50km</span>
                      <span>100km</span>
                      <span>150km</span>
                      <span>200km</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 px-6 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleContinue}
                  className="flex-1 px-6 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Enter your contact information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => updateField('fullName', e.target.value)}
                    placeholder="Gilad Ben Arush"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="Gilad@gmail.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+972 12345678"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.agreeToTerms}
                  onChange={(e) => updateField('agreeToTerms', e.target.checked)}
                  className="mt-1 w-4 h-4 text-orange-500 focus:ring-orange-500 rounded"
                />
                <span className="text-sm text-gray-700">
                  I confirm that the details provided are accurate and agree to the platform's terms and conditions.
                </span>
              </label>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 px-6 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Project & Get Matchedue'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showLocationModal && (
        <LocationPermissionRequest
          onLocationGranted={handleLocationGranted}
          onClose={() => setShowLocationModal(false)}
          title="Enable Project Location"
          description="Share your project's location to connect with nearby contractors and get accurate distance-based matching."
        />
      )}
    </div>
  );
}
