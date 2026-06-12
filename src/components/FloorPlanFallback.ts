import type { ArticleData, HotspotData, TourStep } from '../types';

export interface FloorPlanFallbackCallbacks {
  onHotspotClick: (hotspot: HotspotData) => void;
}

interface RoomGroup {
  name: string;
  hotspots: HotspotData[];
  expanded: boolean;
}

const ROOM_COLORS: Record<string, string> = {
  客厅: '#fef3e2',
  厨房: '#e8f4f8',
  卧室: '#f4ecfa'
};

export class FloorPlanFallback {
  private root: HTMLElement;
  private planSvg: SVGSVGElement;
  private listRoot: HTMLElement;
  private callbacks: FloorPlanFallbackCallbacks;
  private articlesMap: Map<string, ArticleData> = new Map();
  private groups: RoomGroup[] = [];
  private allHotspots: HotspotData[] = [];
  private tourPathG: SVGGElement | null = null;
  private tourMarkers: Map<string, SVGElement> = new Map();
  private activeTourSteps: TourStep[] = [];

  constructor(_container: HTMLElement, callbacks: FloorPlanFallbackCallbacks) {
    this.callbacks = callbacks;

    this.root = document.createElement('div');
    this.root.className = 'floorplan';
    this.root.innerHTML = `
      <div class="floorplan__header">
        <h3>🗺️ 户型平面图（WebGL 不可用降级视图）</h3>
        <p class="floorplan__hint">点击下方房间名称折叠/展开热点，或点击图中标记查看建议</p>
      </div>
      <div class="floorplan__content">
        <div class="floorplan__svg-wrap">
          <svg viewBox="-7.5 -6.5 15 8" class="floorplan__svg" xmlns="http://www.w3.org/2000/svg"></svg>
        </div>
        <div class="floorplan__list"></div>
      </div>
    `;
    _container.appendChild(this.root);

    this.planSvg = this.root.querySelector('.floorplan__svg') as SVGSVGElement;
    this.listRoot = this.root.querySelector('.floorplan__list') as HTMLElement;

    this.drawFloorPlan();
  }

  setArticles(articles: ArticleData[]): void {
    this.articlesMap.clear();
    for (const a of articles) this.articlesMap.set(a.id, a);
  }

  setHotspots(hotspots: HotspotData[]): void {
    this.allHotspots = hotspots;
    const grouped = new Map<string, HotspotData[]>();
    for (const hs of hotspots) {
      if (!grouped.has(hs.room)) grouped.set(hs.room, []);
      grouped.get(hs.room)!.push(hs);
    }
    this.groups = Array.from(grouped.entries()).map(([name, list]) => ({
      name,
      hotspots: list,
      expanded: true
    }));
    this.drawHotspots(hotspots);
    this.renderList();
  }

  private drawFloorPlan(): void {
    const NS = 'http://www.w3.org/2000/svg';

    const rooms = [
      { x: -7, y: -6, w: 8.5, h: 7, name: '卧室', color: ROOM_COLORS['卧室'] },
      { x: 1.5, y: -6, w: 5.5, h: 4.5, name: '厨房', color: ROOM_COLORS['厨房'] },
      { x: -7, y: -6, w: 14, h: 7, name: '客厅', color: ROOM_COLORS['客厅'] }
    ];

    const order = ['客厅', '卧室', '厨房'];
    for (const name of order) {
      const r = rooms.find((x) => x.name === name)!;
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', String(r.x));
      rect.setAttribute('y', String(r.y));
      rect.setAttribute('width', String(r.w));
      rect.setAttribute('height', String(r.h));
      rect.setAttribute('fill', r.color);
      rect.setAttribute('stroke', '#8c7b65');
      rect.setAttribute('stroke-width', '0.08');
      this.planSvg.appendChild(rect);

      const label = document.createElementNS(NS, 'text');
      label.setAttribute('x', String(r.x + r.w / 2));
      label.setAttribute('y', String(r.y + r.h / 2));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('font-size', '0.4');
      label.setAttribute('fill', '#6b5a45');
      label.setAttribute('font-weight', '600');
      label.textContent = r.name;
      this.planSvg.appendChild(label);
    }

    const walls = [
      { x: -7, y: -6, w: 14, h: 0.1 },
      { x: -7, y: 0.9, w: 14, h: 0.1 },
      { x: -7, y: -6, w: 0.1, h: 7 },
      { x: 6.9, y: -6, w: 0.1, h: 7 },
      { x: 1.4, y: -6, w: 0.1, h: 3.5 }
    ];
    for (const w of walls) {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', String(w.x));
      rect.setAttribute('y', String(w.y));
      rect.setAttribute('width', String(w.w));
      rect.setAttribute('height', String(w.h));
      rect.setAttribute('fill', '#5a4d3d');
      this.planSvg.appendChild(rect);
    }
  }

