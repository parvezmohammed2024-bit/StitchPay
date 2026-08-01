import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Shirt, Image as ImageIcon } from 'lucide-react';
import { uploadStyleImage, validateImageFile, deleteFileFromBucket } from '../lib/storageService';
import { showErrorToast } from '../lib/toast';

interface StyleImageUploaderProps {
  currentImageUrl?: string | null;
  styleCode: string;
  onImageChanged: (url: string | null) => void;
  onUploadingStateChange?: (isUploading: boolean) => void;
  className?: string;
}

export const StyleImageUploader: React.FC<StyleImageUploaderProps> = ({
  currentImageUrl,
  styleCode,
  onImageChanged,
  onUploadingStateChange,
  className = '',
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const publicUrl = await uploadStyleImage(file, styleCode, currentImageUrl);
      onImageChanged(publicUrl);
    } catch (err) {
      console.error('Failed style image upload:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentImageUrl) {
      await deleteFileFromBucket('style-images', currentImageUrl);
    }
    onImageChanged(null);
  };

  return (
    <div className={`w-full ${className}`}>
      <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
        <span>Garment Image / Spec Photo</span>
        <span className="text-[10px] text-slate-500 font-normal">Max 5MB (JPG, PNG, WebP)</span>
      </label>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
      />

      <div
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative aspect-square w-full max-w-[220px] mx-auto rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center p-4 group ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-500/10'
            : currentImageUrl
            ? 'border-slate-700 bg-slate-900/90 hover:border-slate-500'
            : 'border-slate-700/80 bg-slate-900/60 hover:border-indigo-500/60 hover:bg-slate-800/60'
        }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center justify-center text-indigo-400 space-y-2 p-4 text-center">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-xs font-semibold">Resizing & Uploading...</span>
            <span className="text-[10px] text-slate-400">Optimizing for fast loading</span>
          </div>
        ) : currentImageUrl ? (
          <>
            <img
              src={currentImageUrl}
              alt="Style Preview"
              loading="lazy"
              className="w-full h-full object-cover rounded-xl"
            />
            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
              <span className="text-xs text-white bg-slate-900/80 px-3 py-1.5 rounded-full font-medium border border-white/10 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Change
              </span>
              <button
                type="button"
                onClick={handleRemove}
                className="p-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-full transition-all shadow-md"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 space-y-2 text-center p-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:scale-105 group-hover:border-indigo-500/50 transition-all">
              <Shirt className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-200">
                Tap to pick image
              </p>
              <p className="text-[10px] text-slate-500">
                or drag & drop here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
