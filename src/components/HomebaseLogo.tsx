import React from 'react';

interface HomebaseLogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

export const HomebaseLogo: React.FC<HomebaseLogoProps> = ({
  size = 36,
  className = '',
  showWordmark = false,
}) => {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Clean, Simple Residential House Emblem */}
      <div
        style={{ width: size, height: size }}
        className="relative rounded-2xl overflow-hidden shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-all duration-300 shrink-0"
      >
        <svg
          viewBox="0 0 512 512"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="hblHouseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="60%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>

          {/* Squircle base */}
          <rect width="512" height="512" rx="120" fill="#0b111e" />
          <rect
            x="16"
            y="16"
            width="480"
            height="480"
            rx="104"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="4"
          />

          <g transform="translate(0, 10)">
            {/* Chimney on roof slope */}
            <rect x="330" y="130" width="44" height="75" rx="10" fill="url(#hblHouseGrad)" />

            {/* Simple, Modern House Silhouette */}
            <path
              d="M 244 118
                 C 251 112, 261 112, 268 118
                 L 412 230
                 C 421 237, 418 250, 407 250
                 L 374 250
                 L 374 386
                 C 374 398, 364 408, 352 408
                 L 160 408
                 C 148 408, 138 398, 138 386
                 L 138 250
                 L 105 250
                 C 94 250, 91 237, 100 230
                 Z"
              fill="url(#hblHouseGrad)"
            />

            {/* Cozy Cut-Out Doorway */}
            <path
              d="M 218 408
                 L 218 300
                 C 218 276, 294 276, 294 300
                 L 294 408
                 Z"
              fill="#0b111e"
            />

            {/* Small door handle accent */}
            <circle cx="280" cy="346" r="4.5" fill="#14b8a6" />
          </g>
        </svg>
      </div>

      {/* Wordmark */}
      {showWordmark && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1 font-black text-xl tracking-tight">
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Homebase
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
