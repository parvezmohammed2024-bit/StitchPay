import React from 'react';

interface NewStyleBadgeProps {
  createdAt?: string | null;
  className?: string;
}

export const NewStyleBadge: React.FC<NewStyleBadgeProps> = ({ createdAt, className = '' }) => {
  if (!createdAt) return null;

  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime)) return null;

  const now = Date.now();
  const diffHours = (now - createdTime) / (1000 * 60 * 60);

  // Show only if created within the last 24 hours
  if (diffHours < 0 || diffHours >= 24) return null;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider bg-indigo-600 text-white uppercase shadow-xs select-none motion-reduce:animate-none ${className}`}
      style={{
        animation: 'gentlePulse 2s ease-in-out 5',
      }}
      title="Created within the last 24 hours"
    >
      NEW
    </span>
  );
};
