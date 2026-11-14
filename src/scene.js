import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { F1, F2 } from './villa/core.js';
import rooms from './rooms.json';
import { installPromo } from './promo.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pageParams = new URLSearchParams(location.search);
const debugMode = pageParams.has('debug');
const promoMode = pageParams.has('promo');
const fastPromoMode = pageParams.has('fast');
const container = $('#scene-container');
const loading = $('#loading');
const progressBar = $('#loading-progress');
const loadingLabel = $('#loading-label');
const roomPanel = $('#room-panel');
const roomDock = $('#room-dock');
const markersRoot = $('#room-markers');
const helpDialog = $('#help-dialog');
const tourButton = $('#tour-button');

const ROOM_COPY = {
  living: { description: '12 × 10.5 米的中央横厅与餐厅整跨连通，会客、家宴、茶叙和庭院景观在一条连续动线上展开。', features: ['126㎡ 真实使用尺度与挑空', '餐厅方向六米开放洞口', '50 项可见陈设、材质和构造细节'] },
  study: { description: '整墙藏书、三米二书画桌与双椅茶叙拉开距离，阅读、工作和待客不再互相挤占。', features: ['六米整墙藏书架', '书画、毛笔、砚台与镇纸', '50 项可见学习与茶叙细节'] },
  guest: { description: '一层客房拥有完整双人床、衣帽收纳、书桌和休憩区，长辈留宿不必上下楼，窗外是庭院绿景。', features: ['真实床具与双床头柜', '书画桌、全身镜与床尾休憩', '50 项可见留宿细节'] },
  gym: { description: '健身房收回后侧三分之一，面积调整为约 42.7㎡；跑步、划船、力量与拉伸仍完整保留，动线更紧凑。', features: ['42.7㎡ 紧凑训练区', '跑步机、划船机与力量凳', '50 项可见训练细节'] },
  kitchen: { description: '七米后操作台与四米六中岛组成顺畅的备餐动线，三席吧台、高柜和双门冰箱各就其位。', features: ['四米六石材中岛', '咖啡、烹饪与完整调味收纳', '50 项可见餐厨细节'] },
  dining: { description: '餐厅与客厅之间的隔墙已经打开，十人圆桌、餐边柜和暖光吊灯直接进入横厅视野。', features: ['六米开放洞口连通客厅', '十人实木圆桌与八席餐椅', '50 项可见家宴细节'] },
  bath1: { description: '一层独立厕所在客房与公共区之间，配置马桶、洗手台和镜面，古铜五金呼应全屋细节。', features: ['独立马桶与洗手台', '古铜龙头与浴室镜', '和淋浴间分开设置'] },
  shower1: { description: '一层淋浴间采用通透玻璃隔断，顶喷、壁龛与防滑石砖底盘齐全，便于客房和健身后使用。', features: ['独立玻璃淋浴房', '古铜顶喷与壁龛', '靠近健身房及客房'] },
  master: { description: '主卧占据二层整侧翼，睡眠、床尾休憩和衣帽收纳依次展开，木饰面与亚麻围合安静的私域。', features: ['2.45 米宽主床与床尾凳', '整墙衣帽收纳', '休闲沙发与双床头灯'] },
  bedroom2: { description: '次卧面向庭院，床、衣柜、书桌和开放书架完整配置，可作为儿童房或长期居住的家人房。', features: ['独立书桌与书架', '双人床及整墙衣柜', '庭院景观朝向'] },
  gaming: { description: '双人工位并排布置，显示器、主机、键盘和氛围灯一应俱全，另一侧保留休息沙发。', features: ['双人电竞工位', '发光主机与氛围灯带', '休闲沙发和主题海报'] },
  bath2: { description: '二层厕所服务主卧与次卧，延续一层石材、木柜和古铜五金的统一搭配。', features: ['独立马桶与洗手台', '浴室镜与古铜五金', '位于二层公共空间'] },
  shower2: { description: '二层淋浴间与厕所分设，玻璃围合、顶喷和壁龛让早晚使用更高效。', features: ['通透玻璃淋浴隔断', '顶喷与置物壁龛', '临近两间卧室'] },
};

let seed = 20261112;
function rand() {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !fastPromoMode, alpha: false, preserveDrawingBuffer: debugMode || promoMode, powerPreference: 'high-performance' });
} catch (error) {
  loadingLabel.textContent = '当前浏览器无法启动 3D，请开启硬件加速后重试';
  $('.loading p').textContent = '菩园暂时无法进入';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);
renderer.domElement.id = 'scene';
renderer.domElement.setAttribute('aria-label', '菩园三维场景');
renderer.domElement.setAttribute('role', 'img');

