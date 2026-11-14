import * as THREE from 'three';

export function createPropFactory(batch, ledger) {
  const b = batch;
  const note = (room, label, x, y, z) => ledger.add(room, label, [x, y, z]);
  const box = (g, m, p, s, o) => b.box(g, m, p, s, o);
  const cyl = (g, m, p, r, h, o) => b.cylinder(g, m, p, r, h, o);

  function roomFinish(room, g, base, cx, cz, w, d, options = {}) {
    const floorMat = options.floor ?? 'oak';
    box(g, floorMat, [cx, base - .055, cz], [w, .11, d], { uvScale: options.wet ? 1.4 : 2.4 });
    note(room, options.wet ? '防滑石材地面' : '通铺真实木地板', cx, base, cz);
    for (let i = 0; i < 8; i++) {
      const x = cx - w * .42 + i * w * .12;
      box(g, options.wet ? 'limestone' : 'darkWood', [x, base + .004, cz], [options.wet ? .014 : .009, .008, d * .94], { worldUV: false });
      note(room, options.wet ? `地面石砖拼缝 ${i + 1}` : `木地板分缝 ${i + 1}`, x, base, cz);
    }
    const skirting = [
      [cx, base + .07, cz - d / 2 + .055, w, .14, .07],
      [cx - w / 2 + .055, base + .07, cz, .07, .14, d],
      [cx + w / 2 - .055, base + .07, cz, .07, .14, d],
    ];
    skirting.forEach((s, i) => {
      box(g, options.wet ? 'limestone' : 'walnut', s.slice(0, 3), s.slice(3), { worldUV: false });
      note(room, `踢脚线收边 ${i + 1}`, ...s.slice(0, 3));
    });
    for (let i = 0; i < 2; i++) {
      const x = cx + (i ? 1 : -1) * w * .24;
      box(g, options.wet ? 'marble' : 'plaster', [x, base + 1.55, cz - d / 2 + .07], [w * .43, 2.75, .12], { uvScale: 1.8 });
      note(room, options.wet ? `石材墙面分块 ${i + 1}` : `灰泥背景墙分块 ${i + 1}`, x, base + 1.5, cz - d / 2);
    }
    const windowZ = options.window === 'back' ? cz - d / 2 + .14 : cz + d / 2 - .14;
    box(g, 'limestone', [cx, base + .76, windowZ], [w * .55, .1, .32], { bevel: .025 });
    note(room, '整石窗台', cx, base + .76, windowZ);
    for (const side of [-1, 1]) {
      const x = cx + side * w * .29;
      box(g, options.wet ? 'glass' : 'fabric', [x, base + 1.9, windowZ], [w * .12, 2.3, .055], { worldUV: false });
      note(room, options.wet ? `磨砂玻璃窗 ${side < 0 ? '左' : '右'}` : `亚麻落地帘 ${side < 0 ? '左' : '右'}`, x, base + 1.9, windowZ);
    }
    b.rod(g, 'bronze', [cx - w * .36, base + 3.08, windowZ], [cx + w * .36, base + 3.08, windowZ], .025);
    note(room, options.wet ? '古铜窗框上轨' : '古铜窗帘轨', cx, base + 3.08, windowZ);
    box(g, 'white', [cx - w / 2 + .11, base + 1.25, cz + d * .2], [.055, .13, .1], { bevel: .012, worldUV: false });
    note(room, '墙面开关面板', cx - w / 2, base + 1.25, cz + d * .2);
    box(g, 'white', [cx + w / 2 - .11, base + .36, cz - d * .15], [.055, .11, .15], { bevel: .01, worldUV: false });
    note(room, '低位电源插座', cx + w / 2, base + .36, cz - d * .15);
  }

  function rug(room, g, base, x, z, w, d, material = 'fabric', label = '手工织毯') {
    box(g, material, [x, base + .018, z], [w, .035, d], { bevel: .04, uvScale: .8 });
    note(room, label, x, base, z);
  }
  function table(room, g, base, x, z, w, d, h = .74, material = 'walnut', label = '实木桌') {
    box(g, material, [x, base + h, z], [w, .1, d], { bevel: .035 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, material, [x + sx * (w / 2 - .14), base + h / 2, z + sz * (d / 2 - .14)], [.1, h, .1], { bevel: .018 });
    note(room, label, x, base + h, z);
  }
  function chair(room, g, base, x, z, ry = 0, label = '实木软包椅', material = 'fabric') {
    box(g, material, [x, base + .47, z], [.58, .15, .58], { bevel: .07, ry });
    box(g, 'walnut', [x, base + .88, z - .25], [.6, .72, .09], { bevel: .035, ry });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 'walnut', [x + sx * .23, base + .23, z + sz * .22], [.07, .46, .07], { bevel: .015 });
    note(room, label, x, base + .5, z);
  }
  function sofa(room, g, base, x, z, w = 2.5, ry = 0, label = '亚麻三人沙发', material = 'fabric') {
    box(g, material, [x, base + .38, z], [w, .34, .92], { bevel: .13, ry });
    box(g, material, [x, base + .86, z - .37], [w, .75, .22], { bevel: .1, ry });
    for (const side of [-1, 1]) box(g, 'walnut', [x + side * (w / 2 - .07), base + .55, z], [.14, .55, .94], { bevel: .04, ry });
    for (const side of [-1, 1]) box(g, 'darkWood', [x + side * (w * .32), base + .11, z], [.12, .22, .65], { bevel: .025, ry });
    note(room, label, x, base + .5, z);
  }
  function cushion(room, g, base, x, y, z, material = 'fabricRust', label = '软包靠垫') {
    box(g, material, [x, y, z], [.5, .48, .16], { bevel: .12, rz: .08 });
    note(room, label, x, y, z);
  }
  function shelf(room, g, base, x, z, w, h, rows = 4, label = '开放木作书柜') {
    box(g, 'darkWood', [x, base + h / 2, z], [w, h, .34], { bevel: .025 });
    for (let i = 0; i <= rows; i++) box(g, 'walnut', [x, base + .1 + i * (h - .2) / rows, z + .2], [w, .07, .48], { bevel: .015 });
    for (const side of [-1, 1]) box(g, 'walnut', [x + side * (w / 2 - .06), base + h / 2, z + .2], [.09, h, .48], { bevel: .015 });
    note(room, label, x, base + h / 2, z);
  }
  function book(room, g, base, x, y, z, index = 1, upright = false) {
    const mats = ['bookRed', 'bookGreen', 'bookBlue', 'paper'];
    box(g, mats[index % mats.length], [x, y, z], upright ? [.07, .32, .22] : [.34, .055, .24], { bevel: .008, ry: (index % 3 - 1) * .05, worldUV: false });
    note(room, `书册 ${index}`, x, y, z);
  }
  function lamp(room, g, base, x, z, h = 1.55, label = '暖光落地灯') {
    cyl(g, 'bronze', [x, base + .035, z], .24, .07);
    cyl(g, 'bronze', [x, base + h / 2, z], .025, h);
    cyl(g, 'paper', [x, base + h, z], .29, .38, { radiusTop: .2, segments: 32 });
    cyl(g, 'emissiveWarm', [x, base + h - .05, z], .07, .12);
    note(room, label, x, base + h, z);
  }
  function pendant(room, g, base, x, z, h = 2.8, label = '宣纸吊灯') {
    cyl(g, 'blackMetal', [x, base + h + .25, z], .012, .5);
    b.sphere(g, 'paper', [x, base + h, z], [.38, .28, .38], { segments: 24, rings: 16 });
    b.sphere(g, 'emissiveWarm', [x, base + h - .08, z], [.09, .09, .09]);
    note(room, label, x, base + h, z);
  }
  function vase(room, g, base, x, y, z, label = '手作陶瓷花器', material = 'ceramic') {
    cyl(g, material, [x, y + .16, z], .13, .3, { radiusTop: .075, segments: 24 });
    cyl(g, material, [x, y + .34, z], .075, .09, { segments: 24 });
    note(room, label, x, y, z);
  }
  function branches(room, g, base, x, y, z, label = '插枝花枝') {
    for (let i = 0; i < 5; i++) {
      const dx = (i - 2) * .08;
      b.rod(g, 'walnut', [x, y, z], [x + dx, y + .65 + (i % 2) * .12, z + (i % 3 - 1) * .09], .012, 8);
      b.sphere(g, 'leafLight', [x + dx, y + .63 + (i % 2) * .12, z + (i % 3 - 1) * .09], [.1, .035, .055]);
    }
    note(room, label, x, y, z);
  }
  function plant(room, g, base, x, z, scale = 1, label = '盆栽绿植') {
    cyl(g, 'clay', [x, base + .22 * scale, z], .25 * scale, .44 * scale, { radiusTop: .31 * scale, segments: 24 });
    cyl(g, 'soil', [x, base + .45 * scale, z], .27 * scale, .035 * scale);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const r = .25 * scale;
      b.rod(g, 'leaf', [x, base + .44 * scale, z], [x + Math.cos(a) * r, base + (.85 + (i % 3) * .12) * scale, z + Math.sin(a) * r], .012 * scale, 7);
      b.sphere(g, i % 2 ? 'leaf' : 'leafLight', [x + Math.cos(a) * r, base + (.85 + (i % 3) * .12) * scale, z + Math.sin(a) * r], [.09 * scale, .25 * scale, .055 * scale], { rz: a });
    }
    note(room, label, x, base + .5 * scale, z);
  }
  function cup(room, g, base, x, y, z, label = '茶杯', material = 'ceramic') {
    cyl(g, material, [x, y + .055, z], .055, .11, { openEnded: true, segments: 20 });
    b.torus(g, material, [x + .065, y + .06, z], .035, .009, { ry: Math.PI / 2 });
    note(room, label, x, y, z);
  }
  function bottle(room, g, base, x, y, z, label = '洗护瓶', material = 'jade', h = .22) {
    cyl(g, material, [x, y + h / 2, z], .055, h, { segments: 16 });
    cyl(g, 'blackMetal', [x, y + h + .025, z], .026, .05, { segments: 12 });
    note(room, label, x, y, z);
  }
  function artwork(room, g, base, x, y, z, w = 1.2, h = .85, label = '水墨装饰画', ry = 0) {
    box(g, 'walnut', [x, y, z], [w + .09, h + .09, .055], { bevel: .015, ry });
    box(g, 'paper', [x, y, z + .035], [w, h, .025], { ry, worldUV: false });
    for (let i = 0; i < 4; i++) b.sphere(g, 'black', [x - w * .28 + i * w * .18, y - h * .18 + (i % 2) * h * .2, z + .055], [w * .12, h * .12, .008], { segments: 12, rings: 8 });
    note(room, label, x, y, z);
  }
  function bowl(room, g, base, x, y, z, label = '陶瓷碗', material = 'ceramic', radius = .16) {
    cyl(g, material, [x, y + .055, z], radius * .62, .11, { radiusTop: radius, openEnded: true, segments: 24 });
    note(room, label, x, y, z);
  }
  function television(room, g, base, x, y, z, w = 2.2, label = '超窄边电视') {
    box(g, 'blackMetal', [x, y, z], [w, w * .56, .075], { bevel: .025 });
    box(g, 'display', [x, y, z + .045], [w * .96, w * .52, .018], { worldUV: false });
    note(room, label, x, y, z);
  }
  function monitor(room, g, base, x, y, z, label = '电竞显示器') {
    box(g, 'blackMetal', [x, y, z], [.74, .46, .055], { bevel: .025 });
    box(g, 'screen', [x, y, z + .035], [.69, .4, .012], { worldUV: false });
    box(g, 'blackMetal', [x, y - .33, z], [.05, .22, .05]);
    box(g, 'blackMetal', [x, y - .44, z], [.32, .035, .2], { bevel: .015 });
    note(room, label, x, y, z);
  }
  function toilet(room, g, base, x, z, label = '壁挂智能马桶') {
    b.sphere(g, 'ceramic', [x, base + .43, z], [.34, .28, .48], { segments: 24, rings: 16 });
    box(g, 'ceramic', [x, base + .78, z - .32], [.62, .72, .25], { bevel: .1 });
    b.torus(g, 'white', [x, base + .62, z + .04], .27, .035, { rx: Math.PI / 2 });
    box(g, 'steel', [x, base + .94, z - .18], [.16, .035, .06], { bevel: .015 });
    note(room, label, x, base + .5, z);
  }
  function vanity(room, g, base, x, z, w = 1.25, label = '悬浮石材洗手台') {
    box(g, 'walnut', [x, base + .48, z], [w, .62, .55], { bevel: .045 });
    box(g, 'marble', [x, base + .83, z], [w + .08, .1, .62], { bevel: .025 });
    b.sphere(g, 'ceramic', [x, base + .89, z + .02], [.32, .09, .23], { segments: 24, rings: 12 });
    b.rod(g, 'bronze', [x, base + .89, z - .2], [x, base + 1.17, z - .2], .025);
    b.rod(g, 'bronze', [x, base + 1.17, z - .2], [x, base + 1.17, z + .03], .025);
    note(room, label, x, base + .8, z);
  }
  function mirror(room, g, base, x, y, z, w = 1.1, h = 1.0, label = '防雾浴室镜') {
    box(g, 'bronze', [x, y, z], [w + .06, h + .06, .045], { bevel: .04 });
    box(g, 'mirror', [x, y, z + .028], [w, h, .018], { bevel: .035, worldUV: false });
    note(room, label, x, y, z);
  }
  function towel(room, g, base, x, y, z, label = '棉麻毛巾', material = 'fabric') {
    box(g, material, [x, y, z], [.42, .58, .045], { bevel: .035, worldUV: false });
    note(room, label, x, y, z);
  }
  function stool(room, g, base, x, z, label = '吧台高脚凳') {
    cyl(g, 'walnut', [x, base + .72, z], .28, .12, { segments: 28 });
    cyl(g, 'blackMetal', [x, base + .36, z], .045, .7);
    cyl(g, 'blackMetal', [x, base + .03, z], .25, .06);
    b.torus(g, 'bronze', [x, base + .25, z], .2, .018, { rx: Math.PI / 2 });
    note(room, label, x, base + .72, z);
  }

  return { roomFinish, rug, table, chair, sofa, cushion, shelf, book, lamp, pendant, vase, branches, plant, cup, bottle, artwork, bowl, television, monitor, toilet, vanity, mirror, towel, stool, note };
}
