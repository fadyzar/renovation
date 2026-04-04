/**
 * ScanDataPanel
 *
 * Reusable component that renders project scan data for:
 *  - Owner project view (after scan is confirmed)
 *  - Contractor project view (ProjectDetails, BidBuilder)
 *
 * Two usage modes:
 *  1. Pass `projectId` — fetches scan from DB automatically
 *  2. Pass `scan` directly — uses provided data (no DB fetch)
 *
 * Gracefully handles:
 *  - No scan existing → returns null (renders nothing)
 *  - Low confidence → shows warning banner
 *  - Partial scan data → shows only available fields
 */

import { useState, useEffect } from 'react';
import { Ruler, AlertCircle, Eye, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ScanData {
  scan_status: string;
  scan_source: string;
  scan_confidence: number | null;
  room_length_ft: number | null;
  room_width_ft: number | null;
  room_height_ft: number | null;
  measured_area_sqft: number | null;
  wall_area_sqft: number | null;
  window_count: number | null;
  door_count: number | null;
  room_count: number | null;
  detected_room_type: string | null;
  detected_features: string[] | null;
  estimated_complexity: 'low' | 'medium' | 'high' | null;
  scan_summary: string | null;
  renovation_notes: string | null;
  is_confirmed: boolean;
}

interface ScanDataPanelProps {
  /** Pass projectId for auto-fetch, or pass scan directly */
  projectId?: string;
  /** Pre-loaded scan data (skips DB fetch) */
  scan?: ScanData | null;
  /** Visual variant */
  variant?: 'card' | 'inline';
  /** Whether to show full detail or a summary (default: summary) */
  expanded?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const COMPLEXITY_STYLE = {
  low:    'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  high:   'bg-red-100 text-red-800',
};

const FEATURE_LABELS: Record<string, string> = {
  hardwood_floor:   'Hardwood floors',
  tile_floor:       'Tile floors',
  carpet:           'Carpet',
  popcorn_ceiling:  'Popcorn ceiling',
  crown_molding:    'Crown molding',
  recessed_lighting:'Recessed lighting',
  exposed_brick:    'Exposed brick',
  built_in_cabinets:'Built-in cabinets',
  fireplace:        'Fireplace',
  skylight:         'Skylight',
  tile_backsplash:  'Tile backsplash',
  bay_window:       'Bay window',
  vaulted_ceiling:  'Vaulted ceiling',
};

function fmtFt(v: number | null): string {
  return v !== null ? `${v.toFixed(1)} ft` : '—';
}
function fmtSqft(v: number | null): string {
  return v !== null ? `${v.toFixed(0)} sq ft` : '—';
}
function fmtCount(v: number | null): string {
  return v !== null ? String(v) : '—';
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ScanDataPanel({
  projectId,
  scan: scanProp,
  variant = 'card',
  expanded: expandedProp = false,
}: ScanDataPanelProps) {
  const [scan, setScan] = useState<ScanData | null>(scanProp ?? null);
  const [loading, setLoading] = useState(!scanProp && !!projectId);
  const [expanded, setExpanded] = useState(expandedProp);

  useEffect(() => {
    if (scanProp !== undefined) {
      setScan(scanProp);
      return;
    }
    if (!projectId) return;

    supabase
      .from('project_images')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle()
      .then(({ data }) => {
        setScan(data ?? null);
        setLoading(false);
      });
  }, [projectId, scanProp]);

  if (loading) return null;
  if (!scan) return null;

  const confidence = scan.scan_confidence ?? 0;
  const isLowConfidence = confidence > 0 && confidence < 45;
  const hasArea = scan.measured_area_sqft !== null;
  const features = scan.detected_features ?? [];

  const wrapperClass = variant === 'card'
    ? 'bg-white border border-gray-200 rounded-xl overflow-hidden'
    : 'border border-blue-100 rounded-xl bg-blue-50/40 overflow-hidden';

  return (
    <div className={wrapperClass}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Ruler className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Space Scan
              {scan.detected_room_type && (
                <span className="text-gray-500 font-normal ml-1.5 capitalize">
                  · {scan.detected_room_type.replace(/_/g, ' ')}
                </span>
              )}
            </p>
            {hasArea && (
              <p className="text-xs text-gray-500">{fmtSqft(scan.measured_area_sqft)} floor area</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Confidence pill */}
          {confidence > 0 && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              confidence >= 70 ? 'bg-green-100 text-green-700' :
              confidence >= 40 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-600'
            }`}>
              {confidence}% conf.
            </span>
          )}
          {scan.estimated_complexity && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${COMPLEXITY_STYLE[scan.estimated_complexity]}`}>
              {scan.estimated_complexity}
            </span>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">
          {/* Low confidence warning */}
          {isLowConfidence && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800">Low scan confidence ({confidence}%)</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Photo quality or lighting may have limited accuracy. Treat these as approximate estimates.
                </p>
              </div>
            </div>
          )}

          {/* AI summary */}
          {scan.scan_summary && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <Eye className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900">{scan.scan_summary}</p>
            </div>
          )}

          {/* Measurements grid */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Measurements
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Length',     value: fmtFt(scan.room_length_ft) },
                { label: 'Width',      value: fmtFt(scan.room_width_ft) },
                { label: 'Height',     value: fmtFt(scan.room_height_ft) },
                { label: 'Floor area', value: fmtSqft(scan.measured_area_sqft) },
                { label: 'Wall area',  value: fmtSqft(scan.wall_area_sqft) },
                { label: 'Windows',    value: fmtCount(scan.window_count) },
                { label: 'Doors',      value: fmtCount(scan.door_count) },
                { label: 'Rooms',      value: fmtCount(scan.room_count) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg px-2.5 py-2 border border-gray-100">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${value === '—' ? 'text-gray-300' : 'text-gray-900'}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Detected features */}
          {features.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Detected Features
              </p>
              <div className="flex flex-wrap gap-1.5">
                {features.map(f => (
                  <span key={f} className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                    {FEATURE_LABELS[f] ?? f.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Renovation notes */}
          {scan.renovation_notes && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <div className="flex items-start gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800 mb-0.5">Renovation Notes</p>
                  <p className="text-xs text-amber-900">{scan.renovation_notes}</p>
                </div>
              </div>
            </div>
          )}

          {/* Source tag */}
          <p className="text-xs text-gray-400">
            Source: {scan.scan_source === 'manual' ? 'Owner manual entry' : scan.scan_source === 'photo_ai' ? 'AI photo analysis' : scan.scan_source}
            {scan.is_confirmed && ' · Confirmed by owner'}
          </p>
        </div>
      )}
    </div>
  );
}
