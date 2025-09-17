// Minimal Three.js FBX viewer using ES modules
// Use esm.sh which rewrites bare imports for the browser
import * as THREE from 'https://esm.sh/three@0.156.0';
import { OrbitControls } from 'https://esm.sh/three@0.156.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.156.0/examples/jsm/loaders/FBXLoader.js';

const container = document.getElementById('viewer');
const app = document.getElementById('app');
const status = document.getElementById('status');
const listEl = document.getElementById('model-list');
const downloadLink = document.getElementById('download-link');

let scene, camera, renderer, controls, currentModel, primaryLight;
let orthoCamera = null, usingOrtho = false, gridHelper = null;

function setStatus(text){ status.textContent = text || ''; }

function init(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071020);
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 150, 300);

  renderer = new THREE.WebGLRenderer({antialias:true});
  // use outputColorSpace instead of removed outputEncoding
  if('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  // touch-friendly tuning
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
  // create an orthographic camera for ortho toggle
  const aspect = container.clientWidth / container.clientHeight;
  const frustumSize = 400;
  orthoCamera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 0.1, 2000);
  orthoCamera.position.copy(camera.position);
  orthoCamera.up.set(0,1,0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(100,200,100);
  scene.add(dir);

  // add a subtle ambient light and helpers to help visualize orientation
  const ambient = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambient);
  primaryLight = dir;
  const axes = new THREE.AxesHelper(50);
  scene.add(axes);
  gridHelper = new THREE.GridHelper(200, 40, 0x666666, 0x222222);
  scene.add(gridHelper);

  window.addEventListener('resize', onWindowResize);

  // Setup touch gesture handlers now that controls and camera exist
  (function(){
    let lastTouchDist = null;
    container.addEventListener('touchmove', function(e){
      try{
        if(e.touches.length === 2){
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if(lastTouchDist){
            const delta = dist - lastTouchDist;
            if(controls && typeof controls.dollyIn === 'function' && typeof controls.dollyOut === 'function'){
              if(delta > 0) controls.dollyOut(1.03);
              else controls.dollyIn(1.03);
              controls.update();
            }else if(camera && controls){
              const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
              const factor = delta > 0 ? 1.03 : 0.97;
              dir.multiplyScalar(factor);
              camera.position.copy(controls.target).add(dir);
              if(typeof camera.updateProjectionMatrix === 'function') camera.updateProjectionMatrix();
              controls.update();
            }
          }
          lastTouchDist = dist;
          e.preventDefault();
        }
      }catch(err){ console.warn('Touch move handler error:', err); }
    }, {passive:false});
    container.addEventListener('touchend', function(e){ lastTouchDist = null; });

    let touchStartX = null;
    container.addEventListener('touchstart', function(e){ if(e.touches.length === 1) touchStartX = e.touches[0].clientX; }, {passive:true});
    container.addEventListener('touchend', function(e){
      try{
        if(touchStartX !== null && e.changedTouches.length === 1){
          const dx = e.changedTouches[0].clientX - touchStartX;
          if(Math.abs(dx) > 80 && sidebar && sidebar.classList.contains('overlay')){
            if(dx > 0) sidebar.classList.add('open');
            else sidebar.classList.remove('open');
          }
        }
      }catch(err){ console.warn('Touch end handler error:', err); }
      touchStartX = null;
    }, {passive:true});
  })();

  animate();
}

// Mobile sidebar toggle
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
if(sidebarToggle && sidebar){
  sidebarToggle.onclick = ()=>{
    const open = sidebar.classList.toggle('open');
    if(open) app && app.classList.add('sidebar-open');
    else app && app.classList.remove('sidebar-open');
  };
  // ensure initial hidden state on small screens
  if(window.innerWidth <= 900) sidebar.classList.remove('open');
  // Accessibility: allow keyboard and touch
  sidebarToggle.setAttribute('tabindex', '0');
  sidebarToggle.addEventListener('keydown', e => {
    if(e.key === 'Enter' || e.key === ' ') sidebarToggle.click();
  });
}

