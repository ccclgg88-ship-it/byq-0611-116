# 热点 JSON 数据结构 (room-hotspots.json)

## 根对象

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `metersPerUnit` | `number` | 是 | 模型单位到米的换算系数，通常 `1.0` 表示 1 模型单位 = 1 米；若模型以厘米建模，设为 `0.01`。 |
| `hotspots` | `Hotspot[]` | 是 | 热点列表，数量需 ≥ 8，覆盖至少 3 个空间（客厅/厨房/卧室等）。 |

## Hotspot 对象

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | 是 | 唯一标识，建议 `hs-{room}-{furniture}` 格式。 |
| `room` | `string` | 是 | 所属房间名称，用于平面图分组折叠（如 `客厅`、`厨房`、`卧室`）。 |
| `position` | `[number, number, number]` | 是 | 热点在世界坐标系中的位置 `[x, y, z]`，单位与 glTF 模型一致。 |
| `normal` | `[number, number, number]` | 是 | 热点朝向的法线向量（单位向量），用于标注面板面向相机偏移。 |
| `furnitureId` | `string` | 是 | 关联的家具实体 ID。 |
| `furnitureName` | `string` | 是 | 家具展示名称（中文）。 |
| `tips` | `string[]` | 是 | 收纳 / 动线建议文案数组，每个条目一句话。数量 ≥ 1。 |
| `articleIds` | `string[]` | 是 | 关联的生活百科文章 ID 列表，对应 `mock-articles.json` 中的文章。 |

## 示例

```json
{
  "metersPerUnit": 1.0,
  "hotspots": [
    {
      "id": "hs-living-sofa",
      "room": "客厅",
      "position": [0, 0.8, -2],
      "normal": [0, 1, 0],
      "furnitureId": "fur-sofa-01",
      "furnitureName": "三人布艺沙发",
      "tips": [
        "沙发底部留空 ≥15cm，便于扫地机器人通行",
        "抱枕按 2:1:2 比例摆放，视觉平衡且方便取用"
      ],
      "articleIds": ["art-001", "art-004"]
    }
  ]
}
```

## 约束与校验

1. 热点数量 ≥ 8。
2. `room` 取值唯一值数量 ≥ 3（至少覆盖 3 个独立空间）。
3. 每个 `tips` 文案 ≥ 8 字。
4. `position` 坐标必须落在 glTF 模型包围盒内（地面 `y=0`，眼高 `y≈1.6`）。
5. `normal` 为单位向量，常用值：
   - 顶面朝上：`[0,1,0]`
   - 墙面朝向 +Z：`[0,0,1]`
   - 墙面朝向 -X：`[-1,0,0]`

## glTF 路径说明

- 开发模式：`/models/room.gltf`（由 `scripts/generate-gltf.mjs` 生成）
- 生产模式：Nginx 托管 `/usr/share/nginx/html/models/room.gltf`，MIME 类型 `model/gltf+json`

如需替换为真实模型：
1. 将 `.gltf` 及关联 `.bin`/贴图放入 `public/models/`
2. 修改 `src/App.ts` 中的 `GLTF_URL` 常量
3. 同步更新 `room-hotspots.json` 中 `position` 坐标与 `metersPerUnit`
