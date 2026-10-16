import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x06070b, 1);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06070b, 0.018);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
camera.position.set(0, 0, 17);
const clock = new THREE.Clock();
let shape = 'sphere', palette = 'cyan', count = 30000, speed = 1;
let positions, target, colors, sizes, geometry, material, points;
let spread = 1, targetSpread = 1, shockwave = 0, elapsed = 0, gesture = 'NO HAND DETECTED', fistHeld = false;
let mouseX = 0, mouseY = 0, orbitX = 0, orbitY = 0, zoom = 17;
let handX = 0, handY = 0, cameraActive = false, lastCameraTime = 0;
let tracker = null, stream = null, videoBusy = false, webcam = $('#webcam');
const palettes = {
  cyan: [new THREE.Color('#6ee9d6'), new THREE.Color('#55baff'), new THREE.Color('#ddfff2')],
  ember: [new THREE.Color('#fa453a'), new THREE.Color('#ffa447'), new THREE.Color('#ffe3a8')],
  violet: [new THREE.Color('#8168ff'), new THREE.Color('#e772ff'), new THREE.Color('#8bcaff')],
  rainbow: [new THREE.Color('#ff598b'), new THREE.Color('#3aeac9'), new THREE.Color('#9b85ff')],
};
function seeded(i, j = 0) {
  let n = (Math.imul(i + 1327, 374761393) + Math.imul(j + 17, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function makeTargets(type, n) {
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = seeded(i, 1), b = seeded(i, 2), c = seeded(i, 3), d = seeded(i, 4);
    let x, y, z;
    if (type === 'sphere') {
      const theta = a * Math.PI * 2, v = b * 2 - 1, r = 3.7 * Math.cbrt(0.35 + 0.65 * c);
      const s = Math.sqrt(1 - v * v); x = r * s * Math.cos(theta); y = r * v; z = r * s * Math.sin(theta);
    } else if (type === 'torus') {
      const phi = a * Math.PI * 2, theta = b * Math.PI * 2, tube = 0.75 + c * 0.45, radius = 3.25 + Math.cos(theta) * tube;
      x = radius * Math.cos(phi); y = Math.sin(theta) * tube; z = radius * Math.sin(phi);
    } else if (type === 'galaxy') {
      const arm = i % 5, radius = Math.sqrt(a) * 4.7, angle = arm * Math.PI * 2 / 5 + radius * 1.35 + (b - .5) * .7;
      x = radius * Math.cos(angle); z = radius * Math.sin(angle); y = (c - .5) * (.2 + .18 * radius);
    } else if (type === 'helix') {
      const t = a * Math.PI * 9, r = 2.2 + (b - .5) * .7;
      x = r * Math.cos(t + (i % 2) * Math.PI); z = r * Math.sin(t + (i % 2) * Math.PI);
      y = (a - .5) * 8;
    } else {
      // Parametric heart surface, softened by interior distribution.
      const t = a * Math.PI * 2, scale = .21 * Math.sqrt(.2 + .8 * b);
      x = 16 * Math.pow(Math.sin(t), 3) * scale;
      y = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t)) * scale - .4;
      z = (c - .5) * 2.7 * (0.35 + b * .65);
    }
    const k = i * 3; arr[k] = x; arr[k+1] = y; arr[k+2] = z;
  }
  return arr;
}
function fillColors() {
  const col = palettes[palette];
  for (let i = 0; i < count; i++) {
    const t = seeded(i, 7), c1 = col[Math.min(2, Math.floor(t * 3))];
    const brightness = .62 + seeded(i, 8) * .65;
    let offset = i * 3;
    colors[offset] = Math.min(1, c1.r * brightness);
    colors[offset+1] = Math.min(1, c1.g * brightness);
    colors[offset+2] = Math.min(1, c1.b * brightness);
  }
  geometry.attributes.aColor.needsUpdate = true;
}
function makeSystem() {
  if (points) {
    scene.remove(points); geometry.dispose(); material.dispose();
  }
  target = makeTargets(shape, count);
  positions = target.slice();
  colors = new Float32Array(count * 3);
  sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) sizes[i] = .7 + 1.3 * seeded(i, 9);
  geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  material = new THREE.ShaderMaterial({
    uniforms: {uPixelRatio:{value:Math.min(window.devicePixelRatio,2)}, uTime:{value:0}},
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      varying vec3 vColor;
      uniform float uPixelRatio;
      uniform float uTime;
      void main(){
        vColor=aColor;
        vec3 p=position;
        p+=normalize(p+vec3(.001))*.035*sin(uTime*1.7+position.x*2.1+position.y);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(aSize*uPixelRatio*30./max(1.,-mv.z),1.,8.);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main(){
        vec2 xy=gl_PointCoord-.5;
        float r=length(xy);
        float alpha=1.-smoothstep(.05,.5,r);
        float core=1.-smoothstep(0.,.13,r);
        gl_FragColor=vec4(vColor*(.7+core*.8),alpha*.8);
      }
    `,
    transparent:true, blending:THREE.AdditiveBlending, depthWrite:false
  });
  fillColors();
  points = new THREE.Points(geometry, material);
  scene.add(points);
}
function setShape(next) {
  shape = next;
  target = makeTargets(shape, count);
  document.querySelectorAll('[data-shape]').forEach(b=>b.classList.toggle('selected',b.dataset.shape===next));
}
makeSystem();
document.querySelectorAll('[data-shape]').forEach(button=>button.addEventListener('click',()=>setShape(button.dataset.shape)));
$('#count').addEventListener('change', e=>{ count=Number(e.target.value); makeSystem(); });
$('#color').addEventListener('change', e=>{palette=e.target.value;fillColors();});
$('#motion').addEventListener('input', e=>{speed=Number(e.target.value); $('#motion-value').textContent=speed.toFixed(2)+'×';});
$('#reset').addEventListener('click',()=>{ targetSpread=1; spread=1; shockwave=0; setShape('sphere'); $('#color').value='cyan'; palette='cyan'; fillColors(); $('#motion').value=1; speed=1; $('#motion-value').textContent='1.00×'; });
window.addEventListener('pointermove', e=>{
  mouseX=(e.clientX/innerWidth-.5)*2;
  mouseY=(e.clientY/innerHeight-.5)*2;
});
window.addEventListener('wheel',e=>{zoom=THREE.MathUtils.clamp(zoom+Math.sign(e.deltaY),9,26);},{passive:true});
function resize(){
  const w=innerWidth,h=innerHeight;
  renderer.setSize(w,h,false);
  camera.aspect=w/h;camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);resize();
function classify(lm) {
  const raised=[8,12,16,20].map((tip,i)=>lm[tip].y < lm[[6,10,14,18][i]].y-.025);
  const width=Math.max(.025,Math.hypot(lm[5].x-lm[17].x,lm[5].y-lm[17].y));
  const pinch=Math.hypot(lm[4].x-lm[8].x,lm[4].y-lm[8].y)/width;
  if(pinch<.38) return 'PINCH / COMPRESS';
  if(raised.every(Boolean)) return 'OPEN PALM / EXPAND';
  if(raised.every(v=>!v)) return 'FIST / BURST';
  return 'HAND TRACKING';
}
function handleHands(results) {
  const list=results.multiHandLandmarks || [];
  if(!list.length) {
    gesture='NO HAND DETECTED';targetSpread=1;fistHeld=false;
  } else {
    const hand=list[0], state=classify(hand);
    gesture=state;
    handX=(.5-hand[9].x)*2;
    handY=(.5-hand[9].y)*2;
    if(state.startsWith('OPEN')) targetSpread=1.65;
    else if(state.startsWith('PINCH')) targetSpread=.52;
    else targetSpread=1;
    if(state.startsWith('FIST')&&!fistHeld) shockwave=1;
    fistHeld=state.startsWith('FIST');
  }
  $('#gesture').textContent=gesture;
  $('#signal-icon').textContent=list.length?'✳':'◎';
}
async function closeCamera(){
  cameraActive=false;
  if(stream) {stream.getTracks().forEach(track=>track.stop());stream=null;}
  webcam.srcObject=null;
  $('#video-wrap').style.display='none';
  $('#camera-label').textContent='ENABLE CAMERA';
  $('#status').textContent='DEMO MODE';
  gesture='NO HAND DETECTED';targetSpread=1;fistHeld=false;
  $('#gesture').textContent=gesture;
}
async function startCamera(){
  const button=$('#camera');
  button.disabled=true;
  $('#error').textContent='';
  try {
    if(!window.isSecureContext)throw new Error('Camera needs HTTPS or localhost.');
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera API unavailable in this browser.');
    if(typeof window.Hands!=='function')throw new Error('Hand tracker failed to load. Check your connection.');
    stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
    webcam.srcObject=stream;
    await webcam.play();
    tracker = tracker || new window.Hands({locateFile:file=>'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/'+file});
    tracker.setOptions({maxNumHands:2,modelComplexity:1,minDetectionConfidence:.65,minTrackingConfidence:.6});
    tracker.onResults(handleHands);
    cameraActive=true;
    $('#video-wrap').style.display='block';
    $('#camera-label').textContent='DISABLE CAMERA';
    $('#status').textContent='TRACKING ACTIVE';
  } catch(err) {
    $('#error').textContent=err.message || 'Unable to access camera.';
    await closeCamera();
  } finally {button.disabled=false;}
}
$('#camera').addEventListener('click',()=>cameraActive?closeCamera():startCamera());
async function updateCamera(now){
  if(!cameraActive||videoBusy||webcam.readyState<2||now-lastCameraTime<65)return;
  videoBusy=true;lastCameraTime=now;
  try {await tracker.send({image:webcam});}
  catch(err){ $('#error').textContent='Tracking error: '+err.message;await closeCamera(); }
  finally{videoBusy=false;}
}
let last=performance.now(),fpsSmoothed=60,frameIndex=0;
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min(.05,(now-last)/1000 || .016);last=now;
  const activeSpeed=Math.max(0,speed);
  elapsed+=dt*activeSpeed;
  fpsSmoothed=THREE.MathUtils.lerp(fpsSmoothed,1/Math.max(dt,.001),.06);
  if(++frameIndex%20===0)$('#fps').textContent=Math.round(fpsSmoothed)+' FPS';
  updateCamera(now);
  spread=THREE.MathUtils.damp(spread,targetSpread,5,dt);
  shockwave*=Math.exp(-dt*3.1);
  const responsiveness=1-Math.exp(-dt*3);
  const burstAmount=shockwave*1.8;
  for(let i=0;i<count;i++){
    const k=i*3, phase=seeded(i,9)*Math.PI*2;
    const flutter=Math.sin(elapsed*.9+phase)*.04*activeSpeed;
    const s=spread+flutter+burstAmount;
    positions[k]+=(target[k]*s-positions[k])*responsiveness;
    positions[k+1]+=(target[k+1]*s-positions[k+1])*responsiveness;
    positions[k+2]+=(target[k+2]*s-positions[k+2])*responsiveness;
  }
  geometry.attributes.position.needsUpdate=true;
  material.uniforms.uTime.value=elapsed;
  points.rotation.y=elapsed*.085;
  points.rotation.z=Math.sin(elapsed*.22)*.13;
  const controlX=cameraActive?handX:mouseX,controlY=cameraActive?handY:mouseY;
  orbitX=THREE.MathUtils.damp(orbitX,controlX,1.7,dt);
  orbitY=THREE.MathUtils.damp(orbitY,controlY,1.7,dt);
  camera.position.x=orbitX*3.4;
  camera.position.y=-orbitY*2.0;
  camera.position.z=THREE.MathUtils.damp(camera.position.z,zoom,3,dt);
  camera.lookAt(0,0,0);
  if(frameIndex%20===0)$('#coordinates').textContent='X '+camera.position.x.toFixed(2)+' / Y '+camera.position.y.toFixed(2)+' / Z '+camera.position.z.toFixed(2);
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);
window.addEventListener('beforeunload',()=>{if(stream)stream.getTracks().forEach(t=>t.stop());});
