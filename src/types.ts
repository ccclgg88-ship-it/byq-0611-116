export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface HotspotData {
  id: string;
  room: string;
  position: [number, number, number];
  normal: [number, number, number];
  furnitureId: string;
  furnitureName: string;
  tips: string[];
  articleIds: string[];
}

export interface HotspotsFile {
  metersPerUnit: number;
  hotspots: HotspotData[];
}

export interface ArticleData {
  id: string;
  title: string;
  summary: string;
  category: string;
  url: string;
}

export interface ArticlesFile {
  articles: ArticleData[];
}

export type ControlMode = 'orbit' | 'wads';

export interface MeasurePoint {
  position: Vec3;
  screenX: number;
  screenY: number;
}

export interface TourStep {
  id: string;
  hotspotId: string;
  narration: string;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  durationMs?: number;
}

export interface TourRoute {
  id: string;
  name: string;
  summary: string;
  icon: string;
  steps: TourStep[];
}

export interface TourRoutesFile {
  routes: TourRoute[];
}

export type TourState = 'idle' | 'playing' | 'paused' | 'transitioning' | 'ended';

export interface TourStatus {
  state: TourState;
  routeId: string | null;
  stepIndex: number;
  totalSteps: number;
  progress: number;
}