const scene = new THREE.Scene();
const DAY = new THREE.Color(0xc5d0d4);
const DUSK = new THREE.Color(0x35434b);
const LOWER_HAZE = new THREE.Color(0xaebbb4);
const DUSK_HAZE = new THREE.Color(0x26343b);
let dayBackground = DAY.clone();
scene.background = DAY.clone();
scene.fog = new THREE.Fog(DAY, 85, 220);

// Keep Three's native HDR background untouched. A transparent, depth-tested
// horizon veil dissolves the fully fogged remote ground into the same colour.
const skyUniforms = {
  uHorizon: { value: DAY.clone() },
  uLowerHaze: { value: LOWER_HAZE.clone() },
};
const sky = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    fog: false,
    // Three mixes fog after tone mapping. This veil is that same unlit fog,
    // so only the output colour-space conversion applies here.
    toneMapped: false,
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vDirection = worldPosition.xyz - cameraPosition;
        gl_Position = (projectionMatrix * modelViewMatrix * vec4(position, 1.0)).xyww;
      }
    `,
    fragmentShader: `
      uniform vec3 uHorizon;
      uniform vec3 uLowerHaze;
      varying vec3 vDirection;
      void main() {
        float altitude = normalize(vDirection).y;
        vec3 haze = mix(
          uLowerHaze,
          uHorizon,
          smoothstep(-0.30, -0.045, altitude)
        );
        // Zero opacity preserves the native clouds. Reach full fog before the
        // remote ground edge, leaving a seam-free buffer on every viewport.
        float opacity = 1.0 - smoothstep(-0.05, 0.006, altitude);
        gl_FragColor = vec4(haze, opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
);
sky.name = 'NaturalHorizonSky';
sky.renderOrder = 1000;
sky.frustumCulled = false;
scene.add(sky);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .08, 500);
camera.position.set(28, 19, 31);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.8, 0);
controls.enableDamping = true;
controls.dampingFactor = .065;
controls.minDistance = 2.1;
controls.maxDistance = 170;
controls.maxPolarAngle = Math.PI * .485;
controls.minPolarAngle = .08;
controls.autoRotateSpeed = .48;
controls.zoomSpeed = .85;
controls.panSpeed = .7;

const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(new RoomEnvironment(), .04);
scene.environment = environment.texture;
scene.environmentIntensity = .72;
pmrem.dispose();

const hemi = new THREE.HemisphereLight(0xe7f0f4, 0x51483c, .85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d8, 2.5);
sun.position.set(22, 35, 24);
sun.castShadow = true;
const shadowResolution = innerWidth < 700 ? 2048 : 4096;
sun.shadow.mapSize.set(shadowResolution, shadowResolution);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 34, bottom: -34, near: 1, far: 110 });
sun.shadow.bias = -.00012;
sun.shadow.normalBias = .018;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xc7d9d2, .55);
fill.position.set(-20, 16, -18);
scene.add(fill);
const interiorLights = [];
for (const [x, y, z] of [[-10,3,3],[0,3.5,2.5],[10,3,3],[0,3,-5],[-10,6.6,0],[10,6.6,3],[0,6.6,-5]]) {
  const light = new THREE.PointLight(0xffd9aa, 14, 19, 2);
  light.position.set(x, y, z);
  scene.add(light);
  interiorLights.push(light);
}

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(300, 80).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x68755f, roughness: 1 })
);
ground.position.y = -.68;
ground.receiveShadow = true;
scene.add(ground);

// 低矮、不规则的远景林冠只负责遮住地平边界，不使用光滑球体假山。
const distant = new THREE.Group();
const horizonMaterial = new THREE.MeshStandardMaterial({ color: 0x405344, roughness: 1 });
for (let i = 0; i < 72; i++) {
  const angle = i / 72 * Math.PI * 2;
  const radius = 145 + rand() * 45;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), horizonMaterial);
  crown.scale.set(4 + rand() * 5, 1.2 + rand() * 2.1, 4 + rand() * 5);
  crown.position.set(Math.cos(angle) * radius, -.2, Math.sin(angle) * radius);
  crown.rotation.set(rand() * .2, rand() * Math.PI, rand() * .15);
  distant.add(crown);
}
scene.add(distant);

const groups = {};
let villa = null;
let detailsManifest = {};
let assetMetrics = [];
let generatedParts = 0;
let currentView = 'exterior';
let currentFloor = 1;
let visibleFloor = 1;
let currentRoom = null;
let labelsOn = true;
let dusk = false;
let tourActive = false;
let tourIndex = 0;
let tourNextAt = 0;
let tourHold = null;
let transition = null;
let ready = false;
let needsRender = true;
let toastTimer = null;
let wheelImpulse = 0;
let motionRendering = false;
let lastMotionAt = 0;
let shadowSignature = '';

