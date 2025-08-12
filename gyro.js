// gyro.js
(function(){
    Utils.setupGlobalErrorHandlers();
  
    const loadingEl = document.getElementById('loading');
    const asciiPre = document.getElementById('ascii');
    const debugEl = document.getElementById('debug');
  
    const ASCII_COLS = 120;
    const ASCII_ROWS = 48;
  
    let renderer, scene, camera, rt, pixelBuffer;
    let dodeWire, cubeWire, tetraWire, cubePivot, tetraPivot;
    let raycaster, mouseNDC, plane;
    let v0_local;
  
    let dodeSize, cubeSize, tetraSize, scaleFactor;
  
    function updateScaleAndPosition(){
      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspect = width / height;
  
      renderer.setSize(width, height);
      rt.setSize(ASCII_COLS, ASCII_ROWS);
  
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
  
      const cameraZ = camera.position.z; // 20 fixed
      const fovRadians = THREE.MathUtils.degToRad(camera.fov);
      const visibleHeight = 2 * Math.tan(fovRadians / 2) * cameraZ;
      const visibleWidth = visibleHeight * aspect;
  
      const baseSize = 6.0;
  
      const maxModelHeight = visibleHeight * 0.8;
      const maxModelWidth = visibleWidth * 0.8;
  
      const scaleY = maxModelHeight / baseSize;
      const scaleX = maxModelWidth / baseSize;
  
      scaleFactor = Math.min(scaleX, scaleY);
  
      scaleFactor = Math.min(Math.max(scaleFactor, 0.5), 4);
  
      dodeSize = baseSize * scaleFactor;
      cubeSize = 3.0 * scaleFactor;
      tetraSize = 1.3 * scaleFactor;
  
      if(tetraPivot){
        tetraPivot.position.set(0, 0, cubeSize / 2 + tetraSize / 2);
      }
    }
  
    function init(){
      renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: false});
      document.body.appendChild(renderer.domElement);
  
      rt = new THREE.WebGLRenderTarget(ASCII_COLS, ASCII_ROWS, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
      });
  
      pixelBuffer = new Uint8Array(ASCII_COLS * ASCII_ROWS * 4);
  
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
  
      camera = new THREE.PerspectiveCamera(45, ASCII_COLS / ASCII_ROWS, 0.1, 1000);
      camera.position.set(0, 0, 20);
      camera.lookAt(0, 0, 0);
  
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dir = new THREE.DirectionalLight(0xffffff, 0.4);
      dir.position.set(5, 5, 5);
      scene.add(dir);
  
      updateScaleAndPosition();
  
      const matT = new THREE.LineBasicMaterial({color: 0xbfefff});
      const matC = new THREE.LineBasicMaterial({color: 0xffc0ea});
      const matD = new THREE.LineBasicMaterial({color: 0xd7ffb3});
  
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
  
      const dodeGroup = new THREE.Object3D();
      root.add(dodeGroup);
      dodeGroup.add(dodeWire);
  
      cubePivot = new THREE.Object3D();
      dodeGroup.add(cubePivot);
      cubePivot.add(cubeWire);
  
      tetraPivot = new THREE.Object3D();
      cubePivot.add(tetraPivot);
      tetraPivot.add(tetraWire);
      tetraPivot.position.set(0, 0, cubeSize / 2 + tetraSize / 2);
  
      raycaster = new THREE.Raycaster();
      mouseNDC = new THREE.Vector2(0, 0);
      plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -3.5);
  
      window.addEventListener('mousemove', (ev) => {
        mouseNDC.x = (ev.clientX / window.innerWidth) * 2 - 1;
        mouseNDC.y = -((ev.clientY / window.innerHeight) * 2 - 1);
      });
  
      window.addEventListener('resize', () => {
        updateScaleAndPosition();
      });
  
      debugEl.style.display = 'block';
      debugEl.textContent = `Render target: ${ASCII_COLS}x${ASCII_ROWS}\nScale factor: ${scaleFactor.toFixed(3)}`;
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
  
      tetraWire.quaternion.slerp(localQ, 0.35);
    }
  
    function updateCubeGyro(dt){
      const cubeWorldPos = new THREE.Vector3();
      cubePivot.getWorldPosition(cubeWorldPos);
      const tetraWorldPos = new THREE.Vector3();
      tetraPivot.getWorldPosition(tetraWorldPos);
  
      const axisCT = new THREE.Vector3().subVectors(tetraWorldPos, cubeWorldPos);
      debugEl.textContent = `Render target: ${ASCII_COLS}x${ASCII_ROWS}\nScale factor: ${scaleFactor.toFixed(3)}\n\n` +
        `axisCT length: ${axisCT.length().toFixed(6)}`;
  
      if(axisCT.lengthSq() < 1e-8) return;
  
      axisCT.normalize();
  
      const arbitrary = Math.abs(axisCT.dot(new THREE.Vector3(0,1,0))) < 0.9 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
      const perp = new THREE.Vector3().crossVectors(axisCT, arbitrary).normalize();
  
      const z = axisCT.clone();
      const y = perp.clone();
      const x = new THREE.Vector3().crossVectors(y,z).normalize();
      const m = new THREE.Matrix4(); m.makeBasis(x,y,z);
      const desiredQ = new THREE.Quaternion().setFromRotationMatrix(m);
  
      const stabilityQ = new THREE.Quaternion();
      if(dodeWire.parent) dodeWire.parent.getWorldQuaternion(stabilityQ);
      else stabilityQ.identity();
  
      const finalQ = new THREE.Quaternion();
      finalQ.copy(stabilityQ).slerp(desiredQ, 0.6);
  
      const parentWorldQInv = new THREE.Quaternion();
      if(cubePivot.parent) cubePivot.parent.getWorldQuaternion(parentWorldQInv).invert();
      else parentWorldQInv.identity();
      const localFinal = finalQ.clone().premultiply(parentWorldQInv);
  
      cubePivot.quaternion.slerp(localFinal, 0.2 + Math.min(0.5, dt*0.001));
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
        updateCubeGyro(dt);
  
        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
  
        if(time - asciiLast > asciiInterval){
          asciiLast = time;
          renderer.readRenderTargetPixels(rt, 0, 0, ASCII_COLS, ASCII_ROWS, pixelBuffer);
          asciiPre.textContent = AsciiHelper.pixelsToASCII(pixelBuffer, ASCII_COLS, ASCII_ROWS);
        }
  
        framesRendered++;
        if(framesRendered === 3){
          loadingEl.style.display = 'none';
        }
  
        requestAnimationFrame(animate);
      } catch (err){
        Utils.showError('Runtime error in render loop:\n' + (err && err.stack ? err.stack : String(err)));
      }
    }
  
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
  
  })();
  