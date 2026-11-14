import * as THREE from 'three';
import { ModelBatch, DetailLedger, F1, F2, WALL_H } from './core.js';
import { createPropFactory } from './props.js';

let b;
const GROUP = { 1: 'Floor1', 2: 'Floor2' };
const CUT = { 1: 'Cut1', 2: 'Cut2' };
const SPECS = {
  living: { cx: 0, cz: 2.75, w: 12, d: 10.5 },
  study: { cx: -10, cz: 4, w: 8, d: 8 },
  guest: { cx: -10, cz: -4, w: 8, d: 8, window: 'back' },
  gym: { cx: 10, cz: 4, w: 8, d: 8 },
  kitchen: { cx: 10, cz: -4, w: 8, d: 8, window: 'back' },
  dining: { cx: 3, cz: -5.25, w: 6, d: 5.5, window: 'back' },
  bath1: { cx: -4.5, cz: -5.25, w: 3, d: 5.5, wet: true, window: 'back' },
  shower1: { cx: -1.5, cz: -5.25, w: 3, d: 5.5, wet: true, window: 'back' },
  master: { cx: -10, cz: 0, w: 8, d: 16 },
  bedroom2: { cx: 10, cz: -4, w: 8, d: 8, window: 'back' },
  gaming: { cx: 10, cz: 4, w: 8, d: 8 },
  bath2: { cx: -3, cz: -5.25, w: 6, d: 5.5, wet: true, window: 'back' },
  shower2: { cx: 3, cz: -5.25, w: 6, d: 5.5, wet: true, window: 'back' },
};