const VIEW_CONFIG = {
  exterior: { position: [39, 25, 43], target: [0, 3.0, 0], kicker: 'NEW CHINESE · REALISTIC EDITION', title: '一方庭院，两层生活', subtitle: '真实木纹、石材与自然光，围合现代东方居所。' },
  floor1: { position: [23, 31, 27], target: [0, .8, 0], kicker: 'GROUND FLOOR · 8 SPACES', title: '一层 · 126㎡ 挑空横厅', subtitle: '客厅扩至三倍，书房、餐厨、客房、健身与独立卫浴重新排布。' },
  floor2: { position: [23, 34, 27], target: [0, 4.3, 0], kicker: 'UPPER FLOOR · 5 SPACES', title: '二层 · 私密休息与兴趣', subtitle: '整翼主卧、次卧、电竞房与分离卫浴，中央桥廊俯瞰客厅。' },
};

const isPortrait = () => innerWidth / innerHeight < .8;
function getViewPosition(view) {
  const config = VIEW_CONFIG[view];
  const position = new THREE.Vector3(...config.position);
  if (isPortrait()) {
    const target = new THREE.Vector3(...config.target);
    position.sub(target).multiplyScalar(view === 'exterior' ? 1.9 : 1.55).add(target);
  }
  return position.toArray();
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
}

