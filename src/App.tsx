import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BistroShopModal, type ShopTab } from './components/BistroShopModal';
import { GameHud, type HudState } from './components/GameHud';
import { GameModals } from './components/GameModals';
import { LoginRewardsModal } from './components/LoginRewardsModal';
import { MobileControls } from './components/MobileControls';
import { TitleScreen } from './components/TitleScreen';
import { TutorialOverlay } from './components/TutorialOverlay';
import { kitchenAudio } from './game/audio';
import {
  claimDailyAllClearBonus,
  claimDailyLoginReward,
  claimDailyMission,
  completeTutorial,
  finalizeShiftProgress,
  loadProgress,
  purchaseUpgrade,
  saveProgress,
  selectOrUnlockTheme,
} from './game/progression';
import { ITEM_LABELS, RECIPES } from './game/recipes';
import { KitchenRenderer } from './game/renderer';
import {
  COMBO_WINDOW,
  createInitialSimulation,
  createStatsSnapshot,
  getStationInteractionHint,
  stepSimulation,
} from './game/rules';
import {
  getNextTutorialStep,
  getTutorialGuideSnapshot,
  shouldAutoAdvanceTutorial,
  type TutorialGuideSnapshot,
} from './game/tutorial';
import { useViewportProfile } from './game/viewport';
import type {
  DailyMissionId,
  GameMode,
  GamePhase,
  KitchenSimulation,
  KitchenThemeId,
  MatchDurationSeconds,
  PersistentProgress,
  RunStatsSnapshot,
  TutorialStepId,
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
    durationSeconds: sim.durationSeconds,
    timeRemaining: sim.timeRemaining,
    score: sim.score,
    coinsEarned: sim.coinsEarned,
    combo: sim.combo,
    comboTimer: sim.comboTimer,
    comboMaxWindow: COMBO_WINDOW,
    ordersServed: sim.ordersServed,
    botOrdersServed: sim.bot?.ordersServed ?? 0,
    botScore: sim.bot?.score ?? 0,
    mode: sim.mode,
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
  const [mode, setMode] = useState<GameMode>('solo');
  const [durationSeconds, setDurationSeconds] = useState<MatchDurationSeconds>(60);
  const [phase, setPhase] = useState<GamePhase>(initialAutostart ? 'playing' : 'title');
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<ShopTab>('upgrades');
  const [loginRewardsOpen, setLoginRewardsOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<TutorialStepId | null>(null);
  const [tutorialGuide, setTutorialGuide] = useState<TutorialGuideSnapshot | null>(null);
  const [muted, setMuted] = useState(false);
  const viewport = useViewportProfile();

  const progressRef = useRef<PersistentProgress>(progress);
  progressRef.current = progress;

  const simRef = useRef<KitchenSimulation>(
    createInitialSimulation('solo', progress.bestScore, {
      day: progress.day,
      durationSeconds: 60,
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
  const durationRef = useRef<MatchDurationSeconds>(durationSeconds);
  const shopOpenRef = useRef<boolean>(shopOpen);
  const loginRewardsOpenRef = useRef<boolean>(loginRewardsOpen);
  const tutorialStepRef = useRef<TutorialStepId | null>(tutorialStep);
  const wakeLoopRef = useRef<(() => void) | null>(null);
  phaseRef.current = phase;
  modeRef.current = mode;
  durationRef.current = durationSeconds;
  shopOpenRef.current = shopOpen;
  loginRewardsOpenRef.current = loginRewardsOpen;
  tutorialStepRef.current = tutorialStep;

  // Unified input state (keyboard fallback + edge-triggered actions)
  const keysHeldRef = useRef<Set<string>>(new Set());
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
    justInteractRef.current = false;
    justDashRef.current = false;
  }, []);

  const startFreshRun = useCallback(
    (
      selectedMode: GameMode,
      selectedDuration: MatchDurationSeconds = durationRef.current,
      progOverride?: PersistentProgress,
    ) => {
      const p = progOverride ?? progressRef.current;
      kitchenAudio.unlock();
      kitchenAudio.setSizzling(false);
      clearInputs();
      const fresh = createInitialSimulation(selectedMode, p.bestScore, {
        day: p.day,
        durationSeconds: selectedDuration,
        upgrades: p.upgrades,
      });
      simRef.current = fresh;
      const nextRenderer = new KitchenRenderer();
      nextRenderer.setTheme(p.selectedTheme);

      const shouldRunTutorial = !p.tutorialCompleted;
      const initialStep: TutorialStepId | null = shouldRunTutorial ? 'chop' : null;
      const initialGuide = initialStep ? getTutorialGuideSnapshot(fresh, initialStep) : null;
      nextRenderer.setTutorialHighlight(initialGuide);
      tutorialStepRef.current = initialStep;
      setTutorialStep(initialStep);
      setTutorialGuide(initialGuide);

      rendererRef.current = nextRenderer;
      setHud(extractHudState(fresh));
      setEndStats(createStatsSnapshot(fresh));
      setShopOpen(false);
      setLoginRewardsOpen(false);
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
    startFreshRun(modeRef.current, durationRef.current);
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
    startFreshRun(modeRef.current, durationRef.current);
  }, [startFreshRun]);

  const handleReturnTitle = useCallback(() => {
    clearInputs();
    kitchenAudio.silence();
    const p = progressRef.current;
    const fresh = createInitialSimulation(modeRef.current, p.bestScore, {
      day: p.day,
      durationSeconds: durationRef.current,
      upgrades: p.upgrades,
    });
    simRef.current = fresh;
    const nextRenderer = new KitchenRenderer();
    nextRenderer.setTheme(p.selectedTheme);
    rendererRef.current = nextRenderer;
    rendererRef.current.setTutorialHighlight(null);
    tutorialStepRef.current = null;
    setTutorialStep(null);
    setTutorialGuide(null);
    setHud(extractHudState(fresh));
    setShopOpen(false);
    setLoginRewardsOpen(false);
    phaseRef.current = 'title';
    syncBodyState('title');
    setPhase('title');
    wakeLoopRef.current?.();
  }, [clearInputs, syncBodyState]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = kitchenAudio.toggleMute();
    setMuted(nextMuted);
  }, []);

  const handleOpenShop = useCallback(
    (tab?: ShopTab) => {
      kitchenAudio.unlock();
      kitchenAudio.setSizzling(false);
      clearInputs();
      setShopTab(typeof tab === 'string' ? tab : 'upgrades');
      setShopOpen(true);
    },
    [clearInputs],
  );

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

  const handleClaimMission = useCallback((missionId: DailyMissionId) => {
    const { next, claimed } = claimDailyMission(progressRef.current, missionId);
    if (!claimed) return;
    saveProgress(next);
    progressRef.current = next;
    setProgress(next);
    kitchenAudio.play('coin');
  }, []);

  const handleClaimAllClear = useCallback(() => {
    const { next, claimed } = claimDailyAllClearBonus(progressRef.current);
    if (!claimed) return;
    saveProgress(next);
    progressRef.current = next;
    setProgress(next);
    kitchenAudio.play('achievement');
  }, []);

  const handleOpenLoginRewards = useCallback(() => {
    kitchenAudio.unlock();
    clearInputs();
    setLoginRewardsOpen(true);
  }, [clearInputs]);

  const handleCloseLoginRewards = useCallback(() => {
    setLoginRewardsOpen(false);
    wakeLoopRef.current?.();
  }, []);

  const handleClaimLoginReward = useCallback(() => {
    const { next, claimed } = claimDailyLoginReward(progressRef.current);
    if (!claimed) return;
    saveProgress(next);
    progressRef.current = next;
    setProgress(next);
    kitchenAudio.play('achievement');
  }, []);

  const finishTutorial = useCallback((awardBonus: boolean) => {
    tutorialStepRef.current = null;
    setTutorialStep(null);
    setTutorialGuide(null);
    rendererRef.current.setTutorialHighlight(null);
    const { next, bonusAwarded } = completeTutorial(progressRef.current, awardBonus);
    saveProgress(next);
    progressRef.current = next;
    setProgress(next);
    if (bonusAwarded > 0) {
      kitchenAudio.play('achievement');
    }
  }, []);

  const handleTutorialNext = useCallback(() => {
    const current = tutorialStepRef.current;
    if (!current) return;
    const nextStep = getNextTutorialStep(current);
    if (nextStep) {
      tutorialStepRef.current = nextStep;
      setTutorialStep(nextStep);
      const nextGuide = getTutorialGuideSnapshot(simRef.current, nextStep);
      setTutorialGuide(nextGuide);
      rendererRef.current.setTutorialHighlight(nextGuide);
      kitchenAudio.play('coin');
    } else {
      finishTutorial(true);
    }
  }, [finishTutorial]);

  const handleTutorialSkip = useCallback(() => {
    finishTutorial(false);
  }, [finishTutorial]);

  const handleReplayTutorial = useCallback(() => {
    const step: TutorialStepId = 'chop';
    tutorialStepRef.current = step;
    setTutorialStep(step);
    const guide = getTutorialGuideSnapshot(simRef.current, step);
    setTutorialGuide(guide);
    rendererRef.current.setTutorialHighlight(guide);
    clearInputs();
    kitchenAudio.unlock();
    phaseRef.current = 'playing';
    syncBodyState('playing');
    setPhase('playing');
    wakeLoopRef.current?.();
    canvasRef.current?.focus();
  }, [clearInputs, syncBodyState]);

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

      if (loginRewardsOpenRef.current) {
        if (code === 'Escape') {
          e.preventDefault();
          handleCloseLoginRewards();
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
    handleCloseLoginRewards,
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
    let lastTutorialSig = '';

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

        let moveX = keyX;
        let moveY = keyY;
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

        const tutorialActiveBeforeStep = tutorialStepRef.current !== null;
        const savedTimeRemaining = sim.timeRemaining;

        const events = stepSimulation(sim, dt, {
          moveX: simMoveX,
          moveY: simMoveY,
          interactPressed,
          dashPressed,
        });

        // Gently pause match countdown while new player walks through interactive tutorial
        if (tutorialActiveBeforeStep && sim.outcome === 'none') {
          sim.timeRemaining = savedTimeRemaining;
        }

        // Update live-reactive tutorial step & glowing canvas highlights
        const activeTut = tutorialStepRef.current;
        if (activeTut) {
          if (shouldAutoAdvanceTutorial(sim, activeTut)) {
            const nextStep = getNextTutorialStep(activeTut);
            if (nextStep) {
              tutorialStepRef.current = nextStep;
              setTutorialStep(nextStep);
              const nextGuide = getTutorialGuideSnapshot(sim, nextStep);
              setTutorialGuide(nextGuide);
              renderer.setTutorialHighlight(nextGuide);
              kitchenAudio.play('coin');
            } else {
              finishTutorial(true);
            }
          } else {
            const liveGuide = getTutorialGuideSnapshot(sim, activeTut);
            renderer.setTutorialHighlight(liveGuide);
            const tutSig = `${liveGuide.stepId}|${liveGuide.actionTag}|${liveGuide.instruction}`;
            if (tutSig !== lastTutorialSig) {
              lastTutorialSig = tutSig;
              setTutorialGuide(liveGuide);
            }
          }
        } else {
          lastTutorialSig = '';
          renderer.setTutorialHighlight(null);
        }

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
          const { nextProgress, newlyUnlocked, newlyCompletedMissions } = finalizeShiftProgress(
            progressRef.current,
            {
              score: sim.score,
              coinsEarned: sim.coinsEarned,
              ordersServed: sim.ordersServed,
              perfectDishes: sim.perfectDishes,
              maxCombo: sim.maxCombo,
              burntCount: sim.burntCount,
              servedByDish: sim.servedByDish,
              vipOrFoodieServed: sim.vipOrFoodieServed,
              wonChallenge: sim.mode === 'challenge' && sim.outcome === 'victory',
            },
          );
          saveProgress(nextProgress);
          progressRef.current = nextProgress;
          setProgress(nextProgress);
          sim.bestScore = nextProgress.bestScore;

          if (newlyUnlocked.length > 0 || newlyCompletedMissions.length > 0) {
            kitchenAudio.play('achievement');
          }

          const snap = createStatsSnapshot(sim, newlyUnlocked, newlyCompletedMissions);
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
        const secCeil = Math.ceil(sim.timeRemaining);
        const sig = `${secCeil}|${sim.score}|${sim.coinsEarned}|${sim.ordersServed}|${sim.bot?.ordersServed ?? 0}|${sim.combo}|${sim.tickets.length}|${sim.nearestStationId ?? ''}|${sim.chef.targetTicketId ?? ''}|${sim.chef.held?.kind ?? ''}|${sim.chef.held?.matchedDishId ?? ''}|${sim.statusBanner ?? ''}`;
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
  }, [finishTutorial, syncBodyState]);

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (phaseRef.current !== 'playing' || shopOpenRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      kitchenAudio.unlock();
      const rect = canvas.getBoundingClientRect();
      const { stationId, ticketId, walkPoint } = rendererRef.current.hitTestCanvas(
        e.clientX,
        e.clientY,
        rect,
        simRef.current,
      );
      const chef = simRef.current.chef;
      if (ticketId !== null) {
        if (chef.targetStationId !== null || (chef.targetTicketId !== null && chef.targetTicketId !== ticketId)) {
          chef.queuedTicketId = ticketId;
          chef.queuedStationId = null;
          chef.targetPoint = null;
        } else {
          chef.targetTicketId = ticketId;
          chef.queuedTicketId = null;
          chef.queuedStationId = null;
          chef.targetPoint = null;
        }
      } else if (stationId) {
        if (chef.targetTicketId !== null || (chef.targetStationId && chef.targetStationId !== stationId)) {
          chef.queuedStationId = stationId;
          chef.queuedTicketId = null;
          chef.targetPoint = null;
        } else {
          chef.targetStationId = stationId;
          chef.queuedStationId = null;
          chef.targetTicketId = null;
          chef.queuedTicketId = null;
          chef.targetPoint = null;
        }
      } else if (walkPoint) {
        chef.targetPoint = walkPoint;
        chef.targetStationId = null;
        chef.queuedStationId = null;
        chef.targetTicketId = null;
        chef.queuedTicketId = null;
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
        className={`block w-full h-full outline-none touch-none ${
          phase === 'title' ? 'invisible' : ''
        }`}
      />

      {/* Title Screen Stage */}
      {phase === 'title' && (
        <div className="fixed inset-0 z-20 isolate">
          <TitleScreen
            mode={mode}
            durationSeconds={durationSeconds}
            progress={progress}
            isMobile={viewport.isMobile}
            isLandscapeMobile={viewport.isLandscapeMobile}
            onSelectMode={(next) => setMode(next)}
            onSelectDuration={(sec) => setDurationSeconds(sec)}
            onStart={handleStartFromTitle}
            onOpenShop={handleOpenShop}
            onOpenLoginRewards={handleOpenLoginRewards}
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
          onOpenRecipes={() => handleOpenShop('recipes')}
          onPause={handlePause}
          onRestart={handleRestart}
        />
      )}

      {/* Interactive Step-by-Step New Player Tutorial Overlay */}
      {phase === 'playing' && !shopOpen && tutorialGuide && (
        <TutorialOverlay
          guide={tutorialGuide}
          isMobile={viewport.isMobile}
          onNext={handleTutorialNext}
          onSkip={handleTutorialSkip}
        />
      )}

      {/* Left-Side Mobile Dash Trigger (tap kitchen directly to cook & serve) */}
      {phase === 'playing' && !shopOpen && viewport.isMobile && (
        <MobileControls
          isLandscapeMobile={viewport.isLandscapeMobile}
          onDash={handleMobileDash}
        />
      )}

      {/* Single Focused Modal for Paused / Time's Up / Challenge Results */}
      <GameModals
        phase={phase}
        stats={endStats}
        onResume={handleResume}
        onRestart={handleRestart}
        onOpenShop={handleOpenShop}
        onReplayTutorial={handleReplayTutorial}
        onReturnTitle={handleReturnTitle}
      />

      {/* Persistent Missions, Upgrades, Themes & Recipe/Milestone Book */}
      <BistroShopModal
        open={shopOpen}
        initialTab={shopTab}
        progress={progress}
        onBuyUpgrade={handleBuyUpgrade}
        onSelectTheme={handleSelectTheme}
        onClaimMission={handleClaimMission}
        onClaimAllClear={handleClaimAllClear}
        onClose={handleCloseShop}
      />

      {/* 7-Day Daily Login Rewards Modal */}
      <LoginRewardsModal
        open={loginRewardsOpen}
        progress={progress}
        onClaim={handleClaimLoginReward}
        onClose={handleCloseLoginRewards}
      />
    </div>
  );
}
