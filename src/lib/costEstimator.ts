/**
 * Deterministic cost estimator.
 *
 * All rules are documented inline. Replace individual rule sets with
 * ML model outputs when enough project-completion data is available.
 *
 * Design goals:
 *  - Fully deterministic for the same inputs
 *  - Gracefully degrades when scan data is incomplete
 *  - Returns a clear `basis` string explaining what drove the estimate
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SuggestedMilestone {
  description: string;
  pct: number;          // percentage of total cost
  duration_days: number;
}

export interface CostEstimate {
  estimated_min: number;
  estimated_max: number;
  complexity_score: number;   // 1–10
  estimated_duration_days: number;
  suggested_milestones: SuggestedMilestone[];
  basis: string;              // human-readable explanation
  has_scan_data: boolean;
  confidence: 'high' | 'medium' | 'low' | 'fallback';
}

export interface ScanInputs {
  measured_area_sqft?: number | null;
  wall_area_sqft?: number | null;
  room_height_ft?: number | null;
  detected_room_type?: string | null;
  estimated_complexity?: 'low' | 'medium' | 'high' | null;
  detected_features?: string[];
  scan_confidence?: number;
}

export interface ProjectInputs {
  work_types?: string[];
  budget_min?: number;
  budget_max?: number;
}

// ─── Base cost rates (USD per sq ft, [min, max]) ───────────────────────────────
// Sources: Remodeling Magazine Cost vs Value report (national average)

const BASE_RATE_BY_ROOM: Record<string, [number, number]> = {
  kitchen:       [120, 280],
  bathroom:      [150, 350],
  bedroom:       [25,   75],
  living_room:   [30,   90],
  living:        [30,   90],
  basement:      [25,   70],
  exterior:      [15,   50],
  office:        [30,   80],
  dining_room:   [30,   80],
  laundry:       [40,  100],
  garage:        [20,   60],
  default:       [35,   90],
};

// ─── Base rate by work type (fallback when no scan room type) ─────────────────

const BASE_RATE_BY_WORK: Record<string, [number, number]> = {
  Kitchen:     [120, 280],
  Bathroom:    [150, 350],
  Bedroom:     [ 25,  75],
  'Living Room': [30, 90],
  Flooring:    [ 10,  25],   // per sqft — floor only
  Painting:    [  3,   8],   // per sqft — walls
  Roofing:     [ 12,  30],   // per sqft — roof area
  Basement:    [ 25,  70],
  Exterior:    [ 15,  50],
  'Full House': [35, 100],
  default:     [ 35,  90],
};

// ─── Complexity multiplier ─────────────────────────────────────────────────────

const COMPLEXITY_MULT: Record<'low' | 'medium' | 'high', [number, number]> = {
  low:    [0.70, 0.85],
  medium: [0.95, 1.15],
  high:   [1.30, 1.60],
};

// Complexity → numeric score (1–10)
const COMPLEXITY_SCORE: Record<'low' | 'medium' | 'high', number> = {
  low: 3, medium: 6, high: 9,
};

// ─── Feature add-ons (USD, flat per item) ─────────────────────────────────────

const FEATURE_ADDONS: Record<string, number> = {
  built_in_cabinets:  6_000,
  fireplace:          3_500,
  skylight:           2_500,
  vaulted_ceiling:    4_000,
  exposed_brick:      1_500,
  popcorn_ceiling:    1_200,   // removal
  bay_window:         3_000,
  crown_molding:        800,   // typical room perimeter
  tile_backsplash:    1_200,
  recessed_lighting:  1_500,
};

// ─── Duration rules (days) ────────────────────────────────────────────────────

// base: 1 day per 40 sqft, minimum 3 days
function baseDurationDays(areaSqft: number): number {
  return Math.max(3, Math.round(areaSqft / 40));
}

const DURATION_MULT: Record<'low' | 'medium' | 'high', number> = {
  low: 0.7, medium: 1.0, high: 1.5,
};

// ─── Milestone templates ───────────────────────────────────────────────────────

function buildMilestones(
  roomType: string,
  complexity: 'low' | 'medium' | 'high',
  totalDays: number
): SuggestedMilestone[] {
  const simple: SuggestedMilestone[] = [
    { description: 'Site preparation & material procurement', pct: 15, duration_days: Math.max(1, Math.round(totalDays * 0.15)) },
    { description: 'Core renovation work',                   pct: 65, duration_days: Math.max(2, Math.round(totalDays * 0.60)) },
    { description: 'Finishing, cleanup & final inspection',   pct: 20, duration_days: Math.max(1, Math.round(totalDays * 0.25)) },
  ];

  const detailed: SuggestedMilestone[] = [
    { description: 'Demolition & site preparation',            pct: 10, duration_days: Math.max(1, Math.round(totalDays * 0.12)) },
    { description: 'Rough work (structural / plumbing / electrical)', pct: 25, duration_days: Math.max(2, Math.round(totalDays * 0.25)) },
    { description: 'Core renovation & installation',           pct: 40, duration_days: Math.max(2, Math.round(totalDays * 0.35)) },
    { description: 'Finishing & fixtures',                     pct: 15, duration_days: Math.max(1, Math.round(totalDays * 0.18)) },
    { description: 'Final inspection, punch list & cleanup',   pct: 10, duration_days: Math.max(1, Math.round(totalDays * 0.10)) },
  ];

  const kitchenBath: SuggestedMilestone[] = [
    { description: 'Demolition & removal of existing fixtures', pct: 10, duration_days: Math.max(1, Math.round(totalDays * 0.10)) },
    { description: 'Rough plumbing & electrical',               pct: 20, duration_days: Math.max(2, Math.round(totalDays * 0.20)) },
    { description: 'Framing, drywall & waterproofing',          pct: 15, duration_days: Math.max(1, Math.round(totalDays * 0.15)) },
    { description: 'Cabinetry, tile & main installations',      pct: 35, duration_days: Math.max(3, Math.round(totalDays * 0.35)) },
    { description: 'Fixtures, trim, paint & final inspection',  pct: 20, duration_days: Math.max(1, Math.round(totalDays * 0.20)) },
  ];

  const type = roomType.toLowerCase();
  if (type === 'kitchen' || type === 'bathroom') return kitchenBath;
  if (complexity === 'high') return detailed;
  return simple;
}

// ─── Main estimator ───────────────────────────────────────────────────────────

export function estimateCost(
  scan: ScanInputs,
  project: ProjectInputs
): CostEstimate {
  // 1. Determine room type
  const roomTypeRaw = scan.detected_room_type ?? project.work_types?.[0] ?? '';
  const roomTypeKey = roomTypeRaw.toLowerCase().replace(/\s+/g, '_');

  // 2. Determine area
  const areaSqft = scan.measured_area_sqft;
  const hasScan = !!(areaSqft && areaSqft > 0);

  // 3. Base rate
  const roomRate = BASE_RATE_BY_ROOM[roomTypeKey]
    ?? BASE_RATE_BY_ROOM[roomTypeRaw.toLowerCase()]
    ?? BASE_RATE_BY_WORK[project.work_types?.[0] ?? '']
    ?? BASE_RATE_BY_ROOM.default;

  // 4. Complexity
  const complexity: 'low' | 'medium' | 'high' = scan.estimated_complexity ?? 'medium';
  const [cmMin, cmMax] = COMPLEXITY_MULT[complexity];

  // 5. Feature add-ons
  let featureAddon = 0;
  const features = scan.detected_features ?? [];
  for (const f of features) {
    featureAddon += FEATURE_ADDONS[f] ?? 0;
  }

  // 6. Compute cost range
  let rawMin: number;
  let rawMax: number;
  let basisParts: string[] = [];
  let confidence: CostEstimate['confidence'];

  if (hasScan && areaSqft) {
    rawMin = areaSqft * roomRate[0] * cmMin + featureAddon * 0.8;
    rawMax = areaSqft * roomRate[1] * cmMax + featureAddon * 1.2;

    const scanConf = scan.scan_confidence ?? 50;
    confidence = scanConf >= 70 ? 'high' : scanConf >= 40 ? 'medium' : 'low';
    basisParts = [
      `${areaSqft.toFixed(0)} sq ft ${roomTypeRaw || 'room'}`,
      `${complexity} complexity`,
      ...(features.length > 0 ? [`${features.length} detected feature${features.length !== 1 ? 's' : ''}`] : []),
    ];
  } else {
    // Fallback: use project budget or work-type default area assumption (200 sqft)
    const assumedArea = 200;
    rawMin = assumedArea * roomRate[0] * cmMin;
    rawMax = assumedArea * roomRate[1] * cmMax;
    confidence = 'fallback';
    basisParts = [
      `No scan data — assumed ${assumedArea} sq ft ${roomTypeRaw || 'room'}`,
      `${complexity} complexity`,
    ];
  }

  // Round to nearest $500
  const estimated_min = Math.round(rawMin / 500) * 500;
  const estimated_max = Math.round(rawMax / 500) * 500;

  // 7. Duration
  const effectiveArea = areaSqft ?? 200;
  const baseDays = baseDurationDays(effectiveArea);
  const estimated_duration_days = Math.round(baseDays * DURATION_MULT[complexity]);

  // 8. Milestones
  const suggested_milestones = buildMilestones(
    roomTypeRaw,
    complexity,
    estimated_duration_days
  );

  return {
    estimated_min,
    estimated_max,
    complexity_score: COMPLEXITY_SCORE[complexity],
    estimated_duration_days,
    suggested_milestones,
    basis: basisParts.join(' · '),
    has_scan_data: hasScan,
    confidence,
  };
}

// ─── Bid deviation check ──────────────────────────────────────────────────────

export type BidDeviationLevel = 'on_target' | 'slightly_off' | 'significantly_off';

export interface BidDeviation {
  level: BidDeviationLevel;
  pct: number;    // percentage above/below midpoint (negative = below)
  message: string;
}

export function checkBidDeviation(
  bidAmount: number,
  estimate: CostEstimate
): BidDeviation {
  const mid = (estimate.estimated_min + estimate.estimated_max) / 2;
  const pct = Math.round(((bidAmount - mid) / mid) * 100);
  const absPct = Math.abs(pct);

  if (absPct <= 20) {
    return { level: 'on_target', pct, message: 'Within the AI-estimated range' };
  } else if (absPct <= 45) {
    const dir = pct > 0 ? 'above' : 'below';
    return {
      level: 'slightly_off',
      pct,
      message: `${absPct}% ${dir} AI estimate — consider reviewing your pricing`,
    };
  } else {
    const dir = pct > 0 ? 'above' : 'below';
    return {
      level: 'significantly_off',
      pct,
      message: `${absPct}% ${dir} AI estimate — ensure your bid reflects actual scope`,
    };
  }
}