function easeInOut(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function setMotionRendering(active) {
  if (motionRendering === active) return;
  motionRendering = active;
  const cap = innerWidth < 700 ? (active ? 1.25 : 1.5) : (active ? 1.25 : 1.75);
  renderer.setPixelRatio(Math.min(devicePixelRatio, cap));
  needsRender = true;
}
function markMotion() {
  lastMotionAt = performance.now();
  setMotionRendering(true);
}
function cancelTransition() {
  if (!transition) return;
  transition.onMid?.();
  transition.onComplete?.();
  transition = null;
  controls.enabled = true;
  markMotion();
}

function flyTo(position, target, duration = 1150, options = {}) {
  cancelTransition();
  markMotion();
  wheelImpulse = 0;
  const fromPosition = camera.position.clone();
  const toPosition = new THREE.Vector3(...position);
  let positionCurve = null;
  if (options.cruiseY) {
    const cruiseY = Math.max(options.cruiseY, fromPosition.y, toPosition.y);
    const fromGate = fromPosition.clone();
    const toGate = toPosition.clone();
    fromGate.y = cruiseY;
    toGate.y = cruiseY;
    const midpoint = fromGate.clone().lerp(toGate, .5);
    midpoint.y += .65;
    positionCurve = new THREE.CatmullRomCurve3(
      [fromPosition, fromGate, midpoint, toGate, toPosition],
      false,
      'centripetal'
    );
  }
  transition = {
    start: performance.now(), duration: reducedMotion ? 0 : duration,
    fromPosition, toPosition, positionCurve,
    fromTarget: controls.target.clone(), toTarget: new THREE.Vector3(...target),
    fromFov: camera.fov, toFov: options.fov ?? camera.fov,
    onMid: options.onMid, midFired: false,
    onComplete: options.onComplete,
  };
  controls.enabled = false;
}

function setActiveViewButton(view) {
  $$('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function applyVisibility() {
  needsRender = true;
  const exterior = currentView === 'exterior';
  const nextShadowSignature = `${exterior}:${visibleFloor}:${dusk}`;
  if (nextShadowSignature !== shadowSignature) {
    shadowSignature = nextShadowSignature;
    renderer.shadowMap.needsUpdate = true;
    sun.shadow.needsUpdate = true;
  }
  scene.background = exterior && !dusk ? dayBackground : (dusk ? DUSK.clone() : DAY.clone());
  scene.backgroundBlurriness = exterior && !dusk ? .055 : 0;
  scene.fog.color.copy(dusk ? DUSK : DAY);
  sky.visible = exterior && !dusk;
  skyUniforms.uHorizon.value.copy(dusk ? DUSK : DAY);
  skyUniforms.uLowerHaze.value.copy(dusk ? DUSK_HAZE : LOWER_HAZE);
  const floor = visibleFloor;
  const visibility = {
    Site: exterior,
    ExteriorShell: exterior,
    FrontDetails: exterior,
    Roof: exterior,
    Floor1: exterior || floor === 1,
    Floor2: exterior || floor === 2,
    Cut1: !exterior && floor === 1,
    Cut2: !exterior && floor === 2,
  };
  for (const [name, group] of Object.entries(groups)) group.visible = visibility[name] ?? true;
  distant.visible = exterior;
  ground.visible = true;
  ground.material.color.set(exterior ? 0x68755f : 0x92998c);
  sun.intensity = dusk ? .45 : (exterior ? 2.3 : 1.15);
  scene.environmentIntensity = dusk ? .18 : (exterior ? .78 : .62);
  renderer.toneMappingExposure = dusk ? .88 : .98;
  interiorLights.forEach(light => { light.visible = !exterior || dusk; light.intensity = exterior ? 18 : 14; });
}

function renderDock() {
  roomDock.innerHTML = '';
  rooms.filter(room => room.floor === currentFloor).forEach(room => {
    const button = document.createElement('button');
    button.className = 'room-chip' + (currentRoom === room.id ? ' active' : '');
    button.dataset.room = room.id;
    button.setAttribute('aria-pressed', String(currentRoom === room.id));
    button.innerHTML = `<b>${room.name}</b><small>${room.floor}F · ${room.area}</small>`;
    button.addEventListener('click', () => selectRoom(room.id));
    roomDock.appendChild(button);
  });
}

function updateCaption(view) {
  const config = VIEW_CONFIG[view];
  $('#view-kicker').textContent = config.kicker;
  $('#view-title').textContent = config.title;
  $('#view-subtitle').textContent = config.subtitle;
  $('.scene-caption').classList.remove('room-active');
}

function stopTour() {
  tourHold = null;
  if (!tourActive) return;
  tourActive = false;
  tourButton.classList.remove('playing');
  tourButton.querySelector('use').setAttribute('href', '#i-play');
  tourButton.querySelector('span').textContent = '开始一镜到底';
  $('#interaction-hint').textContent = '上滑推进 · 下滑后退 · 拖动环顾 · 点击房间';
}

function setMode(view, options = {}) {
  if (!ready) return;
  if (!options.fromTour) stopTour();
  currentView = view;
  document.body.dataset.view = view;
  currentRoom = null;
  if (view === 'floor1') currentFloor = visibleFloor = 1;
  if (view === 'floor2') currentFloor = visibleFloor = 2;
  roomPanel.hidden = true;
  setActiveViewButton(view);
  applyVisibility();
  updateCaption(view);
  renderDock();
  const config = VIEW_CONFIG[view];
  flyTo(getViewPosition(view), config.target, options.duration, { fov: 42 });
}

function selectRoom(id, fromTour = false) {
  if (!ready) return;
  const room = rooms.find(item => item.id === id);
  if (!room) return;
  const previousView = currentView;
  const previousRoom = currentRoom;
  if (!fromTour) stopTour();
  if (previousView !== 'room') visibleFloor = room.floor;
  currentFloor = room.floor;
  currentView = 'room';
  document.body.dataset.view = 'room';
  currentRoom = id;
  setActiveViewButton(room.floor === 1 ? 'floor1' : 'floor2');
  applyVisibility();
  renderDock();
  $('.scene-caption').classList.add('room-active');
  const copy = ROOM_COPY[id];
  $('#room-floor').textContent = `${room.floor}F`;
  $('#room-area').textContent = room.area;
  $('#room-name').textContent = room.name;
  $('#room-mood').textContent = room.mood;
  $('#room-description').textContent = copy.description;
  $('#room-features').innerHTML = copy.features.map(feature => `<li>${feature}</li>`).join('');
  $('#room-details').innerHTML = (detailsManifest[id] ?? []).map(item => `<li><span>${String(item.index).padStart(2, '0')}</span>${item.label}</li>`).join('');
  $('#detail-count').textContent = `${detailsManifest[id]?.length ?? 0} 项`;
  roomPanel.hidden = false;
  const baseY = room.floor === 1 ? F1 : F2;
  const focus = room.focus ?? room.center;
  const target = [focus[0], baseY + 1.15, -focus[1]];
  const position = [room.camera[0], baseY + room.height, -room.camera[1]];
  const targetFov = isPortrait() ? Math.max(74, room.fov) : room.fov;
  const needsArc = previousView === 'room' && previousRoom && previousRoom !== id;
  const syncFloor = () => {
    if (visibleFloor === room.floor) return;
    visibleFloor = room.floor;
    applyVisibility();
  };
  const distance = camera.position.distanceTo(new THREE.Vector3(...position));
  flyTo(position, target, fromTour ? 2400 : Math.min(2400, 1500 + distance * 30), {
    fov: targetFov,
    cruiseY: needsArc ? (room.floor === 2 ? 11.4 : 8.2) : 0,
    onMid: syncFloor,
    onComplete: syncFloor,
  });
  if (fromTour) {
    tourHold = {
      position: new THREE.Vector3(...position),
      target: new THREE.Vector3(...target),
      startedAt: null,
    };
  }
  const chip = roomDock.querySelector(`[data-room="${id}"]`);
  chip?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  if (fromTour) {
    $('#interaction-hint').textContent = `一镜到底 ${tourIndex + 1} / ${rooms.length} · ${room.name}`;
  }
}

function cycleRoom(direction) {
  const list = rooms.filter(room => room.floor === currentFloor);
  const index = Math.max(0, list.findIndex(room => room.id === currentRoom));
  selectRoom(list[(index + direction + list.length) % list.length].id);
}

const markerVector = new THREE.Vector3();
const markerElements = new Map();
for (const room of rooms) {
  const button = document.createElement('button');
  button.className = 'room-marker hidden';
  button.style.left = '0';
  button.style.top = '0';
  button.textContent = room.name;
  button.dataset.marker = room.id;
  button.setAttribute('aria-label', `靠近查看${room.name}`);
  button.addEventListener('click', event => { event.stopPropagation(); selectRoom(room.id); });
  markersRoot.appendChild(button);
  markerElements.set(room.id, button);
}

function updateMarkers() {
  const show = ready && labelsOn && currentView !== 'exterior' && currentView !== 'room';
  for (const room of rooms) {
    const el = markerElements.get(room.id);
    if (!show || room.floor !== currentFloor) {
      el.classList.add('hidden');
      continue;
    }
    const baseY = room.floor === 1 ? F1 + 3.25 : F2 + 3.25;
    markerVector.set(room.center[0], baseY, -room.center[1]).project(camera);
    const onScreen = markerVector.z > -1 && markerVector.z < 1 && Math.abs(markerVector.x) < .96 && Math.abs(markerVector.y) < .88;
    el.classList.toggle('hidden', !onScreen);
    if (onScreen) {
      const x = (markerVector.x * .5 + .5) * innerWidth;
      const y = (-markerVector.y * .5 + .5) * innerHeight;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      el.classList.toggle('active', currentRoom === room.id);
    }
  }
}

function toggleLabels() {
  labelsOn = !labelsOn;
  const button = $('[data-action="labels"]');
  button.classList.toggle('active', labelsOn);
  button.setAttribute('aria-pressed', String(labelsOn));
  button.setAttribute('aria-label', labelsOn ? '隐藏房间标记' : '显示房间标记');
  toast(labelsOn ? '房间标记已显示' : '房间标记已隐藏');
}

function toggleRotate() {
  controls.autoRotate = !controls.autoRotate;
  const button = $('[data-action="rotate"]');
  button.classList.toggle('active', controls.autoRotate);
  button.setAttribute('aria-pressed', String(controls.autoRotate));
  button.setAttribute('aria-label', controls.autoRotate ? '停止自动环绕' : '开启自动环绕');
  toast(controls.autoRotate ? '自动环绕已开启' : '自动环绕已停止');
}

function toggleLight() {
  dusk = !dusk;
  document.body.classList.toggle('dusk', dusk);
  const bg = dusk ? DUSK : DAY;
  scene.background = bg.clone();
  scene.fog.color.copy(bg);
  sun.intensity = dusk ? .45 : 2.5;
  hemi.intensity = dusk ? .3 : .85;
  fill.intensity = dusk ? .18 : .55;
  scene.environmentIntensity = dusk ? .18 : .72;
  renderer.toneMappingExposure = dusk ? .88 : 1.0;
  applyVisibility();
  const button = $('[data-action="light"]');
  button.classList.toggle('active', dusk);
  button.setAttribute('aria-pressed', String(dusk));
  button.setAttribute('aria-label', dusk ? '切换至日间' : '切换至暮色');
  toast(dusk ? '暮色 · 室内暖光已点亮' : '日间 · 自然庭院光');
}

function toggleTour() {
  if (tourActive) { stopTour(); return; }
  tourActive = true;
  tourIndex = currentRoom ? Math.max(0, rooms.findIndex(room => room.id === currentRoom)) : 0;
  tourButton.classList.add('playing');
  tourButton.querySelector('use').setAttribute('href', '#i-pause');
  tourButton.querySelector('span').textContent = '暂停一镜到底';
  selectRoom(rooms[tourIndex].id, true);
  tourNextAt = performance.now() + 4800;
}

function resetView() {
  controls.autoRotate = false;
  $('[data-action="rotate"]').classList.remove('active');
  if (currentView === 'room' && currentRoom) selectRoom(currentRoom);
  else setMode(currentView === 'room' ? `floor${currentFloor}` : currentView);
  toast('视角已重置');
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast('当前浏览器不支持全屏，可使用系统全屏快捷键');
  }
}

const actions = {
  exterior: () => setMode('exterior'),
  reset: resetView,
  labels: toggleLabels,
  rotate: toggleRotate,
  light: toggleLight,
  fullscreen: toggleFullscreen,
  tour: toggleTour,
  help: () => helpDialog.showModal(),
  'close-help': () => helpDialog.close(),
  'close-room': () => setMode(`floor${currentFloor}`),
  'prev-room': () => cycleRoom(-1),
  'next-room': () => cycleRoom(1),
  'dock-prev': () => roomDock.scrollBy({ left: -330, behavior: reducedMotion ? 'auto' : 'smooth' }),
  'dock-next': () => roomDock.scrollBy({ left: 330, behavior: reducedMotion ? 'auto' : 'smooth' }),
};
$$('[data-action]').forEach(button => button.addEventListener('click', () => actions[button.dataset.action]?.()));
$$('[data-view]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.view)));
helpDialog.addEventListener('click', event => {
  const rect = helpDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) helpDialog.close();
});
document.addEventListener('fullscreenchange', () => {
  $('[data-action="fullscreen"]').setAttribute('aria-label', document.fullscreenElement ? '退出全屏' : '进入全屏');
});

document.addEventListener('keydown', event => {
  if (helpDialog.open || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); cycleRoom(1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); cycleRoom(-1); }
  if (event.key.toLowerCase() === 'r') resetView();
  if (event.key === 'Escape') {
    if (tourActive) stopTour();
    else if (currentView !== 'exterior') setMode('exterior');
  }
});

