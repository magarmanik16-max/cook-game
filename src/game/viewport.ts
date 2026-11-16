import { useEffect, useState } from 'react';

export interface ViewportProfile {
  width: number;
  height: number;
  isPortrait: boolean;
  isLandscapeMobile: boolean;
  isMobile: boolean;
}

export function detectCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  const coarseMedia =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return coarseMedia;
}

export function getViewportProfile(
  width: number,
  height: number,
  isCoarsePointer = detectCoarsePointer(),
): ViewportProfile {
  const isPortrait = width < 768 && height > width;
  const isCoarseHandset = isCoarsePointer && Math.min(width, height) < 640;
  const isLandscapeMobile =
    width >= height && (height <= 540 || (isCoarseHandset && width < 1024));
  const isMobile = width < 768 || isLandscapeMobile || isCoarseHandset;

  return {
    width,
    height,
    isPortrait,
    isLandscapeMobile,
    isMobile,
  };
}

export function useViewportProfile(): ViewportProfile {
  const [profile, setProfile] = useState<ViewportProfile>(() => {
    if (typeof window === 'undefined') {
      return getViewportProfile(1280, 720, false);
    }
    return getViewportProfile(window.innerWidth, window.innerHeight, detectCoarsePointer());
  });

  useEffect(() => {
    const update = () => {
      setProfile(getViewportProfile(window.innerWidth, window.innerHeight, detectCoarsePointer()));
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return profile;
}
