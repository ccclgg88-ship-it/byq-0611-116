import type { TourRoute, TourStatus } from '../types';

export interface TourPanelCallbacks {
  onSelectRoute: (route: TourRoute) => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onStop: () => void;
  onGotoStep: (index: number) => void;
}

export class TourPanel {
  private root: HTMLElement;
  private routeList: HTMLElement;
  private activePanel: HTMLElement;
  private statusText: HTMLElement;
  private progressBar: HTMLElement;
  private narrationBox: HTMLElement;
  private stepDots: HTMLElement;
  private btnPlay: HTMLButtonElement;
  private btnPrev: HTMLButtonElement;
  private btnNext: HTMLButtonElement;
  private btnStop: HTMLButtonElement;
  private callbacks: TourPanelCallbacks;
  private routes: TourRoute[] = [];

  constructor(container: HTMLElement, callbacks: TourPanelCallbacks) {
    this.callbacks = callbacks;
    this.root = document.createElement('div');
    this.root.className = 'tour-panel';
    this.root.innerHTML = `
      <div class="tour-panel__list-wrap">
        <h4 class="tour-panel__title">🧭 智能导览路线</h4>
        <div class="tour-panel__route-list"></div>
      </div>
      <div class="tour-panel__active" style="display:none">
        <div class="tour-panel__active-header">
          <span class="tour-panel__active-icon"></span>
          <span class="tour-panel__active-name"></span>
          <span class="tour-panel__status"></span>
        </div>
        <div class="tour-panel__progress-wrap">
          <div class="tour-panel__progress-bar"><div class="tour-panel__progress-fill"></div></div>
          <div class="tour-panel__step-dots"></div>
        </div>
        <div class="tour-panel__narration"></div>
        <div class="tour-panel__controls">
          <button class="tour-panel__btn tour-panel__btn--stop" title="结束导览">⏹</button>
          <button class="tour-panel__btn tour-panel__btn--prev" title="上一步">⏮</button>
          <button class="tour-panel__btn tour-panel__btn--play" title="播放/暂停">▶</button>
          <button class="tour-panel__btn tour-panel__btn--next" title="下一步">⏭</button>
        </div>
      </div>
    `;
    container.appendChild(this.root);

    this.routeList = this.root.querySelector('.tour-panel__route-list') as HTMLElement;
    this.activePanel = this.root.querySelector('.tour-panel__active') as HTMLElement;
    this.statusText = this.root.querySelector('.tour-panel__status') as HTMLElement;
    this.progressBar = this.root.querySelector('.tour-panel__progress-fill') as HTMLElement;
    this.narrationBox = this.root.querySelector('.tour-panel__narration') as HTMLElement;
    this.stepDots = this.root.querySelector('.tour-panel__step-dots') as HTMLElement;
    this.btnPlay = this.root.querySelector('.tour-panel__btn--play') as HTMLButtonElement;
    this.btnPrev = this.root.querySelector('.tour-panel__btn--prev') as HTMLButtonElement;
    this.btnNext = this.root.querySelector('.tour-panel__btn--next') as HTMLButtonElement;
    this.btnStop = this.root.querySelector('.tour-panel__btn--stop') as HTMLButtonElement;

    this.btnPlay.addEventListener('click', () => this.callbacks.onPlayPause());
    this.btnPrev.addEventListener('click', () => this.callbacks.onPrev());
    this.btnNext.addEventListener('click', () => this.callbacks.onNext());
    this.btnStop.addEventListener('click', () => this.callbacks.onStop());
  }

  setRoutes(routes: TourRoute[]): void {
    this.routes = routes;
    this.renderRouteList();
  }

  private renderRouteList(): void {
    this.routeList.innerHTML = '';
    for (const r of this.routes) {
      const item = document.createElement('button');
      item.className = 'tour-panel__route-item';
      item.dataset.routeId = r.id;
      item.innerHTML = `
        <span class="tour-panel__route-icon">${r.icon}</span>
        <span class="tour-panel__route-info">
          <span class="tour-panel__route-name">${r.name}</span>
          <span class="tour-panel__route-summary">${r.summary}</span>
          <span class="tour-panel__route-steps">${r.steps.length} 个关键节点</span>
        </span>
        <span class="tour-panel__route-arrow">▶</span>
      `;
      item.addEventListener('click', () => {
        this.callbacks.onSelectRoute(r);
      });
      this.routeList.appendChild(item);
    }
  }

  showActivePanel(route: TourRoute): void {
    this.activePanel.style.display = 'block';
    (this.activePanel.querySelector('.tour-panel__active-icon') as HTMLElement).textContent = route.icon;
    (this.activePanel.querySelector('.tour-panel__active-name') as HTMLElement).textContent = route.name;

    this.stepDots.innerHTML = '';
    for (let i = 0; i < route.steps.length; i++) {
      const dot = document.createElement('button');
      dot.className = 'tour-panel__dot';
      dot.title = `${i + 1}. ${route.steps[i].narration.slice(0, 20)}`;
      dot.addEventListener('click', () => this.callbacks.onGotoStep(i));
      this.stepDots.appendChild(dot);
    }

    for (const el of this.routeList.querySelectorAll('.tour-panel__route-item')) {
      (el as HTMLElement).classList.toggle('is-active', (el as HTMLElement).dataset.routeId === route.id);
    }
  }

  hideActivePanel(): void {
    this.activePanel.style.display = 'none';
    for (const el of this.routeList.querySelectorAll('.tour-panel__route-item')) {
      (el as HTMLElement).classList.remove('is-active');
    }
  }

  setNarration(text: string): void {
    this.narrationBox.textContent = text;
  }

  updateStatus(status: TourStatus): void {
    const labels: Record<string, string> = {
      idle: '未开始',
      transitioning: '飞行中…',
      playing: '讲解中',
      paused: '已暂停',
      ended: '已完成'
    };
    this.statusText.textContent = status.state === 'idle' ? '' : labels[status.state] ?? status.state;

    const pct = Math.round(status.progress * 100);
    this.progressBar.style.width = `${pct}%`;

    const dots = this.stepDots.querySelectorAll('.tour-panel__dot');
    dots.forEach((dot, i) => {
      (dot as HTMLElement).classList.toggle('is-current', i === status.stepIndex && status.state !== 'idle' && status.state !== 'ended');
      (dot as HTMLElement).classList.toggle('is-done', i < status.stepIndex || status.state === 'ended');
    });

    this.btnPlay.textContent = status.state === 'paused' ? '▶' : '⏸';
    this.btnPrev.disabled = status.state === 'idle' || status.state === 'ended' || status.stepIndex === 0;
    this.btnNext.disabled = status.state === 'idle' || status.state === 'ended' || status.stepIndex >= status.totalSteps - 1;
    this.btnStop.disabled = status.state === 'idle';
  }

  dispose(): void {
    this.root.remove();
  }
}
