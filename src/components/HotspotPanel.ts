import type { ArticleData, HotspotData } from '../types';

export class HotspotPanel {
  private root: HTMLElement;
  private header: HTMLElement;
  private tipsList: HTMLElement;
  private articlesList: HTMLElement;
  private closeBtn: HTMLElement;
  private emptyState: HTMLElement;
  private articlesMap: Map<string, ArticleData> = new Map();
  private currentHotspot: HotspotData | null = null;
  private onCloseCallback: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement('aside');
    this.root.className = 'hotspot-panel';
    this.root.innerHTML = `
      <div class="hotspot-panel__header">
        <div class="hotspot-panel__title">
          <span class="hotspot-panel__room"></span>
          <span class="hotspot-panel__furniture"></span>
        </div>
        <button class="hotspot-panel__close" aria-label="关闭">×</button>
      </div>
      <div class="hotspot-panel__empty">
        <div class="hotspot-panel__empty-icon">🏠</div>
        <p>点击场景中橙色热点查看收纳与动线建议</p>
      </div>
      <div class="hotspot-panel__body" style="display:none">
        <section class="hotspot-panel__section">
          <h4>💡 收纳 / 动线建议</h4>
          <ol class="hotspot-panel__tips"></ol>
        </section>
        <section class="hotspot-panel__section">
          <h4>📚 相关百科</h4>
          <ul class="hotspot-panel__articles"></ul>
        </section>
      </div>
    `;
    container.appendChild(this.root);

    this.header = this.root.querySelector('.hotspot-panel__header') as HTMLElement;
    this.tipsList = this.root.querySelector('.hotspot-panel__tips') as HTMLElement;
    this.articlesList = this.root.querySelector('.hotspot-panel__articles') as HTMLElement;
    this.closeBtn = this.root.querySelector('.hotspot-panel__close') as HTMLElement;
    this.emptyState = this.root.querySelector('.hotspot-panel__empty') as HTMLElement;

    this.closeBtn.addEventListener('click', () => {
      this.clear();
      this.onCloseCallback?.();
    });
  }

  setArticles(articles: ArticleData[]): void {
    this.articlesMap.clear();
    for (const a of articles) this.articlesMap.set(a.id, a);
    if (this.currentHotspot) this.renderArticles(this.currentHotspot);
  }

  show(hotspot: HotspotData): void {
    this.currentHotspot = hotspot;
    this.emptyState.style.display = 'none';
    (this.root.querySelector('.hotspot-panel__body') as HTMLElement).style.display = 'block';
    (this.header.querySelector('.hotspot-panel__room') as HTMLElement).textContent = hotspot.room;
    (this.header.querySelector('.hotspot-panel__furniture') as HTMLElement).textContent = hotspot.furnitureName;

    this.tipsList.innerHTML = '';
    for (const tip of hotspot.tips) {
      const li = document.createElement('li');
      li.textContent = tip;
      this.tipsList.appendChild(li);
    }

    this.renderArticles(hotspot);
  }

  private renderArticles(hotspot: HotspotData): void {
    this.articlesList.innerHTML = '';
    const items = hotspot.articleIds
      .map((id) => this.articlesMap.get(id))
      .filter((a): a is ArticleData => !!a);

    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'hotspot-panel__articles-empty';
      li.textContent = '暂无相关文章';
      this.articlesList.appendChild(li);
      return;
    }

    for (const art of items) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = art.url;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.innerHTML = `
        <span class="hotspot-panel__art-title">${art.title}</span>
        <span class="hotspot-panel__art-summary">${art.summary}</span>
      `;
      li.appendChild(a);
      this.articlesList.appendChild(li);
    }
  }

  clear(): void {
    this.currentHotspot = null;
    this.emptyState.style.display = 'block';
    (this.root.querySelector('.hotspot-panel__body') as HTMLElement).style.display = 'none';
  }

  onClose(cb: () => void): void {
    this.onCloseCallback = cb;
  }

  dispose(): void {
    this.root.remove();
  }
}
