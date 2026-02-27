import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Star, ChevronLeft, ChevronRight, Upload, Edit2, Check, X, Camera, ShieldCheck, AlertCircle, Clock } from 'lucide-react';
import { LicenseVerificationModal } from './LicenseVerificationModal';

interface Specialization {
  id: string;
  name: string;
  icon: string;
  years: number;
}

interface Project {
  id: string;
  title: string;
  description: string;
  location: string;
  images: string[];
  rating: number;
}

interface Review {
  id: string;
  customer_name: string;
  project_title: string;
  rating: number;
  comment: string;
  verified: boolean;
}

const specializationOptions = [
  { id: 'kitchen', name: 'Kitchen Renovation', icon: '🏠', years: 5 },
  { id: 'painting', name: 'Painting & Finishing', icon: '🎨', years: 3 },
  { id: 'electrical', name: 'Electrical & Plumbing', icon: '🔌', years: 7 }
];

export function ContractorProfile() {
  const { profile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editingLicense, setEditingLicense] = useState(false);
  const [currentProjectIndex, setCurrentProjectIndex] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [backgroundUrl, setBackgroundUrl] = useState(profile?.background_url || '');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(profile?.verification_status || 'not_verified');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    company_name: profile?.company_name || '',
    license_number: profile?.license_number || '',
    specializations: [] as string[]
  });

  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [licenseNumber, setLicenseNumber] = useState('Your CSLB License Verification Link');

  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    }
    if (profile?.background_url) {
      setBackgroundUrl(profile.background_url);
    }
    if (profile?.verification_status) {
      setVerificationStatus(profile.verification_status);
    }

    if (!profile?.id) return;

    const channel = supabase
      .channel(`profile-updates-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profile.id}`
        },
        (payload) => {
          const newStatus = payload.new.verification_status;
          if (newStatus) {
            setVerificationStatus(newStatus);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const handleVerificationSuccess = () => {
    setVerificationStatus('pending');
  };

  const getVerificationBadge = () => {
    switch (verificationStatus) {
      case 'verified':
        return (
          <div className="group relative inline-block">
            <span className="px-4 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Verified via CSLB
            </span>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              This professional holds an active California contractor license verified through the official CSLB database.
            </div>
          </div>
        );
      case 'pending':
        return (
          <span className="px-4 py-1 bg-yellow-100 text-yellow-700 text-sm font-semibold rounded-full flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Verification Pending
          </span>
        );
      case 'rejected':
      case 'expired':
      case 'suspended':
        return (
          <span className="px-4 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-full flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {verificationStatus === 'rejected' ? 'Verification Failed' :
             verificationStatus === 'expired' ? 'License Expired' : 'License Suspended'}
          </span>
        );
      default:
        return (
          <span className="px-4 py-1 bg-gray-100 text-gray-700 text-sm font-semibold rounded-full flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Not Verified
          </span>
        );
    }
  };

  const completedProjects: Project[] = [
    {
      id: '1',
      title: 'Luxury Kitchen Upgrade',
      description: 'This project involved a complete kitchen overhaul, turning an outdated space into a sleek, modern cooking area. We installed custom-built white shaker cabinets, complementing them with a stunning quartz waterfall countertop, a built-in wine cooler, and a farmhouse sink with a commercial-style platform. The lighting was upgraded with recessed LED fixtures and stylish pendant lights above the island, creating a bright and inviting atmosphere. High-end appliances, including a smart refrigerator and double oven, were integrated seamlessly, along with a gas cooktop featuring a pot-filler faucet and built-in oven, enhancing both functionality and design.',
      location: 'Los Angeles, CA',
      images: [
        'https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg?auto=compress&cs=tinysrgb&w=800',
        'https://images.pexels.com/photos/2724748/pexels-photo-2724748.jpeg?auto=compress&cs=tinysrgb&w=800',
        'https://images.pexels.com/photos/2724750/pexels-photo-2724750.jpeg?auto=compress&cs=tinysrgb&w=800'
      ],
      rating: 5
    }
  ];

  const reviews: Review[] = [
    {
      id: '1',
      customer_name: 'Sarah Thompson',
      project_title: 'Kitchen Renovation',
      rating: 5,
      comment: 'John and his team did an outstanding job on our kitchen renovation. From the initial consultation to the final touches, everything was handled professionally. The attention to detail is in the cabinetry and quartz countertops was beyond our expectations. The project stayed on schedule and within budget, and we could not be happier!',
      verified: true
    },
    {
      id: '2',
      customer_name: 'Michael Reynolds',
      project_title: 'Bathroom Renovation',
      rating: 5,
      comment: 'I hired John for a complete bathroom renovation, and the results were amazing. The new walk-in shower, heated floors, and modern fixtures transformed the space completely. The workmanship was excellent, and any concerns I had throughout the process, any and minor issues were addressed immediately. Highly recommend him for any home improvement project.',
      verified: true
    },
    {
      id: '3',
      customer_name: 'Emily Carter',
      project_title: 'Living Room Upgrade',
      rating: 5,
      comment: 'John redesigned our living room to create an open, modern space with custom shelving and stylish lighting. He understood our vision perfectly and executed it flawlessly. The quality of work and materials used were top-notch, so to have everything within the timeline provided. We have received so many compliments from friends. John is the one to call!',
      verified: true
    }
  ];

  const handleUpdateProfile = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          company_name: formData.company_name,
          license_number: formData.license_number
        })
        .eq('id', profile?.id);

      if (error) throw error;
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleUpdateLicense = () => {
    setEditingLicense(false);
  };

  const toggleSpecialization = (specId: string) => {
    setSelectedSpecs(prev =>
      prev.includes(specId)
        ? prev.filter(id => id !== specId)
        : [...prev, specId]
    );
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file || !profile?.id) return;

      setUploadingAvatar(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/avatar.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file || !profile?.id) return;

      setUploadingBackground(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/background.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ background_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setBackgroundUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading background:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingBackground(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Meet Your Contractor - Verified & Rated Professionals
          </h2>
          <p className="text-gray-600">
            View experience, completed projects, and customer feedback before making your choice.
          </p>
        </div>

        <div className="relative mb-12">
          <div className="h-48 bg-gradient-to-r from-green-400 to-blue-500 rounded-t-3xl overflow-hidden relative group">
            <img
              src={backgroundUrl || "https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1200"}
              alt="Background"
              className="w-full h-full object-cover opacity-60"
            />
            <input
              ref={backgroundInputRef}
              type="file"
              accept="image/*"
              onChange={handleBackgroundUpload}
              className="hidden"
            />
            <button
              onClick={() => backgroundInputRef.current?.click()}
              disabled={uploadingBackground}
              className="absolute top-4 right-4 px-4 py-2 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition-all flex items-center gap-2 shadow-lg opacity-0 group-hover:opacity-100"
            >
              <Camera className="w-4 h-4" />
              {uploadingBackground ? 'Uploading...' : 'Change Background'}
            </button>
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-gray-200 -mt-24 pt-20 pb-8 px-8 relative">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="relative">
                <img
                  src={avatarUrl || `https://ui-avatars.com/api/?name=${profile?.full_name || 'John Mitchell'}&size=150&background=random`}
                  alt={profile?.full_name}
                  className="w-36 h-36 rounded-full border-4 border-white shadow-xl object-cover"
                />
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 px-4 py-2 bg-white border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingAvatar ? 'Uploading...' : 'Upload New Photo'}
                </button>
              </div>
            </div>

            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                {editing ? (
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="text-2xl font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none text-center"
                  />
                ) : (
                  <h3 className="text-2xl font-bold text-gray-900">{profile?.full_name || 'John Mitchell'}</h3>
                )}
                <button
                  onClick={() => editing ? handleUpdateProfile() : setEditing(true)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  {editing ? <Check className="w-5 h-5 text-green-600" /> : <Edit2 className="w-4 h-4 text-gray-600" />}
                </button>
                {editing && (
                  <button
                    onClick={() => setEditing(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-red-600" />
                  </button>
                )}
              </div>

              {editing ? (
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Company Name"
                  className="text-gray-600 border-b-2 border-blue-500 focus:outline-none text-center mb-3"
                />
              ) : (
                <p className="text-gray-600 mb-3">{profile?.company_name || 'Licensed General Contractor'}</p>
              )}

              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3">
                  {getVerificationBadge()}
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="ml-2 text-gray-600 font-medium">(5 Stars)</span>
                  </div>
                </div>

                {verificationStatus === 'not_verified' && (
                  <button
                    onClick={() => setShowVerificationModal(true)}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    Verify License via CSLB
                  </button>
                )}

                {verificationStatus === 'pending' && (
                  <p className="text-sm text-yellow-700 bg-yellow-50 px-4 py-2 rounded-lg">
                    Your verification is under review. You will be notified within 24-48 hours.
                  </p>
                )}

                {(verificationStatus === 'rejected' || verificationStatus === 'expired' || verificationStatus === 'suspended') && (
                  <div className="text-sm text-red-700 bg-red-50 px-4 py-2 rounded-lg">
                    <p className="font-semibold mb-1">License verification issue detected</p>
                    <button
                      onClick={() => setShowVerificationModal(true)}
                      className="text-red-600 hover:text-red-700 underline"
                    >
                      Resubmit verification
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="max-w-md mx-auto mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">CSLB License</label>
              <div className="flex items-center gap-2">
                {editingLicense ? (
                  <>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleUpdateLicense}
                      className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setEditingLicense(false)}
                      className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={licenseNumber}
                      disabled
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                    <button
                      onClick={() => setEditingLicense(true)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-5 h-5 text-gray-600" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-xl font-bold text-gray-900 mb-4 text-center">
                Choose Your Experience & Specializations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {specializationOptions.map((spec) => (
                  <div
                    key={spec.id}
                    onClick={() => toggleSpecialization(spec.id)}
                    className={`relative p-6 border-2 rounded-2xl cursor-pointer transition-all ${
                      selectedSpecs.includes(spec.id)
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400 bg-white'
                    }`}
                  >
                    {selectedSpecs.includes(spec.id) && (
                      <div className="absolute top-3 right-3 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-4xl mb-3">{spec.icon}</div>
                      <h5 className="font-bold text-gray-900 mb-1">{spec.name}</h5>
                      <p className="text-sm text-gray-600">{spec.years} Years of experience</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8 mb-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Completed Projects Showcase
          </h3>

          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 row-span-2">
                  <img
                    src="https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg?auto=compress&cs=tinysrgb&w=800"
                    alt="Project main"
                    className="w-full h-full object-cover rounded-xl"
                  />
                </div>
                {completedProjects[0].images.slice(1, 4).map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Project ${idx + 2}`}
                    className="w-full h-32 object-cover rounded-xl"
                  />
                ))}
              </div>

              <div>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🏠</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">
                      {completedProjects[0].title}
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {completedProjects[0].description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    {completedProjects[0].location}
                  </p>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="ml-2 text-sm text-gray-600">(5 Stars)</span>
                  </div>
                </div>
              </div>
            </div>

            <button className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
            <button className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
              <ChevronRight className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i === currentProjectIndex ? 'bg-blue-600 w-8' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8 mb-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Customer Reviews & Ratings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <div key={review.id} className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                <div className="flex items-start gap-4 mb-4">
                  <img
                    src={`https://ui-avatars.com/api/?name=${review.customer_name}&size=60&background=random`}
                    alt={review.customer_name}
                    className="w-14 h-14 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-gray-900">{review.customer_name}</h4>
                      {review.verified && (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{review.project_title}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                  {review.comment}
                </p>

                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="ml-2 text-sm text-gray-600">(5 Stars)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showVerificationModal && (
        <LicenseVerificationModal
          onClose={() => setShowVerificationModal(false)}
          onSuccess={handleVerificationSuccess}
        />
      )}
    </div>
  );
}
