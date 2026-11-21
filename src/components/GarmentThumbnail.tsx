import React from 'react';
import type {GarmentCategory} from '../types/inventory';

interface GarmentThumbnailProps {
  imageUrl?: string;
  category: GarmentCategory;
  color?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

function resolveTint(colorName?: string): {fill: string; stroke: string; bg: string} {
  const c = (colorName || '').toLowerCase();
  if (c.includes('negro') || c.includes('oscur')) {
    return {fill: '#1E293B', stroke: '#0F172A', bg: '#F1F5F9'};
  }
  if (c.includes('azul')) {
    return {fill: '#2B6CB0', stroke: '#1E4E8C', bg: '#EFF6FF'};
  }
  if (c.includes('gris')) {
    return {fill: '#94A3B8', stroke: '#64748B', bg: '#F1F5F9'};
  }
  if (c.includes('verde')) {
    return {fill: '#24B570', stroke: '#15803D', bg: '#ECFDF5'};
  }
  if (c.includes('beige') || c.includes('caqui') || c.includes('café')) {
    return {fill: '#D6B88D', stroke: '#A17C4C', bg: '#FAF6F0'};
  }
  if (c.includes('rojo') || c.includes('naranja')) {
    return {fill: '#EF8D2A', stroke: '#C2410C', bg: '#FFF7ED'};
  }
  // Blanco / neutro por defecto
  return {fill: '#FFFFFF', stroke: '#CBD5E1', bg: '#F8FAFC'};
}

export const GarmentThumbnail: React.FC<GarmentThumbnailProps> = ({
  imageUrl,
  category,
  color,
  name,
  size = 'md',
}) => {
  const boxClass =
    size === 'sm'
      ? 'h-10 w-10 rounded-xl'
      : size === 'lg'
        ? 'h-20 w-20 rounded-2xl'
        : 'h-12 w-12 rounded-xl';

  if (imageUrl) {
    return (
      <div className={`${boxClass} shrink-0 overflow-hidden border border-slate-200 bg-slate-100`}>
        <img
          src={imageUrl}
          alt={name}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const tint = resolveTint(color);
  const iconSize = size === 'sm' ? 24 : size === 'lg' ? 48 : 30;

  return (
    <div
      className={`${boxClass} shrink-0 flex items-center justify-center border border-slate-200/80`}
      style={{backgroundColor: tint.bg}}
      aria-hidden="true"
    >
      {(category === 'camiseta' || category === 'otro') && (
        <svg width={iconSize} height={iconSize} viewBox="0 0 36 36" fill="none">
          <path
            d="M11 7L6 10.5L8.5 16L11.5 14.5V29H24.5V14.5L27.5 16L30 10.5L25 7C23.5 9 21 10 18 10C15 10 12.5 9 11 7Z"
            fill={tint.fill}
            stroke={tint.stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {(category === 'jean' || category === 'pantalón') && (
        <svg width={iconSize} height={iconSize} viewBox="0 0 36 36" fill="none">
          <path
            d="M11 7H25L26.5 29H20.5L18 17L15.5 29H9.5L11 7Z"
            fill={tint.fill}
            stroke={tint.stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {category === 'buzo' && (
        <svg width={iconSize} height={iconSize} viewBox="0 0 36 36" fill="none">
          <path
            d="M12 7.5C13.5 9.5 22.5 9.5 24 7.5L29.5 12L28 24.5H24.5V15.5V29H11.5V15.5V24.5H8L6.5 12L12 7.5Z"
            fill={tint.fill}
            stroke={tint.stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {category === 'gorra' && (
        <svg width={iconSize} height={iconSize} viewBox="0 0 36 36" fill="none">
          <path
            d="M8 21C8 14.9249 12.4772 10 18 10C23.5228 10 28 14.9249 28 21V22.5H8V21Z"
            fill={tint.fill}
            stroke={tint.stroke}
            strokeWidth="1.6"
          />
          <path
            d="M7 22.5H30.5C30.5 24.5 27.5 25.5 22 25.5H8.5L7 22.5Z"
            fill={tint.fill}
            stroke={tint.stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {(category === 'zapatos' || category === 'accesorio') && (
        <svg width={iconSize} height={iconSize} viewBox="0 0 36 36" fill="none">
          <path
            d="M8 23.5V16L13 13L18 18.5C21 19 26 20 28 22.5C28.8 23.5 28 25.5 26 25.5H10C8.8 25.5 8 24.6 8 23.5Z"
            fill={tint.fill}
            stroke={tint.stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
};
