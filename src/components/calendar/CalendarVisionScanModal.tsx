import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Drawer } from '../ui/Drawer';
import {
  Camera,
  Upload,
  Check,
  Loader2,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  FileText,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../../lib/api';
import { compressImageFile } from '../../lib/imageCompression';
import type { User, ScannedCalendarEvent } from '../../types';

export interface RecognizedCalendarItem extends ScannedCalendarEvent {
  id: string;
  selected: boolean;
  assignedMemberId: string;
}

interface CalendarVisionScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventsAdded: () => void;
  users: User[];
  householdId: string;
}

export const CalendarVisionScanModal: React.FC<CalendarVisionScanModalProps> = ({
  isOpen,
  onClose,
  onEventsAdded,
  users,
  householdId,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recognizedEvents, setRecognizedEvents] = useState<RecognizedCalendarItem[]>([]);
  const [shotsCount, setShotsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const stopLiveCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLiveCameraActive(false);
    setCameraLoading(false);
  }, []);

  const startLiveCamera = useCallback(async () => {
    setCameraError(null);
    setCameraLoading(true);
    setIsLiveCameraActive(true);

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn('Video play error:', e);
        }
      }
      setCameraLoading(false);
    } catch (err: any) {
      console.warn('Live camera error:', err);
      setCameraError('Live camera could not be opened automatically. You can use the Native Camera button or pick an image from gallery.');
      setIsLiveCameraActive(false);
      setCameraLoading(false);
    }
  }, []);

  // Directly open live camera whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setImagePreview(null);
      setRecognizedEvents([]);
      setShotsCount(0);
      setError(null);
      startLiveCamera();
    } else {
      stopLiveCamera();
    }
  }, [isOpen, startLiveCamera, stopLiveCamera]);

  const snapLivePhoto = () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    stopLiveCamera();
    setImagePreview(base64);
    processImage(base64, 'image/jpeg');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      stopLiveCamera();
      const res = await compressImageFile(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.85 });
      setImagePreview(res.dataUrl);
      processImage(res.dataUrl, res.mimeType);
    } catch (err: any) {
      console.error('Vision scan image processing failed:', err);
      setError(err?.message || 'Could not process this image. Please try another.');
    } finally {
      e.target.value = '';
    }
  };

  const processImage = async (base64: string, type: string) => {
    setIsScanning(true);
    setError(null);
    try {
      const res = await api.scanCalendarVision(base64, type);
      if (res.events && res.events.length > 0) {
        setShotsCount((c) => c + 1);

        const mappedEvents: RecognizedCalendarItem[] = res.events.map((ev, idx) => ({
          id: `ev_rec_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          selected: true,
          title: ev.title || 'Scanned Event',
          date: ev.date || new Date().toISOString().split('T')[0],
          startTime: ev.startTime || '',
          endTime: ev.endTime || '',
          isAllDay: Boolean(ev.isAllDay) || !ev.startTime,
          location: ev.location || '',
          description: ev.description || '',
          assignedMemberId: '',
        }));

        // Append to existing recognized events for multi-shot batch mode
        setRecognizedEvents((prev) => {
          // Deduplicate if identical title and date already present
          const existingKeys = new Set(prev.map((e) => `${e.title.toLowerCase().trim()}_${e.date}`));
          const novel = mappedEvents.filter((e) => !existingKeys.has(`${e.title.toLowerCase().trim()}_${e.date}`));
          return [...prev, ...novel];
        });
      } else {
        setError('No calendar events or schedules were detected in this shot. Try taking a closer, well-lit photo of the flyer or schedule!');
      }
    } catch (err: any) {
      console.error('Calendar vision scan error:', err);
      setError(err.message || 'Failed to scan image. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSelectAll = () => {
    const allSelected = recognizedEvents.every((i) => i.selected);
    setRecognizedEvents(recognizedEvents.map((i) => ({ ...i, selected: !allSelected })));
  };

  const handleDeleteEvent = (id: string) => {
    setRecognizedEvents((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSaveSelected = async () => {
    const toSave = recognizedEvents.filter((i) => i.selected && i.title.trim() && i.date.trim());
    if (toSave.length === 0) return;

    setIsSaving(true);
    try {
      await api.createCalendarEventsBatch(
        householdId,
        toSave.map((ev) => ({
          title: ev.title.trim(),
          date: ev.date,
          startTime: ev.isAllDay ? null : ev.startTime || null,
          endTime: ev.isAllDay ? null : ev.endTime || null,
          isAllDay: ev.isAllDay,
          location: ev.location ? ev.location.trim() : undefined,
          description: ev.description ? ev.description.trim() : undefined,
          assignedMemberId: ev.assignedMemberId || undefined,
        }))
      );
      onEventsAdded();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save events to calendar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    stopLiveCamera();
    setImagePreview(null);
    setRecognizedEvents([]);
    setShotsCount(0);
    setError(null);
    setIsScanning(false);
    onClose();
  };

  const selectedCount = recognizedEvents.filter((i) => i.selected).length;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="AI Photo Scan"
      subtitle="Snap a school flyer, sports schedule, or invitation to auto-add events"
      icon={<Camera className="w-5 h-5 text-slate-950" />}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Hidden File Inputs for Native Camera / Gallery Pickers */}
        <input
          type="file"
          ref={cameraInputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
        />
        <input
          type="file"
          ref={galleryInputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
        />

        {/* Viewfinder or Fallback Options */}
        {!imagePreview ? (
          <div className="space-y-4">
            {cameraError ? (
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-white/10 space-y-3 text-center">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <p className="text-xs text-amber-300 max-w-sm mx-auto">{cameraError}</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={startLiveCamera}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload from Gallery</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative w-full max-w-sm sm:max-w-md mx-auto aspect-[8.5/11] max-h-[62vh] rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl">
                {cameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                  </div>
                )}

                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && streamRef.current && el.srcObject !== streamRef.current) {
                      el.srcObject = streamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      videoRef.current.play().catch(() => {});
                    }
                  }}
                  className="w-full h-full object-cover"
                />

                {/* Sheet-of-Paper Document Framing Overlay */}
                <div className="absolute inset-4 sm:inset-5 pointer-events-none rounded-2xl border border-emerald-400/25 flex flex-col justify-between p-3">
                  {/* Top document corners */}
                  <div className="flex justify-between items-start">
                    <div className="w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg shadow-sm" />
                    <div className="w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg shadow-sm" />
                  </div>

                  {/* Center paper alignment guide */}
                  <div className="text-center">
                    <span className="px-3 py-1 bg-slate-950/75 backdrop-blur-md rounded-full text-[10px] font-bold text-emerald-300 border border-emerald-500/30 tracking-wider uppercase inline-flex items-center gap-1.5 shadow-lg">
                      <FileText className="w-3 h-3 text-emerald-400" />
                      <span>Align sheet in frame</span>
                    </span>
                  </div>

                  {/* Bottom document corners */}
                  <div className="flex justify-between items-end">
                    <div className="w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg shadow-sm" />
                    <div className="w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-lg shadow-sm" />
                  </div>
                </div>

                {/* Batch multi-shot badge if previous events exist */}
                {recognizedEvents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setImagePreview('batch_preview')}
                    className="absolute top-3 left-3 px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 backdrop-blur-md rounded-xl text-xs font-bold text-emerald-200 border border-emerald-500/40 shadow-lg flex items-center gap-1.5 cursor-pointer z-10"
                  >
                    <span>📅 {recognizedEvents.length} events collected</span>
                    <span className="text-[10px] underline">View</span>
                  </button>
                )}

                {/* Gallery Upload shortcut */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md rounded-xl text-xs font-semibold text-white border border-white/10 shadow-md cursor-pointer transition-colors z-10 flex items-center gap-1.5"
                  title="Upload photo from gallery"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Gallery</span>
                </button>

                {/* Snap Photo Action */}
                <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-center z-10">
                  <button
                    type="button"
                    onClick={snapLivePhoto}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:scale-95 text-slate-950 rounded-xl text-xs font-black shadow-xl shadow-emerald-500/30 flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Camera className="w-4 h-4 stroke-[2.5]" />
                    <span>{shotsCount > 0 ? 'Snap Next Page / Flyer' : 'Snap Schedule or Flyer'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Smart Detection Tip Notice */}
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-300">
              <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
              <span>
                <strong>Smart Schedule Extraction:</strong> Gemini AI reads school calendars, sports game sheets, invitations, and appointments to extract event titles, dates, times, and venues.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status & Multi-shot Control Header */}
            <div className="flex items-center gap-3 p-3 bg-slate-900/80 rounded-2xl border border-white/10">
              {imagePreview !== 'batch_preview' && (
                <img
                  src={imagePreview}
                  alt="Scan Preview"
                  className="w-11 h-14 object-cover rounded-lg border border-white/10 shrink-0 shadow-sm"
                />
              )}
              <div className="flex-1 min-w-0">
                {isScanning ? (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing schedule with Gemini AI...
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Extracting dates, times, locations & details
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-white">
                      {recognizedEvents.length} event{recognizedEvents.length !== 1 ? 's' : ''} collected {shotsCount > 1 ? `across ${shotsCount} shots` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      Review, adjust details, or assign family members
                    </p>
                  </div>
                )}
              </div>

              {!isScanning && (
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    startLiveCamera();
                  }}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 text-emerald-200 rounded-xl text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Snap Another</span>
                </button>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Checklist of Recognized Events */}
            {recognizedEvents.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-300">
                    Recognized Events ({selectedCount}/{recognizedEvents.length})
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                    >
                      {recognizedEvents.every((i) => i.selected) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {recognizedEvents.map((item, index) => (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        item.selected
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                          : 'bg-slate-900/40 border-white/5 opacity-50 text-slate-400'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => {
                            const updated = [...recognizedEvents];
                            updated[index].selected = e.target.checked;
                            setRecognizedEvents(updated);
                          }}
                          className="mt-1 w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 border-white/10 bg-slate-900 cursor-pointer"
                        />

                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Title & Delete Action */}
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => {
                                const updated = [...recognizedEvents];
                                updated[index].title = e.target.value;
                                setRecognizedEvents(updated);
                              }}
                              placeholder="Event title..."
                              className="flex-1 font-bold text-sm text-white bg-transparent border-b border-transparent focus:border-emerald-400 focus:outline-none py-0.5"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(item.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors cursor-pointer"
                              title="Discard this event"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Date & Member Assignment */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex items-center gap-1.5 bg-slate-950/60 rounded-xl px-2.5 py-1.5 border border-white/10">
                              <CalendarIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <input
                                type="date"
                                value={item.date}
                                onChange={(e) => {
                                  const updated = [...recognizedEvents];
                                  updated[index].date = e.target.value;
                                  setRecognizedEvents(updated);
                                }}
                                className="w-full bg-transparent text-xs text-slate-200 focus:outline-none"
                              />
                            </div>

                            <div className="flex items-center gap-1.5 bg-slate-950/60 rounded-xl px-2.5 py-1.5 border border-white/10">
                              <UserIcon className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                              <select
                                value={item.assignedMemberId}
                                onChange={(e) => {
                                  const updated = [...recognizedEvents];
                                  updated[index].assignedMemberId = e.target.value;
                                  setRecognizedEvents(updated);
                                }}
                                className="w-full bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
                              >
                                <option value="" className="bg-slate-900 text-white">Whole Family</option>
                                {users.map((u) => (
                                  <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Time & All-Day Toggle */}
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none bg-slate-950/60 rounded-xl px-2.5 py-1.5 border border-white/10 shrink-0">
                              <input
                                type="checkbox"
                                checked={item.isAllDay}
                                onChange={(e) => {
                                  const updated = [...recognizedEvents];
                                  updated[index].isAllDay = e.target.checked;
                                  setRecognizedEvents(updated);
                                }}
                                className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-500 border-white/10 bg-slate-900 cursor-pointer"
                              />
                              <span className="text-[11px] font-semibold">All Day</span>
                            </label>

                            {!item.isAllDay && (
                              <div className="flex items-center gap-1.5 flex-1 min-w-[170px]">
                                <div className="flex items-center gap-1 bg-slate-950/60 rounded-xl px-2 py-1.5 border border-white/10 flex-1">
                                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                  <input
                                    type="time"
                                    value={item.startTime || ''}
                                    onChange={(e) => {
                                      const updated = [...recognizedEvents];
                                      updated[index].startTime = e.target.value;
                                      setRecognizedEvents(updated);
                                    }}
                                    className="w-full bg-transparent text-[11px] text-slate-200 focus:outline-none font-mono"
                                  />
                                </div>
                                <span className="text-slate-500 text-xs">–</span>
                                <div className="flex items-center gap-1 bg-slate-950/60 rounded-xl px-2 py-1.5 border border-white/10 flex-1">
                                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                  <input
                                    type="time"
                                    value={item.endTime || ''}
                                    onChange={(e) => {
                                      const updated = [...recognizedEvents];
                                      updated[index].endTime = e.target.value;
                                      setRecognizedEvents(updated);
                                    }}
                                    className="w-full bg-transparent text-[11px] text-slate-200 focus:outline-none font-mono"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Location Input (optional) */}
                          <div className="flex items-center gap-1.5 bg-slate-950/40 rounded-xl px-2.5 py-1 border border-white/5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={item.location || ''}
                              onChange={(e) => {
                                const updated = [...recognizedEvents];
                                updated[index].location = e.target.value;
                                setRecognizedEvents(updated);
                              }}
                              placeholder="Location / field / venue (optional)..."
                              className="w-full bg-transparent text-xs text-slate-300 placeholder-slate-500 focus:outline-none"
                            />
                          </div>

                          {/* Description Input (optional) */}
                          <div className="flex items-center gap-1.5 bg-slate-950/40 rounded-xl px-2.5 py-1 border border-white/5">
                            <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={item.description || ''}
                              onChange={(e) => {
                                const updated = [...recognizedEvents];
                                updated[index].description = e.target.value;
                                setRecognizedEvents(updated);
                              }}
                              placeholder="Notes, uniform, or instructions (optional)..."
                              className="w-full bg-transparent text-xs text-slate-300 placeholder-slate-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Snap Another Secondary Action */}
                {!isScanning && (
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      startLiveCamera();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-dashed border-emerald-500/35 hover:border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/15 active:scale-[0.99] text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
                  >
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>Snap Another Page, Flyer, or Schedule</span>
                  </button>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {recognizedEvents.length > 0 && (
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSelected}
                  disabled={selectedCount === 0 || isSaving}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 text-slate-950 text-xs font-black transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" /> Add {selectedCount} Event{selectedCount !== 1 ? 's' : ''} to Calendar
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
};