// 点击模型时，以落点寻找当前层最近房间；拖动超过阈值则只执行环绕。
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerStart = null;
renderer.domElement.addEventListener('pointerdown', event => {
  pointerStart = { x: event.clientX, y: event.clientY };
  stopTour();
  cancelTransition();
  markMotion();
}, { capture: true });
renderer.domElement.addEventListener('pointerup', event => {
  if (!ready || !pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
  pointer.set(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (!villa) return;
  const hits = raycaster.intersectObject(villa, true);
  if (!hits.length) return;
  if (currentView === 'exterior') { setMode('floor1'); return; }
  const point = hits[0].point;
  let nearest = null;
  let distance = Infinity;
  for (const room of rooms.filter(item => item.floor === currentFloor)) {
    const d = Math.hypot(point.x - room.center[0], point.z + room.center[1]);
    if (d < distance) { nearest = room; distance = d; }
  }
  if (nearest) selectRoom(nearest.id);
});

// Capture wheel/trackpad input before OrbitControls. Up always moves forward;
// down moves back. During a room transition the same gesture scrubs the shot.
renderer.domElement.addEventListener('wheel', event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!ready) return;
  const unit = event.deltaMode === 1 ? 16 : (event.deltaMode === 2 ? innerHeight : 1);
  const delta = THREE.MathUtils.clamp(event.deltaY * unit, -240, 240);
  stopTour();
  markMotion();
  if (transition) {
    transition.start += delta * 3;
    return;
  }
  wheelImpulse = THREE.MathUtils.clamp(wheelImpulse - delta * .001, -.75, .75);
}, { passive: false, capture: true });

