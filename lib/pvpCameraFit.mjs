// Fit existing art without moving/scaling its geometry or changing raycast targets.
export function fitCameraToPoints(camera,points,margin=.08){
 if(!points.length||!Number.isFinite(margin)||margin<0||margin>=1)throw Error('Finite scene points and camera margin required');
 camera.zoom=1;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const extent=Math.max(...points.map(point=>{const p=point.clone().project(camera);return Math.max(Math.abs(p.x),Math.abs(p.y));}));
 if(!Number.isFinite(extent))throw Error('Scene projection must be finite');
 camera.zoom=extent>0?Math.min(1,(1-margin)/extent):1;
 camera.updateProjectionMatrix();
 return {zoom:camera.zoom,extent:Math.max(...points.map(point=>{const p=point.clone().project(camera);return Math.max(Math.abs(p.x),Math.abs(p.y));}))};
}
