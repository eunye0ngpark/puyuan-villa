// All dimensions are metres in the same Y-up, +Z entrance frame as the Blender authoring file.
import * as THREE from 'three';

class Surface {
  constructor(material) {
    this.material = material;
    this.positions = [];
    this.uvs = [];
    this.colors = [];
    this.indices = [];
  }

  vertex(point, shade = 1, u = point[0] * .52, v = point[2] * .52) {
    const index = this.positions.length / 3;
    this.positions.push(...point);
    this.colors.push(shade, shade, shade);
    this.uvs.push(u, v);
    return index;
  }

  quad(a, b, c, d, flip = false) {
    if (flip) this.indices.push(a, c, b, a, d, c);
    else this.indices.push(a, b, c, a, c, d);
  }

  // Individual box faces have planar, metre-scaled grain and hard edge normals.
  face(points, shade = 1) {
    const a = new THREE.Vector3(...points[0]);
    const normal = new THREE.Vector3(...points[1]).sub(a)
      .cross(new THREE.Vector3(...points[2]).sub(a));
    const axis = Math.abs(normal.y) > Math.max(Math.abs(normal.x), Math.abs(normal.z)) ? 'top'
      : Math.abs(normal.x) > Math.abs(normal.z) ? 'side' : 'front';
    const ids = points.map(p => this.vertex(p, shade,
      (axis === 'side' ? p[2] : p[0]) * .52, (axis === 'top' ? p[2] : p[1]) * .52));
    for (let i = 2; i < ids.length; i++) this.indices.push(ids[0], ids[i - 1], ids[i]);
  }

  mesh(name) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setIndex(this.indices);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

function box(batch, x, y, z, w, h, d, shade = 1, bevel = 0) {
  const a = w / 2, b = h / 2, c = d / 2;
  // A small arris on the leading edge catches daylight on dressed stone and wood.
  const edge = Math.min(bevel, a * .3, b * .35, c * .3);
  const section = [
    [-a,-c], [-a,c], [a,c], [a,-c],
  ];
  const ring = (height, inset) => section.map(([px,pz]) => [
    x + px - Math.sign(px) * inset, y + height, z + pz - Math.sign(pz) * inset,
  ]);
  const bottom = ring(-b, 0), shoulder = ring(b-edge, 0), top = ring(b, edge);
  batch.face([...bottom].reverse(), shade);
  batch.face(top, shade);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    batch.face([bottom[i], bottom[j], shoulder[j], shoulder[i]], shade);
    if (edge) batch.face([shoulder[i], shoulder[j], top[j], top[i]], shade);
  }
}

function grain(row, col, salt) {
  const value = Math.sin(row * 43.67 + col * 19.37 + salt * 13.25) * 4578.541;
  return value - Math.floor(value);
}

const tileProfile = [
  [0, .050], [.10, .044], [.21, .014], [.38, .003],
  [.50, 0], [.62, .003], [.79, .014], [.90, .044], [1, .050],
];

// One curved pan and the two halves of its cover tiles. The lower lip overlaps
// the preceding course. Courses are cut at each hip in roof-plane coordinates.
function tilePlane(batch, face) {
  const {halfSpan, ridgeHalf, run, rise, point, flip} = face;
  const columns = Math.max(1, Math.round(halfSpan * 2 / .257));
  const rows = Math.ceil(run / .325);
  const width = halfSpan * 2 / columns;
  const step = run / rows;
  const maxRun = along => Math.min(run, run * (halfSpan - Math.abs(along)) / (halfSpan - ridgeHalf));
  for (let col = 0; col < columns; col++) {
    const start = -halfSpan + col * width;
    for (let row = 0; row < rows; row++) {
      const low = row * step - (row === 0 ? .085 : .018);
      const high = (row + 1) * step;
      if (low > Math.max(maxRun(start), maxRun(start+width), maxRun(start+width/2))) break;
      const tint = .83 + .25 * grain(row, col, face.salt);
      const front = [], back = [], underside = [];
      for (const [fraction, curvature] of tileProfile) {
        const s = start + fraction * width;
        const limit = maxRun(s);
        const toe = Math.min(low, limit), head = Math.min(high, limit);
        const lift = .078 + curvature;
        const lowLip = .020 * THREE.MathUtils.clamp((high - toe) / step, 0, 1);
        const highLip = .020 * THREE.MathUtils.clamp((high - head) / step, 0, 1);
        front.push(batch.vertex(point(s, toe, lift + lowLip), tint));
        back.push(batch.vertex(point(s, head, lift + highLip), tint));
        underside.push(batch.vertex(point(s, toe, lift + lowLip - .017), tint * .75));
      }
      for (let i = 1; i < front.length; i++) {
        batch.quad(front[i-1], front[i], back[i], back[i-1], flip);
        batch.quad(underside[i-1], underside[i], front[i], front[i-1], flip);
      }
    }
  }
}

