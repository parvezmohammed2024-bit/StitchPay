import React, { useState } from 'react';
import { Shirt } from 'lucide-react';

interface StyleImageProps {
  imageUrl?: string | null;
  styleName?: string;
  className?: string;
  iconClassName?: string;
  alt?: string;
}

export const StyleImage: React.FC<StyleImageProps> = ({
  imageUrl,
  styleName = 'Style',
  className = 'w-12 h-12 rounded-xl object-cover',
  iconClassName = 'w-6 h-6 text-slate-400',
  alt,
}) => {
  const [imageError, setImageError] = useState(false);

  const hasValidImage = Boolean(imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0 && !imageError);

  if (hasValidImage) {
    return (
      <img
        src={imageUrl!}
        alt={alt || styleName}
        loading="lazy"
        onError={() => setImageError(true)}
        className={`${className} border border-slate-700/60 shadow-sm shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${className} bg-slate-800/80 border border-slate-700/60 flex items-center justify-center shrink-0 shadow-inner`}
      title={styleName}
    >
      <Shirt className={iconClassName} />
    </div>
  );
};
