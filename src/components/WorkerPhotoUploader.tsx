import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { uploadWorkerPhoto, validateImageFile, deleteFileFromBucket } from '../lib/storageService';
import { showErrorToast } from '../lib/toast';
import { getInitials, getDeterministicColor } from '../lib/avatar';

interface WorkerPhotoUploaderProps {
  currentPhotoUrl?: string | null;
  workerCode: string;
  workerName: string;
  onPhotoChanged: (url: string | null) => void;
  onUploadingStateChange?: (isUploading: boolean) => void;
  className?: string;
}

export const WorkerPhotoUploader: React.FC<WorkerPhotoUploaderProps> = ({
  currentPhotoUrl,
  workerCode,
  workerName,
  onPhotoChanged,
  onUploadingStateChange,
  className = '',
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const setUploading = (uploading: boolean) => {
    setIsUploading(uploading);
    if (onUploadingStateChange) {
      onUploadingStateChange(uploading);
    }
  };

  const handleFile = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      showErrorToast(validation.error || 'Invalid file');
      return;
    }

    setUploading(true);
    try {
      const publicUrl = await uploadWorkerPhoto(file, workerCode, currentPhotoUrl);
      onPhotoChanged(publicUrl);
    } catch (err) {
      console.error('Failed worker photo upload:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentPhotoUrl) {
      await deleteFileFromBucket('worker-photos', currentPhotoUrl);
    }
    onPhotoChanged(null);
  };

  const colorClass = getDeterministicColor(workerName || 'New Worker');
  const initials = getInitials(workerName || 'New Worker');

  return (
    <div className={`flex flex-col items-center space-y-3 ${className}`}>
      <label className="block text-xs font-mono uppercase tracking-wider text-stone-600 text-center">
        <span>Worker Profile Photo</span>
      </label>

      {/* Hidden Inputs for File Picker and Camera */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/jpg"
        capture="environment"
        className="hidden"
      />

      {/* Circular Avatar / Photo Container */}
      <div className="relative group">
        <div className="w-28 h-28 rounded-full border-2 border-stone-200 p-1 bg-white shadow-xs overflow-hidden flex items-center justify-center">
          {isUploading ? (
            <div className="flex flex-col items-center justify-center text-indigo-700">
              <Loader2 className="w-7 h-7 animate-spin" />
              <span className="text-[10px] font-semibold mt-1">Uploading...</span>
            </div>
          ) : currentPhotoUrl ? (
            <img
              src={currentPhotoUrl}
              alt={workerName || 'Worker'}
              loading="lazy"
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div
              className={`w-full h-full rounded-full flex items-center justify-center font-bold text-2xl font-mono ${colorClass}`}
            >
              {initials}
            </div>
          )}
        </div>

        {/* Remove Photo Badge */}
        {currentPhotoUrl && !isUploading && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-1 -right-1 bg-rose-700 hover:bg-rose-800 text-white p-1.5 rounded-full shadow-xs border border-white transition-transform hover:scale-110"
            title="Remove photo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Action Buttons: Camera and Gallery Picker */}
      <div className="flex items-center space-x-2">
        <button
          type="button"
          disabled={isUploading}
          onClick={() => cameraInputRef.current?.click()}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors disabled:opacity-50"
        >
          <Camera className="w-3.5 h-3.5 text-indigo-700" />
          <span>Take Photo</span>
        </button>

        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl border border-stone-200 transition-colors disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5 text-stone-600" />
          <span>Upload File</span>
        </button>
      </div>

      <p className="text-[10px] text-stone-500 text-center max-w-[200px]">
        JPG, PNG or WebP under 5MB. Auto-resized to 1200px max.
      </p>
    </div>
  );
};