  private renderList(): void {
    this.listRoot.innerHTML = '';
    for (let gi = 0; gi < this.groups.length; gi++) {
      const g = this.groups[gi];
      const item = document.createElement('div');
      item.className = 'floorplan__group';

      const header = document.createElement('button');
      header.className = 'floorplan__group-head';
      header.innerHTML = `
        <span class="floorplan__chevron ${g.expanded ? 'expanded' : ''}">▶</span>
        <span class="floorplan__group-name">${g.name}</span>
        <span class="floorplan__group-count">${g.hotspots.length} 个热点</span>
      `;
      header.addEventListener('click', () => {
        g.expanded = !g.expanded;
        (header.querySelector('.floorplan__chevron') as HTMLElement).classList.toggle('expanded', g.expanded);
        body.style.display = g.expanded ? 'block' : 'none';
      });

      const body = document.createElement('div');
      body.className = 'floorplan__group-body';
      body.style.display = g.expanded ? 'block' : 'none';

      const ul = document.createElement('ul');
      ul.className = 'floorplan__hotspots';
      for (const hs of g.hotspots) {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.className = 'floorplan__hotspot-btn';
        btn.innerHTML = `
          <span class="floorplan__dot"></span>
          <span class="floorplan__hotspot-name">${hs.furnitureName}</span>
        `;
        btn.addEventListener('click', () => this.callbacks.onHotspotClick(hs));
        li.appendChild(btn);

        const tips = document.createElement('ol');
        tips.className = 'floorplan__hotspot-tips';
        for (const tip of hs.tips) {
          const tipLi = document.createElement('li');
          tipLi.textContent = tip;
          tips.appendChild(tipLi);
        }
        li.appendChild(tips);

        if (hs.articleIds.length) {
          const arts = document.createElement('div');
          arts.className = 'floorplan__hotspot-articles';
          arts.innerHTML = '<span>相关文章：</span>';
          for (const aid of hs.articleIds) {
            const art = this.articlesMap.get(aid);
            if (!art) continue;
            const a = document.createElement('a');
            a.href = art.url;
            a.target = '_blank';
            a.rel = 'noreferrer';
            a.textContent = art.title;
            arts.appendChild(a);
          }
          li.appendChild(arts);
        }

        ul.appendChild(li);
      }
      body.appendChild(ul);

      item.appendChild(header);
      item.appendChild(body);
      this.listRoot.appendChild(item);
    }
  }

  private drawHotspots(hotspots: HotspotData[]): void {
    const NS = 'http://www.w3.org/2000/svg';
    this.tourMarkers.clear();
    for (const hs of hotspots) {
      const g = document.createElementNS(NS, 'g');
      g.style.cursor = 'pointer';
      g.setAttribute('transform', `translate(${hs.position[0]}, ${-hs.position[2] - 2.5})`);

      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('r', '0.25');
      circle.setAttribute('fill', '#ff6a3d');
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '0.05');
      circle.dataset.hotspotId = hs.id;

      const label = document.createElementNS(NS, 'text');
      label.setAttribute('y', '-0.4');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '0.25');
      label.setAttribute('fill', '#333');
      label.setAttribute('font-weight', '600');
      label.textContent = hs.furnitureName;

      g.appendChild(circle);
      g.appendChild(label);

      g.addEventListener('click', () => this.callbacks.onHotspotClick(hs));
      g.addEventListener('mouseenter', () => {
        if (circle.dataset.isActive !== '1') circle.setAttribute('fill', '#ff8a5d');
      });
      g.addEventListener('mouseleave', () => {
        if (circle.dataset.isActive !== '1' && circle.dataset.isDone !== '1') {
          circle.setAttribute('fill', this.activeTourSteps.length ? '#d98c6a' : '#ff6a3d');
        }
      });

