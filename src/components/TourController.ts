import type { TourRoute, TourState, TourStatus, TourStep, Vec3 } from '../types';
import { computeStepProgress } from '../utils/tour';

export interface TourControllerCallbacks {
  onStatusChange: (status: TourStatus) => void;
  onStepChange: (step: TourStep, route: TourRoute) => void;
  onEnd: () => void;
}

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

const DEFAULT_STEP_DURATION = 4000;

export class TourController {
  private route: TourRoute | null = null;
  private stepIndex = 0;
  private state: TourState = 'idle';
  private stepElapsed = 0;
  private stepStartTime = 0;
  private rafId = 0;
  private callbacks: TourControllerCallbacks;
  private running = false;

  constructor(callbacks: TourControllerCallbacks) {
    this.callbacks = callbacks;
  }

  getStatus(): TourStatus {
    return {
      state: this.state,
      routeId: this.route?.id ?? null,
      stepIndex: this.state === 'idle' ? 0 : this.stepIndex,
      totalSteps: this.route?.steps.length ?? 0,
      progress: this.computeOverallProgress()
    };
  }

  private computeOverallProgress(): number {
    if (!this.route || this.state === 'idle') return 0;
    if (this.state === 'ended') return 1;
    const perStep = 1 / this.route.steps.length;
    const stepProg = this.currentStepProgress();
    return (this.stepIndex + stepProg) * perStep;
  }

  currentStepProgress(): number {
    const dur = this.currentStepDuration();
    return computeStepProgress(this.stepElapsed, dur);
  }

  currentStepDuration(): number {
    return this.route?.steps[this.stepIndex]?.durationMs ?? DEFAULT_STEP_DURATION;
  }

  getCurrentStep(): TourStep | null {
    return this.route?.steps[this.stepIndex] ?? null;
  }

  getRoute(): TourRoute | null {
    return this.route;
  }

  start(route: TourRoute): void {
    this.route = route;
    this.stepIndex = 0;
    this.stepElapsed = 0;
    this.state = 'transitioning';
    this.notifyStep();
    this.emitStatus();
    this.startTicking();
  }

  pause(): void {
    if (this.state !== 'playing' && this.state !== 'transitioning') return;
    this.state = 'paused';
    this.stopTicking();
    this.emitStatus();
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'transitioning';
    this.stepStartTime = performance.now();
    this.startTicking();
    this.emitStatus();
  }

  togglePause(): void {
    if (this.state === 'paused') this.resume();
    else this.pause();
  }

  nextStep(): void {
    if (!this.route) return;
    if (this.stepIndex < this.route.steps.length - 1) {
      this.stepIndex++;
      this.stepElapsed = 0;
      this.state = 'transitioning';
      this.notifyStep();
      this.emitStatus();
      if (!this.running) this.startTicking();
    } else {
      this.end();
    }
  }

  prevStep(): void {
    if (!this.route) return;
    if (this.stepIndex > 0) {
      this.stepIndex--;
      this.stepElapsed = 0;
      this.state = 'transitioning';
      this.notifyStep();
      this.emitStatus();
      if (!this.running) this.startTicking();
    }
  }

  goToStep(index: number): void {
    if (!this.route) return;
    const clamped = Math.max(0, Math.min(this.route.steps.length - 1, index));
    if (clamped === this.stepIndex && this.state !== 'idle') return;
    this.stepIndex = clamped;
    this.stepElapsed = 0;
    this.state = 'transitioning';
    this.notifyStep();
    this.emitStatus();
    if (!this.running) this.startTicking();
  }

  stop(): void {
    this.stopTicking();
    this.route = null;
    this.stepIndex = 0;
    this.stepElapsed = 0;
    this.state = 'idle';
    this.emitStatus();
  }

  private end(): void {
    this.stopTicking();
    this.state = 'ended';
    this.emitStatus();
    this.callbacks.onEnd();
  }

  private notifyStep(): void {
    if (this.route && this.route.steps[this.stepIndex]) {
      this.callbacks.onStepChange(this.route.steps[this.stepIndex], this.route);
    }
  }

  private emitStatus(): void {
    this.callbacks.onStatusChange(this.getStatus());
  }

  private startTicking(): void {
    if (this.running) return;
    this.running = true;
    this.stepStartTime = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = now - this.stepStartTime;
      this.stepStartTime = now;
      const dur = this.currentStepDuration();
      if (this.state === 'transitioning') {
        this.stepElapsed += dt;
        if (this.stepElapsed >= dur) {
          this.stepElapsed = dur;
          this.state = 'playing';
          this.emitStatus();
        } else {
          this.emitStatus();
        }
      } else if (this.state === 'playing') {
        this.stepElapsed += dt;
        const holdDur = dur + 1500;
        if (this.stepElapsed >= holdDur) {
          if (this.stepIndex < (this.route?.steps.length ?? 0) - 1) {
            this.nextStep();
          } else {
            this.end();
          }
          return;
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopTicking(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }
}
