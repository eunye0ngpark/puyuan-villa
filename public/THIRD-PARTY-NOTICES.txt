# 资产与制作说明

- 当前建筑、庭院、室内布局、月洞木格屏及程序家具：均由本项目 `blender/build_chengyuan.py` 与 `blender/chengyuan_lib.py` 原创参数化建模，使用 Blender 生成并导出 GLB；当前网页未使用旧版 Tripo 模型或外部家具模型。
- Blender → Web 工作流：参考并适配 `czlonkowski/blender-web-3d-skill`，commit `858762f1add7f1d9f5dcb1fb1d0b55f71906bf0d`，MIT License。所用优化脚本与许可证副本位于 `pipeline/`。
- Three.js：MIT License，通过 npm 引入；模型使用 Meshopt 压缩，纹理由 gltf-transform 转为 WebP。
- 环境光照：Poly Haven 的 `kloofendal_48d_partly_cloudy_puresky` HDRI，CC0。
- 木纹、石材、织物、草纹与屏幕画面：由本项目脚本生成或绘制，不依赖外部家具素材。
- 静态加载海报：用户提供的新中式外立面参考图，仅用于加载与 WebGL 失败时的视觉回退；可交互场景本身为真实 3D。

本次优化增加了程序化陶瓦、檐下木作、窗框收口、入户台阶、分层植物和连续林地背景。
庭院景石使用 Kless Gyzen 的 Rock Moss Set 01，CC0，https://polyhaven.com/a/rock_moss_set_01 。
附带砾石纹理来自 Poly Haven Floor Pebbles 01，CC0，https://polyhaven.com/a/floor_pebbles_01 。
