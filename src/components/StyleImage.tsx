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
  iconClassName = 'w-6 h-6 text-stone-500',
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
        className={`${className} border border-stone-200 shadow-xs shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${className} bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0`}
      title={styleName}
    >
      <Shirt className={iconClassName} />
    </div>
  );
};
