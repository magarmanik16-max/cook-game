import React, { useRef, useState } from 'react';

interface MobileControlsProps {
  actionLabel: string | null;
  isLandscapeMobile: boolean;
  onStickMove: (x: number, y: number) => void;
  onInteract: () => void;
  onDash: () => void;
}

export function MobileControls({
  actionLabel,
  isLandscapeMobile,
  onStickMove,
  onInteract,
  onDash,
}: MobileControlsProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const updateStickFromPointer = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const maxRadius = rect.width * 0.36;

    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    const nx = dist > 0.001 ? dx / dist : 0;
    const ny = dist > 0.001 ? dy / dist : 0;

    setKnobOffset({ x: nx * clamped, y: ny * clamped });
    const normMag = maxRadius > 0 ? clamped / maxRadius : 0;
    onStickMove(nx * normMag, ny * normMag);
  };

  const resetStick = () => {
    pointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onStickMove(0, 0);
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-20 pointer-events-none flex items-end justify-between ${
        isLandscapeMobile ? 'px-4 pb-4 pt-1' : 'px-4 pb-2.5 pt-1'
      }`}
      aria-label="Mobile touch controls"
    >
      {/* Left Thumb: Sculpted Clay Joystick Bowl with directional guide dimples */}
      <div
        ref={padRef}
        role="application"
        aria-label="Move Chef joystick"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          pointerIdRef.current = e.pointerId;
          updateStickFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointerIdRef.current === e.pointerId) {
            updateStickFromPointer(e.clientX, e.clientY);
          }
        }}
        onPointerUp={(e) => {
          if (pointerIdRef.current === e.pointerId) {
            resetStick();
          }
        }}
        onPointerCancel={resetStick}
        className={`clay-inset pointer-events-auto relative rounded-full bg-[#EFE0D2] touch-none flex items-center justify-center ${
          isLandscapeMobile ? 'w-[92px] h-[92px]' : 'w-[104px] h-[104px]'
        }`}
      >
        <span aria-hidden="true" className="absolute top-2.5 w-1.5 h-1.5 rounded-full bg-[#C7AC98]" />
        <span aria-hidden="true" className="absolute bottom-2.5 w-1.5 h-1.5 rounded-full bg-[#C7AC98]" />
        <span aria-hidden="true" className="absolute left-2.5 w-1.5 h-1.5 rounded-full bg-[#C7AC98]" />
        <span aria-hidden="true" className="absolute right-2.5 w-1.5 h-1.5 rounded-full bg-[#C7AC98]" />
        <div
          className={`clay-btn rounded-full bg-[#C94136] transition-transform duration-75 ${
            isLandscapeMobile ? 'w-11 h-11' : 'w-12 h-12'
          }`}
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
        />
      </div>

      {/* Right Thumb: Squishy Clay Dash + Primary Cook Buttons */}
      <div
        className={`pointer-events-auto flex items-end ${
          isLandscapeMobile ? 'flex-col gap-2.5' : 'gap-3'
        }`}
      >
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onDash();
          }}
          aria-label="Dash"
          className={`clay-btn-soft rounded-full bg-[#FFFBF7] text-[#3D2921] font-bold text-xs touch-none cursor-pointer flex items-center justify-center ${
            isLandscapeMobile ? 'w-12 h-12 self-end' : 'w-14 h-14'
          }`}
        >
          Dash
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onInteract();
          }}
          aria-label="Cook or interact with nearest station"
          className={`clay-btn rounded-full bg-[#C94136] text-white font-bold text-sm px-1 touch-none cursor-pointer flex items-center justify-center text-center leading-tight ${
            isLandscapeMobile ? 'w-[70px] h-[70px]' : 'w-[76px] h-[76px]'
          }`}
        >
          {actionLabel ? actionLabel.split(' ')[0] : 'Cook'}
        </button>
      </div>
    </div>
  );
}