// Lapped barrel caps have a hollow half-round section and real joint shadows.
function capRun(batch, from, to, radius, salt) {
  const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
  const dir = end.sub(start);
  const length = dir.length();
  dir.normalize();
  const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  const up = dir.clone().cross(side).normalize();
  const count = Math.max(1, Math.round(length / .49));
  const slices = 8;
  for (let j = 0; j < count; j++) {
    const tint = .85 + .24 * grain(j, salt, .6);
    const rings = [];
    for (const [offset, r] of [[-.013, radius], [-.013, radius + .018], [length/count, radius + .002]]) {
      const center = start.clone().addScaledVector(dir, j * length / count + offset);
      const ring = [];
      for (let i = 0; i <= slices; i++) {
        const angle = i * Math.PI / slices;
        const p = center.clone().addScaledVector(side, r * Math.cos(angle))
          .addScaledVector(up, r * Math.sin(angle));
        ring.push(batch.vertex(p.toArray(), tint));
      }
      rings.push(ring);
    }
    for (let k = 0; k < rings.length - 1; k++) {
      for (let i = 0; i < slices; i++) {
        batch.quad(rings[k][i], rings[k][i+1], rings[k+1][i+1], rings[k+1][i]);
      }
    }
    // Close the cut end at the eaves and the end of a ridge.
    if (j === 0) {
      const p = start.clone().addScaledVector(dir, -.013);
      const center = batch.vertex(p.toArray(), tint * .72);
      for (let i = 0; i < slices; i++) batch.indices.push(center, rings[0][i+1], rings[0][i]);
    }
    if (j === count - 1) {
      const center = batch.vertex(start.clone().addScaledVector(dir, length).toArray(), tint);
      for (let i = 0; i < slices; i++) batch.indices.push(center, rings[2][i], rings[2][i+1]);
    }
  }
}

function hipRoof(batches, x, z, w, d, y, rise, ridge) {
  const w2 = w / 2, d2 = d / 2, endRun = d2 - ridge;
  for (const sign of [-1, 1]) {
    tilePlane(batches.tile, {
      halfSpan: d2, ridgeHalf: ridge, run: w2, rise, salt: x + sign * 12,
      point: (s,t,lift) => [x + sign * (w2 - t), y + rise * t / w2 + lift, z + s],
      flip: sign > 0,
    });
    tilePlane(batches.tile, {
      halfSpan: w2, ridgeHalf: 0, run: endRun, rise, salt: z + sign * 22,
      point: (s,t,lift) => [x + s, y + rise * t / endRun + lift, z + sign * (d2 - t)],
      flip: sign < 0,
    });
    for (const sx of [-1, 1]) {
      capRun(batches.cap, [x+sx*(w2+.035),y+.113,z+sign*(d2+.035)],
        [x,y+rise+.118,z+sign*ridge], .122, sx + x + sign);
    }
    // The actual fascia projects 0.1 m beyond the source roof perimeter.
    box(batches.wood, x, y-.148, z+sign*(d2-.015), w-.08,.09,.17, .93, .009);
  }
  capRun(batches.cap, [x,y+rise+.14,z-ridge-.065], [x,y+rise+.14,z+ridge+.065], .158, x+27);
}

