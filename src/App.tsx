import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BistroShopModal } from './components/BistroShopModal';
import { GameHud, type HudState } from './components/GameHud';
import { GameModals } from './components/GameModals';
import { MobileControls } from './components/MobileControls';
import { TitleScreen } from './components/TitleScreen';
import { kitchenAudio } from './game/audio';
import {
  finalizeShiftProgress,
  loadProgress,
  purchaseUpgrade,
  saveProgress,
  selectOrUnlockTheme,
} from './game/progression';
import { ITEM_LABELS, RECIPES } from './game/recipes';
import { KitchenRenderer } from './game/renderer';
import {
  createInitialSimulation,
  createStatsSnapshot,
  getStationInteractionHint,
  stepSimulation,
} from './game/rules';
import { useViewportProfile } from './game/viewport';
import type {
  GameMode,
  GamePhase,
  KitchenSimulation,
  KitchenThemeId,
  PersistentProgress,
  RunStatsSnapshot,
  UpgradeKey,
} from './game/types';

function extractHudState(sim: KitchenSimulation): HudState {
  const heldDishId =
    sim.chef.held?.kind === 'plate' ? sim.chef.held.matchedDishId : null;
  let heldLabel: string | null = null;
  if (sim.chef.held) {
    if (sim.chef.held.kind === 'plate') {
      heldLabel = heldDishId
        ? RECIPES[heldDishId].name
        : `Plate (${sim.chef.held.plateComponents.length} ${sim.chef.held.plateComponents.length === 1 ? 'item' : 'items'})`;
    } else {
      heldLabel = ITEM_LABELS[sim.chef.held.kind];
    }
  }

  return {
    day: sim.day,
    score: sim.score,
    coinsEarned: sim.coinsEarned,
    combo: sim.combo,
    ordersServed: sim.ordersServed,
    targetOrders: sim.targetOrders,
    mode: sim.mode,
    stars: sim.stars,
    maxStars: sim.maxStars,
    wave: sim.wave,
    tickets: sim.tickets.map((t) => ({ ...t })),
    heldDishId,
    heldLabel,
    actionHint: getStationInteractionHint(sim, sim.nearestStationId),
    statusBanner: sim.statusBanner,
  };
}

