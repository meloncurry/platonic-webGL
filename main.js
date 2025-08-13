// main.js

const ASCII_COLS = 120;
const ASCII_ROWS = 48;

const Utils = {
  showError(msg) {
    const errEl = document.getElementById('error');
    const asciiEl = document.getElementById('ascii');
    console.error(msg);
    errEl.style.display = 'block';
    errEl.textContent = 'ERROR:\n\n' + msg;
    asciiEl.textContent = '';
  },
  setupGlobalErrorHandlers() {
    window.addEventListener('error', (ev) => {
      const msg = (ev && ev.error && ev.error.stack) ? ev.error.stack : (ev.message || String(ev));
      this.showError(msg);
    });
    window.addEventListener('unhandledrejection', ev => {
      this.showError('Unhandled Promise Rejection:\n' + (ev.reason && ev.reason.stack ? ev.reason.stack : String(ev.reason)));
    });
  }
};

const loadingEl = document.getElementById('loading');
const asciiPre = document.getElementById('ascii');
const debugEl = document.getElementById('debug');

let renderer, scene, camera, rt, pixelBuffer;
let dodeWire, cubeWire, tetraWire, cubePivot, tetraPivot, dodeGroup;
let raycaster, mouseNDC, plane;
let v0_local;

let dodeSize, cubeSize, tetraSize, scaleFactor;

function updateScaleAndPosition(){
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height);
  rt.setSize(ASCII_COLS, ASCII_ROWS);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  const cameraZ = camera.position.z;
  const fovRadians = THREE.MathUtils.degToRad(camera.fov);
  const visibleHeight = 2 * Math.tan(fovRadians / 2) * cameraZ;
  const visibleWidth = visibleHeight * camera.aspect;

  const baseSize = 6.0;

  const maxModelHeight = visibleHeight * 0.8;
  const maxModelWidth = visibleWidth * 0.8;

  scaleFactor = Math.min(maxModelWidth / baseSize, maxModelHeight / baseSize);
  scaleFactor = Math.min(Math.max(scaleFactor, 0.5), 4);

  dodeSize = baseSize * scaleFactor;
  cubeSize = 3.0 * scaleFactor;
  tetraSize = 1.3 * scaleFactor;

  if (tetraPivot) {
    tetraPivot.position.set(0, 0, cubeSize / 2 + tetraSize / 2);
  }
}

function init(){
  Utils.setupGlobalErrorHandlers();

  renderer = new THREE.WebGLRenderer({ antialias: false });
  const container = document.getElementById('container');
  container.appendChild(renderer.domElement);

  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.margin = 'auto';
  canvas.style.position = 'relative';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.outline = 'none';

  rt = new THREE.WebGLRenderTarget(ASCII_COLS, ASCII_ROWS, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
  });

  pixelBuffer = new Uint8Array(ASCII_COLS * ASCII_ROWS * 4);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);

  // Add big AxesHelper for visibility
  const axesHelper = new THREE.AxesHelper(10);
  scene.add(axesHelper);

  updateScaleAndPosition();

  const matT = new THREE.LineBasicMaterial({ color: 0xbfefff });
  const matC = new THREE.LineBasicMaterial({ color: 0xffc0ea });
  const matD = new THREE.LineBasicMaterial({ color: 0xd7ffb3 });

  const tetraGeom = new THREE.TetrahedronGeometry(tetraSize);
  v0_local = new THREE.Vector3().fromBufferAttribute(tetraGeom.attributes.position, 0).clone();
  const tetraEdges = new THREE.EdgesGeometry(tetraGeom);
  tetraWire = new THREE.LineSegments(tetraEdges, matT);

  const cubeEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize));
  cubeWire = new THREE.LineSegments(cubeEdges, matC);

  const dodeEdges = new THREE.EdgesGeometry(new THREE.DodecahedronGeometry(dodeSize));
  dodeWire = new THREE.LineSegments(dodeEdges, matD);

  const root = new THREE.Object3D();
  scene.add(root);

  dodeGroup = new THREE.Object3D();
  root.add(dodeGroup);
  dodeGroup.add(dodeWire);
  dodeGroup.position.set(0, 0, 0);

  cubePivot = new THREE.Object3D();
  dodeGroup.add(cubePivot);
  cubePivot.add(cubeWire);
  cubePivot.position.set(0, 0, 0);

  tetraPivot = new THREE.Object3D();
  cubePivot.add(tetraPivot);
  tetraPivot.add(tetraWire);
  tetraPivot.position.set(0, 0, cubeSize / 2 + tetraSize / 2);

  console.log('Positions after setup:', {
    dodePos: dodeGroup.position,
    cubePos: cubePivot.position,
    tetraPos: tetraPivot.position,
  });

  raycaster = new THREE.Raycaster();
  mouseNDC = new THREE.Vector2(0, 0);
  plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -3.5);

  window.addEventListener('mousemove', ev => {
    mouseNDC.x = (ev.clientX / window.innerWidth) * 2 - 1;
    mouseNDC.y = -((ev.clientY / window.innerHeight) * 2 - 1);
  });

  window.addEventListener('resize', () => {
    updateScaleAndPosition();
  });

  debugEl.style.display = 'block';
}

