/**
 * ScanSpaceModal
 *
 * Real-time photo capture + AI analysis flow for room measurement.
 *
 * DESIGN DECISIONS (honest about web limitations):
 * - True depth scanning (ARKit/ARCore) requires a native app.
 * - On web, we do the best possible: live camera capture → Claude Vision AI analysis.
 * - This is meaningfully smarter than upload — AI extracts measurements, features,
 *   complexity, and renovation notes from photos. It is NOT pretending to be native AR.
 *
 * FLOW: capture → processing → results → (confirm → onConfirm callback)
 * No intro gate — camera starts immediately to maximize perceived responsiveness.
 */

import { useState, useRef, useEffect } from 'react';
import {
  X, Camera, Upload, CheckCircle, AlertCircle,
  RefreshCw, Ruler, Zap, Eye, Edit3, ScanLine,
  ArrowRight, RotateCcw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RoomMeasurements {
  room_length_ft: number | null;
  room_width_ft: number | null;
  room_height_ft: number | null;
  measured_area_sqft: number | null;
  wall_area_sqft: number | null;
  window_count: number | null;
  door_count: number | null;
  room_count: number;
  detected_room_type: string | null;
  detected_features: string[];
  estimated_complexity: 'low' | 'medium' | 'high';
  scan_confidence: number;
  scan_summary: string;
  renovation_notes: string;
}

export interface ScanResult {
  measurements: RoomMeasurements;
  photo_urls: string[];
}

interface ScanSpaceModalProps {
  projectId: string;
  renovationType?: string;
  onConfirm: (result: ScanResult) => void;
  onClose: () => void;
}

type ModalStep = 'capture' | 'processing' | 'results' | 'manual';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(val: number | null, unit: string): string {
  return val !== null ? `${val.toFixed(unit === 'sqft' ? 0 : 1)} ${unit === 'sqft' ? 'sq ft' : 'ft'}` : '—';
}

const COMPLEXITY_STYLE: Record<string, string> = {
  low:    'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  high:   'bg-red-100 text-red-700 border-red-200',
};

const FEATURE_LABELS: Record<string, string> = {
  hardwood_floor: 'Hardwood floors', tile_floor: 'Tile floors', carpet: 'Carpet',
  popcorn_ceiling: 'Popcorn ceiling', crown_molding: 'Crown molding',
  recessed_lighting: 'Recessed lighting', exposed_brick: 'Exposed brick',
  built_in_cabinets: 'Built-in cabinets', fireplace: 'Fireplace',
  skylight: 'Skylight', tile_backsplash: 'Tile backsplash',
  bay_window: 'Bay window', vaulted_ceiling: 'Vaulted ceiling',
};

const SHOT_GUIDES = [
  'Stand in the doorway — capture the full room',
  'Move to a corner — show two walls',
  'Aim at the ceiling to show height',
  'Include furniture or a door for scale',
  'Capture any special features (fireplace, bay window…)',
];

// ─── Component ─────────────────────────────────────────────────────────────────

export function ScanSpaceModal({ projectId, renovationType, onConfirm, onClose }: ScanSpaceModalProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState<ModalStep>('capture');
  const [capturedPhotos, setCapturedPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [scanResult, setScanResult] = useState<RoomMeasurements | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraState, setCameraState] = useState<'starting' | 'active' | 'denied' | 'unavailable'>('starting');
  const [isSaving, setIsSaving] = useState(false);
  const [processingStage, setProcessingStage] = useState(0);
  const [manual, setManual] = useState({ length: '', width: '', height: '', windows: '', doors: '' });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-start camera when modal opens
  useEffect(() => {
    startCamera();
    return () => stopStream();
  }, []);

  // Animate processing stages
  useEffect(() => {
    if (step !== 'processing') return;
    const stages = [0, 800, 2200, 4000];
    const timers = stages.map((delay, i) =>
      setTimeout(() => setProcessingStage(i), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [step]);

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsCameraActive(false);
  }

  async function startCamera() {
    setCameraState('starting');

    // Try rear camera first (mobile), fall back to any camera (desktop)
    const constraints: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
      { video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
    ];

    for (const constraint of constraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraint);
        streamRef.current = stream;
        // Wait one tick for React to render the video element
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        }, 50);
        setIsCameraActive(true);
        setCameraState('active');
        return;
      } catch {
        continue;
      }
    }

    // Check if it was a permissions denial vs no camera
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(d => d.kind === 'videoinput');
      setCameraState(hasCamera ? 'denied' : 'unavailable');
    } catch {
      setCameraState('unavailable');
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      addPhoto(new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  }

  function addPhoto(file: File) {
    setPreviewUrls(prev => [...prev, URL.createObjectURL(file)]);
    setCapturedPhotos(prev => [...prev, file]);
  }

  function removePhoto(i: number) {
    URL.revokeObjectURL(previewUrls[i]);
    setPreviewUrls(prev => prev.filter((_, idx) => idx !== i));
    setCapturedPhotos(prev => prev.filter((_, idx) => idx !== i));
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach(addPhoto);
    e.target.value = '';
  }

  async function uploadPhotos(): Promise<string[]> {
    const urls: string[] = [];
    for (const file of capturedPhotos) {
      const path = `${profile?.id}/${projectId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('scan-photos').upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      urls.push(supabase.storage.from('scan-photos').getPublicUrl(path).data.publicUrl);
    }
    return urls;
  }

  async function runAnalysis() {
    setStep('processing');
    setProcessingStage(0);
    setErrorMsg('');
    stopStream();

    try {
      const publicUrls = await uploadPhotos();
      setUploadedUrls(publicUrls);

      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-room-scan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.session?.access_token}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            photo_urls: publicUrls,
            room_type_hint: renovationType ?? undefined,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Analysis failed (${res.status})`);
      }

      const result = await res.json();
      setScanResult(result.measurements);

      await supabase.from('project_scans').upsert({
        project_id: projectId,
        owner_id: profile?.id,
        scan_status: 'completed',
        scan_source: 'photo_ai',
        photo_urls: publicUrls,
        ai_analysis_payload: result.ai_analysis_payload,
        is_confirmed: false,
        ...result.measurements,
        room_count: result.measurements.room_count ?? 1,
        detected_features: result.measurements.detected_features ?? [],
      }, { onConflict: 'project_id' });

      setStep('results');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error — please try again');
      setStep('capture');
      startCamera();
    }
  }

  async function confirmResults() {
    if (!scanResult) return;
    setIsSaving(true);
    try {
      await supabase.from('project_scans').update({
        is_confirmed: true,
        confirmed_at: new Date().toISOString(),
      }).eq('project_id', projectId);
      onConfirm({ measurements: scanResult, photo_urls: uploadedUrls });
    } finally {
      setIsSaving(false);
    }
  }

  async function saveManual() {
    setIsSaving(true);
    const l = parseFloat(manual.length) || null;
    const w = parseFloat(manual.width) || null;
    const h = parseFloat(manual.height) || null;
    const area = l && w ? parseFloat((l * w).toFixed(2)) : null;
    const wallArea = l && w && h ? parseFloat((2 * (l + w) * h).toFixed(2)) : null;
    const m: RoomMeasurements = {
      room_length_ft: l, room_width_ft: w, room_height_ft: h,
      measured_area_sqft: area, wall_area_sqft: wallArea,
      window_count: parseInt(manual.windows) || null,
      door_count: parseInt(manual.doors) || null,
      room_count: 1,
      detected_room_type: renovationType?.toLowerCase() ?? null,
      detected_features: [], estimated_complexity: 'medium',
      scan_confidence: 100,
      scan_summary: 'Measurements entered manually by owner.',
      renovation_notes: '',
    };
    try {
      await supabase.from('project_scans').upsert({
        project_id: projectId, owner_id: profile?.id,
        scan_status: 'manual', scan_source: 'manual',
        is_confirmed: true, confirmed_at: new Date().toISOString(),
        ...m, room_count: 1, detected_features: [],
      }, { onConflict: 'project_id' });
      onConfirm({ measurements: m, photo_urls: [] });
    } finally {
      setIsSaving(false);
    }
  }

  const shotGuide = SHOT_GUIDES[Math.min(capturedPhotos.length, SHOT_GUIDES.length - 1)];
  const canAnalyze = capturedPhotos.length >= 1;
  const idealCount = capturedPhotos.length >= 3;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-xl max-h-[96vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <ScanLine className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">AI Space Scan</h2>
              <p className="text-xs text-gray-400">
                {step === 'capture'   && `${capturedPhotos.length} photo${capturedPhotos.length !== 1 ? 's' : ''} captured`}
                {step === 'processing' && 'Analyzing…'}
                {step === 'results'   && 'Scan complete'}
                {step === 'manual'    && 'Manual entry'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">

          {/* ── CAPTURE ──────────────────────────────────────────────────── */}
          {step === 'capture' && (
            <div className="flex flex-col">

              {/* Camera / scan zone */}
              <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
                {cameraState === 'active' ? (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline muted autoPlay
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Scan overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Corner brackets */}
                      {[
                        'top-6 left-6 border-t-2 border-l-2',
                        'top-6 right-6 border-t-2 border-r-2',
                        'bottom-6 left-6 border-b-2 border-l-2',
                        'bottom-6 right-6 border-b-2 border-r-2',
                      ].map((cls, i) => (
                        <div key={i} className={`absolute w-7 h-7 border-white/80 rounded-sm ${cls}`} />
                      ))}

                      {/* Scan line animation */}
                      <div className="absolute inset-x-6 top-1/2 h-px bg-blue-400/60 animate-pulse" />

                      {/* Shot guide */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-20 pt-8">
                        <p className="text-white text-sm text-center font-medium drop-shadow">
                          {shotGuide}
                        </p>
                      </div>

                      {/* Photo count indicator */}
                      {capturedPhotos.length > 0 && (
                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-full">
                          {capturedPhotos.length} / 5
                        </div>
                      )}
                    </div>

                    {/* Shutter button */}
                    <button
                      onClick={capturePhoto}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-gray-300 shadow-xl hover:scale-105 active:scale-95 transition-transform z-10"
                      aria-label="Capture photo"
                    />

                    {/* Flip camera (stop + restart) */}
                    <button
                      onClick={() => { stopStream(); startCamera(); }}
                      className="absolute bottom-6 right-6 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center z-10"
                    >
                      <RotateCcw className="w-4 h-4 text-white" />
                    </button>
                  </>
                ) : cameraState === 'starting' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-white/70 text-sm">Starting camera…</p>
                  </div>
                ) : (
                  /* Camera denied/unavailable — make upload feel like scanning */
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                      <Camera className="w-7 h-7 text-white/60" />
                    </div>
                    <div>
                      <p className="text-white font-semibold mb-1">
                        {cameraState === 'denied' ? 'Camera access blocked' : 'No camera detected'}
                      </p>
                      <p className="text-white/60 text-sm">
                        {cameraState === 'denied'
                          ? 'Allow camera in your browser settings, or upload photos below'
                          : 'Upload 2–5 photos of your space to use AI measurement'}
                      </p>
                    </div>
                    {cameraState === 'denied' && (
                      <button
                        onClick={startCamera}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg"
                      >
                        Retry Camera
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Controls row */}
              <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100">
                <label className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  Upload photos
                  <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileInput} className="hidden" />
                </label>

                <button
                  onClick={() => { stopStream(); setStep('manual'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Enter manually
                </button>

                <div className="ml-auto flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${idealCount ? 'bg-green-500' : capturedPhotos.length > 0 ? 'bg-amber-400' : 'bg-gray-300'}`} />
                  <span className="text-xs text-gray-500">
                    {capturedPhotos.length === 0 ? 'Need 1+ photos' : idealCount ? 'Good coverage' : 'Add more for accuracy'}
                  </span>
                </div>
              </div>

              {/* Error */}
              {errorMsg && (
                <div className="mx-4 mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {errorMsg}
                </div>
              )}

              {/* Photo thumbnails */}
              {previewUrls.length > 0 && (
                <div className="px-4 pt-3 pb-1 flex gap-2 flex-wrap">
                  {previewUrls.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-gray-200 flex-shrink-0">
                      <img src={url} className="w-full h-full object-cover" alt="" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                  {capturedPhotos.length < 5 && cameraState === 'active' && (
                    <button
                      onClick={capturePhoto}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-blue-300 flex items-center justify-center text-blue-500 flex-shrink-0 hover:bg-blue-50 transition-colors"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}

              {/* Analyze button */}
              <div className="p-4">
                <button
                  onClick={runAnalysis}
                  disabled={!canAnalyze}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Zap className="w-4 h-4" />
                  Analyze Space — Get AI Measurements
                  <ArrowRight className="w-4 h-4" />
                </button>
                {!canAnalyze && (
                  <p className="text-center text-xs text-gray-400 mt-2">
                    Capture or upload at least 1 photo to continue
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── PROCESSING ─────────────────────────────────────────────── */}
          {step === 'processing' && (
            <div className="p-10 flex flex-col items-center text-center gap-6">
              {/* Animated scan icon */}
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
                <div className="absolute inset-0 border-4 border-t-blue-600 rounded-full animate-spin" />
                <div className="absolute inset-3 bg-blue-50 rounded-full flex items-center justify-center">
                  <ScanLine className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div>
                <p className="text-xl font-bold text-gray-900 mb-1">Scanning your space…</p>
                <p className="text-sm text-gray-500">Claude AI is analyzing your photos</p>
              </div>

              {/* Stage pipeline */}
              <div className="w-full max-w-xs space-y-2">
                {[
                  'Uploading photos',
                  'Detecting room geometry',
                  'Measuring dimensions',
                  'Identifying features & materials',
                ].map((label, i) => (
                  <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${processingStage >= i ? 'opacity-100' : 'opacity-30'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      processingStage > i ? 'bg-green-500' : processingStage === i ? 'bg-blue-600 animate-pulse' : 'bg-gray-200'
                    }`}>
                      {processingStage > i
                        ? <CheckCircle className="w-3 h-3 text-white" />
                        : <div className="w-2 h-2 bg-white rounded-full" />
                      }
                    </div>
                    <span className={`text-sm ${processingStage >= i ? 'text-gray-800' : 'text-gray-400'}`}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RESULTS ────────────────────────────────────────────────── */}
          {step === 'results' && scanResult && (
            <div className="p-5 space-y-4">
              {/* Hero result */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide mb-0.5">AI Scan Complete</p>
                    <p className="text-xl font-bold capitalize">
                      {scanResult.detected_room_type?.replace(/_/g, ' ') ?? renovationType ?? 'Your space'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-200 text-xs mb-1">Confidence</p>
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 h-1.5 bg-white/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full"
                          style={{ width: `${scanResult.scan_confidence}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold">{scanResult.scan_confidence}%</span>
                    </div>
                  </div>
                </div>

                {/* Key numbers */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Floor area', value: fmt(scanResult.measured_area_sqft, 'sqft') },
                    { label: 'Dimensions', value: scanResult.room_length_ft && scanResult.room_width_ft ? `${scanResult.room_length_ft.toFixed(0)}×${scanResult.room_width_ft.toFixed(0)} ft` : '—' },
                    { label: 'Ceiling', value: fmt(scanResult.room_height_ft, 'ft') },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/10 rounded-xl p-2.5 text-center">
                      <p className="text-white/70 text-xs">{label}</p>
                      <p className="text-white font-bold text-sm mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI summary */}
              {scanResult.scan_summary && (
                <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
                  <Eye className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-900">{scanResult.scan_summary}</p>
                </div>
              )}

              {/* Complexity + extra measurements */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Wall area', value: fmt(scanResult.wall_area_sqft, 'sqft') },
                  { label: 'Windows', value: scanResult.window_count?.toString() ?? '—' },
                  { label: 'Doors', value: scanResult.door_count?.toString() ?? '—' },
                  {
                    label: 'Complexity',
                    value: scanResult.estimated_complexity,
                    extra: `capitalize px-2 py-0.5 text-xs font-semibold rounded-full border ${COMPLEXITY_STYLE[scanResult.estimated_complexity]}`,
                  },
                ].map(({ label, value, extra }) => (
                  <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                    <p className="text-xs text-gray-400">{label}</p>
                    {extra
                      ? <span className={`inline-block mt-1 ${extra}`}>{value}</span>
                      : <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
                    }
                  </div>
                ))}
              </div>

              {/* Detected features */}
              {scanResult.detected_features?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Detected Features</p>
                  <div className="flex flex-wrap gap-1.5">
                    {scanResult.detected_features.map(f => (
                      <span key={f} className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                        {FEATURE_LABELS[f] ?? f.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Renovation notes */}
              {scanResult.renovation_notes && (
                <div className="flex items-start gap-2 p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
                  <Zap className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800 mb-0.5">Contractor Notes</p>
                    <p className="text-sm text-amber-900">{scanResult.renovation_notes}</p>
                  </div>
                </div>
              )}

              {/* Low confidence warning */}
              {scanResult.scan_confidence < 45 && (
                <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-600">
                    Confidence is low ({scanResult.scan_confidence}%). Consider adding more photos or correcting measurements manually before confirming.
                  </p>
                </div>
              )}

              {/* Photos used */}
              {previewUrls.length > 0 && (
                <div className="flex gap-1.5">
                  {previewUrls.slice(0, 5).map((url, i) => (
                    <img key={i} src={url} className="w-12 h-12 rounded-lg object-cover border border-gray-200 flex-shrink-0" alt="" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MANUAL ─────────────────────────────────────────────────── */}
          {step === 'manual' && (
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <Ruler className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-900">
                  All fields are optional. Even partial measurements help contractors give you accurate bids.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Length (ft)', key: 'length', ph: '14' },
                  { label: 'Width (ft)', key: 'width', ph: '12' },
                  { label: 'Ceiling height (ft)', key: 'height', ph: '9' },
                  { label: 'Windows', key: 'windows', ph: '2' },
                  { label: 'Doors', key: 'doors', ph: '1' },
                ].map(({ label, key, ph }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input
                      type="number" min="0" placeholder={ph}
                      value={manual[key as keyof typeof manual]}
                      onChange={e => setManual(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                    />
                  </div>
                ))}
              </div>

              {manual.length && manual.width && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-xs text-gray-500">Calculated area</p>
                  <p className="text-lg font-bold text-gray-900">{(parseFloat(manual.length) * parseFloat(manual.width)).toFixed(0)} sq ft</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 flex-shrink-0 flex gap-3">
          {step === 'results' && (
            <>
              <button
                onClick={() => { setStep('capture'); setScanResult(null); setPreviewUrls([]); setCapturedPhotos([]); startCamera(); }}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                <RefreshCw className="w-4 h-4" /> Rescan
              </button>
              <button
                onClick={confirmResults}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {isSaving ? 'Saving…' : 'Use These Measurements'}
              </button>
            </>
          )}
          {step === 'manual' && (
            <>
              <button onClick={() => { setStep('capture'); startCamera(); }} className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">
                Back
              </button>
              <button
                onClick={saveManual}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {isSaving ? 'Saving…' : 'Save Measurements'}
              </button>
            </>
          )}
          {step === 'capture' && null /* action inside the step */}
          {step === 'processing' && null /* no action during analysis */}
        </div>
      </div>
    </div>
  );
}
