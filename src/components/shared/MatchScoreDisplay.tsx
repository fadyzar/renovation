import { useEffect, useRef, useState } from 'react';
import { Shield, MapPin, DollarSign, Star, Briefcase, Award, CheckCircle, User, Tag } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchFactorKey = 'license' | 'experience' | 'budget' | 'proposal' | 'area' | 'rating' | 'profile' | 'specialty';

export interface MatchFactor {
  key: MatchFactorKey;
  label: string;
  description: string;
  earned: number;
  max: number;
  /** Whether this factor counted as a positive signal */
  met: boolean;
}

export interface MatchBreakdown {
  score: number;
  tier: 'excellent' | 'good' | 'fair' | 'low';
  factors: MatchFactor[];
  /** 3–5 short bullets explaining the match — shown in cards and modals */
  highlights: string[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  excellent: {
    label: 'Excellent Match',
    ringColor: '#22c55e',
    glowFilter: 'drop-shadow(0 0 10px rgba(34,197,94,0.55))',
    badgeClass: 'bg-green-100 text-green-800 border border-green-200',
    barColor: '#22c55e',
    textClass: 'text-green-700',
    bgClass: 'bg-green-50',
  },
  good: {
    label: 'Good Match',
    ringColor: '#3b82f6',
    glowFilter: 'drop-shadow(0 0 10px rgba(59,130,246,0.5))',
    badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200',
    barColor: '#3b82f6',
    textClass: 'text-blue-700',
    bgClass: 'bg-blue-50',
  },
  fair: {
    label: 'Fair Match',
    ringColor: '#f59e0b',
    glowFilter: 'drop-shadow(0 0 8px rgba(245,158,11,0.45))',
    badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200',
    barColor: '#f59e0b',
    textClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
  },
  low: {
    label: 'Low Match',
    ringColor: '#9ca3af',
    glowFilter: undefined,
    badgeClass: 'bg-gray-100 text-gray-600 border border-gray-200',
    barColor: '#9ca3af',
    textClass: 'text-gray-500',
    bgClass: 'bg-gray-50',
  },
} as const;

const FACTOR_ICONS: Record<MatchFactorKey, React.FC<React.SVGProps<SVGSVGElement>>> = {
  license: Shield,
  experience: Briefcase,
  budget: DollarSign,
  proposal: Award,
  area: MapPin,
  rating: Star,
  profile: User,
  specialty: Tag,
};

const RING_RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const ANIMATION_DURATION_MS = 1100;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  breakdown: MatchBreakdown;
  /** compact = ring + top 2 highlights (for card); full = ring + all factors (for modal) */
  size?: 'compact' | 'full';
  /** Delay before animation starts (ms) — use to stagger multiple cards */
  animationDelay?: number;
}