function buildRoof(roof) {
  for (const x of [-10,10]) {
    hipRoof(roof,x,0,9.5,17.7,7.46,1.28,5.81);
    for (const sign of [-1,1]) {
      // Exposed rafter tails seat on the wall plate and extend to the eave.
      for (let i=-9;i<=9;i++) {
        box(roof.wood,x+i*.49,7.262,sign*8.45,.084,.151,.69,.82+.16*grain(i,x,sign),.013);
      }
      for (let i=-16;i<=16;i++) {
        box(roof.wood,x+sign*4.44,7.263,i*.51,.53,.151,.080,.9,.010);
      }
    }
  }
  hipRoof(roof,0,-5.2,13.4,6.8,7.52,.95,.3);
  for (let i=-12;i<=12;i++) {
    box(roof.wood,i*.48,7.208,8.29,.071,.108,.48,.95,.008);
  }
  // Raised weathering and glazing beads follow the genuine rectangular opening.
  for (const s of [-1,1]) {
    box(roof.alloy,s*2.105,7.584,2.4,.10,.192,5.90,1,.008);
    box(roof.alloy,0,7.584,2.4+s*2.91,4.25,.192,.10,1,.008);
  }
  for (const z of [.43,1.40,2.37,3.34,4.31]) {
    box(roof.alloy,0,7.526,z,4.17,.045,.038,.93,.003);
  }
}

function buildShell(shell) {
  // Each lite sits inside an outer frame, with a timber reveal and a projecting sill.
  for (const xSign of [-1,1]) {
    const x = xSign*14;
    box(shell.stone,x+xSign*.10,.67,0,.26,.25,16.18,.83,.014);
    for (const z of [-4,4]) {
      for (const [mid,h] of [[2.15,2.4],[5.65,2.25]]) {
        const low = mid-h/2, high = mid+h/2;
        box(shell.stone,x+xSign*.205,low-.050,z,.38,.112,5.08,1,.024);
        box(shell.alloy,x+xSign*.207,high-.025,z,.112,.072,4.86,1,.006);
        box(shell.alloy,x+xSign*.218,low+.045,z,.108,.083,4.84,1,.007);
        for (const dz of [-2.4,2.4]) {
          box(shell.wood,x+xSign*.195,mid,z+dz,.16,h,.081,.92,.008);
        }
        box(shell.alloy,x+xSign*.223,high-.46,z,.055,.043,4.77,.93,.003);
      }
    }
  }
  for (const x of [-14,-6,6,14]) {
    box(shell.stone,x,.735,8,.57,.35,.62,.90,.023);
    box(shell.alloy,x,.933,8.02,.48,.038,.50,.94,.005);
    for (const y of [2.52,5.89]) {
      box(shell.stone,x,y,8.083,.388,3.12,.37,1,.012);
    }
    box(shell.wood,x,7.127,8.08,.54,.17,.49,.91,.015);
  }
  const bays = [[-10,7.40],[0,11.40],[10,7.40]];
  for (const [x,w] of bays) {
    for (const y of [3.538,6.93]) {
      box(shell.wood,x,y,8.104,w+.08,.10,.142,.94,.008);
      box(shell.alloy,x,y-.082,8.135,w+.05,.045,.075,1,.004);
    }
    box(shell.stone,x,4.16,8.106,w+.20,.124,.32,.95,.015);
    if (x !== 0) box(shell.stone,x,.684,8.13,w+.16,.126,.32,1,.016);
    else for (const s of [-1,1]) {
      box(shell.stone,s*3.5,.684,8.13,4.44,.126,.32,1,.016);
    }
    for (const s of [-1,1]) {
      box(shell.wood,x+s*w*.5,5.566,8.112,.083,2.72,.136,.97,.008);
      box(shell.wood,x+s*w*.5,2.112,8.112,.083,2.84,.136,.97,.008);
    }
  }
  // Deep shadow line between the two levels, interrupted at the main piers.
  for (const [x,w] of [[-10,7.54],[0,11.54],[10,7.54]]) {
    box(shell.wood,x,3.80,8.106,w,.212,.165,.9,.010);
    box(shell.alloy,x,3.696,8.167,w+.02,.049,.08,1,.004);
  }
}