      this.planSvg.appendChild(g);
      this.tourMarkers.set(hs.id, circle);
    }
  }

  setActiveTourRoute(steps: TourStep[]): void {
    this.clearActiveTourRoute();
    this.activeTourSteps = steps;
    if (!steps.length) return;

    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'floorplan__tour-path');

    const points = steps.map((s) => {
      const hs = this.allHotspots.find((h) => h.id === s.hotspotId);
      if (!hs) return null;
      return { x: hs.position[0], y: -hs.position[2] - 2.5 };
    }).filter((p): p is { x: number; y: number } => p !== null);

    if (points.length >= 2) {
      const d = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(3) + ' ' + p.y.toFixed(3)).join(' ');
      const line = document.createElementNS(NS, 'path');
      line.setAttribute('d', d);
      line.setAttribute('stroke', '#f59e0b');
      line.setAttribute('stroke-width', '0.12');
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke-dasharray', '0.3 0.15');
      line.setAttribute('stroke-linecap', 'round');
      g.appendChild(line);

      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const arrow = document.createElementNS(NS, 'polygon');
        arrow.setAttribute('points', '0.18,0 -0.09,-0.1 -0.09,0.1');
        arrow.setAttribute('transform', `translate(${mx.toFixed(3)} ${my.toFixed(3)}) rotate(${angle.toFixed(1)})`);
        arrow.setAttribute('fill', '#f59e0b');
        g.appendChild(arrow);
      }
    }

    for (let i = 0; i < steps.length; i++) {
      const hs = this.allHotspots.find((h) => h.id === steps[i].hotspotId);
      const circle = hs ? this.tourMarkers.get(hs.id) : null;
      if (!circle) continue;
      circle.setAttribute('fill', '#d98c6a');
      circle.setAttribute('r', '0.3');

      const lbl = document.createElementNS(NS, 'text');
      const hs2 = this.allHotspots.find((h) => h.id === steps[i].hotspotId)!;
      lbl.setAttribute('x', String(hs2.position[0]));
      lbl.setAttribute('y', String(-hs2.position[2] - 2.5));
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('dominant-baseline', 'middle');
      lbl.setAttribute('font-size', '0.28');
      lbl.setAttribute('font-weight', '700');
      lbl.setAttribute('fill', '#fff');
      lbl.textContent = String(i + 1);
      g.appendChild(lbl);
    }

    this.planSvg.appendChild(g);
    this.tourPathG = g;
  }

  setActiveStepIndex(index: number): void {
    this.tourMarkers.forEach((circle, id) => {
      const stepIdx = this.activeTourSteps.findIndex((s) => s.hotspotId === id);
      if (stepIdx < 0) {
        circle.removeAttribute('data-is-active');
        circle.removeAttribute('data-is-done');
        circle.setAttribute('fill', this.activeTourSteps.length ? '#d98c6a' : '#ff6a3d');
        circle.setAttribute('r', '0.25');
        return;
      }
      if (stepIdx === index) {
        circle.dataset.isActive = '1';
        circle.removeAttribute('data-is-done');
        circle.setAttribute('fill', '#ffffff');
        circle.setAttribute('stroke', '#f59e0b');
        circle.setAttribute('stroke-width', '0.1');
        circle.setAttribute('r', '0.42');
      } else if (stepIdx < index) {
        circle.removeAttribute('data-is-active');
        circle.dataset.isDone = '1';
        circle.setAttribute('fill', '#10b981');
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '0.05');
        circle.setAttribute('r', '0.3');
      } else {
        circle.removeAttribute('data-is-active');
        circle.removeAttribute('data-is-done');
        circle.setAttribute('fill', '#d98c6a');
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '0.05');
        circle.setAttribute('r', '0.3');
      }
    });
  }

  clearActiveTourRoute(): void {
    this.activeTourSteps = [];
    if (this.tourPathG) {
      this.tourPathG.remove();
      this.tourPathG = null;
    }
    this.tourMarkers.forEach((circle, id) => {
      circle.removeAttribute('data-is-active');
      circle.removeAttribute('data-is-done');
      circle.setAttribute('fill', '#ff6a3d');
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '0.05');
      circle.setAttribute('r', '0.25');
      void id;
    });
  }

  dispose(): void {
    this.root.remove();
  }
}