function renderScene() {
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
}

async function loadModels() {
  progressBar.style.width = '10%';
  loadingLabel.textContent = '正在载入自然光与 Blender 材质';
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [gltf, manifest, hdr] = await Promise.all([
    loader.loadAsync('/models/chengyuan.glb'),
    fetch('/details/rooms.json').then(response => {
      if (!response.ok) throw new Error(`细节清单载入失败 ${response.status}`);
      return response.json();
    }),
    new HDRLoader().loadAsync('/hdri/kloofendal_2k.hdr'),
  ]);
  progressBar.style.width = '62%';
  loadingLabel.textContent = '正在整理两层空间与 650 项可见细节';
  const pmremHDR = new THREE.PMREMGenerator(renderer);
  const env = pmremHDR.fromEquirectangular(hdr);
  scene.environment = env.texture;
  scene.environmentIntensity = .82;
  dayBackground = hdr;
  scene.background = dayBackground;
  scene.backgroundBlurriness = .055;
  pmremHDR.dispose();
  villa = gltf.scene;
  villa.name = 'ChengyuanBlenderVilla';
  detailsManifest = manifest.details;
  generatedParts = manifest.generatedParts;
  for (const name of ['Site','ExteriorShell','FrontDetails','Roof','Floor1','Floor2','Cut1','Cut2']) {
    const group = villa.getObjectByName(name);
    if (!group) throw new Error(`Blender 模型缺少可见性组 ${name}`);
    groups[name] = group;
  }
  villa.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const materialNames = materials.filter(Boolean).map(material => material.name).join('|');
    // Thin books, luminous inserts and printed panels should not shadow themselves.
    // Their sub-centimetre depth is smaller than a useful shadow-map texel footprint.
    const thinDetail = /book|paper|display|screen|art|emissive/.test(materialNames);
    const nonCaster = thinDetail || /glass|frosted|water|leaf/.test(materialNames);
    object.castShadow = !nonCaster;
    object.receiveShadow = !thinDetail && !/glass|frosted|water/.test(materialNames);
    for (const material of materials) {
      if (!material) continue;
      if (/leaf|display|screen|art/.test(material.name)) material.side = THREE.DoubleSide;
      if (/glass|frosted|water/.test(material.name)) {
        // A single outer surface avoids double-layer transparent sorting shimmer.
        material.side = THREE.FrontSide;
        material.depthWrite = false;
        material.envMapIntensity = 1.15;
      }
      if (/display|screen/.test(material.name)) {
        material.emissiveIntensity = .65;
        material.roughness = .32;
      }
      if (/mirror/.test(material.name)) {
        material.metalness = .82;
        material.roughness = .1;
        material.envMapIntensity = 1.35;
      }
      material.needsUpdate = true;
    }
  });
  // Outdoor foliage shares materials with indoor plants in the source GLB.
  // Clone it before tempering the strong courtyard light, so interiors stay intact.
  groups.Site.traverse(object => {
    if (!object.isMesh) return;
    const temperLeaf = material => {
      if (!/leaf/.test(material.name)) return material;
      const outdoor = material.clone();
      outdoor.color.multiplyScalar(material.name === 'leafLight' ? .55 : .45);
      outdoor.envMapIntensity = .5;
      return outdoor;
    };
    object.material = Array.isArray(object.material) ? object.material.map(temperLeaf) : temperLeaf(object.material);
  });
  scene.add(villa);
  assetMetrics = [];
  window.__DETAILS__ = detailsManifest;
  window.__MODEL_MANIFEST__ = { ...manifest, details: undefined };
  progressBar.style.width = '86%';
  loadingLabel.textContent = '正在预编译写实材质与光影';
  applyVisibility();
  camera.position.set(...getViewPosition(currentView));
  controls.target.set(...VIEW_CONFIG[currentView].target);
  controls.update();
  await renderer.compileAsync(scene, camera);
  renderer.shadowMap.needsUpdate = true;
  sun.shadow.needsUpdate = true;
  renderScene();
  progressBar.style.width = '100%';
  ready = true;
  renderDock();
  loadingLabel.textContent = '菩园 Blender 写实版已就绪';
  setTimeout(() => {
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 550);
  }, 240);
  window.__SCENE_READY__ = true;
  if (promoMode) {
    installPromo({ camera, controls, renderer, scene, groups, sky, interiorLights, sun });
    return;
  }
  if (pageParams.get('view') && VIEW_CONFIG[pageParams.get('view')]) setMode(pageParams.get('view'), { duration: 0 });
  if (pageParams.get('room')) selectRoom(pageParams.get('room'));
  if (pageParams.has('t')) window.__seek(Number(pageParams.get('t')));
}

