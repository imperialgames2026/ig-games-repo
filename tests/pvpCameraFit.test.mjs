import test from 'node:test';import assert from 'node:assert/strict';
import * as T from 'three';import {fitCameraToPoints} from '../lib/pvpCameraFit.mjs';
const points=()=>[-1.1275,1.1275].flatMap(x=>[-.4975,.4975].map(z=>new T.Vector3(x,.104,z)));
function camera(width,height){const c=new T.PerspectiveCamera(38,width/height,.01,100);c.position.set(0,2,1.65);c.lookAt(0,0,0);c.updateProjectionMatrix();c.updateMatrixWorld(true);return c;}
test('authored Fleet outer cells clip before fit and remain in bounds at narrow/resized viewports after fit',()=>{
 const c=camera(358,300);assert.ok(points().some(p=>Math.abs(p.project(c).x)>1));
 for(const[width,height]of [[288,300],[358,300],[398,300],[1100,560],[358,300]]){
  c.aspect=width/height;const p=points(),original=p.map(p=>p.toArray()),fit=fitCameraToPoints(c,p);
  assert.ok(fit.extent<=.92000001);assert.deepEqual(p.map(p=>p.toArray()),original);
  for(const point of p){const v=point.clone().project(c);assert.ok(Math.abs(v.x)<=.92000001&&Math.abs(v.y)<=.92000001);}
 }
});
test('fit preserves wide camera framing and raycast projection round trip',()=>{
 const c=camera(1100,560),fit=fitCameraToPoints(c,points());assert.equal(fit.zoom,1);
 c.aspect=358/300;fitCameraToPoints(c,points());const target=new T.Vector3(1.08,.104,.45),screen=target.clone().project(c),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(screen.x,screen.y),c);const hit=new T.Vector3();ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-.104),hit);assert.ok(hit.distanceTo(target)<1e-8);
});
