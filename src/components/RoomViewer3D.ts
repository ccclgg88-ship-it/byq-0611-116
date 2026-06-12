import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { HotspotData, HotspotsFile, ControlMode, MeasurePoint, Vec3 } from '../types';
import { distanceInMeters, formatMeters, midpoint } from '../utils/measure';
import { extractAABBsFromObject, resolveAABBCollision, type AABB } from '../utils/collision';

const EYE_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.35;
const MOVE_SPEED = 3.0;
const MOUSE_SENSITIVITY = 0.002;
const HOTSPOT_RADIUS = 0.22;

export interface RoomViewerCallbacks {
  onHotspotClick: (hotspot: HotspotData) => void;
  onHotspotHover: (hotspot: HotspotData | null) => void;
  onModeChange: (mode: ControlMode) => void;
  onMeasure: (meters: number | null) => void;
  onLoadError: (message: string) => void;
}

export class RoomViewer3D {
  private container: HTMLElement;
  private callbacks: RoomViewerCallbacks;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private orbit: OrbitControls | null = null;

  private modelRoot: THREE.Group | null = null;
  private hotspotGroup: THREE.Group | null = null;
  private measureGroup: THREE.Group | null = null;

  private wallAABBs: AABB[] = [];
  private hotspots: HotspotData[] = [];
  private hotspotMeshes: Map<string, THREE.Mesh> = new Map();
  private metersPerUnit = 1.0;

  private mode: ControlMode = 'orbit';
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private keys = new Set<string>();

  private yaw = 0;
  private pitch = 0;
  private prevPosition = new THREE.Vector3();
  private playerPosition = new THREE.Vector3(0, EYE_HEIGHT, 0);
  private isPointerLocked = false;

  private measurePoints: MeasurePoint[] = [];
  private measuring = false;

  private rafId = 0;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  constructor(container: HTMLElement, callbacks: RoomViewerCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  async init(gltfUrl: string, hotspotsUrl: string): Promise<void> {
    try {
      this.initRenderer();
      this.initScene();
      this.initCamera();
      this.initLights();
      this.initGrid();
      this.initOrbit();
      this.initEvents();
      this.startLoop();

      await Promise.all([this.loadGLTF(gltfUrl), this.loadHotspots(hotspotsUrl)]);
    } catch (err) {
      this.callbacks.onLoadError(err instanceof Error ? err.message : String(err));
      this.buildFallbackRoom();
    }
  }

  private initRenderer(): void {
    const canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(canvas);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf2efe8);
    this.scene.fog = new THREE.Fog(0xf2efe8, 15, 40);
  }