export default function App() {
  const initialAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [progress, setProgress] = useState<PersistentProgress>(() => loadProgress());
  const [mode, setMode] = useState<GameMode>('shift');
  const [phase, setPhase] = useState<GamePhase>(initialAutostart ? 'playing' : 'title');
  const [shopOpen, setShopOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const viewport = useViewportProfile();

  const progressRef = useRef<PersistentProgress>(progress);
  progressRef.current = progress;

  const simRef = useRef<KitchenSimulation>(
    createInitialSimulation('shift', progress.bestScore, {
      day: progress.day,
      upgrades: progress.upgrades,
    }),
  );
  const rendererRef = useRef<KitchenRenderer>(new KitchenRenderer());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync theme on initial mount & whenever selectedTheme changes
  useEffect(() => {
    rendererRef.current.setTheme(progress.selectedTheme);
  }, [progress.selectedTheme]);

  const [hud, setHud] = useState<HudState>(() => extractHudState(simRef.current));
  const [endStats, setEndStats] = useState<RunStatsSnapshot>(() =>
    createStatsSnapshot(simRef.current),
  );

  const phaseRef = useRef<GamePhase>(phase);
  const modeRef = useRef<GameMode>(mode);
  const shopOpenRef = useRef<boolean>(shopOpen);
  const wakeLoopRef = useRef<(() => void) | null>(null);
  phaseRef.current = phase;
  modeRef.current = mode;
  shopOpenRef.current = shopOpen;

  // Unified input state (keyboard + mobile analog joystick + edge-triggered actions)
  const keysHeldRef = useRef<Set<string>>(new Set());
  const stickMoveRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const justInteractRef = useRef(false);
  const justDashRef = useRef(false);

  const syncBodyState = useCallback((nextPhase: GamePhase) => {
    if (typeof document !== 'undefined') {
      document.body.dataset.state = nextPhase;
    }
  }, []);

  useEffect(() => {
    syncBodyState(phase);
  }, [phase, syncBodyState]);

  const clearInputs = useCallback(() => {
    keysHeldRef.current.clear();
    stickMoveRef.current = { x: 0, y: 0 };
    justInteractRef.current = false;
    justDashRef.current = false;
  }, []);

  const startFreshRun = useCallback(
    (selectedMode: GameMode, progOverride?: PersistentProgress) => {
      const p = progOverride ?? progressRef.current;
      kitchenAudio.unlock();
      kitchenAudio.setSizzling(false);
      clearInputs();
      const fresh = createInitialSimulation(selectedMode, p.bestScore, {
        day: p.day,
        upgrades: p.upgrades,
      });
      simRef.current = fresh;
      const nextRenderer = new KitchenRenderer();
      nextRenderer.setTheme(p.selectedTheme);
      rendererRef.current = nextRenderer;
      setHud(extractHudState(fresh));
      setEndStats(createStatsSnapshot(fresh));
      setShopOpen(false);
      phaseRef.current = 'playing';
      syncBodyState('playing');
      setPhase('playing');
      wakeLoopRef.current?.();

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      canvasRef.current?.focus();
    },
    [clearInputs, syncBodyState],
  );

  const handleStartFromTitle = useCallback(() => {
    startFreshRun(modeRef.current);
  }, [startFreshRun]);

  const handlePause = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    clearInputs();
    kitchenAudio.silence();
    phaseRef.current = 'paused';
    syncBodyState('paused');
    setPhase('paused');
  }, [clearInputs, syncBodyState]);

  const handleResume = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    clearInputs();
    kitchenAudio.unlock();
    phaseRef.current = 'playing';
    syncBodyState('playing');
    setPhase('playing');
    wakeLoopRef.current?.();
    canvasRef.current?.focus();
  }, [clearInputs, syncBodyState]);

  const handleRestart = useCallback(() => {
    startFreshRun(modeRef.current);
  }, [startFreshRun]);

  const handleNextDay = useCallback(() => {
    setMode('shift');
    modeRef.current = 'shift';
    startFreshRun('shift', progressRef.current);
  }, [startFreshRun]);

  const handleReturnTitle = useCallback(() => {
    clearInputs();
    kitchenAudio.silence();
    const p = progressRef.current;
    const fresh = createInitialSimulation(modeRef.current, p.bestScore, {
      day: p.day,
      upgrades: p.upgrades,
    });
    simRef.current = fresh;
    const nextRenderer = new KitchenRenderer();
    nextRenderer.setTheme(p.selectedTheme);
    rendererRef.current = nextRenderer;
    setHud(extractHudState(fresh));
    setShopOpen(false);
    phaseRef.current = 'title';
    syncBodyState('title');
    setPhase('title');
    wakeLoopRef.current?.();
  }, [clearInputs, syncBodyState]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = kitchenAudio.toggleMute();
    setMuted(nextMuted);
  }, []);

  const handleOpenShop = useCallback(() => {
    kitchenAudio.unlock();
    kitchenAudio.setSizzling(false);
    clearInputs();
    setShopOpen(true);
  }, [clearInputs]);

  const handleCloseShop = useCallback(() => {
    setShopOpen(false);
    wakeLoopRef.current?.();
  }, []);

  const handleBuyUpgrade = useCallback((key: UpgradeKey) => {
    const { next, purchased } = purchaseUpgrade(progressRef.current, key);
    if (!purchased) return;
    saveProgress(next);
    progressRef.current = next;
    setProgress(next);
    // Apply upgrades immediately to idle/title preview sim too
    simRef.current.upgrades = { ...next.upgrades };
    kitchenAudio.play('upgrade');
  }, []);

  const handleSelectTheme = useCallback((themeId: KitchenThemeId) => {
    const { next, changed } = selectOrUnlockTheme(progressRef.current, themeId);
    if (!changed) return;
    saveProgress(next);
    progressRef.current = next;
    setProgress(next);
    rendererRef.current.setTheme(next.selectedTheme);
    kitchenAudio.play('upgrade');
    wakeLoopRef.current?.();
  }, []);

  const handleStickMove = useCallback((x: number, y: number) => {
    stickMoveRef.current = { x, y };
  }, []);

  const handleMobileInteract = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    kitchenAudio.unlock();
    justInteractRef.current = true;
  }, []);

  const handleMobileDash = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    kitchenAudio.unlock();
    justDashRef.current = true;
  }, []);

  // Global keyboard & focus-loss listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;

      if (shopOpenRef.current) {
        if (code === 'Escape') {
          e.preventDefault();
          handleCloseShop();
        }
        return;
      }

      if (phaseRef.current === 'title') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          handleStartFromTitle();
        }
        return;
      }

      if (code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        if (phaseRef.current === 'playing') {
          handlePause();
        } else if (phaseRef.current === 'paused') {
          handleResume();
        }
        return;
      }

      if (
        code === 'KeyR' &&
        (phaseRef.current === 'playing' || phaseRef.current === 'paused' || phaseRef.current === 'gameover')
      ) {
        e.preventDefault();
        handleRestart();
        return;
      }

      if (phaseRef.current !== 'playing') return;

      if (
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'Space'
      ) {
        e.preventDefault();
      }

      if (!e.repeat) {
        if (code === 'Space' || code === 'KeyE') {
          justInteractRef.current = true;
        }
        if (code === 'ShiftLeft' || code === 'ShiftRight') {
          justDashRef.current = true;
        }
      }

      keysHeldRef.current.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    const onBlur = () => {
      clearInputs();
    };

    const onVisibility = () => {
      if (document.hidden) {
        clearInputs();
        kitchenAudio.setSizzling(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [
    clearInputs,
    handleCloseShop,
    handlePause,
    handleRestart,
    handleResume,
    handleStartFromTitle,
    handleToggleMute,
  ]);

  // Isolated 60fps Canvas Loop (mounted once, sleeps when idle)
  useEffect(() => {
    let rafId = 0;
    let isRunning = false;
    let lastTime = performance.now();
    let hudAccumulator = 0;
    let lastSignature = '';

    const drawFrame = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = canvas.width / dpr;
      const cssH = canvas.height / dpr;
      ctx.save();
      ctx.scale(dpr, dpr);
      rendererRef.current.render(ctx, cssW, cssH, simRef.current, now);
      ctx.restore();
    };

    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.max(1, Math.floor(rect.width * dpr));
      const targetH = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      drawFrame(performance.now());
    };

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      const sim = simRef.current;
      const renderer = rendererRef.current;
      const currentPhase = phaseRef.current;

      if (currentPhase === 'playing' && !shopOpenRef.current) {
        const held = keysHeldRef.current;
        const keyX =
          (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) -
          (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
        const keyY =
          (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) -
          (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);

        let moveX = keyX + stickMoveRef.current.x;
        let moveY = keyY + stickMoveRef.current.y;
        const mag = Math.hypot(moveX, moveY);
        if (mag > 1) {
          moveX /= mag;
          moveY /= mag;
        }

        const canvasEl = canvasRef.current;
        const isPortrait = canvasEl
          ? renderer.isPortraitLayout(canvasEl.clientWidth, canvasEl.clientHeight)
          : false;
        const simMoveX = isPortrait ? moveY : moveX;
        const simMoveY = isPortrait ? moveX : moveY;

        const interactPressed = justInteractRef.current;
        const dashPressed = justDashRef.current;
        justInteractRef.current = false;
        justDashRef.current = false;

        const events = stepSimulation(sim, dt, {
          moveX: simMoveX,
          moveY: simMoveY,
          interactPressed,
          dashPressed,
        });

        renderer.ingestEvents(events);

        for (const ev of events) {
          if (ev.sound) {
            kitchenAudio.play(ev.sound, sim.combo);
          }
        }

        const isAnyCooking = sim.stations.some(
          (s) => s.type === 'skillet' && s.item && s.cookStage !== 'burnt',
        );
        kitchenAudio.setSizzling(sim.outcome === 'none' && isAnyCooking);

        if (sim.outcome !== 'none') {
          kitchenAudio.setSizzling(false);
          const { nextProgress, newlyUnlocked } = finalizeShiftProgress(progressRef.current, {
            score: sim.score,
            coinsEarned: sim.coinsEarned,
            ordersServed: sim.ordersServed,
            perfectDishes: sim.perfectDishes,
            maxCombo: sim.maxCombo,
            isVictoryShift: sim.outcome === 'victory' && sim.mode === 'shift',
          });
          saveProgress(nextProgress);
          progressRef.current = nextProgress;
          setProgress(nextProgress);
          sim.bestScore = nextProgress.bestScore;

          if (newlyUnlocked.length > 0) {
            kitchenAudio.play('achievement');
          }

          const snap = createStatsSnapshot(sim, newlyUnlocked);
          setEndStats(snap);
          setHud(extractHudState(sim));
          phaseRef.current = 'gameover';
          syncBodyState('gameover');
          setPhase('gameover');
        }
      } else {
        kitchenAudio.setSizzling(false);
      }

      renderer.updateVisuals(dt, sim, currentPhase === 'playing' && !shopOpenRef.current);
      drawFrame(now);

      // Throttled HUD sync (~10Hz or immediately on discrete state changes)
      if (currentPhase === 'playing') {
        hudAccumulator += dt;
        const sig = `${sim.score}|${sim.coinsEarned}|${sim.ordersServed}|${sim.stars}|${sim.combo}|${sim.tickets.length}|${sim.nearestStationId ?? ''}|${sim.chef.held?.kind ?? ''}|${sim.chef.held?.matchedDishId ?? ''}|${sim.statusBanner ?? ''}`;
        if (sig !== lastSignature || hudAccumulator >= 0.14) {
          lastSignature = sig;
          hudAccumulator = 0;
          setHud(extractHudState(sim));
        }
      }

      if (phaseRef.current === 'playing' || renderer.hasActiveVisuals()) {
        rafId = requestAnimationFrame(tick);
      } else {
        isRunning = false;
      }
    };

    const wakeLoop = () => {
      drawFrame(performance.now());
      if (!isRunning && (phaseRef.current === 'playing' || rendererRef.current.hasActiveVisuals())) {
        isRunning = true;
        lastTime = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    };

    wakeLoopRef.current = wakeLoop;
    resizeCanvas();
    wakeLoop();

    const observer =
      typeof ResizeObserver !== 'undefined' && canvasRef.current
        ? new ResizeObserver(() => resizeCanvas())
        : null;
    if (observer && canvasRef.current) {
      observer.observe(canvasRef.current);
    }

    return () => {
      cancelAnimationFrame(rafId);
      isRunning = false;
      wakeLoopRef.current = null;
      kitchenAudio.setSizzling(false);
      observer?.disconnect();
    };
  }, [syncBodyState]);

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (phaseRef.current !== 'playing' || shopOpenRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      kitchenAudio.unlock();
      const rect = canvas.getBoundingClientRect();
      const stationId = rendererRef.current.hitTestStation(
        e.clientX,
        e.clientY,
        rect,
        simRef.current,
      );
      if (stationId) {
        simRef.current.chef.targetStationId = stationId;
      }
    },
    [],
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F7ECE1] select-none">
      {/* Isolated Canvas Mount (never unmounted by HUD updates) */}
      <canvas
        ref={canvasRef}
        data-testid="kitchen-canvas"
        tabIndex={0}
        onPointerDown={handleCanvasPointerDown}
        aria-label="Copper Pan Bistro Kitchen Playfield"
        className="block w-full h-full outline-none touch-none"
      />

      {/* Title Screen Stage */}
      {phase === 'title' && (
        <div className="fixed inset-0 z-20">
          <TitleScreen
            mode={mode}
            progress={progress}
            isMobile={viewport.isMobile}
            isLandscapeMobile={viewport.isLandscapeMobile}
            onSelectMode={(next) => setMode(next)}
            onStart={handleStartFromTitle}
            onOpenShop={handleOpenShop}
          />
        </div>
      )}

      {/* Unobtrusive Active Gameplay HUD */}
      {phase !== 'title' && (
        <GameHud
          hud={hud}
          muted={muted}
          isMobile={viewport.isMobile}
          isLandscapeMobile={viewport.isLandscapeMobile}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onRestart={handleRestart}
        />
      )}

      {/* Responsive Mobile Touch Deck (visible on portrait & landscape phones during play) */}
      {phase === 'playing' && !shopOpen && viewport.isMobile && (
        <MobileControls
          actionLabel={hud.actionHint}
          isLandscapeMobile={viewport.isLandscapeMobile}
          onStickMove={handleStickMove}
          onInteract={handleMobileInteract}
          onDash={handleMobileDash}
        />
      )}

      {/* Single Focused Modal for Paused / Victory / Game Over */}
      <GameModals
        phase={phase}
        stats={endStats}
        onResume={handleResume}
        onRestart={handleRestart}
        onNextDay={handleNextDay}
        onOpenShop={handleOpenShop}
        onReturnTitle={handleReturnTitle}
      />

      {/* Persistent Upgrades, Themes & Recipe/Milestone Book */}
      <BistroShopModal
        open={shopOpen}
        progress={progress}
        onBuyUpgrade={handleBuyUpgrade}
        onSelectTheme={handleSelectTheme}
        onClose={handleCloseShop}
      />
    </div>
  );
}
