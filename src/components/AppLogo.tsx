import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({size = 72, className = ''}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Logo de Inventario Fácil IA"
    >
      {/* Estante */}
      <path d="M22 18C22 15.7909 23.7909 14 26 14H31V106H22V18Z" fill="#5C7B98" />
      <path d="M89 14H94C96.2091 14 98 15.7909 98 18V106H89V14Z" fill="#5C7B98" />
      <rect x="22" y="54" width="76" height="6" rx="2" fill="#3B5975" />
      <rect x="22" y="94" width="76" height="7" rx="2" fill="#3B5975" />

      {/* Caja superior */}
      <rect x="42" y="25" width="36" height="29" rx="4" fill="#F2B449" />
      <rect x="56" y="25" width="8" height="12" rx="1.5" fill="#EF8D2A" />

      {/* Caja inferior con etiqueta IA */}
      <rect x="33" y="57" width="54" height="37" rx="5" fill="#F6BE57" />
      <rect x="54" y="57" width="12" height="13" rx="1.5" fill="#EF8D2A" />
      <rect x="45" y="72" width="30" height="17" rx="4" fill="#0A1F32" />
      <text
        x="60"
        y="84.5"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontWeight="800"
        fontSize="11"
      >
        IA
      </text>
    </svg>
  );
};