loadModels().catch(error => {
  console.error('模型加载失败', error);
  loadingLabel.textContent = '模型未能载入，请刷新重试';
  $('.loading p').textContent = '菩园加载未完成';
});

let previousTime = performance.now();
let frameCounter = 0;
let fpsTime = previousTime;
let fps = 0;
const wheelOffset = new THREE.Vector3();
function render(now) {
  const delta = Math.min((now - previousTime) / 1000, .1);
  previousTime = now;
  const animating = !!transition;
  if (transition) {
    const progress = transition.duration === 0 ? 1 : THREE.MathUtils.clamp((now - transition.start) / transition.duration, 0, 1);
    const eased = easeInOut(progress);
    if (transition.positionCurve) {
      if (eased >= 1) camera.position.copy(transition.toPosition);
      else camera.position.copy(transition.positionCurve.getPointAt(eased));
    } else camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
    controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
    const nextFov = THREE.MathUtils.lerp(transition.fromFov, transition.toFov, eased);
    if (Math.abs(nextFov - camera.fov) > .001) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
    if (progress >= .5 && !transition.midFired) {
      transition.midFired = true;
      transition.onMid?.();
    }
    if (progress >= 1) {
      transition.onComplete?.();
      transition = null;
      controls.enabled = true;
    }
  }
  if (tourActive && now >= tourNextAt) {
    tourIndex += 1;
    if (tourIndex >= rooms.length) {
      stopTour();
      setMode('exterior');
      toast('十三处空间一镜到底完成');
    } else {
      selectRoom(rooms[tourIndex].id, true);
      tourNextAt = now + 4800;
    }
  }
  const controlsChanged = controls.update(delta);
  const scrolling = !transition && Math.abs(wheelImpulse) > .0005;
  if (scrolling) {
    wheelOffset.copy(camera.position).sub(controls.target);
    const distance = wheelOffset.length();
    const nextDistance = THREE.MathUtils.clamp(
      distance * (1 - wheelImpulse * delta * 5),
      controls.minDistance,
      controls.maxDistance
    );
    wheelOffset.setLength(nextDistance);
    camera.position.copy(controls.target).add(wheelOffset);
    wheelImpulse *= Math.exp(-delta * 8);
  } else if (!transition) {
    wheelImpulse = 0;
  }
  const holding = tourActive && !transition && tourHold;
  if (holding) {
    if (tourHold.startedAt === null) tourHold.startedAt = now;
    const drift = Math.min(.32, (now - tourHold.startedAt) * .00012);
    wheelOffset.copy(tourHold.target).sub(tourHold.position).normalize();
    camera.position.copy(tourHold.position).addScaledVector(wheelOffset, drift);
    controls.target.copy(tourHold.target);
  }
  const moving = animating || controlsChanged || scrolling || holding || controls.autoRotate;
  if (moving) markMotion();
  else if (motionRendering && now - lastMotionAt > 260) setMotionRendering(false);
  if (ready && (needsRender || moving)) {
    updateMarkers();
    renderScene();
    needsRender = false;
    frameCounter += 1;
    if (now - fpsTime > 1000) {
      fps = Math.round(frameCounter * 1000 / (now - fpsTime));
      frameCounter = 0;
      fpsTime = now;
    }
  }
  const hudText = ready && debugMode ? `${fps} fps · ${renderer.info.render.calls} calls · ${Math.round(renderer.info.render.triangles / 1000)}k tris` : '';
  if ($('#hud').textContent !== hudText) $('#hud').textContent = hudText;
}
if (!promoMode) renderer.setAnimationLoop(render);

