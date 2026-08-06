import React, { useState, useRef } from 'react';
import { Shirt, X } from 'lucide-react';

interface StyleImageLightboxProps {
  imageUrl?: string | null;
  styleCode?: string;
  styleName?: string;
  sizeClassName?: string; // e.g., 'w-12 h-12' (48px square)
  className?: string;
  alt?: string;
}

export const StyleImageLightbox: React.FC<StyleImageLightboxProps> = ({
  imageUrl,
  styleCode = '',
  styleName = 'Style',
  sizeClassName = 'w-12 h-12',
  className = '',
  alt,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Mobile swipe-down state to dismiss
  const touchStartY = useRef<number | null>(null);
  const [touchOffsetY, setTouchOffsetY] = useState(0);

  const hasValidImage = Boolean(imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0 && !imageError);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    if (diff > 0) {
      setTouchOffsetY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (touchOffsetY > 80) {
      setIsOpen(false);
    }
    touchStartY.current = null;
    setTouchOffsetY(0);
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className={`group relative rounded-xl overflow-hidden shrink-0 border border-stone-200/80 shadow-2xs hover:ring-2 hover:ring-indigo-500 hover:border-indigo-400 transition focus:outline-none cursor-pointer ${sizeClassName} ${className}`}
        title={`Click to enlarge ${styleCode || styleName}`}
      >
        {hasValidImage ? (
          <img
            src={imageUrl!}
            alt={alt || styleCode || styleName}
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-500">
            <Shirt className="w-5 h-5 text-stone-400" />
          </div>
        )}
      </button>

      {/* Lightbox Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          {/* Top Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
            className="absolute top-5 right-5 z-50 p-3 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition shadow-lg cursor-pointer"
            aria-label="Close lightbox"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Mobile Swipe handle */}
          <div className="w-12 h-1.5 bg-white/40 rounded-full mb-4 sm:hidden shrink-0" />

          {/* Image & Title Container */}
          <div
            className="flex flex-col items-center max-w-2xl w-full transition-transform duration-150"
            style={{ transform: `translateY(${touchOffsetY}px)` }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {hasValidImage ? (
              <img
                src={imageUrl!}
                alt={alt || styleCode || styleName}
                className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
              />
            ) : (
              <div className="w-64 h-64 bg-stone-800 rounded-2xl flex items-center justify-center text-stone-400 border border-stone-700 shadow-2xl">
                <Shirt className="w-24 h-24 text-stone-500" />
              </div>
            )}

            <div className="mt-4 text-center text-white bg-stone-900/90 px-6 py-3 rounded-2xl border border-white/15 shadow-xl backdrop-blur-sm max-w-md w-full">
              <p className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
                {styleCode || styleName}
              </p>
              {styleCode && styleName && (
                <p className="text-sm font-medium text-stone-300 mt-0.5">
                  {styleName}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
