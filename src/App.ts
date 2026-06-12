import { RoomViewer3D } from './components/RoomViewer3D';
import { HotspotPanel } from './components/HotspotPanel';
import { FloorPlanFallback } from './components/FloorPlanFallback';
import { isWebGLSupported } from './utils/webgl';
import { formatMeters } from './utils/measure';
import type { ArticleData, ArticlesFile, ControlMode, HotspotData, HotspotsFile } from './types';

const GLTF_URL = '/models/room.gltf';
const HOTSPOTS_URL = '/room-hotspots.json';
const ARTICLES_URL = '/mock-articles.json';

export class App {
  private root: HTMLElement;
  private viewer3dWrap: HTMLElement;
  private toolbar: HTMLElement;
  private measureBadge: HTMLElement;
  private errorToast: HTMLElement;
  private loading: HTMLElement;

  private viewer: RoomViewer3D | null = null;
  private panel: HotspotPanel | null = null;
  private fallback: FloorPlanFallback | null = null;

  private articles: ArticleData[] = [];
  private hotspots: HotspotData[] = [];
  private measureMode = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'app';

    this.root.innerHTML = `
      <header class="app__header">
        <h1 class="app__title">🏡 生活百科 · 家居布置 3D 漫游</h1>
        <div class="app__toolbar"></div>
      </header>
      <div class="app__main">
        <div class="app__viewer-wrap">
          <div class="app__loading">加载户型模型中…</div>
          <div class="app__error-toast" style="display:none"></div>
          <div class="app__viewer"></div>
          <div class="app__measure-badge" style="display:none"></div>
        </div>
        <div class="app__panel"></div>
      </div>
    `;

    this.viewer3dWrap = this.root.querySelector('.app__viewer') as HTMLElement;
    this.toolbar = this.root.querySelector('.app__toolbar') as HTMLElement;
    this.measureBadge = this.root.querySelector('.app__measure-badge') as HTMLElement;
    this.errorToast = this.root.querySelector('.app__error-toast') as HTMLElement;
    this.loading = this.root.querySelector('.app__loading') as HTMLElement;

    this.buildToolbar();
  }

  private buildToolbar(): void {
    const btnOrbit = this.mkBtn('orbit', '🖱️ 环绕模式', true);
    const btnWads = this.mkBtn('wads', '🚶 WASD 漫游', false);
    const btnMeasure = this.mkBtn('measure', '📏 测量距离', false);
    const btnShot = this.mkBtn('shot', '📸 截图导出', false);

    btnOrbit.addEventListener('click', () => {
      this.setMeasureMode(false);
      this.viewer?.setControlMode('orbit');
    });
    btnWads.addEventListener('click', () => {
      this.setMeasureMode(false);
      this.viewer?.setControlMode('wads');
    });
    btnMeasure.addEventListener('click', () => {
      this.setMeasureMode(!this.measureMode);
    });
    btnShot.addEventListener('click', () => {
      this.viewer?.exportScreenshot(`room-${Date.now()}.png`);
    });

    this.toolbar.append(btnOrbit, btnWads, btnMeasure, btnShot);

    const hint = document.createElement('div');
    hint.className = 'app__hint';
    hint.innerHTML = '提示：环绕模式下鼠标拖动旋转、滚轮缩放；WASD 模式点击画布锁定鼠标，Esc 退出';
    this.toolbar.appendChild(hint);
  }

  private mkBtn(id: string, label: string, active: boolean): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = `app__btn app__btn--${id}${active ? ' is-active' : ''}`;
    b.textContent = label;
    return b;
  }

  private setButtonActive(id: string, active: boolean): void {
    const b = this.toolbar.querySelector(`.app__btn--${id}`) as HTMLElement | null;
    if (b) b.classList.toggle('is-active', active);
  }

  private setMeasureMode(enabled: boolean): void {
    this.measureMode = enabled;
    this.setButtonActive('measure', enabled);
    this.viewer?.toggleMeasureMode(enabled);
    if (enabled) {
      this.measureBadge.style.display = 'block';
      this.measureBadge.textContent = '📏 测量模式：在地面点击两点查看距离';
      this.viewer?.setControlMode('orbit');
    } else {
      this.measureBadge.style.display = 'none';
    }
  }

  async start(): Promise<void> {
    try {
      await this.loadStaticData();
    } catch (err) {
      this.showError('热点或文章数据加载失败：' + (err instanceof Error ? err.message : String(err)));
      this.hotspots = [];
      this.articles = [];
    }

    this.panel = new HotspotPanel(this.root.querySelector('.app__panel') as HTMLElement);
    this.panel.setArticles(this.articles);
    this.panel.onClose(() => this.setMeasureMode(this.measureMode));

    if (!isWebGLSupported()) {
      this.loading.style.display = 'none';
      this.showError('当前设备不支持 WebGL，已降级为平面图视图。');
      this.mountFallback();
      return;
    }

    this.viewer = new RoomViewer3D(this.viewer3dWrap, {
      onHotspotClick: (hs) => this.panel?.show(hs),
      onHotspotHover: () => {},
      onModeChange: (m: ControlMode) => {
        this.setButtonActive('orbit', m === 'orbit');
        this.setButtonActive('wads', m === 'wads');
      },
      onMeasure: (m) => {
        if (m == null) {
          this.measureBadge.textContent = '📏 测量模式：在地面点击两点查看距离';
        } else {
          this.measureBadge.textContent = `📏 已测量：${formatMeters(m)}（再次点击地面重置）`;
        }
      },
      onLoadError: (msg) => this.showError('模型加载异常：' + msg)
    });

    try {
      await this.viewer.init(GLTF_URL, HOTSPOTS_URL);
      this.loading.style.display = 'none';
    } catch (err) {
      this.loading.style.display = 'none';
      this.showError('初始化失败：' + (err instanceof Error ? err.message : String(err)));
    }
  }

  private mountFallback(): void {
    this.fallback = new FloorPlanFallback(this.viewer3dWrap, {
      onHotspotClick: (hs) => this.panel?.show(hs)
    });
    this.fallback.setArticles(this.articles);
    this.fallback.setHotspots(this.hotspots);

    for (const b of this.toolbar.querySelectorAll('.app__btn')) {
      (b as HTMLButtonElement).disabled = true;
    }
    const hint = this.toolbar.querySelector('.app__hint') as HTMLElement;
    if (hint) hint.style.display = 'none';
  }

  private async loadStaticData(): Promise<void> {
    const [hs, arts] = await Promise.all([
      fetch(HOTSPOTS_URL).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<HotspotsFile>;
      }),
      fetch(ARTICLES_URL).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ArticlesFile>;
      })
    ]);
    this.hotspots = hs.hotspots;
    this.articles = arts.articles;
  }

  private showError(msg: string): void {
    this.errorToast.textContent = '⚠️ ' + msg;
    this.errorToast.style.display = 'block';
    setTimeout(() => {
      this.errorToast.style.display = 'none';
    }, 6000);
  }

  dispose(): void {
    this.viewer?.dispose();
    this.panel?.dispose();
    this.fallback?.dispose();
    this.root.innerHTML = '';
  }
}
