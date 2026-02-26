import { useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

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
}

const RENOVATION_TYPES = [
  'Kitchen', 'Bathroom', 'Bedroom', 'Living Room', 'Basement',
  'Exterior', 'Roofing', 'Flooring', 'Painting', 'Plumbing', 'Electrical', 'HVAC',
];

const FINISH_LEVELS = [
  { value: 'basic', label: 'Basic' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
];

const TIMELINES = [
  { value: 'asap', label: 'ASAP (0–2 weeks)' },
  { value: 'flexible', label: 'Flexible (2–4 weeks)' },
  { value: 'standard', label: 'Standard (1–2 months)' },
  { value: 'extended', label: 'Extended (2+ months)' },
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

const inputBase =
  'w-full px-6 bg-white border-[1.5px] border-[#D9D9D9] rounded-full text-brand-navy placeholder-[#909090] focus:outline-none focus:border-brand-blue focus:bg-[#EDF3FF] transition-colors';

const inputError = 'border-red-500';

export function CreateProjectPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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
    country: 'USA',
    fullName: profile?.full_name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    agreeToTerms: false,
  });

  const updateField = (field: keyof ProjectFormData, value: any) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFormData({ ...formData, images: Array.from(e.target.files) });
  };

  const validateStep1 = () => {
    const e: { [key: string]: string } = {};
    if (!formData.renovationType.trim()) e.renovationType = 'Please select a renovation type';
    if (!formData.description.trim()) e.description = 'Please describe your project';
    else if (formData.description.length < 20) e.description = 'Description must be at least 20 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: { [key: string]: string } = {};
    if (!formData.budget) e.budget = 'Please enter your budget';
    else if (isNaN(parseFloat(formData.budget)) || parseFloat(formData.budget) <= 0)
      e.budget = 'Please enter a valid budget amount';
    if (!formData.address.trim()) e.address = 'Please enter project address';
    if (!formData.city.trim()) e.city = 'Please enter city';
    if (!formData.state) e.state = 'Please select state';
    if (!formData.zipCode.trim()) e.zipCode = 'Please enter ZIP code';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e: { [key: string]: string } = {};
    if (!formData.fullName.trim()) e.fullName = 'Please enter your full name';
    if (!formData.email.trim()) e.email = 'Please enter your email';
    else if (!formData.email.includes('@')) e.email = 'Please enter a valid email';
    if (!formData.phone.trim()) e.phone = 'Please enter your phone number';
    if (!formData.agreeToTerms) e.agreeToTerms = 'You must agree to the terms and conditions';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) setCurrentStep(2);
    else if (currentStep === 2 && validateStep2()) setCurrentStep(3);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    setIsSubmitting(true);
    try {
      const budget = parseFloat(formData.budget);
      const { error } = await supabase.from('projects').insert({
        owner_id: profile?.id,
        title: `${formData.renovationType} Renovation`,
        description: formData.description,
        budget_min: budget,
        budget_max: budget * 1.1,
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
        status: 'seeking_quotes',
      });
      if (error) throw error;
      setShowLoading(true);
      setTimeout(() => navigate('/dashboard'), 3000);
    } catch (err) {
      console.error('Error creating project:', err);
      setErrors({ form: 'Failed to create project. Please try again.' });
      setIsSubmitting(false);
    }
  };

  /* ─── Loading screen ─── */
  if (showLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-[94px] h-[94px] rounded-full bg-white shadow-lg flex items-center justify-center mx-auto mb-8">
            <div className="w-14 h-14 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-[40px] font-extrabold text-brand-navy leading-tight mb-4">
            We are looking for constructors...
          </h2>
          <p className="text-[20px] text-[#909090]">
            You will receive a notification when we made a match.
          </p>
        </div>
      </div>
    );
  }

  /* ─── Progress bar width per step ─── */
  const progressWidth = currentStep === 1 ? '33%' : currentStep === 2 ? '66%' : '100%';

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-[999px] mx-auto">

        {/* ── Page heading (same across all steps) ── */}
        <div className="mb-8">
          <h1 className="text-[40px] leading-[1.2] font-extrabold text-brand-navy max-w-[737px]">
            Create Your Project – Get Matched with Verified Contractors.
          </h1>
          <p className="text-[20px] text-[#909090] mt-3">
            Fill out the details below to receive contractor offers tailored to your needs.
          </p>
        </div>

        {/* ── Step indicators ── */}
        <div className="flex items-start mb-3">
          {/* Step 1 */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentStep >= 1 ? 'bg-brand-blue text-white' : 'bg-[#D9D9D9] text-[#909090]'}`}>
              {currentStep > 1 ? '✓' : 1}
            </div>
            <span className="text-xs text-[#909090] whitespace-nowrap">Project Details</span>
          </div>

          {/* Line 1→2 */}
          <div className="flex-1 h-[2px] mt-4 mx-3 bg-[#D9D9D9] overflow-hidden">
            <div className={`h-full bg-brand-blue transition-all duration-500 ${currentStep > 1 ? 'w-full' : 'w-0'}`} />
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentStep >= 2 ? 'bg-brand-blue text-white' : 'bg-[#D9D9D9] text-[#909090]'}`}>
              {currentStep > 2 ? '✓' : 2}
            </div>
            <span className="text-xs text-[#909090] whitespace-nowrap">Budget & Location</span>
          </div>

          {/* Line 2→3 */}
          <div className="flex-1 h-[2px] mt-4 mx-3 bg-[#D9D9D9] overflow-hidden">
            <div className={`h-full bg-brand-blue transition-all duration-500 ${currentStep > 2 ? 'w-full' : 'w-0'}`} />
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentStep >= 3 ? 'bg-brand-blue text-white' : 'bg-[#D9D9D9] text-[#909090]'}`}>
              3
            </div>
            <span className="text-xs text-[#909090] whitespace-nowrap">Contact Info</span>
          </div>
        </div>

        {/* ── Blue progress bar ── */}
        {/* <div className="relative h-[6px] bg-[#EDF3FF] rounded-full mb-10 overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-brand-blue rounded-full transition-all duration-500"
            style={{ width: progressWidth }}
          />
        </div> */}

        {/* ── Global form error ── */}
        {errors.form && (
          <div className="mb-6 px-6 py-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
            {errors.form}
          </div>
        )}

        {/* ════════════ STEP 1 ════════════ */}
        {currentStep === 1 && (
          <div className="space-y-6">

            {/* Renovation type */}
            <div>
              <div className="relative">
                <select
                  value={formData.renovationType}
                  onChange={(e) => updateField('renovationType', e.target.value)}
                  className={`${inputBase} h-[59px] appearance-none pr-10 ${
                    errors.renovationType ? inputError : ''
                  }`}
                >
                  <option value="">Select Project Type</option>
                  {RENOVATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#909090] text-xs">▾</span>
              </div>
              {errors.renovationType && (
                <p className="text-red-500 text-xs mt-1 ml-5">{errors.renovationType}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe your project in detail (e.g., what you want to renovate, current condition, specific requirements)"
                rows={4}
                className={`w-full h-[119px] px-6 py-4 bg-white border-[1.5px] rounded-[10px] text-brand-navy placeholder-[#909090] focus:outline-none focus:border-brand-blue focus:bg-[#EDF3FF] resize-none transition-colors ${
                  errors.description ? inputError : 'border-[#D9D9D9]'
                }`}
              />
              {errors.description && (
                <p className="text-red-500 text-xs mt-1 ml-5">{errors.description}</p>
              )}
            </div>

            {/* Upload images */}
            <div>
              <p className="text-[20px] font-semibold text-brand-navy mb-3">
                Upload images of the renovation area (optional but recommended)
              </p>
              <label className="cursor-pointer block">
                <div className="w-full h-[71px] px-6 rounded-full border-[1.5px] border-brand-blue bg-[#EDF3FF] flex items-center gap-3 hover:opacity-90 transition-opacity">
                  <svg className="w-5 h-5 text-brand-blue shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-brand-navy text-sm font-medium">
                    {formData.images.length > 0
                      ? `${formData.images.length} file(s) selected`
                      : 'Click to upload images (PNG, JPG up to 10MB)'}
                  </span>
                </div>
                <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            {/* Room dimensions */}
            <div>
              <p className="text-[20px] font-semibold text-brand-navy mb-3">
                Room Dimensions | Enter dimensions (Length x Width in feet)
              </p>
              <div className="grid grid-cols-2 gap-5">
                <input
                  type="number"
                  value={formData.length}
                  onChange={(e) => updateField('length', e.target.value)}
                  placeholder="Length (ft)"
                  className={`${inputBase} h-[59px]`}
                />
                <input
                  type="number"
                  value={formData.width}
                  onChange={(e) => updateField('width', e.target.value)}
                  placeholder="Width (ft)"
                  className={`${inputBase} h-[59px]`}
                />
              </div>
            </div>
          </div>
        )}

        {/* ════════════ STEP 2 ════════════ */}
        {currentStep === 2 && (
          <div className="space-y-4">

            {/* Budget */}
            <div>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) => updateField('budget', e.target.value)}
                placeholder="Budget ($)"
                className={`${inputBase} h-[53px] ${errors.budget ? inputError : ''}`}
              />
              <p className="text-[14px] text-brand-navy mt-2 ml-5">
                *Your final price will not exceed your budget by more than 10%
              </p>
              {errors.budget && (
                <p className="text-red-500 text-xs mt-1 ml-5">{errors.budget}</p>
              )}
            </div>

            {/* Street address */}
            <div>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Street Address"
                className={`${inputBase} h-[59px] ${errors.address ? inputError : ''}`}
              />
              {errors.address && (
                <p className="text-red-500 text-xs mt-1 ml-5">{errors.address}</p>
              )}
            </div>

            {/* Apartment */}
            <input
              type="text"
              value={formData.apartment}
              onChange={(e) => updateField('apartment', e.target.value)}
              placeholder="Apartment / Unit (Optional)"
              className={`${inputBase} h-[59px]`}
            />

            {/* Row 1: City + State */}
            <div className="grid grid-cols-2 gap-5">
              <div>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="City"
                  className={`${inputBase} h-[59px] ${errors.city ? inputError : ''}`}
                />
                {errors.city && (
                  <p className="text-red-500 text-xs mt-1 ml-5">{errors.city}</p>
                )}
              </div>
              <div className="relative">
                <select
                  value={formData.state}
                  onChange={(e) => updateField('state', e.target.value)}
                  className={`${inputBase} h-[59px] appearance-none pr-10 ${errors.state ? inputError : ''}`}
                >
                  <option value="">State</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#909090] text-xs">▾</span>
                {errors.state && (
                  <p className="text-red-500 text-xs mt-1 ml-5">{errors.state}</p>
                )}
              </div>
            </div>

            {/* Row 2: ZIP + Country */}
            <div className="grid grid-cols-2 gap-5">
              <div>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => updateField('zipCode', e.target.value)}
                  placeholder="ZIP Code"
                  className={`${inputBase} h-[59px] ${errors.zipCode ? inputError : ''}`}
                />
                {errors.zipCode && (
                  <p className="text-red-500 text-xs mt-1 ml-5">{errors.zipCode}</p>
                )}
              </div>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => updateField('country', e.target.value)}
                placeholder="Country"
                className={`${inputBase} h-[59px]`}
              />
            </div>

            {/* Row 3: Finish level + Timeline */}
            <div className="grid grid-cols-2 gap-5">
              <div className="relative">
                <select
                  value={formData.finishLevel}
                  onChange={(e) => updateField('finishLevel', e.target.value)}
                  className={`${inputBase} h-[59px] appearance-none pr-10`}
                >
                  {FINISH_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label} Finish</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#909090] text-xs">▾</span>
              </div>
              <div className="relative">
                <select
                  value={formData.timeline}
                  onChange={(e) => updateField('timeline', e.target.value)}
                  className={`${inputBase} h-[59px] appearance-none pr-10`}
                >
                  {TIMELINES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#909090] text-xs">▾</span>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ STEP 3 ════════════ */}
        {currentStep === 3 && (
          <div className="space-y-6">

            <p className="text-[20px] font-semibold text-brand-navy">
              Enter your contact information
            </p>

            {/* 3-column contact inputs */}
            <div className="grid grid-cols-3 gap-5">
              <div>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  placeholder="Full Name"
                  className={`${inputBase} h-[59px] ${errors.fullName ? inputError : ''}`}
                />
                {errors.fullName && (
                  <p className="text-red-500 text-xs mt-1 ml-5">{errors.fullName}</p>
                )}
              </div>
              <div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="Email Address"
                  className={`${inputBase} h-[59px] ${errors.email ? inputError : ''}`}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1 ml-5">{errors.email}</p>
                )}
              </div>
              <div>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="Phone Number"
                  className={`${inputBase} h-[59px] ${errors.phone ? inputError : ''}`}
                />
                {errors.phone && (
                  <p className="text-red-500 text-xs mt-1 ml-5">{errors.phone}</p>
                )}
              </div>
            </div>

            {/* Project summary */}
            <div className="bg-[#EDF3FF] rounded-2xl px-6 py-5 space-y-3">
              <p className="font-semibold text-brand-navy">Project Summary</p>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-[#909090]">Type</span>
                <span className="font-medium text-brand-navy">{formData.renovationType}</span>
                <span className="text-[#909090]">Budget</span>
                <span className="font-medium text-brand-navy">
                  ${parseFloat(formData.budget || '0').toLocaleString()}
                </span>
                <span className="text-[#909090]">Location</span>
                <span className="font-medium text-brand-navy">
                  {formData.city}, {formData.state} {formData.zipCode}
                </span>
                <span className="text-[#909090]">Timeline</span>
                <span className="font-medium text-brand-navy">
                  {TIMELINES.find((t) => t.value === formData.timeline)?.label}
                </span>
              </div>
            </div>

            {/* Terms */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.agreeToTerms}
                  onChange={(e) => updateField('agreeToTerms', e.target.checked)}
                  className="w-5 h-5 mt-0.5 accent-brand-blue rounded"
                />
                <span className="text-sm text-brand-navy">
                  I agree to the{' '}
                  <a href="#" className="text-brand-blue hover:underline">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="text-brand-blue hover:underline">Privacy Policy</a>
                  <span className="block text-[#909090] text-xs mt-1">
                    We'll use your information to match you with contractors and send project updates.
                  </span>
                </span>
              </label>
              {errors.agreeToTerms && (
                <p className="text-red-500 text-xs mt-2 ml-8">{errors.agreeToTerms}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Navigation buttons ── */}
        <div className="flex items-center justify-between mt-10">
          {/* Back */}
          {currentStep > 1 ? (
            <button
              onClick={handlePrevious}
              className="flex items-center gap-2 px-7 h-[54px] rounded-full border-[1.5px] border-[#D9D9D9] text-brand-navy font-medium bg-white hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-7 h-[54px] rounded-full border-[1.5px] border-[#D9D9D9] text-brand-navy font-medium bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}

          {/* Next / Submit */}
          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-8 h-[54px] bg-brand-orange rounded-full border border-[#E6E8E7] text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-10 h-[54px] bg-brand-orange rounded-full border border-[#E6E8E7] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Project & Find Contractors'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
