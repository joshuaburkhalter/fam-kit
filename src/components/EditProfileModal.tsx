import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  Loader2,
  Camera,
  Trash2,
  User,
  Eye,
  EyeOff,
  Users,
  Upload,
} from 'lucide-react';
import { usePWA } from '../context/PWAContext';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ef4444', // Red
];

// Helper to compress and convert image file to optimized base64
function compressImage(file: File, maxSize: number = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // High quality JPEG compression for snappy storage and rendering
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to read image file'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const isValidPhoto = (imgStr?: string | null): boolean => {
  if (!imgStr || typeof imgStr !== 'string') return false;
  return imgStr.startsWith('data:image') || imgStr.startsWith('http://') || imgStr.startsWith('https://');
};

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, targetUser }) => {
  const { currentUser, users, updateProfile, switchUser } = usePWA();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeUser = targetUser || currentUser;

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'parent' | 'child' | 'member'>('member');
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [avatarImage, setAvatarImage] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeUser && isOpen) {
      setName(activeUser.name || '');
      setUsername(activeUser.username || '');
      setEmail(activeUser.email || '');
      setRole(activeUser.role || 'member');
      setColor(activeUser.avatar_color || AVATAR_COLORS[0]);
      setAvatarImage(isValidPhoto(activeUser.avatar) ? activeUser.avatar! : '');
      setNewPassword('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [activeUser, isOpen]);

  if (!isOpen || !activeUser) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    try {
      setIsProcessingPhoto(true);
      setErrorMessage(null);
      const compressedDataUrl = await compressImage(file, 300);
      setAvatarImage(compressedDataUrl);
    } catch (err: any) {
      console.error('Image compression failed:', err);
      setErrorMessage('Could not process this image. Please try another.');
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setAvatarImage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setErrorMessage('Name cannot be empty.');
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile({
        userId: activeUser.id,
        name: name.trim(),
        username: username.trim().toLowerCase().replace(/\s+/g, '') || undefined,
        email: email.trim().toLowerCase() || undefined,
        role,
        avatar: avatarImage,
        avatarColor: color,
        password: newPassword.trim() || undefined,
      });

      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setErrorMessage(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const otherMembers = users.filter((u) => u.id !== activeUser.id);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      {/* Solid opaque dialog with header, scrollable body, and sticky footer */}
      <div className="bg-[#0f172a] w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black border-t sm:border border-slate-700/80 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Mobile drag handle */}
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Sticky Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-800 shrink-0 bg-[#0f172a]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {activeUser.id === currentUser?.id ? 'Edit Profile' : `Edit ${activeUser.name}'s Profile`}
              </h2>
              <p className="text-xs text-slate-400">
                {activeUser.id === currentUser?.id
                  ? 'Update your photo, name, username, and account details'
                  : `Update ${activeUser.name}'s photo, color, name, and account details`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 stroke-[2.5]" />
              {successMessage}
            </div>
          )}

          <form id="edit-profile-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Profile Picture Upload Section */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center sm:items-start gap-4">
              {/* Avatar Preview */}
              <div className="relative group">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-xl font-black text-white shadow-lg cursor-pointer relative border-2 border-white/10 group-hover:border-emerald-500/50 transition-all"
                  style={{ backgroundColor: color }}
                >
                  {isProcessingPhoto ? (
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  ) : isValidPhoto(avatarImage) ? (
                    <img src={avatarImage} alt="Profile preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-2xl select-none">
                      {name ? name.charAt(0).toUpperCase() : activeUser?.name ? activeUser.name.charAt(0).toUpperCase() : '👤'}
                    </span>
                  )}

                  {/* Hover Camera Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <Camera className="w-5 h-5" />
                  </div>
                </div>

                {/* Small Camera Button Badge */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload Photo"
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md transition-transform hover:scale-110 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>

              {/* Photo Actions & Info */}
              <div className="flex-1 text-center sm:text-left space-y-2">
                <div>
                  <span className="text-xs font-bold text-white block">Profile Picture</span>
                  <p className="text-[11px] text-slate-400">
                    Upload a photo or choose an avatar color below
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isValidPhoto(avatarImage) ? 'Change Photo' : 'Upload Photo'}</span>
                  </button>

                  {isValidPhoto(avatarImage) && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-2.5 py-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Avatar Color Picker */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Avatar Accent Color</label>
              <div className="flex items-center gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full transition-all cursor-pointer ${
                      color === c ? 'scale-110 ring-2 ring-white shadow-lg' : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Name and Username */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Joshua Burkhalter"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Username <span className="text-[10px] text-slate-500">(used for login)</span>
                </label>
                <div className="relative">
                  <span className="text-xs font-bold text-emerald-400 absolute left-2.5 top-1/2 -translate-y-1/2 select-none">
                    @
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="e.g. joshua"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-6 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Email and Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Email Address <span className="text-[10px] text-slate-500">(Optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. joshua@example.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Role in Family</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
                  <option value="member">Family Member</option>
                </select>
              </div>
            </div>

            {/* Change Password (Optional) */}
            <div className="pt-1">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                New Password <span className="text-[10px] text-slate-500">(Leave blank to keep unchanged)</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 pr-9 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Switch Profile Section */}
            {otherMembers.length > 0 && (
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  Switch Active Profile on This Device
                </label>
                <div className="flex flex-wrap gap-2">
                  {otherMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        switchUser(m);
                        onClose();
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/40 text-xs transition-colors cursor-pointer"
                    >
                      {m.avatar && (m.avatar.startsWith('data:image') || m.avatar.startsWith('http')) ? (
                        <img src={m.avatar} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: m.avatar_color }}
                        >
                          {m.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-slate-200 font-medium">{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Sticky Footer with Save & Cancel Buttons */}
        <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-slate-800 bg-[#0f172a] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-profile-form"
            disabled={isSaving || isProcessingPhoto}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
            <span>Save Profile</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
