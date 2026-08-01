import React, { useState } from 'react';
import { getInitials, getDeterministicColor } from '../lib/avatar';

interface WorkerAvatarProps {
  photoUrl?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | string;
  className?: string;
  alt?: string;
}

const SIZE_MAP: Record<string, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
  xl: 'w-14 h-14 text-base',
  '2xl': 'w-20 h-20 text-xl font-bold',
};

export const WorkerAvatar: React.FC<WorkerAvatarProps> = ({
  photoUrl,
  name,
  size = 'md',
  className = '',
  alt,
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClass = SIZE_MAP[size] || (size.includes('w-') ? size : 'w-9 h-9 text-xs');
  const colorClass = getDeterministicColor(name);
  const initials = getInitials(name);

  // Check if photoUrl is valid non-empty string and not an unsplash stock image URL if preferred, or try to load it
  const hasValidPhoto = Boolean(photoUrl && typeof photoUrl === 'string' && photoUrl.trim().length > 0 && !imageError);

  if (hasValidPhoto) {
    return (
      <img
        src={photoUrl!}
        alt={alt || name}
        loading="lazy"
        onError={() => setImageError(true)}
        className={`${sizeClass} rounded-full object-cover border border-slate-700/60 shadow-sm shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold font-mono tracking-wider shadow-sm border border-white/10 shrink-0 select-none ${colorClass} ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
};