  private initCamera(): void {
    if (!this.scene) return;
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.05,
      200
    );
    this.camera.position.set(0, EYE_HEIGHT, 0);
  }

  private initLights(): void {
    if (!this.scene) return;
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 10, 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -10;
    dir.shadow.camera.right = 10;
    dir.shadow.camera.top = 10;
    dir.shadow.camera.bottom = -10;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 30;
    this.scene.add(dir);

    const fill = new THREE.DirectionalLight(0xfff4e5, 0.3);
    fill.position.set(-6, 5, -3);
    this.scene.add(fill);
  }

  private initGrid(): void {
    if (!this.scene) return;
    const grid = new THREE.GridHelper(20, 20, 0xbfb7a7, 0xd8d0c0);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.6;
    grid.position.y = 0.001;
    this.scene.add(grid);
  }

  private initOrbit(): void {
    if (!this.camera || !this.renderer) return;
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.target.set(0, 1.2, -3);
    this.orbit.minDistance = 1;
    this.orbit.maxDistance = 25;
    this.orbit.maxPolarAngle = Math.PI / 2 - 0.05;
    this.camera.position.set(5, 3.5, 4);
    this.orbit.update();
  }

  private initEvents(): void {
    if (!this.renderer) return;
    const canvas = this.renderer.domElement;

    canvas.addEventListener('click', (e) => this.onPointerClick(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    canvas.addEventListener('click', this.requestPointerLockIfWASD);
  }

  private onResize(): void {
    if (!this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private async loadGLTF(url: string): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    this.modelRoot = new THREE.Group();
    this.modelRoot.add(gltf.scene);
    this.modelRoot.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    this.scene?.add(this.modelRoot);
    this.extractWallColliders();
  }

  private extractWallColliders(): void {
    if (!this.modelRoot) return;
    this.wallAABBs = extractAABBsFromObject(this.modelRoot, /wall|ceiling/i);
    const furnAABBs = extractAABBsFromObject(this.modelRoot, /沙发|电视柜|茶几|书架|橱柜|冰箱|床|衣柜|床头柜/i);
    this.wallAABBs.push(...furnAABBs);
  }

  private async loadHotspots(url: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`热点加载失败: ${res.status}`);
    const data = (await res.json()) as HotspotsFile;
    this.hotspots = data.hotspots;
    this.metersPerUnit = data.metersPerUnit ?? 1.0;
    this.buildHotspotMeshes();
  }

  private buildHotspotMeshes(): void {
    if (!this.scene) return;
    this.hotspotGroup = new THREE.Group();
    this.hotspotMeshes.clear();

    const sphereGeo = new THREE.SphereGeometry(HOTSPOT_RADIUS, 16, 16);
    for (const hs of this.hotspots) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff6a3d,
        transparent: true,
        opacity: 0.85,
        depthTest: true
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.position.set(hs.position[0], hs.position[1], hs.position[2]);
      mesh.userData.hotspotId = hs.id;
      mesh.name = 'hotspot';
      this.hotspotGroup.add(mesh);
      this.hotspotMeshes.set(hs.id, mesh);
    }
    this.scene.add(this.hotspotGroup);
  }

  private buildFallbackRoom(): void {
    if (!this.scene) this.initScene();
    if (!this.camera) this.initCamera();
    if (!this.modelRoot) {
      this.modelRoot = new THREE.Group();
      this.scene?.add(this.modelRoot);
    }

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.1, 7),
      new THREE.MeshStandardMaterial({ color: 0xd2c4a8 })
    );
    floor.position.set(0, -0.05, -2.5);
    floor.receiveShadow = true;
    this.modelRoot.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf0ece2, side: THREE.DoubleSide });
    const walls = [
      { pos: [0, 1.4, -6], size: [14, 2.8, 0.1] },
      { pos: [0, 1.4, 1], size: [14, 2.8, 0.1] },
      { pos: [-7, 1.4, -2.5], size: [0.1, 2.8, 7] },
      { pos: [7, 1.4, -2.5], size: [0.1, 2.8, 7] }
    ];
    for (const w of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w.size[0], w.size[1], w.size[2]), wallMat);
      m.position.set(w.pos[0], w.pos[1], w.pos[2]);
      m.receiveShadow = true;
      this.modelRoot.add(m);
    }

    this.extractWallColliders();
    if (this.hotspots.length === 0) {
      this.hotspots = this.fallbackHotspots();
      this.buildHotspotMeshes();
    }
  }

  private fallbackHotspots(): HotspotData[] {
    return [
      {
        id: 'fb-hs-1',
        room: '客厅',
        position: [0, 0.9, -2],
        normal: [0, 1, 0],
        furnitureId: 'fb-fur-1',
        furnitureName: '客厅沙发区',
        tips: ['模型加载失败，已显示占位房间。请刷新页面重试。'],
        articleIds: []
      }
    ];
  }

  setControlMode(mode: ControlMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.callbacks.onModeChange(mode);

    if (mode === 'orbit') {
      document.exitPointerLock?.();
      if (this.orbit && this.camera) {
        this.orbit.enabled = true;
        this.orbit.target.copy(this.playerPosition.clone().add(new THREE.Vector3(0, 0, -3)));
        this.orbit.update();
      }
    } else {
      if (this.orbit) this.orbit.enabled = false;
      if (this.camera) {
        this.playerPosition.copy(this.camera.position);
        this.playerPosition.y = EYE_HEIGHT;
        this.yaw = Math.atan2(-this.camera.position.x, -this.camera.position.z) * 0;
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        this.yaw = Math.atan2(dir.x, dir.z);
        this.pitch = Math.asin(Math.max(-0.9, Math.min(0.9, dir.y)));
      }
    }
  }

  getControlMode(): ControlMode {
    return this.mode;
  }

  toggleMeasureMode(enabled: boolean): void {
    this.measuring = enabled;
    this.clearMeasure();
    if (!this.scene) return;
    if (enabled && !this.measureGroup) {
      this.measureGroup = new THREE.Group();
      this.scene.add(this.measureGroup);
    }
  }

  private clearMeasure(): void {
    this.measurePoints = [];
    this.callbacks.onMeasure(null);
    if (this.measureGroup) {
      while (this.measureGroup.children.length) {
        const c = this.measureGroup.children.pop()!;
        (c as THREE.Mesh).geometry?.dispose?.();
        ((c as THREE.Mesh).material as THREE.Material)?.dispose?.();
      }
    }
  }

  takeScreenshot(): string | null {
    if (!this.renderer || !this.scene || !this.camera) return null;
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  exportScreenshot(filename = 'room-view.png'): void {
    const dataUrl = this.takeScreenshot();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.code === 'Escape') {
      if (this.mode === 'wads') this.setControlMode('orbit');
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.renderer?.domElement;
  };

  private requestPointerLockIfWASD = (): void => {
    if (this.mode !== 'wads') return;
    if (this.measuring) return;
    this.renderer?.domElement.requestPointerLock?.();
  };

  private updatePointer(e: MouseEvent): void {
    if (!this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerMove(e: MouseEvent): void {
    this.updatePointer(e);

    if (this.mode === 'wads' && this.isPointerLocked) {
      this.yaw -= e.movementX * MOUSE_SENSITIVITY;
      this.pitch -= e.movementY * MOUSE_SENSITIVITY;
      this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch));
    }

    if (!this.measuring || this.mode === 'wads') {
      const hs = this.pickHotspot();
      this.callbacks.onHotspotHover(hs);
    }
  }

  private onPointerClick(e: MouseEvent): void {
    this.updatePointer(e);

    if (this.measuring) {
      const point = this.pickFloorPoint();
      if (point) {
        const screenPoint = this.worldToScreen(point);
        const mp: MeasurePoint = {
          position: { x: point.x, y: point.y, z: point.z },
          screenX: screenPoint.x,
          screenY: screenPoint.y
        };
        this.addMeasurePoint(mp);
      }
      return;
    }

    if (this.mode === 'orbit') {
      const hs = this.pickHotspot();
      if (hs) this.callbacks.onHotspotClick(hs);
    }
  }

  private addMeasurePoint(mp: MeasurePoint): void {
    this.measurePoints.push(mp);
    this.drawMeasureVisuals();
    if (this.measurePoints.length === 2) {
      const a = this.measurePoints[0].position;
      const b = this.measurePoints[1].position;
      this.callbacks.onMeasure(distanceInMeters(a, b, this.metersPerUnit));
    }
  }

  private drawMeasureVisuals(): void {
    if (!this.measureGroup) return;
    while (this.measureGroup.children.length) {
      const c = this.measureGroup.children.pop()!;
      (c as THREE.Mesh).geometry?.dispose?.();
      ((c as THREE.Mesh).material as THREE.Material)?.dispose?.();
    }

    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x2e7dff });
    for (const mp of this.measurePoints) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), sphereMat);
      s.position.set(mp.position.x, mp.position.y, mp.position.z);
      this.measureGroup.add(s);
    }

    if (this.measurePoints.length === 2) {
      const a = this.measurePoints[0].position;
      const b = this.measurePoints[1].position;
      const av = new THREE.Vector3(a.x, a.y, a.z);
      const bv = new THREE.Vector3(b.x, b.y, b.z);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([av, bv]);
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x2e7dff, linewidth: 2 }));
      this.measureGroup.add(line);

      const meters = distanceInMeters(a, b, this.metersPerUnit);
      const mid = midpoint(a, b);
      const canvas = this.makeTextSpriteCanvas(formatMeters(meters));
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
      sprite.position.set(mid.x, mid.y + 0.25, mid.z);
      sprite.scale.set(1.5, 0.4, 1);
      this.measureGroup.add(sprite);
    }
  }

  private makeTextSpriteCanvas(text: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;
    ctx.fillStyle = 'rgba(46,125,255,0.92)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    return canvas;
  }

  private worldToScreen(pos: Vec3): { x: number; y: number } {
    if (!this.camera || !this.renderer) return { x: 0, y: 0 };
    const v = new THREE.Vector3(pos.x, pos.y, pos.z).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * rect.width,
      y: (-v.y * 0.5 + 0.5) * rect.height
    };
  }

  private pickHotspot(): HotspotData | null {
    if (!this.camera || !this.hotspotGroup || !this.scene) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hotspotGroup.children, true);
    if (!hits.length) return null;
    const nearest = hits[0];
    const id = (nearest.object as THREE.Mesh).userData?.hotspotId as string | undefined;
    if (!id) return null;
    return this.hotspots.find((h) => h.id === id) ?? null;
  }

  private pickFloorPoint(): Vec3 | null {
    if (!this.camera || !this.scene) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, hit);
    if (!hit) return null;
    return { x: hit.x, y: hit.y, z: hit.z };
  }

  private startLoop(): void {
    const clock = new THREE.Clock();
    const tick = () => {
      if (this.disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      this.update(dt);
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private update(dt: number): void {
    if (this.mode === 'orbit') {
      this.orbit?.update();
      this.animateHotspots();
      return;
    }

    if (this.mode === 'wads' && this.camera) {
      this.prevPosition.copy(this.playerPosition);
      const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

      const move = new THREE.Vector3();
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(forward);
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(forward);
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(right);
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(right);

      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(MOVE_SPEED * dt);
        this.playerPosition.x += move.x;
        this.playerPosition.z += move.z;
      }

      const resolved = resolveAABBCollision(this.playerPosition, this.prevPosition, this.wallAABBs, PLAYER_RADIUS);
      this.playerPosition.copy(resolved);
      this.playerPosition.y = EYE_HEIGHT;

      this.camera.position.copy(this.playerPosition);
      const lookDir = new THREE.Vector3(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      this.camera.lookAt(this.camera.position.clone().add(lookDir));
    }

    this.animateHotspots();
  }

  private animateHotspots(): void {
    if (!this.hotspotGroup) return;
    const t = performance.now() * 0.003;
    this.hotspotGroup.children.forEach((child, i) => {
      if (child instanceof THREE.Mesh) {
        const s = 1 + Math.sin(t + i) * 0.08;
        child.scale.setScalar(s);
        child.lookAt(this.camera?.position ?? new THREE.Vector3());
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer?.domElement.removeEventListener('click', this.requestPointerLockIfWASD);
    this.resizeObserver?.disconnect();

    this.scene?.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });

    this.renderer?.dispose();
    if (this.renderer?.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