function ndcToWorldOnPlane(ndc, plane){
  raycaster.setFromCamera(ndc, camera);
  const out = new THREE.Vector3();
  if(raycaster.ray.intersectPlane(plane, out)) return out;
  return null;
}

function aimTetraAt(targetWorld){
  if(!targetWorld) return;
  const tetraWorldPos = new THREE.Vector3();
  tetraPivot.getWorldPosition(tetraWorldPos);

  const targetDir = new THREE.Vector3().subVectors(targetWorld, tetraWorldPos).normalize();
  if(targetDir.lengthSq() < 1e-8) return;

  const parentWorldQ = new THREE.Quaternion();
  tetraWire.getWorldQuaternion(parentWorldQ);
  const v0_world = v0_local.clone().applyQuaternion(parentWorldQ).normalize();

  const q = new THREE.Quaternion().setFromUnitVectors(v0_world, targetDir);
  const newWorldQ = q.multiply(parentWorldQ);

  const parentQinv = new THREE.Quaternion();
  if(tetraWire.parent) tetraWire.parent.getWorldQuaternion(parentQinv).invert();
  else parentQinv.identity();
  const localQ = newWorldQ.clone().premultiply(parentQinv);

  tetraWire.quaternion.slerp(localQ, 0.85);
}

// NEW: Update cube's position smoothly between dodecahedron and tetrahedron
function updateCubePosition(){
  const dodePos = new THREE.Vector3();
  dodeGroup.getWorldPosition(dodePos);

  const tetraPos = new THREE.Vector3();
  tetraPivot.getWorldPosition(tetraPos);

  // For example: cube sits halfway between dodecahedron and tetrahedron
  const targetPos = new THREE.Vector3().addVectors(dodePos, tetraPos).multiplyScalar(0.5);

  cubePivot.position.lerp(targetPos, 0.1); // smooth lerp to new position
}