function buildEntry(front) {
  // Interior F1 = .55 m. The existing forecourt begins at Z=10 and tops out at .09 m.
  // Three 153 mm rises bridge the forecourt to the entrance, with a level landing.
  const runs = [[8.20,9.13,.55,5.22],[9.13,9.565,.397,5.34],[9.565,10.00,.243,5.46]];
  for (let course=0;course<runs.length;course++) {
    const [za,zb,top,width] = runs[course];
    box(front.base,0,(top+.06)/2-.035,(za+zb)/2,width-.04,top-.06,zb-za,.95);
    const joints = course===1 ? [-width/2,-1.7,-.57,.57,1.7,width/2] : [-width/2,-1.3,0,1.3,width/2];
    for (let i=0;i<joints.length-1;i++) {
      const l = joints[i], r = joints[i+1];
      box(front.stone,(r+l)/2,top-.040,(za+zb)/2+.013,r-l-.005,.080,zb-za+.018,
        .92+.15*grain(i,course,9),.009);
    }
  }
  // A shallow timber rain canopy is mortised into the entrance surround.
  for (const s of [-1,1]) {
    box(front.stone,s*1.55,.712,8.27,.292,.322,.36,.85,.014);
    box(front.wood,s*1.55,2.13,8.27,.198,2.53,.238,.95,.014);
    box(front.wood,s*1.55,3.296,8.51,.19,.17,.71,1,.009);
    box(front.wood,s*1.55,3.407,8.65,.26,.12,.97,.98,.012);
    box(front.wood,s*1.55,3.493,8.72,.33,.08,1.12,.92,.008);
  }
  box(front.wood,0,3.604,8.68,4.69,.15,1.15,.95,.014);
  box(front.alloy,0,3.720,8.69,4.85,.082,1.27,.91,.009);
  for (let j=-5;j<=5;j++) {
    box(front.wood,j*.398,3.515,8.70,.068,.053,1.10,.92+.11*grain(j,11,1),.006);
  }
  // Wall lights have opaque backs, frosted inserts, and a bronze frame.
  for (const s of [-1,1]) {
    const x = s*1.60;
    box(front.alloy,x,2.13,8.413,.145,.522,.067,.9,.01);
    box(front.light,x,2.13,8.465,.10,.411,.064,1,.008);
    for (const y of [1.908,2.352]) box(front.alloy,x,y,8.466,.158,.045,.145,.94,.006);
    for (const dx of [-.055,.055]) box(front.alloy,x+dx,2.13,8.499,.014,.41,.016,.97);
  }
}

function standard(name, color, roughness, metalness = 0) {
  const mat = new THREE.MeshStandardMaterial({color, roughness, metalness, vertexColors: true});
  mat.name = name;
  return mat;
}

function sourceFinish(parent, materialName, name, fallback, color, roughness) {
  let original;
  parent.traverse(object => {
    if (object.material?.name === materialName) original = object.material;
  });
  const mat = original ? original.clone() : standard(name, fallback, roughness);
  mat.name = name;
  if (original) mat.color.set(color);
  mat.roughness = roughness;
  mat.vertexColors = true;
  return mat;
}

function attach(parent, name, batches) {
  const holder = new THREE.Group();
  holder.name = name;
  // Quantized mesh children have their own scale/offset. Components attach to
  // the visibility group, in the villa's modelling frame, never to those meshes.
  parent.updateWorldMatrix(true,false);
  holder.matrix.copy(parent.matrixWorld).invert();
  holder.matrixAutoUpdate = false;
  for (const [key,batch] of Object.entries(batches)) {
    if (batch.indices.length) holder.add(batch.mesh(name+'_'+key));
  }
  parent.add(holder);
  return holder;
}

export function buildExteriorCraft(groups) {
  const {Roof, ExteriorShell, FrontDetails} = groups;
  if (Roof.getObjectByName('FiredRoofTiles')) return;
  const tile = standard('青灰陶瓦',0x565854,.77);
  const cap = standard('脊筒瓦',0x414744,.65);
  const alloy = standard('深铜金属收边',0x493f32,.46,.56);
  const base = standard('深灰基座',0x706c60,.86);
  const wood = sourceFinish(Roof,'walnut','檐下木作',0x715540,0xbda384,.72);
  const stone = sourceFinish(ExteriorShell,'limestone','錾面石',0xb9b4a3,0xdcdbcf,.83);
  const light = standard('磨砂灯罩',0xd5ba8b,.49);
  light.emissive.set(0xffbf75);
  light.emissiveIntensity = .68;

  const roof = {tile:new Surface(tile),cap:new Surface(cap),wood:new Surface(wood),alloy:new Surface(alloy)};
  buildRoof(roof);
  attach(Roof,'FiredRoofTiles',roof);
  const facade = {stone:new Surface(stone),wood:new Surface(wood),alloy:new Surface(alloy)};
  buildShell(facade);
  attach(ExteriorShell,'WindowReveals',facade);
  const entry = {base:new Surface(base),stone:new Surface(stone),wood:new Surface(wood),alloy:new Surface(alloy),light:new Surface(light)};
  buildEntry(entry);
  attach(FrontDetails,'EntranceJoinery',entry);
}
