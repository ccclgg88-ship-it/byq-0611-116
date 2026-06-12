import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public/models');
const OUT_FILE = path.join(OUT_DIR, 'room.gltf');

const room = {
  walls: [
    { min: [-7, 0, -6], max: [7, 2.8, -6] },
    { min: [-7, 0, 1], max: [7, 2.8, 1] },
    { min: [-7, 0, -6], max: [-7, 2.8, 1] },
    { min: [7, 0, -6], max: [7, 2.8, 1] },
    { min: [-1.5, 0, -6], max: [-1.5, 2.2, -5.8], door: true },
    { min: [2, 0, -6], max: [2, 2.2, -5.8], door: true }
  ],
  floor: { min: [-7, 0, -6], max: [7, 0, 1] },
  ceiling: { min: [-7, 2.8, -6], max: [7, 2.8, 1] },
  furniture: [
    { id: 'fur-sofa-01', name: '沙发', min: [-1.5, 0, -2.5], max: [1.5, 0.9, -1.3], color: [0.75, 0.68, 0.6] },
    { id: 'fur-tv-01', name: '电视柜', min: [-1.8, 0.4, -5.7], max: [1.8, 1.2, -5.3], color: [0.35, 0.28, 0.22] },
    { id: 'fur-coffee-01', name: '茶几', min: [-0.8, 0.2, -3.8], max: [0.8, 0.5, -3.1], color: [0.9, 0.85, 0.75] },
    { id: 'fur-bookshelf-01', name: '书架', min: [2.3, 0, -5.7], max: [3.3, 2.2, -5.3], color: [0.5, 0.45, 0.35] },
    { id: 'fur-kitchen-01', name: '橱柜', min: [3.7, 0, -3.5], max: [6.5, 0.9, -1.5], color: [0.85, 0.8, 0.72] },
    { id: 'fur-fridge-01', name: '冰箱', min: [5.7, 0, -1.2], max: [6.7, 2.0, 0.2], color: [0.92, 0.92, 0.95] },
    { id: 'fur-bed-01', name: '床', min: [-6, 0.3, -3.8], max: [-3, 0.6, -1.5], color: [0.65, 0.58, 0.52] },
    { id: 'fur-wardrobe-01', name: '衣柜', min: [-6.7, 0, -4.5], max: [-5.7, 2.6, -0.8], color: [0.55, 0.4, 0.3] },
    { id: 'fur-nightstand-01', name: '床头柜', min: [-3.5, 0, -2], max: [-2.9, 0.55, -1.4], color: [0.5, 0.4, 0.32] }
  ]
};

function makeBox(min, max, color) {
  const dx = max[0] - min[0];
  const dy = max[1] - min[1];
  const dz = max[2] - min[2];
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const cz = (min[2] + max[2]) / 2;
  return { size: [dx, dy, dz], center: [cx, cy, cz], color };
}

function buildGLTF() {
  const meshes = [];
  const nodes = [];
  const materials = [];
  const accessors = [];
  const bufferViews = [];
  const buffers = [];

  const allBoxes = [];

  for (const w of room.walls) {
    allBoxes.push({ ...makeBox(w.min, w.max, [0.94, 0.92, 0.88]), name: 'wall' });
  }
  allBoxes.push({ ...makeBox(room.floor.min, room.floor.max, [0.82, 0.76, 0.65]), name: 'floor' });
  allBoxes.push({ ...makeBox(room.ceiling.min, room.ceiling.max, [0.95, 0.95, 0.97]), name: 'ceiling' });
  for (const f of room.furniture) {
    allBoxes.push({ ...makeBox(f.min, f.max, f.color), name: f.name });
  }

  const chunks = [];
  let byteOffset = 0;

  for (const b of allBoxes) {
    const matIdx = materials.length;
    materials.push({
      pbrMetallicRoughness: {
        baseColorFactor: [...b.color, 1],
        metallicFactor: 0.0,
        roughnessFactor: 0.85
      },
      name: `mat_${b.name}_${matIdx}`
    });

    const { indices, positions } = makeBoxGeometry(b.size[0], b.size[1], b.size[2]);

    const posBuf = Buffer.from(new Float32Array(positions).buffer);
    const idxBuf = Buffer.from(new Uint16Array(indices).buffer);
    const pad1 = (4 - (posBuf.length % 4)) % 4;
    const pad2 = (4 - (idxBuf.length % 4)) % 4;

    chunks.push(posBuf);
    if (pad1) chunks.push(Buffer.alloc(pad1));
    const posViewByteOffset = byteOffset + posBuf.length + pad1;
    chunks.push(idxBuf);
    if (pad2) chunks.push(Buffer.alloc(pad2));

    const posAccessor = accessors.length;
    accessors.push({
      bufferView: bufferViews.length,
      componentType: 5126,
      count: positions.length / 3,
      type: 'VEC3',
      min: [-b.size[0] / 2, -b.size[1] / 2, -b.size[2] / 2],
      max: [b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]
    });
    bufferViews.push({
      buffer: 0,
      byteOffset: byteOffset,
      byteLength: posBuf.length,
      target: 34962
    });

    const idxAccessor = accessors.length;
    accessors.push({
      bufferView: bufferViews.length,
      componentType: 5123,
      count: indices.length,
      type: 'SCALAR'
    });
    bufferViews.push({
      buffer: 0,
      byteOffset: posViewByteOffset,
      byteLength: idxBuf.length,
      target: 34963
    });

    const meshIdx = meshes.length;
    meshes.push({
      primitives: [
        {
          attributes: { POSITION: posAccessor },
          indices: idxAccessor,
          material: matIdx
        }
      ],
      name: b.name
    });

    nodes.push({
      mesh: meshIdx,
      translation: b.center,
      name: b.name
    });

    byteOffset += posBuf.length + pad1 + idxBuf.length + pad2;
  }

  const binary = Buffer.concat(chunks);
  const base64 = binary.toString('base64');
  buffers.push({
    byteLength: binary.length,
    uri: `data:application/octet-stream;base64,${base64}`
  });

  return {
    asset: { version: '2.0', generator: 'room-viewer-generator' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i), name: 'RoomScene' }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers
  };
}

function makeBoxGeometry(sx, sy, sz) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const positions = [
    -hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz,
    hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz,
    -hx, hy, hz, hx, hy, hz, hx, hy, -hz, -hx, hy, -hz,
    -hx, -hy, -hz, hx, -hy, -hz, hx, -hy, hz, -hx, -hy, hz,
    hx, -hy, hz, hx, -hy, -hz, hx, hy, -hz, hx, hy, hz,
    -hx, -hy, -hz, -hx, -hy, hz, -hx, hy, hz, -hx, hy, -hz
  ];
  const indices = [];
  for (let i = 0; i < 6; i++) {
    const o = i * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  return { indices, positions };
}

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const gltf = buildGLTF();
fs.writeFileSync(OUT_FILE, JSON.stringify(gltf, null, 2), 'utf-8');
console.log(`Generated ${OUT_FILE} (${JSON.stringify(gltf).length} bytes JSON)`);
