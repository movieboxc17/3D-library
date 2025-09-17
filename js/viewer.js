// Simple Three.js FBX viewer (clean rewrite)
import * as THREE from 'https://esm.sh/three@0.156.0';
import { OrbitControls } from 'https://esm.sh/three@0.156.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.156.0/examples/jsm/loaders/FBXLoader.js';

// Elements
const app = document.getElementById('app');
const container = document.getElementById('viewer');
const status = document.getElementById('status');
const listEl = document.getElementById('model-list');
const downloadLink = document.getElementById('download-link');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const debugEl = document.getElementById('debug');

let scene, camera, renderer, controls, loader;
let currentModel = null;
let gridHelper = null;

function logDebug(msg){ if(debugEl) debugEl.textContent = msg; }
function setStatus(s){ if(status) status.textContent = s || ''; }

function initRenderer(){
  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.innerHTML = '';
  container.appendChild(renderer.domElement);
}

function initScene(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071020);

  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 5000);
  camera.position.set(200,200,200);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(100,200,100);
  scene.add(dir);

  const ambient = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambient);

  gridHelper = new THREE.GridHelper(200, 40, 0x666666, 0x222222);
  scene.add(gridHelper);
}

function onWindowResize(){
  if(!camera || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate(){
  requestAnimationFrame(animate);
  if(controls) controls.update();
  if(renderer && scene && camera) renderer.render(scene, camera);
}

function clearModel(){
  if(currentModel){
    scene.remove(currentModel);
    currentModel.traverse(c=>{ if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); });
    currentModel = null;
  }
}

function fitCameraToObject(object, offset = 1.25){
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI/180);
  let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));
  cameraZ *= offset;
  camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();
}

function applyWireframe(root, enabled){
  root.traverse(c=>{ if(c.isMesh){ if(Array.isArray(c.material)) c.material.forEach(m=>m.wireframe = enabled); else c.material.wireframe = enabled; } });
}

function autoScaleToUnit(root){
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z);
  if(max === 0) return 1;
  const scale = 100 / max;
  root.scale.setScalar(scale);
  return scale;
}

async function loadModel(url, name){
  setStatus('Loading ' + name + '...');
  try{
    const obj = await new Promise((res, rej)=> loader.load(url, res, undefined, rej));
    clearModel();
    const group = new THREE.Group();
    group.add(obj);
    scene.add(group);
    currentModel = group;
    autoScaleToUnit(currentModel);
    fitCameraToObject(currentModel, 1.5);
    setStatus('Loaded ' + name);
    if(downloadLink){ downloadLink.href = url; downloadLink.download = name; }
  }catch(err){
    console.error(err);
    setStatus('Failed to load ' + name + ': ' + (err.message || err));
  }
}

async function fetchModels(){
  try{
    const res = await fetch('models/models.json');
    if(!res.ok) throw new Error('models.json not found');
    const list = await res.json();
    renderModelList(list);
  }catch(err){
    listEl.innerHTML = '<div class="hint">No models found. Add FBX files to models/</div>';
    setStatus('No models available');
  }
}

function renderModelList(list){
  listEl.innerHTML = '';
  list.forEach(item=>{
    const div = document.createElement('div');
    div.className = 'model-item';
    div.textContent = item.name;
    const sizeSpan = document.createElement('span'); sizeSpan.textContent = item.size || '';
    div.appendChild(sizeSpan);
    div.addEventListener('click', ()=> loadModel(item.url, item.name));
    listEl.appendChild(div);
  });
}

// Tablet detection and UI
function isTablet(){
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && shortSide >= 600 && shortSide <= 1100;
}

function updateDeviceUI(){
  if(isTablet()){
    app.classList.add('tablet-mode');
    if(sidebar) sidebar.classList.add('overlay');
  }else{
    app.classList.remove('tablet-mode');
    if(sidebar) sidebar.classList.remove('overlay');
  }
}

// Sidebar toggle
if(sidebarToggle && sidebar){
  sidebarToggle.addEventListener('click', ()=> sidebar.classList.toggle('open'));
}

// Wire tablet buttons
function wireTabletButtons(){
  const tbFront = document.getElementById('tb-cam-front');
  const tbTop = document.getElementById('tb-cam-top');
  const tbRight = document.getElementById('tb-cam-right');
  const tbPersp = document.getElementById('tb-cam-persp');
  const tbWire = document.getElementById('tb-wire-toggle');
  const tbShading = document.getElementById('tb-shading');
  const tbGrid = document.getElementById('tb-grid-toggle');
  const tbDownload = document.getElementById('tb-download');

  if(tbFront) tbFront.addEventListener('click', ()=>{ camera.position.set(0,200,0); controls.target.set(0,0,0); controls.update(); });
  if(tbTop) tbTop.addEventListener('click', ()=>{ camera.position.set(0,400,0); controls.target.set(0,0,0); controls.update(); });
  if(tbRight) tbRight.addEventListener('click', ()=>{ camera.position.set(400,0,0); controls.target.set(0,0,0); controls.update(); });
  if(tbPersp) tbPersp.addEventListener('click', ()=>{ camera.position.set(200,200,200); controls.target.set(0,0,0); controls.update(); });
  if(tbWire) tbWire.addEventListener('click', ()=>{ applyWireframe(currentModel, tbWire.getAttribute('aria-pressed') !== 'true'); tbWire.setAttribute('aria-pressed', tbWire.getAttribute('aria-pressed') !== 'true'); });
  if(tbShading) tbShading.addEventListener('change', ()=>{
    const val = tbShading.value;
    if(!currentModel) return;
    currentModel.traverse(m=>{
      if(!m.isMesh) return;
      if(val === 'solid') m.material = new THREE.MeshStandardMaterial({color: m.material.color || new THREE.Color(0xaaaaaa)});
    });
  });
  if(tbGrid) tbGrid.addEventListener('click', ()=>{ gridHelper.visible = !gridHelper.visible; });
  if(tbDownload) tbDownload.addEventListener('click', ()=>{ if(downloadLink && downloadLink.href) tbDownload.href = downloadLink.href; });
}

// Touch gesture prevention to avoid page pinch zoom on iOS Safari
function preventPagePinchZoom(){
  document.addEventListener('gesturestart', e=> e.preventDefault());
  document.addEventListener('gesturechange', e=> e.preventDefault());
  document.addEventListener('gestureend', e=> e.preventDefault());
}

// Init
function start(){
  initRenderer();
  initScene();
  loader = new FBXLoader();
  fetchModels();
  wireTabletButtons();
  updateDeviceUI();
  window.addEventListener('resize', ()=>{ onWindowResize(); updateDeviceUI(); });
  window.addEventListener('orientationchange', ()=>{ onWindowResize(); updateDeviceUI(); });
  preventPagePinchZoom();
  animate();
  setStatus('Ready');
}

start();