window.__seek = (_time) => {
  controls.autoRotate = false;
  // Deterministic QA frame: hidden tabs may throttle rAF, so land on the exact
  // destination instead of cancelling a half-finished camera transition.
  if (transition) {
    camera.position.copy(transition.toPosition);
    controls.target.copy(transition.toTarget);
    camera.fov = transition.toFov;
    camera.updateProjectionMatrix();
    transition.onMid?.();
    transition.onComplete?.();
    transition = null;
  }
  controls.enabled = true;
  controls.update();
  needsRender = true;
  renderScene();
};
window.__pause = () => renderer.setAnimationLoop(null);
window.__play = () => {
  previousTime = performance.now();
  renderer.setAnimationLoop(render);
};
window.__stepFrames = (count = 1, step = 16.666) => {
  const start = Math.max(performance.now(), previousTime);
  for (let i = 1; i <= count; i++) render(start + i * step);
};
window.__seekTransition = progress => {
  if (!transition) return false;
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  transition.start = performance.now() - transition.duration * t;
  render(performance.now());
  return true;
};
window.__APP_STATE__ = () => ({
  ready, view: currentView, floor: currentFloor, room: currentRoom, dusk, labelsOn, tourActive, tourIndex,
  camera: camera.position.toArray(), target: controls.target.toArray(),
  fov: camera.fov, pixelRatio: renderer.getPixelRatio(), motionRendering, wheelImpulse,
  transition: transition ? { progress: THREE.MathUtils.clamp((performance.now() - transition.start) / transition.duration, 0, 1), curved: !!transition.positionCurve } : null,
  visibleGroups: Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, group.visible])),
  fps, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
  generatedParts, detailCount: currentRoom ? detailsManifest[currentRoom]?.length : Object.values(detailsManifest).reduce((sum, list) => sum + list.length, 0),
  assetCount: assetMetrics.length,
});
window.__setView = setMode;
window.__selectRoom = selectRoom;
window.__setCamera = (position, target, fov = camera.fov) => {
  transition = null;
  controls.enabled = true;
  controls.autoRotate = false;
  camera.position.fromArray(position);
  controls.target.fromArray(target);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  controls.update();
  needsRender = true;
  renderScene();
};
window.__PROBE__ = () => {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  return raycaster.intersectObject(villa, true).filter(hit => {
    let node = hit.object;
    while (node) { if (!node.visible) return false; node = node.parent; }
    return true;
  }).slice(0, 8).map(hit => ({
    name: hit.object.name,
    material: (Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material)?.name,
    distance: hit.distance,
    point: hit.point.toArray(),
  }));
};
window.__ATMOSPHERE__ = () => ({
  visible: sky.visible,
  nativeBackground: scene.background === dayBackground && dayBackground.isTexture,
  blurriness: scene.backgroundBlurriness,
  horizon: skyUniforms.uHorizon.value.getHexString(),
  texture: dayBackground.isTexture ? {
    width: dayBackground.image.width,
    height: dayBackground.image.height,
    flipY: dayBackground.flipY,
  } : null,
});

addEventListener('resize', () => {
  needsRender = true;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  motionRendering = false;
  wheelImpulse = 0;
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 1.75));
  renderer.setSize(innerWidth, innerHeight);
  if (ready && currentView !== 'room' && !promoMode) {
    transition = null;
    controls.enabled = true;
    camera.position.set(...getViewPosition(currentView));
    controls.target.set(...VIEW_CONFIG[currentView].target);
    controls.update();
  }
});
