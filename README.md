# 生活百科 · 家居布置 3D 漫游 (RoomViewer3D)

基于 Three.js + TypeScript + Vite 构建的三维户型漫游与收纳建议展示系统。

## 功能概览

- **三维场景**：Three.js 加载 glTF 户型模型，环境光 + 定向光 + 补光，PCF 软阴影，地面网格辅助。
- **双模式漫游**：Orbit 环绕模式与 WASD 第一人称漫游模式一键切换；漫游模式眼高锁定 1.6m，AABB 碰撞防止穿墙。
- **热点交互**：Raycaster 拾取橙色热点球，点击侧栏展示家具收纳 / 动线建议与关联百科文章。热点重叠时优先返回射线最近命中点。
- **测量工具**：地面两点测距，世界坐标 Euclidean 距离 × `metersPerUnit`，米制显示。
- **截图导出**：当前视角 PNG 一键下载。
- **降级方案**：
  - WebGL 不支持 → SVG 平面图 + 按房间分组折叠的热点列表。
  - glTF 加载失败 → BoxGeometry 占位房间 + 错误提示。

## 快速开始

```bash
# 安装依赖
npm install

# 生成简化户型 glTF 模型
node scripts/generate-gltf.mjs

# 开发
npm run dev

# 单元测试（测距函数）
npm test

# 构建生产包
npm run build
```

构建产物位于 `dist/`，可由任意静态服务器托管。

## Docker 部署

```bash
docker-compose up -d
# 访问 http://localhost:8080
```

Nginx 已配置 glTF/glb 的 MIME 类型 `model/gltf+json` 与 gzip 压缩。

## 项目结构

```
├── public/
│   ├── models/
│   │   └── room.gltf              # 由 generate-gltf.mjs 生成的简化户型
│   ├── room-hotspots.json         # 热点定义（9 个热点，覆盖 3 房间）
│   ├── mock-articles.json         # 生活百科 Mock 文章
│   └── tour-routes.json           # 智能导览路线（3 条路线：全屋速览 / 客厅收纳动线 / 厨房黄金三角）
├── scripts/
│   └── generate-gltf.mjs          # glTF 程序化生成脚本
├── docs/
│   └── hotspot-schema.md          # 热点 JSON Schema 文档
├── src/
│   ├── components/
│   │   ├── RoomViewer3D.ts        # Three.js 3D 场景主控制器（含 startTourStep / stopTour / 热点高亮）
│   │   ├── HotspotPanel.ts        # 侧栏热点详情面板
│   │   ├── FloorPlanFallback.ts   # WebGL 不可用时的平面图降级视图（含导览路线绘制）
│   │   ├── TourController.ts      # 导览状态机（播放 / 暂停 / 上一步 / 下一步 / 进度）
│   │   └── TourPanel.ts           # 导览 UI：路线列表 + 播放控件 + 进度显示
│   ├── utils/
│   │   ├── measure.ts             # 测距核心函数 + formatMeters
│   │   ├── measure.test.ts        # 11 个测距相关单测
│   │   ├── tour.ts                # 相机弧线插值、缓动函数、路线校验工具
│   │   ├── tour.test.ts           # 28 个导览工具相关单测
│   │   ├── collision.ts           # AABB 碰撞检测与墙体解算
│   │   └── webgl.ts               # WebGL 能力检测
│   ├── types.ts                   # 共享 TS 类型
│   ├── App.ts                     # 应用装配与状态协调
│   ├── main.ts                    # 入口
│   └── styles.css                 # 全部样式
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── vite.config.ts
└── tsconfig.json
```

## glTF 路径

当前默认路径：`/models/room.gltf`。模型由 `scripts/generate-gltf.mjs` 生成，基于盒体几何（墙/地板/家具占位）。替换真实模型时参见 `docs/hotspot-schema.md`。

## 业务规则

1. 漫游模式相机高度锁定 `EYE_HEIGHT = 1.6m`。
2. 热点 ≥ 8，覆盖客厅 / 厨房 / 卧室 ≥ 3 个空间（当前配置 9 个）。
3. 平面图降级视图热点按 `room` 字段分组折叠。
4. 测距以 `metersPerUnit`（默认 `1.0`）换算为米。

## 技术栈

- **渲染**：Three.js `^0.172`（GLTFLoader / OrbitControls / PointerLock）
- **语言**：TypeScript `^5.6`（strict 模式）
- **构建**：Vite `^6`
- **测试**：Vitest `^3`
- **部署**：nginx:1.27-alpine 静态托管