// NEW: Update dodecahedron rotation smoothly (slerp)
function updateDodecahedronRotation(dt){
  const cubeWorldPos = new THREE.Vector3();
  cubePivot.getWorldPosition(cubeWorldPos);
  const tetraWorldPos = new THREE.Vector3();
  tetraPivot.getWorldPosition(tetraWorldPos);

  const axisCT = new THREE.Vector3().subVectors(tetraWorldPos, cubeWorldPos);

  if(axisCT.lengthSq() < 1e-8) return;

  axisCT.normalize();

  const arbitrary = Math.abs(axisCT.dot(new THREE.Vector3(0,1,0))) < 0.9 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
  const perp = new THREE.Vector3().crossVectors(axisCT, arbitrary).normalize();

  const z = axisCT.clone();
  const y = perp.clone();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  const m = new THREE.Matrix4(); m.makeBasis(x, y, z);
  const desiredQ = new THREE.Quaternion().setFromRotationMatrix(m);

  // Static orientation reference
  const stabilityQ = new THREE.Quaternion().identity();

  const finalQ = new THREE.Quaternion();
  finalQ.copy(stabilityQ).slerp(desiredQ, 0.6);

  const parentWorldQInv = new THREE.Quaternion();
  if(dodeGroup.parent) dodeGroup.parent.getWorldQuaternion(parentWorldQInv).invert();
  else parentWorldQInv.identity();
  const localFinal = finalQ.clone().premultiply(parentWorldQInv);

  const dtSeconds = dt / 1000;
  const slerpFactor = 0.1 + Math.min(0.5, dtSeconds);
  dodeGroup.quaternion.slerp(localFinal, slerpFactor);

  // Debug logs (optional)
  // console.log(`updateDodecahedronRotation called | dtSeconds: ${dtSeconds.toFixed(3)} | slerpFactor: ${slerpFactor.toFixed(3)}`);
}

let lastTime = performance.now();
let asciiLast = 0;
const asciiInterval = 50;
let framesRendered = 0;

function animate(time){
  try {
    const dt = time - lastTime;
    lastTime = time;

    const targetWorld = ndcToWorldOnPlane(mouseNDC, plane);

    aimTetraAt(targetWorld);
    updateCubePosition();
    updateDodecahedronRotation(dt);

    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    if(time - asciiLast > asciiInterval){
      asciiLast = time;
      renderer.readRenderTargetPixels(rt, 0, 0, ASCII_COLS, ASCII_ROWS, pixelBuffer);
      const asciiString = AsciiHelper.pixelsToASCII(pixelBuffer, ASCII_COLS, ASCII_ROWS);
      if(asciiString.trim().length === 0){
        asciiPre.textContent = '[ASCII output empty, rendering WebGL canvas]';
        renderer.domElement.style.display = 'block';
      } else {
        asciiPre.textContent = asciiString;
        renderer.domElement.style.display = 'none';
      }
    }

    framesRendered++;
    if(framesRendered === 3){
      loadingEl.style.display = 'none';
    }

    debugEl.textContent = `Render target: ${ASCII_COLS}x${ASCII_ROWS}\nScale factor: ${scaleFactor.toFixed(3)}\n\n` +
      `axisCT length: ${(tetraPivot.getWorldPosition(new THREE.Vector3()).distanceTo(cubePivot.getWorldPosition(new THREE.Vector3()))).toFixed(6)}`;

    requestAnimationFrame(animate);
  } catch (err) {
    Utils.showError('Runtime error in render loop:\n' + (err && err.stack ? err.stack : String(err)));
  }
}

const AsciiHelper = {
  asciiChars: " .'`^\",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  pixelsToASCII(buffer, cols, rows){
    let out = '';
    for(let y = 0; y < rows; y++){
      const readY = rows - 1 - y; // flip vertically
      for(let x = 0; x < cols; x++){
        const idx = (readY * cols + x) * 4;
        const r = buffer[idx], g = buffer[idx + 1], b = buffer[idx + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const norm = lum / 255;
        const charIndex = Math.floor(norm * (this.asciiChars.length - 1));
        out += this.asciiChars.charAt(charIndex);
      }
      out += '\n';
    }
    return out;
  }
};

init();
setTimeout(() => requestAnimationFrame(animate), 120);

let prog = 0;
const progT = setInterval(() => {
  prog = Math.min(100, prog + (framesRendered > 0 ? 40 : 6));
  loadingEl.textContent = 'Booting renderer...\n[' + '#'.repeat(Math.round(prog/100*20)) + ' '.repeat(20 - Math.round(prog/100*20)) + `] ${prog}%`;
  if(prog >= 100 || framesRendered > 0){
    loadingEl.textContent = 'Booting renderer...\n[' + '#'.repeat(20) + `] 100%`;
    if(framesRendered > 0){
      setTimeout(() => { loadingEl.style.display = 'none'; }, 220);
    }
    clearInterval(progT);
  }
}, 80);