function hipGeometry(w, d, rise) {
  const ridge = Math.max(.2, w / 2 - d * .36);
  const vertices = new Float32Array([
    -w/2,0,d/2, w/2,0,d/2, ridge,rise,0,  -w/2,0,d/2, ridge,rise,0, -ridge,rise,0,
    w/2,0,-d/2, -w/2,0,-d/2, -ridge,rise,0,  w/2,0,-d/2, -ridge,rise,0, ridge,rise,0,
    -w/2,0,-d/2, -w/2,0,d/2, -ridge,rise,0,
    w/2,0,d/2, w/2,0,-d/2, ridge,rise,0,
    -w/2,0,-d/2, -ridge,rise,0, ridge,rise,0,  -w/2,0,-d/2, ridge,rise,0, w/2,0,d/2,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  const uv = new Float32Array(vertices.length / 3 * 2);
  for (let i = 0; i < vertices.length / 3; i++) { uv[i*2] = vertices[i*3] / 2; uv[i*2+1] = vertices[i*3+2] / 2; }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function buildArchitecture(b, assetPlacements) {
  b.box('Site', 'grass', [0, -.22, 0], [56, .4, 48], { uvScale: 3 });
  b.box('Site', 'paving', [0, .01, 12], [31, .16, 4], { uvScale: 1.8 });
  b.box('Site', 'paving', [19, .015, 7], [8, .17, 24], { uvScale: 2 });
  b.box('Site', 'paving', [0, .06, 8.8], [29, .22, 1.4], { uvScale: 1.5 });
  for (let i = 0; i < 9; i++) b.box('Site', 'limestone', [-12 + i * 3, .1, 15], [2.1, .16, 1.25], { bevel: .06, uvScale: 1.2 });
  b.box('Site', 'limestone', [-18, .13, -2], [5.5, .24, 12], { bevel: .12 });
  b.box('Site', 'water', [-18, .27, -2], [5.1, .06, 11.6], { worldUV: false });
  for (const x of [-24, 24]) {
    b.box('Site', 'limestone', [x, .7, 0], [.35, 1.4, 42], { uvScale: 1.6 });
    b.box('Site', 'grass', [x - Math.sign(x) * .6, .75, 0], [.9, 1.25, 39], { bevel: .25, uvScale: 1.2 });
  }
  b.box('Site', 'limestone', [0, .7, -20], [48, 1.4, .35], { uvScale: 1.6 });
  b.box('Site', 'grass', [0, .75, -19.4], [45, 1.25, .9], { bevel: .25, uvScale: 1.2 });
  // 独立车库：平屋顶、金属门框和完整车辆。
  b.box('Site', 'plaster', [20, 1.65, -6], [8, 3.3, .28], { uvScale: 1.5 });
  b.box('Site', 'plaster', [16, 1.65, -1], [.28, 3.3, 10], { uvScale: 1.5 });
  b.box('Site', 'plaster', [24, 1.65, -1], [.28, 3.3, 10], { uvScale: 1.5 });
  b.box('Site', 'blackMetal', [20, 3.38, -1], [8.8, .28, 10.8], { bevel: .05 });
  b.box('Site', 'walnut', [20, 3.22, -1], [8.3, .08, 10.2], { uvScale: 1.4 });
  for (let i = 0; i < 9; i++) b.box('Site', 'blackMetal', [20, .38 + i * .31, 4], [7.6, .06, .12]);
  b.box('Site', 'black', [19.8, .65, 8.5], [2.05, .65, 4.6], { bevel: .28 });
  b.box('Site', 'glass', [19.8, 1.13, 8.25], [1.75, .65, 2.35], { bevel: .28 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cylinder('Site', 'rubber', [19.8 + sx * 1.01, .48, 8.5 + sz * 1.48], .36, .22, { rz: Math.PI / 2, segments: 24 });
  for (const sx of [-1, 1]) b.box('Site', 'emissiveWarm', [19.8 + sx * .65, .7, 10.82], [.45, .18, .04], { bevel: .04 });
  // 庭院灯光和修剪整齐的绿篱。
  for (const x of [-13, -7, 0, 7, 13]) {
    b.cylinder('Site', 'blackMetal', [x, .48, 13.8], .045, .9);
    b.cylinder('Site', 'emissiveWarm', [x, .91, 13.8], .11, .16);
  }
  for (const [x,z,s] of [[-20,-12,5.8],[-20,10,5.2],[24,-14,6.2],[10,-16,5.4],[-9,-16,4.8]]) assetPlacements.push({ type: 'olive', group: 'Site', position: [x, .02, z], height: s, yaw: x * .17 });

  // 主体地坪与二层侧翼／后桥廊，中央客厅上方保持挑空。
  b.box('ExteriorShell', 'limestone', [0, .28, 0], [28.6, .56, 16.6], { uvScale: 2 });
  for (const x of [-10, 10]) b.box('ExteriorShell', 'limestone', [x, 3.91, 0], [8.25, .28, 16.3], { uvScale: 2 });
  b.box('ExteriorShell', 'limestone', [0, 3.91, -5.25], [12.2, .28, 5.7], { uvScale: 2 });
  // 外立面柱梁与通透玻璃，不再使用实心小窗盒子。
  for (const x of [-14, -6, 6, 14]) b.box('ExteriorShell', 'limestone', [x, 3.85, 8], [.42, 6.7, .42], { uvScale: 1.3 });
  for (const y of [.62, 3.88, 7.35]) b.box('ExteriorShell', 'blackMetal', [0, y, 8.02], [28.5, .18, .24]);
  for (const [x,w] of [[-10,7.4],[0,11.4],[10,7.4]]) {
    b.box('ExteriorShell', 'glass', [x, 2.12, 8.04], [w, 2.85, .035], { worldUV: false });
    b.box('ExteriorShell', 'glass', [x, 5.57, 8.04], [w, 2.72, .035], { worldUV: false });
    for (let i = -2; i <= 2; i++) b.box('ExteriorShell', 'blackMetal', [x + i * w / 5, 3.82, 8.08], [.045, 6.25, .07]);
  }
  // 后墙与侧墙。
  b.box('ExteriorShell', 'plaster', [0, 3.85, -8], [28, 6.7, .32], { uvScale: 1.8 });
  for (const x of [-14, 14]) {
    b.box('ExteriorShell', 'plaster', [x, 3.85, 0], [.32, 6.7, 16], { uvScale: 1.8 });
    for (const z of [-4,4]) {
      b.box('ExteriorShell', 'glass', [x + (x < 0 ? -.18 : .18), 2.15, z], [.035, 2.4, 4.8], { worldUV: false });
      b.box('ExteriorShell', 'glass', [x + (x < 0 ? -.18 : .18), 5.65, z], [.035, 2.25, 4.8], { worldUV: false });
    }
  }
  // 主入口门、门把与门牌。
  b.box('FrontDetails', 'walnut', [0, 1.95, 8.19], [1.7, 2.75, .12], { bevel: .025 });
  b.rod('FrontDetails', 'bronze', [.58, 1.25, 8.29], [.58, 2.35, 8.29], .025);
  b.box('FrontDetails', 'bronze', [-1.4, 2.25, 8.22], [.55, .36, .05], { bevel: .025 });
  // 深挑檐和三组低坡屋顶。
  for (const [x,w] of [[-10,9.3],[10,9.3]]) {
    b.addGeometry('Roof', 'blackMetal', hipGeometry(w, 17.6, 1.25), [x, 7.46, 0]);
    b.box('Roof', 'walnut', [x, 7.39, 0], [w, .12, 17.3], { uvScale: 1.5 });
  }
  b.addGeometry('Roof', 'blackMetal', hipGeometry(13.4, 6.8, .95), [0, 7.52, -5.2]);
  b.box('Roof', 'blackMetal', [0, 7.48, 2.75], [13.3, .3, 11.5], { bevel: .05 });
  b.box('Roof', 'walnut', [0, 7.3, 2.75], [12.8, .1, 11], { uvScale: 1.5 });
  b.box('Roof', 'glass', [0, 7.48, 2.4], [4.2, .035, 5.8], { worldUV: false });
  // 剖切模式只保留低墙，任何房间机位都不会被整面墙堵死。
  for (const [id, s] of Object.entries(SPECS)) {
    const floor = ['master','bedroom2','gaming','bath2','shower2'].includes(id) ? 2 : 1;
    const base = floor === 1 ? F1 : F2;
    const g = CUT[floor];
    b.box(g, 'limestone', [s.cx, base + .26, s.cz - s.d/2], [s.w, .52, .13], { uvScale: 1.2 });
    b.box(g, 'limestone', [s.cx - s.w/2, base + .26, s.cz], [.13, .52, s.d], { uvScale: 1.2 });
    b.box(g, 'limestone', [s.cx + s.w/2, base + .26, s.cz], [.13, .52, s.d], { uvScale: 1.2 });
  }
  // 开放式楼梯，沿客厅左侧升至二层主卧翼。
  for (let i = 0; i < 18; i++) {
    const h = (F2 - F1) / 18;
    b.box('Floor1', 'oak', [-5.15, F1 + h * (i + 1) / 2, 5.4 - i * .29], [1.45, h * (i + 1), .32], { uvScale: 1.2 });
    b.box('Floor1', 'emissiveWarm', [-5.15, F1 + h * (i + 1) + .015, 5.53 - i * .29], [1.1, .018, .025], { worldUV: false });
  }
  b.rod('Floor1', 'bronze', [-4.35, F1 + .9, 5.5], [-4.35, F2 + .9, .5], .035);
  for (let i = 0; i < 10; i++) b.rod('Floor1', 'bronze', [-4.35, F1 + i * .36, 5.4 - i * .52], [-4.35, F1 + .9 + i * .36, 5.4 - i * .52], .015);
}

function buildLiving(p, room, g, base, s, assets) {
  assets.push({ type: 'sofa', group: g, position: [-2.2, base, .5], width: 3, yaw: 0, room, label: '三米榆木藤编主沙发' });
  p.sofa(room,g,base,3.6,2.4,2.7,-Math.PI/2,'独立亚麻双人沙发','fabric');
  p.chair(room,g,base,-2.8,4.9,.15,'圈椅一'); p.chair(room,g,base,-.9,5.1,-.12,'圈椅二');
  p.table(room,g,base,-1.1,3.1,2.3,1.15,.42,'walnut','低矮实木茶几');
  p.table(room,g,base,-4.4,1.2,.7,.7,.55,'walnut','左侧边几'); p.table(room,g,base,4.5,4.2,.7,.7,.55,'walnut','右侧边几');
  p.rug(room,g,base,0,3.1,8.4,5.6,'fabric','超大手工羊毛地毯');
  p.television(room,g,base,0,base+1.65,6.65,3.1,'一百英寸超窄边电视');
  p.table(room,g,base,0,6.5,4.8,.6,.42,'darkWood','悬浮电视矮柜');
  b.box(g,'marble',[0,base+1.6,6.85],[5.8,3.0,.18],{uvScale:1.4}); p.note(room,'整面天然石材电视背景',0,base+1.6,6.85);
  assets.push({ type:'gate',group:g,position:[4.8,base,-1.65],height:3.1,yaw:Math.PI/2,room,label:'月洞木格景观屏' });
  p.lamp(room,g,base,-4.4,2.5,1.75,'古铜落地阅读灯'); p.pendant(room,g,base,0,2.6,4.7,'挑空客厅主吊灯');
  p.table(room,g,base,-1.1,3.1,.65,.42,.49,'bronze','古铜茶盘');
  b.cylinder(g,'jade',[-1.1,base+.61,3.1],.11,.18,{radiusTop:.08}); p.note(room,'翡翠釉茶壶',-1.1,base+.61,3.1);
  p.cup(room,g,base,-.75,base+.51,3.05,'品茗杯一'); p.cup(room,g,base,-1.42,base+.51,3.04,'品茗杯二'); p.cup(room,g,base,-1.1,base+.51,3.36,'品茗杯三');
  p.book(room,g,base,3.6,base+.56,2.4,1); p.book(room,g,base,3.62,base+.63,2.42,2);
  p.vase(room,g,base,-4.4,base+.61,1.2,'粗陶落地花器','clay'); p.branches(room,g,base,-4.4,base+1.01,1.2,'舒展插花枝条');
  assets.push({type:'tree',group:g,position:[5.1,base,5.8],height:1.65,yaw:0,room,label:'角落编织发财树'});
  p.cushion(room,g,base,-2.9,base+.82,.45,'fabricRust','赭色靠垫'); p.cushion(room,g,base,-1.55,base+.82,.45,'fabricDark','墨绿靠垫');
  p.rug(room,g,base,3.6,2.1,.75,1.3,'fabricRust','沙发搭毯');
  p.artwork(room,g,base,-5.82,base+1.9,1.8,1.25,1.5,'左侧水墨立轴',Math.PI/2); p.artwork(room,g,base,5.82,base+1.9,1.8,1.25,1.5,'右侧水墨立轴',-Math.PI/2);
  b.box(g,'emissiveWarm',[0,base+5.7,2.7],[7.5,.045,.08],{worldUV:false}); p.note(room,'挑顶隐藏灯带',0,base+5.7,2.7);
  for(let i=0;i<3;i++){b.cylinder(g,'emissiveWarm',[-3+i*3,base+5.65,1.4],.11,.04,{segments:20});p.note(room,`挑顶筒灯 ${i+1}`,-3+i*3,base+5.65,1.4);}
}

function buildStudy(p,room,g,base,s) {
  p.table(room,g,base,-10,3.7,3.2,1.25,.78,'walnut','三米二书画书桌'); p.chair(room,g,base,-10,2.65,0,'书桌主椅');
  p.chair(room,g,base,-12.2,5.8,Math.PI,'茶叙客椅一'); p.chair(room,g,base,-10.7,5.8,Math.PI,'茶叙客椅二');
  p.monitor(room,g,base,-10,base+1.55,3.5,'书房显示器');
  b.box(g,'black',[-9.25,base+.88,3.65],[.52,.035,.34],{bevel:.02}); p.note(room,'笔记本电脑',-9.25,base+.88,3.65);
  p.shelf(room,g,base,-10,.25,6.3,2.75,5,'六米三整墙藏书架');
  for(let i=0;i<6;i++) p.book(room,g,base,-12.5+i*.43,base+.42,.54,i+1,true);
  p.lamp(room,g,base,-11.25,3.75,1.25,'桌面阅读灯');
  p.table(room,g,base,-11.45,5.45,.8,.65,.48,'walnut','茶叙小圆桌');
  b.cylinder(g,'jade',[-11.45,base+.61,5.45],.1,.17); p.note(room,'茶叙陶壶',-11.45,base+.61,5.45);
  p.cup(room,g,base,-11.2,base+.53,5.45,'客用茶杯一'); p.cup(room,g,base,-11.7,base+.53,5.45,'客用茶杯二');
  p.rug(room,g,base,-10,3.9,5.8,4.5,'fabric','书房静音地毯');
  p.artwork(room,g,base,-13.82,base+1.8,3.8,1.2,1.6,'竹枝水墨图',Math.PI/2);
  p.plant(room,g,base,-6.8,6.6,1.15,'窗边阔叶植物');
  p.vase(room,g,base,-8.7,base+.86,3.6,'毛笔笔筒','clay');
  for(let i=0;i<4;i++){b.rod(g,'walnut',[-8.85+i*.08,base+1.0,3.6],[-8.85+i*.08,base+1.38,3.6],.012,8);p.note(room,`毛笔 ${i+1}`,-8.85+i*.08,base+1.2,3.6);}
  b.box(g,'paper',[-10.1,base+.85,4.05],[1.1,.018,.7],{worldUV:false});p.note(room,'摊开书画宣纸',-10.1,base+.85,4.05);
  b.cylinder(g,'black',[-9.65,base+.9,4.05],.07,.08);p.note(room,'砚台',-9.65,base+.9,4.05);
  b.box(g,'bronze',[-10.55,base+.88,4.05],[.42,.05,.08],{bevel:.015});p.note(room,'古铜镇纸',-10.55,base+.88,4.05);
  p.pendant(room,g,base,-10,4.1,2.85,'书房纸质吊灯');
}

function buildBedroom(p,room,g,base,s,assets,master=false) {
  const x=s.cx,z=s.cz-(master?2.2:0);
  assets.push({type:'hotel',group:g,position:[x,base,z-1.0],width:master?2.45:2.0,yaw:0,room,label:master?'主卧软包床与配套床品':'完整软包双人床'});
  p.rug(room,g,base,x,z+1.1,master?6.4:5.5,master?7:5.2,'fabric','卧室大面积羊毛毯');
  for(const side of [-1,1]) {
    p.table(room,g,base,x+side*1.55,z-.75,.72,.58,.48,'walnut',`${side<0?'左':'右'}床头柜`);
    p.lamp(room,g,base,x+side*1.55,z-.75,1.1,`${side<0?'左':'右'}床头灯`);
  }
  p.shelf(room,g,base,x-(master?2.9:2.6),z-(master?5.7:3.1),master?2.2:2.4,2.65,4,'整墙衣柜与开放格');
  p.sofa(room,g,base,x+(master?2.4:2.1),z+2.3,master?2.2:1.8,-Math.PI/2,'床尾休憩沙发');
  p.table(room,g,base,x,z+(master?3.2:2.4),2.1,.62,.45,'walnut','床尾凳');
  p.artwork(room,g,base,x,base+2.05,z-(master?4.2:3.35),2.2,1.0,'床头山水装饰画');
  p.plant(room,g,base,x+3.1,z+2.7,1.15,'卧室窗边绿植');
  p.television(room,g,base,x,base+1.6,z+3.45,1.8,'卧室壁挂电视');
  for(let i=0;i<6;i++) p.book(room,g,base,x-2.7+(i%3)*.34,base+.48+Math.floor(i/3)*.07,z+2.5,i+1);
  p.cushion(room,g,base,x-.45,base+1.05,z-.55,'fabricRust','床品靠枕一'); p.cushion(room,g,base,x+.35,base+1.05,z-.55,'fabricDark','床品靠枕二');
  p.vase(room,g,base,x+2.1,base+.55,z+2.2,'床头陶罐','clay');
  p.cup(room,g,base,x+1.55,base+.56,z-.65,'夜间水杯');
  p.pendant(room,g,base,x,z,2.95,'卧室漫反射吊灯');
  b.box(g,'fabricDark',[x,base+.12,z+1.2],[1.7,.08,.65],{bevel:.04});p.note(room,'折叠床尾搭毯',x,base+.12,z+1.2);
  b.box(g,'bronze',[x-3.65,base+1.35,z+.8],[.06,.32,.18],{bevel:.02});p.note(room,'卧室温控面板',x-3.65,base+1.35,z+.8);
  // 独立行李／衣物收纳，保证卧室 30 项专属细节。
  b.box(g,'fabricDark',[x+2.8,base+.35,z-2.2],[.85,.65,.5],{bevel:.08});p.note(room,'旅行收纳箱',x+2.8,base+.35,z-2.2);
  p.table(room,g,base,x-2.7,z+2.6,1.5,.65,.74,'walnut','卧室书画兼梳妆桌');
  p.chair(room,g,base,x-2.7,z+3.25,Math.PI,'卧室书桌椅');
  p.mirror(room,g,base,x-3.65,base+1.65,z+1.8,1.0,1.55,'卧室全身镜');
  p.lamp(room,g,base,x-2.7,z+2.6,1.15,'卧室桌面灯');
  for(const side of [-1,1])b.box(g,'fabricDark',[x+side*.2,base+.06,z+1.75],[.25,.1,.55],{bevel:.08});p.note(room,'床边居家拖鞋',x,base+.06,z+1.75);
}

function buildGym(p,room,g,base,s) {
  // 跑步机
  b.box(g,'blackMetal',[8.2,base+.18,3.2],[1.15,.28,2.3],{bevel:.12});b.box(g,'rubber',[8.2,base+.35,3.2],[.85,.06,1.85],{bevel:.04});
  b.rod(g,'blackMetal',[7.7,base+.35,2.35],[7.7,base+1.25,2.1],.045);b.rod(g,'blackMetal',[8.7,base+.35,2.35],[8.7,base+1.25,2.1],.045);
  b.box(g,'screen',[8.2,base+1.3,2.05],[.65,.35,.08],{rx:-.2});p.note(room,'商用跑步机',8.2,base+.5,3.2);
  // 划船机
  b.box(g,'blackMetal',[11.2,base+.22,3.0],[.65,.18,2.4],{bevel:.05});b.box(g,'fabricDark',[11.2,base+.5,3.5],[.55,.14,.5],{bevel:.06});
  b.rod(g,'steel',[11.2,base+.25,2.0],[11.2,base+1.0,1.7],.04);p.note(room,'磁阻划船机',11.2,base+.4,3);
  // 训练凳和哑铃架
  b.box(g,'fabricDark',[9.8,base+.55,5.7],[.65,.18,1.65],{bevel:.08});b.box(g,'blackMetal',[9.8,base+.28,5.7],[.45,.55,1.1]);p.note(room,'可调节力量训练凳',9.8,base+.55,5.7);
  b.box(g,'blackMetal',[12.8,base+.65,4.9],[.65,1.25,2.4],{bevel:.04});p.note(room,'三层哑铃收纳架',12.8,base+.65,4.9);
  for(let i=0;i<8;i++){const z=4+i*.27;b.rod(g,'steel',[12.42,base+.45+(i%2)*.4,z],[13.12,base+.45+(i%2)*.4,z],.035);for(const x of [12.38,13.16])b.cylinder(g,'rubber',[x,base+.45+(i%2)*.4,z],.11,.13,{rz:Math.PI/2});p.note(room,`哑铃 ${i+1}`,12.8,base+.6,z);}
  for(let i=0;i<2;i++)p.rug(room,g,base,7.3+i*2.2,6.4,1.1,2.2,i?'fabricDark':'fabricRust',`瑜伽垫 ${i+1}`);
  for(let i=0;i<2;i++){b.cylinder(g,'fabricDark',[11.2+i*.55,base+.16,6.9],.14,.72,{rx:Math.PI/2});p.note(room,`泡沫轴 ${i+1}`,11.2+i*.55,base+.16,6.9);}
  for(let i=0;i<3;i++){b.box(g,'mirror',[6.15,base+1.55,2.2+i*1.7],[.035,2.5,1.6],{worldUV:false});p.note(room,`训练镜墙 ${i+1}`,6.15,base+1.55,2.2+i*1.7);}
  for(let i=0;i<2;i++)p.bottle(room,g,base,8.8+i*.35,base+.05,6.8,`运动水壶 ${i+1}`,'steel',.28);
  for(let i=0;i<2;i++)p.towel(room,g,base,12.9,base+1.5,6.1+i*.55,`训练毛巾 ${i+1}`);
  p.plant(room,g,base,13,7,1.1,'健身房绿植');
  b.cylinder(g,'white',[10,base+2.65,.18],.3,.06,{rx:Math.PI/2});p.note(room,'训练时钟',10,base+2.65,.18);
  b.box(g,'black',[7,base+.25,7.1],[.4,.5,.32],{bevel:.05});p.note(room,'蓝牙运动音箱',7,base+.25,7.1);
  b.cylinder(g,'steel',[11.8,base+1.1,7.1],.35,.12);b.cylinder(g,'blackMetal',[11.8,base+.55,7.1],.035,1.1);p.note(room,'落地循环风扇',11.8,base+1.1,7.1);
  for(let i=0;i<2;i++){b.cylinder(g,'rubber',[13.25,base+.25+i*.28,2.0],.28,.1,{rz:Math.PI/2});p.note(room,`杠铃片 ${i+1}`,13.25,base+.25+i*.28,2);}
  p.pendant(room,g,base,10,4,2.9,'健身房防眩顶灯');
}

function buildKitchen(p,room,g,base,s) {
  b.box(g,'walnut',[10,base+.46,-7.25],[7.1,.9,.72],{bevel:.035});b.box(g,'marble',[10,base+.95,-7.25],[7.25,.1,.82],{bevel:.025});p.note(room,'七米石材后操作台',10,base+.9,-7.25);
  b.box(g,'darkWood',[13.25,base+1.35,-6.9],[1.1,2.7,1.0],{bevel:.04});p.note(room,'通顶高柜',13.25,base+1.35,-6.9);
  b.box(g,'steel',[12.0,base+1.35,-7.1],[1.25,2.65,1.0],{bevel:.06});b.box(g,'blackMetal',[12,base+1.35,-6.57],[.035,2.3,.04]);p.note(room,'双门冷藏冰箱',12,base+1.35,-7.1);
  b.box(g,'black',[10.7,base+.52,-6.85],[.85,.68,.08],{bevel:.04});b.box(g,'glass',[10.7,base+.52,-6.79],[.68,.45,.02]);p.note(room,'嵌入式蒸烤箱',10.7,base+.52,-6.85);
  b.sphere(g,'steel',[8.7,base+1.0,-7.15],[.55,.07,.32]);p.note(room,'不锈钢深水槽',8.7,base+1,-7.15);
  b.rod(g,'bronze',[8.7,base+1.0,-7.48],[8.7,base+1.4,-7.48],.028);b.rod(g,'bronze',[8.7,base+1.4,-7.48],[8.7,base+1.4,-7.15],.028);p.note(room,'抽拉式厨房龙头',8.7,base+1.2,-7.3);
  b.box(g,'black',[9.8,base+1.02,-7.15],[1.05,.035,.55],{bevel:.03});for(const x of [9.5,10.1])b.torus(g,'steel',[x,base+1.05,-7.15],.17,.018,{rx:Math.PI/2});p.note(room,'双眼电磁炉灶',9.8,base+1.02,-7.15);
  b.box(g,'steel',[9.8,base+2.25,-7.25],[1.3,.35,.72],{bevel:.06});p.note(room,'隐藏式排烟机',9.8,base+2.25,-7.25);
  b.box(g,'walnut',[9.4,base+.48,-2.8],[4.4,.92,1.35],{bevel:.04});b.box(g,'marble',[9.4,base+.98,-2.8],[4.65,.12,1.55],{bevel:.035});p.note(room,'四米六中岛操作台',9.4,base+.98,-2.8);
  for(let i=0;i<3;i++)p.stool(room,g,base,8.1+i*1.3,-1.65,`中岛吧椅 ${i+1}`);
  for(let i=0;i<3;i++)p.pendant(room,g,base,8.1+i*1.3,-2.8,2.65,`中岛吊灯 ${i+1}`);
  b.box(g,'paleWood',[8.4,base+1.07,-2.8],[.75,.045,.45],{bevel:.025});p.note(room,'实木砧板',8.4,base+1.07,-2.8);
  b.box(g,'walnut',[9.25,base+1.18,-3.0],[.22,.28,.18],{bevel:.02});p.note(room,'磁吸刀架',9.25,base+1.18,-3);
  for(let i=0;i<3;i++){b.box(g,'steel',[9.16+i*.09,base+1.43,-3],[.035,.32,.06],{rz:(i-1)*.08});p.note(room,`厨刀 ${i+1}`,9.16+i*.09,base+1.43,-3);}
  p.bowl(room,g,base,10.4,base+1.06,-2.75,'陶瓷备餐碗','ceramic',.25);
  p.bowl(room,g,base,11.25,base+1.06,-2.8,'应季水果盘','jade',.3);
  for(let i=0;i<3;i++){b.sphere(g,i===0?'bookRed':'clay',[11.1+i*.14,base+1.25,-2.8],[.1,.1,.1]);p.note(room,`鲜果 ${i+1}`,11.1+i*.14,base+1.25,-2.8);}
  b.box(g,'blackMetal',[7.3,base+1.3,-7.15],[.55,.58,.45],{bevel:.06});b.box(g,'steel',[7.3,base+1.28,-6.9],[.35,.18,.04]);p.note(room,'意式咖啡机',7.3,base+1.3,-7.15);
  b.cylinder(g,'steel',[7.95,base+1.18,-7.15],.15,.3);b.torus(g,'blackMetal',[8.13,base+1.2,-7.15],.12,.025,{ry:Math.PI/2});p.note(room,'电热水壶',7.95,base+1.18,-7.15);
  for(let i=0;i<3;i++)p.bottle(room,g,base,10.7+i*.25,base+1.03,-7.25,`调味罐 ${i+1}`,i===1?'clay':'jade',.18);
}

function buildDining(p,room,g,base,s) {
  b.cylinder(g,'walnut',[3,base+.77,-5.15],1.45,.13,{segments:48});b.cylinder(g,'walnut',[3,base+.39,-5.15],.36,.76,{segments:32});p.note(room,'十人实木圆餐桌',3,base+.77,-5.15);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const x=3+Math.sin(a)*2.05,z=-5.15+Math.cos(a)*2.05;p.chair(room,g,base,x,z,a+Math.PI,`餐椅 ${i+1}`);}
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const x=3+Math.sin(a)*1.08,z=-5.15+Math.cos(a)*1.08;b.cylinder(g,'fabricDark',[x,base+.85,z],.25,.018,{segments:24});p.note(room,`餐垫 ${i+1}`,x,base+.85,z);}
  for(let i=0;i<4;i++){const a=i/4*Math.PI*2;p.cup(room,g,base,3+Math.sin(a)*.82,base+.86,-5.15+Math.cos(a)*.82,`餐杯 ${i+1}`);}
  p.vase(room,g,base,3,base+.86,-5.15,'餐桌中央花器','jade');p.branches(room,g,base,3,base+1.25,-5.15,'餐桌季节性插花');
  for(const x of [2.2,3.8]){b.cylinder(g,'bronze',[x,base+1.04,-5.15],.045,.36);b.cylinder(g,'emissiveWarm',[x,base+1.28,-5.15],.025,.14);p.note(room,`餐桌烛台 ${x<3?'左':'右'}`,x,base+1.1,-5.15);}
  p.table(room,g,base,3,-7.5,4.4,.65,.82,'walnut','餐边储物柜');
  p.artwork(room,g,base,1.7,base+1.95,-7.82,1.25,1.05,'餐厅水墨一');p.artwork(room,g,base,4.3,base+1.95,-7.82,1.25,1.05,'餐厅水墨二');
  p.pendant(room,g,base,3,-5.15,2.8,'家宴宣纸主吊灯');p.bowl(room,g,base,3.9,base+.88,-7.45,'宴客汤盆','ceramic',.28);
}

function buildBath(p,room,g,base,s,upper=false) {
  const x=s.cx,z=s.cz;
  p.toilet(room,g,base,x-.65,z-1.25,'智能壁挂马桶');
  b.torus(g,'white',[x-.65,base+.64,z-1.18],.28,.025,{rx:Math.PI/2});p.note(room,'缓冲马桶座圈',x-.65,base+.64,z-1.18);
  b.box(g,'ceramic',[x-.65,base+.82,z-1.58],[.65,.72,.22],{bevel:.08});p.note(room,'隐藏水箱面板',x-.65,base+.82,z-1.58);
  b.box(g,'steel',[x-.65,base+1.0,z-1.45],[.18,.035,.06],{bevel:.015});p.note(room,'双档冲水按钮',x-.65,base+1,z-1.45);
  p.vanity(room,g,base,x+.55,z+.7,upper?1.8:1.1,'悬浮木作浴室柜');
  b.sphere(g,'ceramic',[x+.55,base+.9,z+.72],[.32,.08,.22]);p.note(room,'台上洗手盆',x+.55,base+.9,z+.72);
  b.rod(g,'bronze',[x+.55,base+.9,z+.42],[x+.55,base+1.22,z+.42],.024);p.note(room,'古铜面盆龙头',x+.55,base+1.1,z+.42);
  p.mirror(room,g,base,x+.55,base+1.95,z+.32,upper?1.65:1.05,1.0,'带框防雾镜');
  for(const side of [-1,1]){b.cylinder(g,'emissiveWarm',[x+.55+side*(upper?1.05:.72),base+1.95,z+.36],.055,.55);p.note(room,`镜前壁灯 ${side<0?'左':'右'}`,x+.55+side*.7,base+1.95,z+.36);}
  p.towel(room,g,base,x+1.1,base+1.15,z+1.5,'擦手毛巾');
  b.rod(g,'bronze',[x+.65,base+1.48,z+1.5],[x+1.55,base+1.48,z+1.5],.022);p.note(room,'古铜毛巾杆',x+1.1,base+1.48,z+1.5);
  p.bottle(room,g,base,x+.95,base+.91,z+.75,'洗手液瓶','jade',.2);
  p.cup(room,g,base,x+.15,base+.91,z+.75,'漱口杯');
  for(let i=0;i<2;i++){b.rod(g,'paleWood',[x+.1+i*.1,base+1.0,z+.75],[x+.1+i*.1,base+1.23,z+.75],.012,8);p.note(room,`牙刷 ${i+1}`,x+.1+i*.1,base+1.1,z+.75);}
  for(let i=0;i<3;i++)p.bottle(room,g,base,x-.15+i*.2,base+.92,z-.05,`洗漱收纳瓶 ${i+1}`,i===1?'clay':'white',.18);
  b.cylinder(g,'steel',[x-1.05,base+.75,z+.1],.09,.035,{rx:Math.PI/2});p.note(room,'厕纸卷',x-1.05,base+.75,z+.1);
  b.rod(g,'bronze',[x-1.18,base+.75,z+.1],[x-.92,base+.75,z+.1],.02);p.note(room,'厕纸架',x-1.05,base+.75,z+.1);
  b.cylinder(g,'blackMetal',[x-1.0,base+.22,z+1.1],.16,.42,{segments:20});p.note(room,'脚踏垃圾桶',x-1,base+.22,z+1.1);
  b.cylinder(g,'steel',[x-.2,base+.012,z-1.7],.12,.018,{segments:20});p.note(room,'隐形地漏',x-.2,base+.012,z-1.7);
  b.rod(g,'bronze',[x+s.w/2-.12,base+1.0,z],[x+s.w/2-.12,base+1.45,z],.025);p.note(room,'卫生间门拉手',x+s.w/2,base+1.2,z);
  p.artwork(room,g,base,x-s.w/2+.09,base+1.75,z+.4,.55,.75,'小型植物版画',Math.PI/2);
  p.plant(room,g,base,x+s.w/2-.5,z+1.8,.65,'耐阴小盆栽');
  p.rug(room,g,base,x+.45,z+1.65,1.0,.65,'fabric','吸水浴室地垫');
  p.pendant(room,g,base,x,z,2.85,'防潮顶灯');
  b.box(g,'bronze',[x,base+.06,z+s.d/2-.1],[s.w*.75,.08,.06]);p.note(room,'门槛古铜收边',x,base+.06,z+s.d/2);
  b.box(g,'blackMetal',[x-s.w/2+.08,base+2.55,z-.5],[.04,.25,.45]);p.note(room,'静音排风口',x-s.w/2,base+2.55,z-.5);
}

function buildShower(p,room,g,base,s,upper=false) {
  const x=s.cx,z=s.cz,w=Math.min(upper?3.2:2.1,s.w-.35),d=2.8;
  b.box(g,'glass',[x-w/2,base+1.25,z],[.035,2.5,d],{worldUV:false});p.note(room,'左侧通透玻璃隔断',x-w/2,base+1.25,z);
  b.box(g,'glass',[x,base+1.25,z+d/2],[w,2.5,.035],{worldUV:false});p.note(room,'玻璃淋浴门',x,base+1.25,z+d/2);
  b.rod(g,'steel',[x+.35,base+1.0,z+d/2+.04],[x+.35,base+1.5,z+d/2+.04],.022);p.note(room,'淋浴门竖向拉手',x+.35,base+1.25,z+d/2);
  for(const yy of [.55,2.0]){b.box(g,'steel',[x-w/2+.05,base+yy,z+d/2],[.12,.09,.08],{bevel:.015});p.note(room,`玻璃门铰链 ${yy<1?'下':'上'}`,x-w/2,base+yy,z+d/2);}
  b.cylinder(g,'bronze',[x,base+2.25,z-d/2+.25],.28,.055,{segments:32});p.note(room,'大雨淋顶喷',x,base+2.25,z-d/2+.25);
  b.rod(g,'bronze',[x,base+2.25,z-d/2+.25],[x,base+2.55,z-d/2+.25],.025);p.note(room,'顶喷固定臂',x,base+2.4,z-d/2+.25);
  b.box(g,'bronze',[x,base+1.05,z-d/2+.08],[.42,.18,.08],{bevel:.04});p.note(room,'恒温淋浴控制阀',x,base+1.05,z-d/2);
  b.cylinder(g,'bronze',[x+.6,base+1.55,z-d/2+.12],.075,.16,{rx:Math.PI/2});p.note(room,'手持花洒',x+.6,base+1.55,z-d/2);
  b.torus(g,'steel',[x+.35,base+1.25,z-d/2+.1],.35,.015,{arc:Math.PI*1.45});p.note(room,'柔性花洒软管',x+.35,base+1.25,z-d/2);
  b.box(g,'bronze',[x-.55,base+1.25,z-d/2+.12],[.65,.055,.25],{bevel:.02});p.note(room,'置物架',x-.55,base+1.25,z-d/2);
  b.box(g,'limestone',[x,base+1.55,z-d/2+.06],[1.0,.65,.12],{bevel:.025});p.note(room,'内嵌壁龛',x,base+1.55,z-d/2);
  for(let i=0;i<4;i++)p.bottle(room,g,base,x-.45+i*.28,base+1.3,z-d/2+.22,`洗护瓶 ${i+1}`,i%2?'jade':'clay',.2);
  b.box(g,'teak' in b.materials?'teak':'paleWood',[x+.75,base+.45,z+.35],[.65,.12,.5],{bevel:.04});for(const sx of [-1,1])b.box(g,'paleWood',[x+.75+sx*.23,base+.22,z+.35],[.07,.44,.38]);p.note(room,'防腐木淋浴凳',x+.75,base+.45,z+.35);
  p.towel(room,g,base,x+.8,base+1.2,z+1.25,'淋浴浴巾');
  b.rod(g,'bronze',[x+.35,base+1.52,z+1.25],[x+1.25,base+1.52,z+1.25],.025);p.note(room,'浴巾挂杆',x+.8,base+1.52,z+1.25);
  b.cylinder(g,'steel',[x,base+.012,z],.16,.025,{segments:24});p.note(room,'线性地漏主体',x,base+.012,z);
  for(let i=0;i<6;i++){b.box(g,'blackMetal',[x-.11+i*.044,base+.029,z],[.014,.012,.22],{worldUV:false});p.note(room,`地漏排水槽 ${i+1}`,x-.11+i*.044,base+.03,z);}
  for(let i=0;i<2;i++){b.torus(g,'bronze',[x+s.w/2-.08,base+1.6,z+.3+i*.4],.055,.012,{ry:Math.PI/2});p.note(room,`衣物挂钩 ${i+1}`,x+s.w/2,base+1.6,z+.3+i*.4);}
  for(let i=0;i<2;i++){b.box(g,'fabricDark',[x-.35+i*.42,base+.06,z+1.9],[.28,.1,.58],{bevel:.09});p.note(room,`防滑拖鞋 ${i+1}`,x-.35+i*.42,base+.06,z+1.9);}
}

function buildGaming(p,room,g,base,s) {
  p.table(room,g,base,10,1.2,5.4,1.15,.78,'darkWood','五米四双人电竞桌');
  for(const x of [8.6,11.4])p.chair(room,g,base,x,2.45,Math.PI,'人体工学电竞椅','fabricDark');
  for(const x of [8.6,11.4])p.monitor(room,g,base,x,base+1.55,1.15,'高刷电竞显示器');
  for(const x of [8.6,11.4]){b.box(g,'black',[x,base+.86,1.65],[.52,.035,.18],{bevel:.015});p.note(room,'机械键盘',x,base+.86,1.65);}
  for(const x of [9.15,11.95]){b.sphere(g,'black',[x,base+.88,1.65],[.07,.035,.11]);p.note(room,'电竞鼠标',x,base+.88,1.65);}
  for(const x of [8.8,11.6])p.rug(room,g,base,x,1.65,1.15,.48,'fabricDark','大尺寸鼠标垫');
  for(const x of [7.65,12.35]){b.box(g,'blackMetal',[x,base+.62,1.2],[.45,1.15,.65],{bevel:.05});b.box(g,'emissiveCool',[x,base+.65,1.54],[.25,.65,.025]);p.note(room,'侧透电竞主机',x,base+.62,1.2);}
  for(const x of [8.0,12.0]){b.torus(g,'blackMetal',[x,base+1.0,2.0],.18,.035,{arc:Math.PI});p.note(room,'头戴式耳机',x,base+1,2);}
  for(const x of [8.0,12.0]){b.cylinder(g,'blackMetal',[x,base+.9,2],.025,.35);p.note(room,'耳机展示架',x,base+.9,2);}
  for(const x of [8.6,11.4]){b.box(g,'emissiveCool',[x,base+1.28,1.0],[1.4,.025,.03],{worldUV:false});p.note(room,'桌面氛围灯带',x,base+1.28,1);}
  p.sofa(room,g,base,12.9,5.6,2.2,-Math.PI/2,'电竞房休息沙发');p.rug(room,g,base,10,4.4,5.4,3.6,'fabricDark','电竞房吸音地毯');
  p.artwork(room,g,base,8.5,base+1.9,.18,1.1,1.45,'科幻主题海报一');p.artwork(room,g,base,11.5,base+1.9,.18,1.1,1.45,'科幻主题海报二');
  p.shelf(room,g,base,6.55,4.2,1.0,2.1,3,'游戏收藏展示架一');p.shelf(room,g,base,13.45,4.2,1.0,2.1,3,'游戏收藏展示架二');
  for(const x of [7.9,12.1]){b.box(g,'black',[x,base+1.05,1.05],[.16,.25,.18],{bevel:.03});p.note(room,'桌面监听音箱',x,base+1.05,1.05);}
  b.box(g,'blackMetal',[10,base+.25,5.8],[.55,.18,.42],{bevel:.04});p.note(room,'游戏主机',10,base+.25,5.8);
  for(const x of [9.65,10.35]){b.box(g,'black',[x,base+.14,5.2],[.22,.08,.32],{bevel:.07});p.note(room,'无线游戏手柄',x,base+.14,5.2);}
}

export function buildVilla(materials, rooms) {
  const villa = new THREE.Group(); villa.name = 'ChengyuanVillaV2';
  const groups = {};
  for (const name of ['Site','ExteriorShell','FrontDetails','Roof','Floor1','Floor2','Cut1','Cut2']) {
    groups[name] = new THREE.Group(); groups[name].name = name; villa.add(groups[name]);
  }
  const batch = new ModelBatch(groups, materials);
  b = batch;
  const ledger = new DetailLedger();
  const p = createPropFactory(batch, ledger);
  const assetPlacements = [];
  buildArchitecture(batch, assetPlacements);
  for (const room of rooms) {
    const s = SPECS[room.id];
    if (!s) throw new Error(`缺少房间布局 ${room.id}`);
    const base = room.floor === 1 ? F1 : F2;
    const g = GROUP[room.floor];
    p.roomFinish(room.id,g,base,s.cx,s.cz,s.w,s.d,{wet:s.wet,window:s.window,floor:s.wet?'marble':'oak'});
    if (room.id==='living') buildLiving(p,room.id,g,base,s,assetPlacements);
    else if (room.id==='study') buildStudy(p,room.id,g,base,s);
    else if (room.id==='guest') buildBedroom(p,room.id,g,base,s,assetPlacements,false);
    else if (room.id==='master') buildBedroom(p,room.id,g,base,s,assetPlacements,true);
    else if (room.id==='bedroom2') buildBedroom(p,room.id,g,base,s,assetPlacements,false);
    else if (room.id==='gym') buildGym(p,room.id,g,base,s);
    else if (room.id==='kitchen') buildKitchen(p,room.id,g,base,s);
    else if (room.id==='dining') buildDining(p,room.id,g,base,s);
    else if (room.id==='bath1') buildBath(p,room.id,g,base,s,false);
    else if (room.id==='bath2') buildBath(p,room.id,g,base,s,true);
    else if (room.id==='shower1') buildShower(p,room.id,g,base,s,false);
    else if (room.id==='shower2') buildShower(p,room.id,g,base,s,true);
    else if (room.id==='gaming') buildGaming(p,room.id,g,base,s);
  }
  const details = ledger.validate(rooms.map(r=>r.id));
  batch.flush();
  return { villa, groups, details, assetPlacements, generatedParts: batch.count };
}
