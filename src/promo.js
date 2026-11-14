import * as THREE from 'three';

// One continuous camera move through the actual villa. Every doorway, stair and
// gallery on this route exists in the Blender geometry; there are no image cuts.
const SHOT = [
  [[28,12,28],[0,3,2]],
  [[15,7,20],[0,2.8,4]],
  [[4,3.2,13],[0,2.2,7]],
  [[0,2.2,9.4],[-1,2.1,7.2]],
  [[0,2.15,7.2],[-3.65,2.1,7.2]],
  [[-3.65,2.15,7.2],[-3.65,1.6,3]],
  [[-3.65,2.1,5.6],[-1.5,1.4,.8]],
  [[2,2.1,4.2],[-1.5,1.4,.8]],
  [[-4.8,2.1,3.6],[-10,1.6,1]],
  [[-7.4,2.1,4.8],[-10,1.7,.25]],
  [[-8,2.1,2.2],[-10,1.6,3.7]],
  [[-6.75,2.1,1.4],[-10,1.5,-4.8]],
  [[-6.75,2.1,-.9],[-10,1.4,-5]],
  [[-7.1,2.1,-2.1],[-10,1.4,-5]],
  [[-5.4,2.1,-1.3],[-2,1.5,2]],
  [[4.8,2.1,3.6],[8.2,1.3,2.8]],
  [[5.2,2.1,7.15],[7,2.1,7.15]],
  [[7,2.1,7.15],[8.2,1.35,2.65]],
  [[7,2.1,5.2],[8.2,1.35,2.65]],
  [[7,2.1,7.15],[5.2,2.1,7.15]],
  [[5.2,2.1,7.15],[3.8,2.1,-1.85]],
  [[5.2,2.1,4.8],[3.8,2.1,-1.85]],
  [[3.8,2.1,-1.85],[2.15,2.1,-3.3]],
  [[2.15,2.1,-3.3],[9.4,1.5,-3]],
  [[6.6,2.1,-4.4],[9.4,1.4,-4.2]],
  [[5.65,2.1,-4.4],[3,1.3,-5.15]],
  [[5.65,2.1,-6.8],[3,1.3,-5.15]],
  [[5.65,2.1,-3.5],[3,1.4,-5.15]],
  [[2.15,2.1,-3.5],[2.15,2.1,-1.85]],
  [[2.15,2.1,-1.85],[-1.5,2.1,-1.85]],
  [[-1.5,2.1,-1.85],[-1.5,1.5,-6.3]],
  [[-1.5,2.1,-3.15],[-1.5,1.5,-6.3]],
  [[-1.5,2.1,-1.85],[-4.5,2.1,-1.85]],
  [[-4.5,2.1,-1.85],[-4.5,1.5,-6.3]],
  [[-4.5,2.1,-3.15],[-4.5,1.5,-6.3]],
  [[-4.5,2.1,-1.8],[-3.6,2.1,2]],
  [[-3.6,2.1,2],[-3.6,2.1,5.65]],
  [[-3.6,2.1,5.65],[-5.15,2.8,5.65]],
  [[-5.15,2.1,5.65],[-5.15,4.5,1.2]],
  [[-5.15,3.6,3.1],[-5.15,5.8,.25]],
  [[-5.15,5.8,.25],[-6,5.8,3.5]],
  [[-6,5.8,3.5],[-10,5.4,-3.4]],
  [[-5.15,5.8,.55],[-3,5.8,-1.55]],
  [[-5.15,5.8,-1.55],[-3,5.8,-1.55]],
  [[-3,5.8,-1.85],[-3,5.3,-6.3]],
  [[-3,5.8,-1.55],[3,5.8,-1.55]],
  [[3,5.8,-1.85],[3,5.3,-6.3]],
  [[3,5.8,-1.55],[6.8,5.8,-1.6]],
  [[6.8,5.8,-1.6],[10,5.4,-5]],
  [[10,5.8,-1.1],[10,5.4,-5]],
  [[10,5.8,1.4],[10,5.6,5.5]],
  [[10,5.8,3.1],[9.2,5.4,1.15]],
  [[10,5.8,1.4],[10,5.4,-2]],
  [[10,5.8,-1.1],[3,5.8,-1.55]],
  [[3,5.8,-1.55],[-5.15,5.8,-1.55]],
  [[-5.15,5.8,-1.55],[-5.15,4.5,1]],
  [[-5.15,5.8,.25],[-5.15,4.5,1]],
  [[-5.15,3.6,3.1],[-1,1.5,3]],
  [[-5.15,2.1,5.65],[-3.65,1.8,7.2]],
  [[-3.65,2.15,7.2],[0,2.15,7.2]],
  [[0,2.15,7.2],[0,2.2,12]],
  [[0,2.2,9.4],[0,3,18]],
  [[8,5.5,17],[0,3,4]],
  [[26,12,29],[0,3,0]],
];

export function installPromo({ camera, controls, renderer, scene, groups, sky, interiorLights, sun }) {
  const style = document.createElement('style');
  style.textContent = '#app > :not(#scene-container) { display: none !important; } #scene-container, #scene { inset: 0; width: 100%; height: 100%; }';
  document.head.appendChild(style);
  controls.enabled = false;
  controls.autoRotate = false;
  for (const [name, group] of Object.entries(groups)) {
    group.visible = !['Cut1', 'Cut2'].includes(name);
  }
  sky.visible = true;
  interiorLights.forEach(light => { light.visible = true; light.intensity = 16; });
  sun.intensity = 1.9;
  scene.environmentIntensity = .7;
  scene.backgroundBlurriness = 0;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.needsUpdate = true;
  sun.shadow.needsUpdate = true;

  const positions = new THREE.CatmullRomCurve3(SHOT.map(([p]) => new THREE.Vector3(...p)), false, 'centripetal');
  const targets = new THREE.CatmullRomCurve3(SHOT.map(([,t]) => new THREE.Vector3(...t)), false, 'centripetal');
  const duration = (SHOT.length - 1) * 1.7;
  const target = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const direction = new THREE.Vector3();

  window.promo = {
    duration,
    renderAt(time) {
      const u = THREE.MathUtils.clamp(time / duration, 0, 1);
      camera.position.copy(positions.getPoint(u));
      target.copy(targets.getPoint(u));
      camera.fov = 55;
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      sky.position.copy(camera.position);
      renderer.render(scene, camera);
      return { time, u, position: camera.position.toArray(), target: target.toArray() };
    },
    stateAt(time) {
      const u = THREE.MathUtils.clamp(time / duration, 0, 1);
      return { time, u, position: positions.getPoint(u).toArray(), target: targets.getPoint(u).toArray() };
    },
    probe(time, lookahead = .12) {
      const u = THREE.MathUtils.clamp(time / duration, 0, 1);
      const point = positions.getPoint(u);
      const ahead = positions.getPoint(Math.min(1, u + lookahead / duration));
      direction.copy(ahead).sub(point);
      const length = direction.length();
      if (length < .0001) return [];
      direction.normalize();
      raycaster.set(point, direction);
      raycaster.near = .025;
      raycaster.far = length + .08;
      return raycaster.intersectObjects(Object.values(groups), true).filter(hit => {
        let node = hit.object;
        while (node) { if (!node.visible) return false; node = node.parent; }
        return true;
      }).slice(0, 4).map(hit => ({
        name: hit.object.name,
        material: (Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material)?.name,
        distance: hit.distance,
        point: hit.point.toArray(),
      }));
    },
  };
  window.sceneReady = true;
  window.promo.renderAt(0);
}