function onWindowResize(){
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function updateSidebarState(){
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  // treat device as small if the shorter side <= 900 (handles tablets in landscape)
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const isSmall = shortSide <= 900;
  const isLandscape = window.innerWidth > window.innerHeight;
  // detect iPad specifically (modern iPadOS reports MacIntel + touch points)
  const isIpad = (()=>{
    const ua = navigator.userAgent || '';
    // iPadOS 13+ may report MacIntel but has touch points
    if(/iPad/.test(ua)) return true;
    if(navigator.platform === 'MacIntel' && navigator.maxTouchPoints && navigator.maxTouchPoints > 1) return true;
    return false;
  })();

  if(isSmall && isLandscape && isTouch){
    // For iPad prefer an overlay that can be closed to reveal the viewer.
    if(isIpad){
      sidebar.classList.add('overlay');
      sidebar.classList.remove('docked');
      // make it open by default but overlay so user can close
      sidebar.classList.add('open');
      injectSidebarClose();
      if(sidebarToggle) sidebarToggle.style.display = 'none';
    }else{
      // other small touch devices: keep a docked sidebar but don't let it cover too much
      sidebar.classList.add('docked');
      sidebar.classList.remove('overlay');
      sidebar.classList.add('open');
      if(sidebarToggle) sidebarToggle.style.display = 'none';
    }
  app && app.classList.remove('sidebar-open');
  }else{
    // desktop or portrait: remove forced overlay/docked modes and show toggle
    sidebar.classList.remove('overlay');
    sidebar.classList.remove('docked');
    if(sidebarToggle) sidebarToggle.style.display = '';
    // keep user's choice for open/close state
  }
}

window.addEventListener('resize', updateSidebarState);
window.addEventListener('orientationchange', updateSidebarState);
// run initially
updateSidebarState();

// Fix iOS/vh issues: set a CSS var --vh to the real inner height fraction
function updateVH(){
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', updateVH);
window.addEventListener('orientationchange', updateVH);
updateVH();

// Inject a close button into the sidebar for overlay mode (idempotent)
function injectSidebarClose(){
  if(!sidebar) return;
  // if already has a close button, keep existing
  if(sidebar.querySelector('.close-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'close-btn';
  btn.title = 'Close';
  btn.innerHTML = '✕';
  btn.onclick = ()=>{
    sidebar.classList.remove('open');
    // small delay to ensure visual update
    setTimeout(()=>{
      sidebar.classList.remove('overlay');
    }, 350);
  };
  sidebar.appendChild(btn);
  // add a small handle bar to indicate draggable sheet on touch devices
  if(!sidebar.querySelector('.sheet-handle')){
    const handle = document.createElement('div');
    handle.className = 'sheet-handle';
    handle.setAttribute('aria-hidden','true');
    sidebar.insertBefore(handle, sidebar.firstChild);
  }
}

// Close sidebar on outside tap (overlay mode)
document.addEventListener('touchstart', function(e){
  if(sidebar.classList.contains('overlay') && sidebar.classList.contains('open')){
    if(!sidebar.contains(e.target)){
      sidebar.classList.remove('open');
      setTimeout(()=>sidebar.classList.remove('overlay'), 350);
    }
  }
}, {passive:true});

function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, usingOrtho ? orthoCamera : camera);
}

const loader = new FBXLoader();
const debugEl = document.getElementById('debug');
const shadingSelect = document.getElementById('shading-mode');
const showGrid = document.getElementById('show-grid');
const orthoToggle = document.getElementById('ortho-toggle');
const camFront = document.getElementById('cam-front');
const camTop = document.getElementById('cam-top');
const camRight = document.getElementById('cam-right');
const camPersp = document.getElementById('cam-persp');

// Compute bounding box only from visible mesh geometries (more robust for FBX with transforms)
function computeMeshesBox(root){
  const box = new THREE.Box3();
  let has = false;
  root.updateMatrixWorld(true);
  root.traverse(node => {
    if(node.isMesh){
      const geom = node.geometry;
      if(!geom) return;
      if(!geom.boundingBox) geom.computeBoundingBox();
      const geomBox = geom.boundingBox.clone();
      geomBox.applyMatrix4(node.matrixWorld);
      box.union(geomBox);
      has = true;
    }
  });
  if(!has) return new THREE.Box3().setFromObject(root);
  return box;
}

// Find the largest mesh (by bbox volume) and return its world-space box
function computeLargestMeshBox(root){
  let bestBox = null;
  let bestVol = 0;
  root.updateMatrixWorld(true);
  root.traverse(node => {
    if(node.isMesh){
      const geom = node.geometry;
      if(!geom) return;
      if(!geom.boundingBox) geom.computeBoundingBox();
      const geomBox = geom.boundingBox.clone();
      geomBox.applyMatrix4(node.matrixWorld);
      const size = geomBox.getSize(new THREE.Vector3());
      const vol = size.x * size.y * size.z;
      if(vol > bestVol){ bestVol = vol; bestBox = geomBox.clone(); }
    }
  });
  return bestBox; // may be null
}

async function loadModel(url, name){
  setStatus('Loading ' + name + ' ...');
  try{
    const obj = await new Promise((res, rej) => loader.load(url, res, undefined, rej));
    if(currentModel) scene.remove(currentModel);

    // Ensure world matrices are current before measuring
    obj.updateMatrixWorld(true);

    // compute bounding box in world space
    const box = new THREE.Box3().setFromObject(obj);
    const sizeVec = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

  // create a pivot group so we can reposition/scale the whole model reliably
  const pivot = new THREE.Group();
  pivot.add(obj);
  scene.add(pivot);
  currentModel = pivot;

    // apply auto-scaling first and update world matrices
    const appliedScale = autoScaleToUnit(currentModel);
    currentModel.updateMatrixWorld(true);

    // After scaling, compute bbox on the pivot using mesh-only method
    const largestBox = computeLargestMeshBox(currentModel) || computeMeshesBox(currentModel);
    const postCenter = largestBox.getCenter(new THREE.Vector3());

    // shift pivot so that model center becomes origin, or align to ground if requested
    let px = -postCenter.x, py = -postCenter.y, pz = -postCenter.z;
    if(alignGround && alignGround.checked){
      // align the model's minimum Y to zero after scaling
      currentModel.updateMatrixWorld(true);
      const worldBox = computeMeshesBox(currentModel);
      const minY = worldBox.min.y;
      py = -minY;
    }
    pivot.position.set(px, py, pz);

    // recompute bounding box after scaling so we fit the actual displayed size
    const finalBox = computeMeshesBox(currentModel);
    const finalSize = finalBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(finalSize.x, finalSize.y, finalSize.z) || 1;
    const fitDistance = Math.max(1, maxDim) * 1.5;
    camera.position.set(fitDistance, fitDistance, fitDistance);
    camera.near = Math.max(0.01, (maxDim) / 1000);
    camera.far = Math.max(1000, maxDim * 100);
    camera.updateProjectionMatrix();
    controls.target.set(0,0,0);
    controls.update();

    if(debugEl){
      debugEl.innerHTML = `Model: ${name}<br>Original center: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}<br>Original size: ${sizeVec.x.toFixed(2)} x ${sizeVec.y.toFixed(2)} x ${sizeVec.z.toFixed(2)}<br>Final size: ${finalSize.x.toFixed(2)} x ${finalSize.y.toFixed(2)} x ${finalSize.z.toFixed(2)}<br>Scale applied: ${appliedScale.toFixed(3)}<br>Camera: ${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}`;
    }
  // hook up controls
    if(lightRange){
      lightRange.value = primaryLight ? primaryLight.intensity : 1;
      lightRange.oninput = ()=>{ if(primaryLight) primaryLight.intensity = parseFloat(lightRange.value); };
    }
    if(wireToggle){
      wireToggle.onchange = ()=>{ applyWireframe(currentModel, wireToggle.checked); };
    }
    // shading mode: preserve original materials and allow flat solid/wireframe modes
    function setShading(mode){
      if(!currentModel) return;
      currentModel.traverse(mesh=>{
        if(!mesh.isMesh) return;
        if(!mesh.userData._origMaterial) mesh.userData._origMaterial = mesh.material;
        if(mode === 'solid'){
          // replace with a simple flat MeshStandardMaterial while preserving color roughly
          const mat = new THREE.MeshStandardMaterial({color: mesh.userData._origMaterial && mesh.userData._origMaterial.color ? mesh.userData._origMaterial.color.clone() : new THREE.Color(0xaaaaaa)});
          mesh.material = mat;
        }else{ // lit
          if(mesh.userData._origMaterial) mesh.material = mesh.userData._origMaterial;
        }
      });
    }
    if(shadingSelect) shadingSelect.onchange = ()=> setShading(shadingSelect.value);
    if(showGrid) showGrid.onchange = ()=>{ if(gridHelper) gridHelper.visible = showGrid.checked; }
    if(orthoToggle) orthoToggle.onchange = ()=>{ usingOrtho = !!orthoToggle.checked; }

    // camera preset helper to avoid duplicated handlers
    function setCameraTo(dir){
      if(!dir) return;
      const d = Math.max(150, camera.position.length() || 200);
      let pos = new THREE.Vector3();
      if(dir === 'front') pos.set(0, d, 0);
      else if(dir === 'top') pos.set(0, d, 0);
      else if(dir === 'right') pos.set(d, 0, 0);
      else pos.set(d, d, d);
      if(usingOrtho){ orthoCamera.position.copy(pos); orthoCamera.updateProjectionMatrix(); }
      else { camera.position.copy(pos); camera.updateProjectionMatrix(); }
      controls.target.set(0,0,0);
      controls.update();
    }
    if(camFront) camFront.onclick = ()=> setCameraTo('front');
    if(camTop) camTop.onclick = ()=> setCameraTo('top');
    if(camRight) camRight.onclick = ()=> setCameraTo('right');
    if(camPersp) camPersp.onclick = ()=> { if(orthoToggle){ orthoToggle.checked = false; usingOrtho = false; } setCameraTo('persp'); };
    if(resetBtn){
      resetBtn.onclick = ()=>{
        if(!currentModel){ controls.reset(); return; }
        const box = new THREE.Box3().setFromObject(currentModel);
        const sizeVec = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;
        const scale = currentModel.scale ? currentModel.scale.x : 1;
        const fit = Math.max(1, maxDim * scale) * 1.5;
        camera.position.set(fit, fit, fit);
        controls.target.set(0,0,0);
        controls.update();
      };
    }
    if(centerBtn){
      centerBtn.onclick = ()=>{
        if(!currentModel) return;
        currentModel.updateMatrixWorld(true);
        const lb = computeLargestMeshBox(currentModel) || computeMeshesBox(currentModel);
        if(!lb) return;
        const c = lb.getCenter(new THREE.Vector3());
        currentModel.position.set(-c.x, -c.y, -c.z);
        currentModel.updateMatrixWorld(true);
      };
    }
    if(frameBtn){
      frameBtn.onclick = ()=>{
        if(!currentModel) return;
        currentModel.updateMatrixWorld(true);
        const fb = new THREE.Box3().setFromObject(currentModel);
        const s = fb.getSize(new THREE.Vector3());
        const md = Math.max(s.x, s.y, s.z) || 1;
        const f = Math.max(1, md) * 1.5;
        camera.position.set(f, f, f);
        camera.updateProjectionMatrix();
        controls.target.set(0,0,0);
        controls.update();
      };
    }
    downloadLink.href = url;
    downloadLink.download = name;
  }catch(err){
    console.error(err);
    setStatus('Failed to load ' + name + ': ' + (err.message||err));
  }
}

async function fetchModelsList(){
  try{
    const res = await fetch('models/models.json');
    if(!res.ok) throw new Error('models.json not found');
    const list = await res.json();
    renderModelList(list);
  }catch(err){
    listEl.innerHTML = '<div class="hint">No models found. Add FBX files to the <code>models/</code> folder and run the generator.</div>';
    setStatus('No models available');
  }
}

function renderModelList(list){
  listEl.innerHTML = '';
  list.forEach(item=>{
    const div = document.createElement('div');
    div.className = 'model-item';
    div.textContent = item.name;
    const sizeSpan = document.createElement('span');
    sizeSpan.textContent = item.size ? item.size : '';
    div.appendChild(sizeSpan);
    div.addEventListener('click', ()=>{
      loadModel(item.url, item.name);
      // only auto-close in portrait (not docked landscape)
      const shortSide = Math.min(window.innerWidth, window.innerHeight);
      const isPortrait = window.innerHeight >= window.innerWidth;
      if(shortSide <= 900 && isPortrait && sidebar){
        sidebar.classList.remove('open');
      app && app.classList.remove('sidebar-open');
      }
    });
    listEl.appendChild(div);
  });
}

// Controls (wireframe, lighting, reset)
const lightRange = document.getElementById('light-range');
const wireToggle = document.getElementById('wire-toggle');
const resetBtn = document.getElementById('reset-camera');
const centerBtn = document.getElementById('center-model');
const frameBtn = document.getElementById('frame-model');
const alignGround = document.getElementById('align-ground');

function applyWireframe(root, enabled){
  root.traverse(child=>{
    if(child.isMesh){
      if(Array.isArray(child.material)) child.material.forEach(m=>m.wireframe = enabled);
      else child.material.wireframe = enabled;
    }
  });
}

function autoScaleToUnit(root){
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if(maxDim === 0) return 1;
  const scale = 100 / maxDim; // scale the model to roughly 100 units
  root.scale.setScalar(scale);
  return scale;
}

init();
fetchModelsList();

  // Add pinch-to-zoom and swipe for iPad/touch devices (robust)
  (function(){
    let lastTouchDist = null;
    container.addEventListener('touchmove', function(e){
      try{
        if(e.touches.length === 2){
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if(lastTouchDist){
            const delta = dist - lastTouchDist; // positive = fingers moved apart
            // Prefer OrbitControls dolly methods if available, otherwise apply camera fallback
            if(controls && typeof controls.dollyIn === 'function' && typeof controls.dollyOut === 'function'){
              if(delta > 0) controls.dollyOut(1.03);
              else controls.dollyIn(1.03);
              controls.update();
            }else if(camera && controls){
              // Fallback: move camera toward/away from controls.target
              const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
              const factor = delta > 0 ? 1.03 : 0.97;
              dir.multiplyScalar(factor);
              camera.position.copy(controls.target).add(dir);
              if(typeof camera.updateProjectionMatrix === 'function') camera.updateProjectionMatrix();
              controls.update();
            }
          }
          lastTouchDist = dist;
          // prevent default to avoid page pinch-zoom on some browsers
          e.preventDefault();
        }
      }catch(err){
        // swallow errors to avoid breaking the app on touch devices
        console.warn('Touch move handler error:', err);
      }
    }, {passive:false});
    container.addEventListener('touchend', function(e){ lastTouchDist = null; });

    // Swipe left/right to open/close sidebar in overlay mode
    let touchStartX = null;
    container.addEventListener('touchstart', function(e){
      if(e.touches.length === 1) touchStartX = e.touches[0].clientX;
    }, {passive:true});
    container.addEventListener('touchend', function(e){
      try{
        if(touchStartX !== null && e.changedTouches.length === 1){
          const dx = e.changedTouches[0].clientX - touchStartX;
          if(Math.abs(dx) > 80 && sidebar && sidebar.classList.contains('overlay')){
            if(dx > 0) sidebar.classList.add('open');
            else sidebar.classList.remove('open');
          }
        }
      }catch(err){ console.warn('Touch end handler error:', err); }
      touchStartX = null;
    }, {passive:true});
  })();