export function MatchScoreDisplay({ breakdown, size = 'compact', animationDelay = 0 }: Props) {
  const [displayScore, setDisplayScore] = useState(0);
  const [barsVisible, setBarsVisible] = useState(false);
  const rafRef = useRef<number>();
  const startRef = useRef<number | null>(null);
  const cfg = TIER_CONFIG[breakdown.tier];
  const strokeOffset = CIRCUMFERENCE - (displayScore / 100) * CIRCUMFERENCE;

  // Count-up animation
  useEffect(() => {
    startRef.current = null;
    const timer = setTimeout(() => {
      const animate = (ts: number) => {
        if (startRef.current === null) startRef.current = ts;
        const t = Math.min((ts - startRef.current) / ANIMATION_DURATION_MS, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        setDisplayScore(Math.round(eased * breakdown.score));
        if (t < 1) rafRef.current = requestAnimationFrame(animate);
        else if (size === 'full') setBarsVisible(true);
      };
      rafRef.current = requestAnimationFrame(animate);
    }, animationDelay);

    return () => {
      clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [breakdown.score, animationDelay, size]);

  // ── Compact ──────────────────────────────────────────────────────────────────
  if (size === 'compact') {
    return (
      <div className="flex items-center gap-3">
        <div style={{ filter: cfg.glowFilter }} className="flex-shrink-0">
          <svg width="68" height="68" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="9" />
            <circle
              cx="50" cy="50" r={RING_RADIUS}
              fill="none"
              stroke={cfg.ringColor}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeOffset}
              transform="rotate(-90 50 50)"
            />
            <text x="50" y="45" textAnchor="middle" fill="#111827" fontSize="20" fontWeight="800" fontFamily="system-ui, sans-serif">
              {displayScore}
            </text>
            <text x="50" y="63" textAnchor="middle" fill="#6b7280" fontSize="11" fontFamily="system-ui, sans-serif">
              %
            </text>
          </svg>
        </div>

        <div className="min-w-0">
          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5 ${cfg.badgeClass}`}>
            {cfg.label}
          </span>
          {breakdown.highlights.slice(0, 2).map((h, i) => (
            <p key={i} className="text-xs text-gray-600 flex items-start gap-1 leading-snug mb-0.5">
              <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
              <span>{h}</span>
            </p>
          ))}
        </div>
      </div>
    );
  }

  // ── Full ─────────────────────────────────────────────────────────────────────
  return (
    <div className={`rounded-2xl p-5 ${cfg.bgClass}`}>
      {/* Ring + highlights */}
      <div className="flex items-start gap-5 mb-5">
        <div style={{ filter: cfg.glowFilter }} className="flex-shrink-0">
          <svg width="96" height="96" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="#d1d5db" strokeWidth="9" />
            <circle
              cx="50" cy="50" r={RING_RADIUS}
              fill="none"
              stroke={cfg.ringColor}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeOffset}
              transform="rotate(-90 50 50)"
            />
            <text x="50" y="43" textAnchor="middle" fill="#111827" fontSize="22" fontWeight="800" fontFamily="system-ui, sans-serif">
              {displayScore}%
            </text>
            <text x="50" y="61" textAnchor="middle" fill="#6b7280" fontSize="10" fontFamily="system-ui, sans-serif">
              Match
            </text>
          </svg>
        </div>

        <div className="flex-1 pt-1">
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold mb-3 ${cfg.badgeClass}`}>
            {cfg.label}
          </div>
          <div className="space-y-1.5">
            {breakdown.highlights.map((h, i) => (
              <p key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                {h}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Factor breakdown bars */}
      <div className="border-t border-black/10 pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Score Breakdown
        </p>
        <div className="space-y-3">
          {breakdown.factors.map((factor, i) => {
            const Icon = FACTOR_ICONS[factor.key];
            const pct = Math.round((factor.earned / factor.max) * 100);
            const delay = `${i * 80}ms`;
            return (
              <div key={factor.key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Icon
                      className={`w-3.5 h-3.5 ${factor.met ? 'text-green-500' : 'text-gray-400'}`}
                    />
                    <span className="text-xs font-medium text-gray-700">{factor.label}</span>
                    <span className="text-xs text-gray-400">— {factor.description}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-800 ml-2 whitespace-nowrap">
                    {factor.earned}/{factor.max}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: barsVisible ? `${pct}%` : '0%',
                      backgroundColor: cfg.barColor,
                      transitionDelay: delay,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Pre-bid fit score (ProjectFeed) ─────────────────────────────────────────

interface ContractorProfile {
  license_verified?: boolean;
  license_status?: string;
  years_experience?: number;
  service_latitude?: number | null;
  service_longitude?: number | null;
  company_name?: string;
  bio?: string;
  specialties?: string[];
  rating?: number;
}

/**
 * Computes a "potential fit" score for a contractor browsing a project
 * BEFORE submitting a bid. Uses contractor profile + project data only.
 *
 * Skips "Proposal Quality" (no bid yet) and normalises the remaining
 * factors to 100 so the score remains comparable to post-bid scores.
 *
 * Budget factor: estimated at "neutral" since we don't know the bid yet.
 */
export function computeContractorFit(
  contractor: ContractorProfile,
  project: {
    budget_min?: number;
    budget_max?: number;
    work_types?: string[];
    scan?: {
      measured_area_sqft?: number | null;
      estimated_complexity?: 'low' | 'medium' | 'high' | null;
      detected_room_type?: string | null;
    } | null;
  },
  distanceKm?: number
): MatchBreakdown {
  const factors: MatchFactor[] = [];
  const highlights: string[] = [];

  // 1. License & Verification (max 25)
  const isFullyLicensed =
    !!contractor.license_verified && contractor.license_status === 'approved';
  const hasLicense = !!contractor.license_verified;
  const licenseEarned = isFullyLicensed ? 25 : hasLicense ? 10 : 0;
  factors.push({
    key: 'license',
    label: 'License & Verification',
    description: isFullyLicensed
      ? 'You are fully licensed & verified'
      : hasLicense
      ? 'License pending review'
      : 'No license on file',
    earned: licenseEarned,
    max: 25,
    met: licenseEarned >= 15,
  });
  if (isFullyLicensed) highlights.push('Your license is verified');

  // 2. Professional Experience (max 20)
  const exp = contractor.years_experience ?? 0;
  const expEarned = exp >= 10 ? 20 : exp >= 5 ? 15 : exp >= 3 ? 10 : exp >= 1 ? 5 : 4;
  factors.push({
    key: 'experience',
    label: 'Your Experience',
    description: exp > 0 ? `${exp} years in the industry` : 'Experience not specified',
    earned: expEarned,
    max: 20,
    met: expEarned >= 10,
  });
  if (expEarned >= 15) highlights.push(`${exp}+ years of relevant experience`);

  // 3. Budget Feasibility (max 20)
  // Without a bid we score based on whether the budget is reasonable
  const bMax = project.budget_max ?? 0;
  let budgetEarned = 15; // neutral default — "can quote on this"
  let budgetDesc = 'Budget range is reasonable';
  if (bMax === 0) {
    budgetEarned = 10;
    budgetDesc = 'No budget published yet';
  } else if (bMax > 0) {
    budgetEarned = 15;
    budgetDesc = `Project budget up to $${bMax.toLocaleString()}`;
  }
  factors.push({
    key: 'budget',
    label: 'Budget Feasibility',
    description: budgetDesc,
    earned: budgetEarned,
    max: 20,
    met: true,
  });

  // 4. Specialty Match (max 10)
  const { earned: fitSpecialtyEarned, matched: fitSpecialtyMatched } = specialtyMatchLevel(
    contractor.specialties,
    project.work_types,
    project.scan?.detected_room_type
  );
  factors.push({
    key: 'specialty',
    label: 'Specialty Match',
    description: fitSpecialtyMatched
      ? `You specialize in ${fitSpecialtyMatched}`
      : fitSpecialtyEarned > 0
      ? 'Your specialties are relevant'
      : 'No matching specialty on file',
    earned: fitSpecialtyEarned,
    max: 10,
    met: fitSpecialtyEarned >= 8,
  });
  if (fitSpecialtyMatched) highlights.push(`Your ${fitSpecialtyMatched} specialty matches this project`);

  // 5. Service Area (max 7)
  let areaEarned: number;
  let areaDesc: string;
  if (distanceKm !== undefined) {
    areaEarned = distanceKm <= 20 ? 7 : distanceKm <= 50 ? 5 : distanceKm <= 100 ? 3 : 1;
    areaDesc = `${Math.round(distanceKm)} km from project`;
  } else if (contractor.service_latitude && contractor.service_longitude) {
    areaEarned = 5;
    areaDesc = 'Service area configured';
  } else {
    areaEarned = 2;
    areaDesc = 'Location not specified';
  }
  factors.push({
    key: 'area',
    label: 'Service Area',
    description: areaDesc,
    earned: areaEarned,
    max: 7,
    met: areaEarned >= 5,
  });
  if (areaEarned >= 5) highlights.push('Project is close to your service area');

  // 6. Profile Completeness (max 3)
  const hasCompany = !!contractor.company_name;
  const hasBio = (contractor.bio?.length ?? 0) > 20;
  const profileEarned = (hasCompany ? 2 : 0) + (hasBio ? 1 : 0);
  factors.push({
    key: 'profile',
    label: 'Profile Completeness',
    description:
      hasCompany && hasBio
        ? 'Complete professional profile'
        : hasCompany
        ? 'Business name on file'
        : 'Profile partially filled',
    earned: profileEarned,
    max: 3,
    met: profileEarned >= 2,
  });

  // Normalise: available max = 25+20+20+10+7+3 = 85, scale to 100
  const raw = factors.reduce((s, f) => s + f.earned, 0);
  const score = Math.min(Math.round((raw / 85) * 100), 100);

  const tier =
    score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'low';

  if (score >= 75) highlights.push('Strong overall fit for this project');
  else if (score >= 55) highlights.push('Good potential fit — review requirements');

  // Scan context
  const scan = project.scan;
  if (scan?.measured_area_sqft) {
    highlights.push(`Space: ${Math.round(scan.measured_area_sqft)} sq ft · ${scan.estimated_complexity ?? 'medium'} complexity`);
  }

  return { score, tier, factors, highlights: highlights.slice(0, 4) };
}

// ─── Score computation ────────────────────────────────────────────────────────

interface BidForScoring {
  total_price: number;
  milestones: Array<{ description?: string; price: number; duration?: number }>;
  message?: string;
  contractor?: {
    license_verified?: boolean;
    license_status?: string;
    years_experience?: number;
    service_latitude?: number | null;
    service_longitude?: number | null;
    company_name?: string;
    bio?: string;
    specialties?: string[];
    rating?: number;
  } | null;
}

interface ProjectForScoring {
  budget_min?: number;
  budget_max?: number;
  work_types?: string[];
  /** Optional scan data — enriches highlights when available */
  scan?: {
    measured_area_sqft?: number | null;
    estimated_complexity?: 'low' | 'medium' | 'high' | null;
    detected_room_type?: string | null;
    scan_confidence?: number | null;
    renovation_notes?: string | null;
  } | null;
}

/** Returns true if any contractor specialty overlaps with the project's work types */
function specialtyMatchLevel(
  specialties: string[] | undefined,
  workTypes: string[] | undefined,
  roomType: string | null | undefined
): { earned: number; matched: string | null } {
  if (!specialties || specialties.length === 0) return { earned: 0, matched: null };

  const targets = [
    ...(workTypes ?? []).map(w => w.toLowerCase()),
    ...(roomType ? [roomType.toLowerCase()] : []),
  ];

  const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '');
  const normalizedTargets = targets.map(normalize);

  for (const spec of specialties) {
    const ns = normalize(spec);
    if (normalizedTargets.some(t => ns.includes(t) || t.includes(ns))) {
      return { earned: 10, matched: spec };
    }
  }

  // Partial match — contractor has specialties but none align perfectly
  return { earned: 3, matched: null };
}

/**
 * Deterministic, explainable match scoring.
 * Factors are weighted to reflect what owners actually care about.
 *
 * Total possible: 100 pts
 *  License & Verification   25
 *  Professional Experience  20
 *  Budget Alignment         20
 *  Proposal Quality         15
 *  Specialty Match          10
 *  Service Area              7
 *  Profile Completeness      3
 */
export function computeMatchBreakdown(
  bid: BidForScoring,
  project: ProjectForScoring
): MatchBreakdown {
  const factors: MatchFactor[] = [];
  const highlights: string[] = [];

  // 1. License & Verification (max 25)
  const isFullyLicensed =
    !!bid.contractor?.license_verified && bid.contractor?.license_status === 'approved';
  const hasLicense = !!bid.contractor?.license_verified;
  const licenseEarned = isFullyLicensed ? 25 : hasLicense ? 10 : 0;
  factors.push({
    key: 'license',
    label: 'License & Verification',
    description: isFullyLicensed
      ? 'Fully licensed & verified'
      : hasLicense
      ? 'License pending review'
      : 'No license on file',
    earned: licenseEarned,
    max: 25,
    met: licenseEarned >= 15,
  });
  if (isFullyLicensed) highlights.push('Licensed & verified contractor');

  // 2. Professional Experience (max 20)
  const exp = bid.contractor?.years_experience ?? 0;
  const expEarned = exp >= 10 ? 20 : exp >= 5 ? 15 : exp >= 3 ? 10 : exp >= 1 ? 5 : 4;
  factors.push({
    key: 'experience',
    label: 'Professional Experience',
    description: exp > 0 ? `${exp} years in the industry` : 'Experience not specified',
    earned: expEarned,
    max: 20,
    met: expEarned >= 10,
  });
  if (expEarned >= 15) highlights.push(`${exp}+ years of proven experience`);

  // 3. Budget Alignment (max 20)
  const bMin = project.budget_min ?? 0;
  const bMax = project.budget_max ?? 0;
  const price = bid.total_price;
  let budgetEarned = 0;
  let budgetDesc = '';
  if (bMax > 0) {
    if (price >= bMin && price <= bMax) {
      budgetEarned = 20;
      budgetDesc = 'Bid fits perfectly in your budget range';
    } else if (price < bMin) {
      budgetEarned = 14;
      budgetDesc = 'Bid is under your minimum budget';
    } else if (price <= bMax * 1.1) {
      budgetEarned = 10;
      budgetDesc = 'Bid is slightly above budget (within 10%)';
    } else if (price <= bMax * 1.25) {
      budgetEarned = 5;
      budgetDesc = 'Bid exceeds budget by up to 25%';
    } else {
      budgetEarned = 0;
      budgetDesc = 'Bid significantly exceeds your budget';
    }
  } else {
    budgetEarned = 10;
    budgetDesc = 'No budget reference set';
  }
  factors.push({
    key: 'budget',
    label: 'Budget Alignment',
    description: budgetDesc,
    earned: budgetEarned,
    max: 20,
    met: budgetEarned >= 10,
  });
  if (budgetEarned >= 18) highlights.push('Bid perfectly aligned with your budget');
  else if (budgetEarned >= 10) highlights.push('Budget expectations are compatible');

  // 4. Proposal Quality (max 15)
  const milestones = bid.milestones?.length ?? 0;
  const hasDetailedMessage = (bid.message?.length ?? 0) > 150;
  let proposalEarned = milestones >= 4 ? 11 : milestones >= 3 ? 8 : milestones >= 2 ? 4 : 0;
  if (hasDetailedMessage) proposalEarned = Math.min(proposalEarned + 4, 15);
  factors.push({
    key: 'proposal',
    label: 'Proposal Quality',
    description: `${milestones} milestone${milestones !== 1 ? 's' : ''}${hasDetailedMessage ? ', with detailed message' : ''}`,
    earned: proposalEarned,
    max: 15,
    met: proposalEarned >= 8,
  });
  if (proposalEarned >= 11) highlights.push('Detailed, structured project proposal');

  // 5. Specialty Match (max 10)
  const { earned: specialtyEarned, matched: specialtyMatched } = specialtyMatchLevel(
    bid.contractor?.specialties,
    project.work_types,
    project.scan?.detected_room_type
  );
  factors.push({
    key: 'specialty',
    label: 'Specialty Match',
    description: specialtyMatched
      ? `Specializes in ${specialtyMatched}`
      : specialtyEarned > 0
      ? 'Has relevant specialties'
      : 'No specialty listed',
    earned: specialtyEarned,
    max: 10,
    met: specialtyEarned >= 8,
  });
  if (specialtyMatched) highlights.push(`Specializes in ${specialtyMatched}`);
  else if (specialtyEarned >= 8) highlights.push('Specialty aligns with your project');

  // 6. Service Area (max 7)
  const hasLocation = !!(
    bid.contractor?.service_latitude && bid.contractor?.service_longitude
  );
  const areaEarned = hasLocation ? 7 : 3;
  factors.push({
    key: 'area',
    label: 'Service Area',
    description: hasLocation ? 'Operates in your area' : 'Service area not specified',
    earned: areaEarned,
    max: 7,
    met: hasLocation,
  });
  if (hasLocation) highlights.push('Confirmed to service your area');

  // 7. Profile Completeness (max 3)
  const hasCompany = !!bid.contractor?.company_name;
  const hasBio = (bid.contractor?.bio?.length ?? 0) > 20;
  const profileEarned = (hasCompany ? 2 : 0) + (hasBio ? 1 : 0);
  factors.push({
    key: 'profile',
    label: 'Profile Completeness',
    description:
      hasCompany && hasBio
        ? 'Complete professional profile'
        : hasCompany
        ? 'Business name on file'
        : 'Profile partially filled',
    earned: profileEarned,
    max: 3,
    met: profileEarned >= 2,
  });
  if (hasCompany) highlights.push(`Operating as ${bid.contractor!.company_name}`);

  const score = Math.min(
    factors.reduce((sum, f) => sum + f.earned, 0),
    100
  );

  const tier =
    score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'low';

  // Scan-based context highlights (informational only — do not affect score)
  const scan = project.scan;
  if (scan) {
    if (scan.measured_area_sqft && scan.estimated_complexity) {
      const area = Math.round(scan.measured_area_sqft);
      const cLabel = scan.estimated_complexity;
      highlights.push(`Space scanned: ${area} sq ft, ${cLabel} complexity`);
    } else if (scan.measured_area_sqft) {
      highlights.push(`Space measured: ${Math.round(scan.measured_area_sqft)} sq ft`);
    } else if (scan.estimated_complexity) {
      highlights.push(`AI estimated complexity: ${scan.estimated_complexity}`);
    }
  }

  return { score, tier, factors, highlights: highlights.slice(0, 5) };
}
