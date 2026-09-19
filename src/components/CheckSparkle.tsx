import React, { useEffect, useState } from 'react';

interface Particle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
}

const SPARKLE_COLORS = [
  '#10b981', // emerald-500
  '#34d399', // emerald-400
  '#6ee7b7', // emerald-300
  '#38bdf8', // sky-400
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#a855f7', // purple-500
];

import { triggerHaptic } from '../lib/haptics';

/**
 * Triggers subtle mobile haptic vibration if supported by the browser/PWA (iOS Taptics + Android)
 */
export function triggerHapticCheck() {
  triggerHaptic([16, 28, 22]);
}

/**
 * Micro sparkle burst that shoots 8 vibrant particles outward from the checkbox or badge
 */
export const CheckSparkle: React.FC<{ trigger: boolean | number | string }> = ({ trigger }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;

    const newParticles: Particle[] = Array.from({ length: 8 }).map((_, i) => ({
      id: Math.random(),
      angle: (i * 45 + (Math.random() * 24 - 12)) * (Math.PI / 180),
      distance: 18 + Math.random() * 16,
      size: 3.5 + Math.random() * 2.5,
      color: SPARKLE_COLORS[i % SPARKLE_COLORS.length],
    }));

    setParticles(newParticles);

    const timer = setTimeout(() => {
      setParticles([]);
    }, 550);

    return () => clearTimeout(timer);
  }, [trigger]);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible z-30">
      {particles.map((p) => {
        const x = Math.cos(p.angle) * p.distance;
        const y = Math.sin(p.angle) * p.distance;
        return (
          <span
            key={p.id}
            className="absolute rounded-full animate-particle-burst"
            style={
              {
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.color,
                '--tx': `${x}px`,
                '--ty': `${y}px`,
                boxShadow: `0 0 6px ${p.color}`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
};

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  isCircle: boolean;
}

const CONFETTI_COLORS = [
  '#10b981',
  '#34d399',
  '#38bdf8',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#f97316',
  '#06b6d4',
];

/**
 * Full celebratory confetti shower when all recipe steps or major milestones are completed
 */
export const CelebrationConfetti: React.FC<{ active: boolean; count?: number }> = ({
  active,
  count = 38,
}) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (!active) {
      setPieces([]);
      return;
    }

    const generated: ConfettiPiece[] = Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2.2 + Math.random() * 1.6,
      size: 6 + Math.random() * 6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      isCircle: Math.random() > 0.5,
    }));

    setPieces(generated);

    const timer = setTimeout(() => {
      setPieces([]);
    }, 4500);

    return () => clearTimeout(timer);
  }, [active, count]);

  if (!active || pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute top-0 animate-confetti"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          <div
            style={{
              width: `${p.size}px`,
              height: p.isCircle ? `${p.size}px` : `${p.size * 1.5}px`,
              backgroundColor: p.color,
              borderRadius: p.isCircle ? '9999px' : '2px',
              boxShadow: `0 0 8px ${p.color}80`,
            }}
          />
        </div>
      ))}
    </div>
  );
};
