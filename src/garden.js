import * as THREE from 'three';
import {createPlanting} from './garden-plants.js';
export async function createGarden(loader) {
 const garden=new THREE.Group();
 const plants=createPlanting();
 const trees=[[-20,11,6,'maple'],[-22,-7,8,'canopy'],[-15,-15,10,'canopy'],[-6,-16,9,'canopy'],[6,-15,11,'canopy'],[18,-16,10,'canopy'],[24,14,7,'pine'],[-14,20,6,'pine']];
 trees.forEach(([x,z,h,k],i)=>plants.tree(k,x,0,z,h,120+i));
 let seed=52;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<170;i++){
  const side=i%2?-1:1;
  const x=side*(21+random()*2.4),z=-18+random()*39;
  if(x>0&&z<6&&z>-7)continue;
  plants.underplant(i%4===0?'shrub':i%3===0?'fern':'grass',x,.02,z,.35+random()*.8,i+900);
 }
 for(let i=0;i<65;i++){
  const x=-21+random()*34,z=17+random()*5;
  if(Math.abs(x)<3)continue;
  plants.underplant(i%5===0?'shrub':'grass',x,0,z,.25+random()*.65,i+800);
 }
 garden.add(plants.finish());
 const rocks=await loader.loadAsync('./garden/rocks.glb');
 const originals=[];rocks.scene.traverse(o=>{if(o.isMesh)originals.push(o)});
 [[-20,8,1],[-19,9,.6],[-21,7,.45],[-21,-8,.8],[12,18,.7],[-12,18,.7]].forEach(([x,z,s],i)=>{
  const rock=originals[i%originals.length].clone();rock.position.set(x,.18,z);rock.scale.setScalar(s);rock.rotation.y=i*1.7;rock.castShadow=true;rock.receiveShadow=true;garden.add(rock);
 });
 return garden;
}
