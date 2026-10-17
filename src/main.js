import * as THREE from 'three';
import { createClient } from '@supabase/supabase-js';
import './style.css';

const $ = (id) => document.getElementById(id);
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const state = {
  name:'Dreamer', worldName:'Dreamland', roomId:null, roomCode:'DREAMLAND', memberId:null,
  mode:'walk', selectedItem:null, category:'all', objects:[], notes:[], players:new Map(),
  chat:[], channel:null, isOnline:false, sound:true, atmosphere:'day', quality:'balanced',
  undo:[], redo:[], pendingNote:false, muted:false, lastSave:0, saveTimer:null, session:null,
  localId:crypto.randomUUID(), gardenCount:0
};
const catalog = [
  {id:'cottage',name:'Cottage',emoji:'🏡',cat:'build',desc:'A cozy little home'},
  {id:'house',name:'Mint house',emoji:'🏠',cat:'build',desc:'Two-storey home'},
  {id:'tower',name:'Castle tower',emoji:'🏰',cat:'build',desc:'A fairytale tower'},
  {id:'shop',name:'Tiny café',emoji:'☕',cat:'build',desc:'A place to hang out'},
  {id:'fountain',name:'Fountain',emoji:'⛲',cat:'decor',desc:'A little water magic'},
  {id:'bench',name:'Garden bench',emoji:'🪑',cat:'decor',desc:'Rest for a while'},
  {id:'lamp',name:'Street lamp',emoji:'🏮',cat:'decor',desc:'Glows after sunset'},
  {id:'heart',name:'Heart balloons',emoji:'🎈',cat:'decor',desc:'A floating surprise'},
  {id:'tree',name:'Round tree',emoji:'🌳',cat:'garden',desc:'A leafy friend'},
  {id:'blossom',name:'Blossom tree',emoji:'🌸',cat:'garden',desc:'Pink spring petals'},
  {id:'flower',name:'Flower patch',emoji:'🌼',cat:'garden',desc:'Bright little blooms'},
  {id:'mushroom',name:'Magic mushrooms',emoji:'🍄',cat:'garden',desc:'A secret garden touch'},
  {id:'pond',name:'Pond',emoji:'💧',cat:'garden',desc:'A peaceful pond'},
  {id:'crystal',name:'Crystal',emoji:'💎',cat:'decor',desc:'A glowing keepsake'},
  {id:'arch',name:'Flower arch',emoji:'🌷',cat:'garden',desc:'A lovely entrance'},
  {id:'path',name:'Stone path',emoji:'🪨',cat:'road',desc:'A stepping-stone path'},
  {id:'road',name:'Curved road',emoji:'🛣️',cat:'road',desc:'Connect your town'},
  {id:'mailbox',name:'Mailbox',emoji:'📮',cat:'decor',desc:'For little notes'},
  {id:'campfire',name:'Campfire',emoji:'🔥',cat:'decor',desc:'Gather after dark'},
  {id:'gift',name:'Gift box',emoji:'🎁',cat:'decor',desc:'A surprise for a friend'},
  {id:'castlewall',name:'Castle wall',emoji:'🧱',cat:'build',desc:'Build a fortress'},
  {id:'hedge',name:'Hedge',emoji:'🌿',cat:'garden',desc:'Shape your garden'}
];

let scene,camera,renderer,clock,raycaster,ground,worldGroup,playerGroup,otherGroup,preview=null;
let move={x:0,z:0}, keys={}, pointer={down:false,x:0,y:0,lastX:0,lastY:0}, cameraYaw=0, cameraPitch=.72, cameraDistance=17;
let targetPos=new THREE.Vector3(0,0,0), playerPos=new THREE.Vector3(0,0,0), playerMesh, otherMeshes=new Map(), objectMeshes=new Map(), labels={};
let toastTimer, audioCtx=null, qualityScale=1;
const COLORS={day:{sky:0xb9d9cf,fog:0xb9d9cf,hemi:0xeaf8ef,sun:0xfff1d0,intensity:2.1},sunset:{sky:0xf4c7bf,fog:0xf4c7bf,hemi:0xffe0d0,sun:0xffc29a,intensity:1.65},night:{sky:0x293c58,fog:0x293c58,hemi:0x8193c5,sun:0xc4d5ff,intensity:.72},twilight:{sky:0xaaa9d2,fog:0xaaa9d2,hemi:0xe5d7ff,sun:0xf6c6dd,intensity:1.15}};
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
function setStatus(text,online=false){$('statusText').textContent=text;$('statusDot').classList.toggle('online',online)}
function show(el,on=true){el.classList.toggle('open',on)}
function init3D(){
  scene=new THREE.Scene();scene.background=new THREE.Color(COLORS.day.sky);scene.fog=new THREE.Fog(COLORS.day.fog,28,90);
  camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,180);camera.position.set(12,14,16);
  renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,state.quality==='lite'?1:1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=state.quality!=='lite';renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;tuneQuality();
  clock=new THREE.Clock();raycaster=new THREE.Raycaster();worldGroup=new THREE.Group();scene.add(worldGroup);
  scene.add(new THREE.HemisphereLight(0xe9fff1,0x71977b,2));
  const sun=new THREE.DirectionalLight(0xfff0d8,2.1);sun.position.set(-12,22,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;scene.add(sun);scene.userData.sun=sun;
  buildLandscape();makePlayer();animate();addEventListener('resize',onResize);bindWorldInput();
}
function tuneQuality(){if(!renderer)return;renderer.setPixelRatio(Math.min(devicePixelRatio,state.quality==='lite'?0.8:state.quality==='balanced'?1.2:1.6));renderer.shadowMap.enabled=state.quality!=='lite'}
function mat(color,roughness=.85){return new THREE.MeshStandardMaterial({color,roughness})}
function addMesh(parent,geo,material,x,y,z,scale=null){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function buildLandscape(){
  const groundGeo=new THREE.PlaneGeometry(150,150,80,80);groundGeo.rotateX(-Math.PI/2);
  const pos=groundGeo.attributes.position;
  for(let i=0;i<pos.count;i++){let x=pos.getX(i),z=pos.getZ(i);let h=(Math.sin(x*.15)*Math.cos(z*.12)+Math.sin(z*.21+x*.1)*.45)*.36;pos.setY(i,h)}
  groundGeo.computeVertexNormals();ground=addMesh(worldGroup,groundGeo,new THREE.MeshStandardMaterial({color:0x8fbe9c,roughness:1}),0,-.22,0);ground.receiveShadow=true;ground.userData.ground=true;
  // A winding blue stream with sandy banks.
  const streamMat=mat(0x83cbd1,.25),bankMat=mat(0xd8d1ad);
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-28,.04,-7),new THREE.Vector3(-17,.04,-4),new THREE.Vector3(-8,.04,-8),new THREE.Vector3(2,.04,-4),new THREE.Vector3(11,.04,-7),new THREE.Vector3(27,.04,-1)]);
  const river=addMesh(worldGroup,new THREE.TubeGeometry(curve,80,1.65,8,false),streamMat,0,0,0);river.castShadow=false;
  const bankCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-28,.02,-7),new THREE.Vector3(-17,.02,-4),new THREE.Vector3(-8,.02,-8),new THREE.Vector3(2,.02,-4),new THREE.Vector3(11,.02,-7),new THREE.Vector3(27,.02,-1)]);
  addMesh(worldGroup,new THREE.TubeGeometry(bankCurve,80,2.05,8,false),bankMat,0,-.07,0).renderOrder=-1;
  // Rolling hills and distant mountains.
  for(let i=0;i<13;i++){const a=i/13*Math.PI*2,r=36+(i%3)*5,x=Math.cos(a)*r,z=Math.sin(a)*r;const h=7+(i%4)*2;const hill=addMesh(worldGroup,new THREE.ConeGeometry(8,h,7),mat([0x9fc9a6,0x8bb99a,0xa8cba9][i%3]),x,h/2-1,z);hill.scale.x=1.8;hill.scale.z=1.6;hill.castShadow=false}
  // Wildflower dots.
  const flowerColors=[0xf6c4d5,0xffe5a1,0xe9d4ff,0xffffff,0xbbe5db];
  for(let i=0;i<420;i++){let x=(Math.random()-.5)*75,z=(Math.random()-.5)*75;if(Math.abs(z+5+Math.sin(x*.15)*2)<3)continue;if(Math.hypot(x,z)<7)continue;const stem=addMesh(worldGroup,new THREE.CylinderGeometry(.025,.035,.22,4),mat(0x63976e),x,-.02,z);stem.castShadow=false;const f=addMesh(worldGroup,new THREE.SphereGeometry(.09,5,4),mat(flowerColors[i%flowerColors.length]),x,.1,z);f.scale.set(1,.6,1);f.castShadow=false}
  // Tree grove.
  for(let i=0;i<48;i++){let x=(Math.random()-.5)*65,z=(Math.random()-.5)*65;if(Math.hypot(x,z)<10||Math.abs(z+5+Math.sin(x*.15)*2)<5)continue;createTree(worldGroup,x,terrainY(x,z),z,i%5===0)}
  // Islands, stones, tiny hills.
  for(let i=0;i<35;i++){let x=(Math.random()-.5)*45,z=(Math.random()-.5)*45;if(Math.hypot(x,z)<7)continue;let rock=addMesh(worldGroup,new THREE.DodecahedronGeometry(.25+Math.random()*.35,0),mat(i%2?0xb6c6ac:0xd8d5bb),x,terrainY(x,z),z);rock.rotation.set(Math.random(),Math.random(),Math.random());rock.castShadow=false}
  // central plaza.
  const plaza=addMesh(worldGroup,new THREE.CylinderGeometry(5.8,6.2,.18,48),mat(0xe9dfc9),0,-.03,0);plaza.castShadow=false;
  const ring=addMesh(worldGroup,new THREE.TorusGeometry(5.7,.08,6,64),mat(0xd3bba0),0,.07,0);ring.rotation.x=Math.PI/2;
  // town square fountain geometry.
  createObjectMesh({id:'fountain-centre',type:'fountain',x:0,z:0,rot:0,color:'#9ccfce',scale:1},worldGroup,true);
  // clouds.
  for(let i=0;i<8;i++){const cloud=new THREE.Group();for(let j=0;j<4;j++)addMesh(cloud,new THREE.SphereGeometry(1.1+Math.random()*.5,8,6),mat(0xf8fff8),j*.9,Math.random()*.3,Math.random()*.5);cloud.position.set(-35+i*10,15+(i%3)*2,-25+(i%4)*12);cloud.userData.cloud=true;cloud.userData.speed=.15+Math.random()*.2;scene.add(cloud)}
}
function terrainY(x,z){return (Math.sin(x*.15)*Math.cos(z*.12)+Math.sin(z*.21+x*.1)*.45)*.36}
function createTree(parent,x,y,z,pink=false){const g=new THREE.Group();g.position.set(x,y,z);addMesh(g,new THREE.CylinderGeometry(.13,.22,1.2,6),mat(0x9d7959),0,.55,0);const colors=pink?[0xf4b6d0,0xf7c4d7]:[0x5d9b70,0x6eaa78,0x86ba82];addMesh(g,new THREE.IcosahedronGeometry(1.05,1),mat(colors[Math.floor(Math.random()*colors.length)]),0,1.55,0,[1,1.12,1]);addMesh(g,new THREE.IcosahedronGeometry(.68,1),mat(colors[Math.floor(Math.random()*colors.length)]),-.5,2.05,.2);parent.add(g);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});return g}
function makePlayer(){
  playerGroup=new THREE.Group();playerMesh=new THREE.Group();playerGroup.add(playerMesh);
  addMesh(playerMesh,new THREE.CapsuleGeometry(.36,.55,4,8),mat(0xeab6c8),0,.72,0);
  addMesh(playerMesh,new THREE.SphereGeometry(.32,12,10),mat(0xf4d3b5),0,1.35,0);
  addMesh(playerMesh,new THREE.SphereGeometry(.35,10,8),mat(0x76594c),0,1.52,-.04,[1,.55,1]);
  addMesh(playerMesh,new THREE.SphereGeometry(.045,6,6),mat(0x3f5148),-.11,1.36,.285);addMesh(playerMesh,new THREE.SphereGeometry(.045,6,6),mat(0x3f5148),.11,1.36,.285);
  addMesh(playerMesh,new THREE.SphereGeometry(.07,6,6),mat(0xf19ba9),0,1.23,.29,[1,.5,.5]);
  const feet=mat(0x6a8c78);addMesh(playerMesh,new THREE.SphereGeometry(.17,8,6),feet,-.2,.18,.04,[1,.7,1.3]);addMesh(playerMesh,new THREE.SphereGeometry(.17,8,6),feet,.2,.18,.04,[1,.7,1.3]);
  scene.add(playerGroup);
  const label=document.createElement('div');label.className='player-tag';label.textContent=state.name;labels.self=label;$('playerLabels').appendChild(label);
}
function createObjectMesh(o,parent=worldGroup,staticObject=false){
  const group=new THREE.Group();group.position.set(o.x||0,terrainY(o.x||0,o.z||0),o.z||0);group.rotation.y=o.rot||0;group.scale.setScalar(o.scale||1);group.userData.objectId=o.id;group.userData.object=o;
  const body=(geo,color,x,y,z,s=null)=>addMesh(group,geo,mat(color),x,y,z,s);
  const wood=0x9c7658, cream=0xffe8c9, wall=o.color||0xf3d7b8;
  switch(o.type){
    case 'cottage': case 'house': {
      const w=o.type==='house'?2.8:2.4,d=o.type==='house'?2.3:2.1,h=o.type==='house'?2.25:1.7;
      body(new THREE.BoxGeometry(w,h,d),wall,0,h/2,0);
      // gabled roof made from two angled roof planes, not a cube.
      const roofMat=mat(0xc77f83);const roof1=body(new THREE.BoxGeometry(w*.62,.18,d+ .5),0xffffff,-w*.22,h+.42,0);roof1.material=roofMat;roof1.rotation.z=-.56;
      const roof2=body(new THREE.BoxGeometry(w*.62,.18,d+.5),0xffffff,w*.22,h+.42,0);roof2.material=roofMat;roof2.rotation.z=.56;
      body(new THREE.BoxGeometry(.58,1,.09),wood,0,.5,d/2+.045);
      for(const wx of [-.72,.72]){body(new THREE.BoxGeometry(.42,.42,.08),0x9dd5d8,wx,h*.67,d/2+.055);body(new THREE.BoxGeometry(.5,.055,.1),cream,wx,h*.67,d/2+.1);body(new THREE.BoxGeometry(.055,.48,.1),cream,wx,h*.67,d/2+.1)}
      body(new THREE.BoxGeometry(.65,.12,.15),cream,0,h+.06,d/2+.1);
      break}
    case 'tower':{
      body(new THREE.CylinderGeometry(.75,.88,3,8),wall,0,1.5,0);
      body(new THREE.ConeGeometry(1.05,1.35,8),0xb96f83,0,3.65,0);
      for(let i=0;i<4;i++){let a=i*Math.PI/2;body(new THREE.BoxGeometry(.24,.65,.24),cream,Math.cos(a)*.63,2.85,Math.sin(a)*.63)}
      body(new THREE.BoxGeometry(.42,.8,.08),wood,0,.4,.83);break}
    case 'shop':{
      body(new THREE.BoxGeometry(2.8,1.8,2.2),0xf2d4ad,0,.9,0);body(new THREE.BoxGeometry(3,.18,2.5),0xb76e82,0,1.9,0);body(new THREE.BoxGeometry(1.4,.7,.12),0x83b9b7,0,1.05,1.12);body(new THREE.BoxGeometry(2.8,.18,.15),cream,0,1.47,1.2);body(new THREE.BoxGeometry(.5,.9,.1),wood,-.8,.45,1.12);body(new THREE.BoxGeometry(.6,.3,.15),0xd89c76,.8,.5,1.15);break}
    case 'tree':case 'blossom': createTree(group,0,0,0,o.type==='blossom');break;
    case 'flower':for(let i=0;i<7;i++){let a=i*Math.PI*2/7,x=Math.cos(a)*.4,z=Math.sin(a)*.4;body(new THREE.CylinderGeometry(.025,.03,.35,4),0x609768,x,.17,z);body(new THREE.SphereGeometry(.15,6,5),[0xf6b6d0,0xffe7a3,0xe3c8ff][i%3],x,.38,z)}break;
    case 'mushroom':for(let i=0;i<3;i++){let x=(i-1)*.35;body(new THREE.CylinderGeometry(.09,.12,.35,6),0xfff1d9,x,.18,0);body(new THREE.SphereGeometry(.25,8,6),i%2?0xe9919b:0xc4a5df,x,.4,0,[1,.55,1])}break;
    case 'pond':body(new THREE.CylinderGeometry(1.65,1.75,.12,24),0xcbbd9e,0,.03,0);body(new THREE.CircleGeometry(1.48,32),0x72c4ce,0,.1,0).rotation.x=-Math.PI/2;break;
    case 'fountain':body(new THREE.CylinderGeometry(1.2,1.3,.25,20),0xd8d4c8,0,.14,0);body(new THREE.CylinderGeometry(.82,.9,.18,20),0x9fcfcd,0,.32,0);body(new THREE.CylinderGeometry(.18,.25,.65,10),0xe4e2d6,0,.65,0);body(new THREE.SphereGeometry(.2,8,6),0x8cd8d8,0,1.05,0);break;
    case 'bench':body(new THREE.BoxGeometry(1.5,.16,.45),0xc99670,0,.55,0);for(let x of [-.55,.55]){body(new THREE.BoxGeometry(.12,.55,.12),wood,x,.28,0);body(new THREE.BoxGeometry(.12,.65,.12),wood,x,.72,-.15)}break;
    case 'lamp':body(new THREE.CylinderGeometry(.07,.12,2.1,8),wood,0,1,0);body(new THREE.BoxGeometry(.55,.4,.5),0xf8e2a5,0,2.1,0);body(new THREE.SphereGeometry(.34,8,6),0xffe6a4,0,2.1,0);break;
    case 'heart':for(let i=0;i<3;i++){let b=body(new THREE.SphereGeometry(.38,10,8),[0xf3a5c0,0xf7c6d5,0xe6a6cc][i],(i-1)*.55,1.4+Math.abs(i-1)*.25,0,[.8,1.05,.65]);b.rotation.z=Math.PI/4}break;
    case 'crystal':body(new THREE.OctahedronGeometry(.65,0),0x9be1e4,0,.65,0,[.8,1.5,.8]);body(new THREE.OctahedronGeometry(.28,0),0xd9c9ff,.5,.35,.15);break;
    case 'arch':for(let x of [-1,1])body(new THREE.CylinderGeometry(.12,.15,2.2,7),0x9dbf8e,x,1.1,0);body(new THREE.TorusGeometry(1,.13,7,16,Math.PI),0x83b28d,0,2.15,0);for(let i=0;i<8;i++){let a=Math.PI-i*Math.PI/7;body(new THREE.SphereGeometry(.15,6,5),[0xf4bdd0,0xffe6a2,0xd8c4f8][i%3],Math.cos(a),2.15+Math.sin(a),0)}break;
    case 'path':for(let i=0;i<5;i++)body(new THREE.CylinderGeometry(.25,.3,.09,6),0xd6cdb8,(i-2)*.38,.04,Math.sin(i*1.4)*.18);break;
    case 'road':body(new THREE.BoxGeometry(4,.06,1.5),0x9ba9a3,0,.01,0);for(let x of [-1.2,0,1.2])body(new THREE.BoxGeometry(.6,.02,.06),0xf9efcf,x,.05,0);break;
    case 'mailbox':body(new THREE.CylinderGeometry(.06,.08,.7,6),wood,0,.35,0);body(new THREE.BoxGeometry(.48,.4,.35),0xc77f83,0,.8,0);break;
    case 'campfire':body(new THREE.ConeGeometry(.35,.45,5),0xb87655,0,.25,0);body(new THREE.ConeGeometry(.2,.65,5),0xffbb6d,0,.45,0);break;
    case 'gift':body(new THREE.BoxGeometry(.8,.7,.8),0xf0a4bc,0,.35,0);body(new THREE.BoxGeometry(.13,.75,.83),0xffe5a5,0,.37,0);body(new THREE.BoxGeometry(.83,.12,.13),0xffe5a5,0,.37,0);break;
    case 'castlewall':body(new THREE.BoxGeometry(2.5,1.3,.45),0xe6d7c2,0,.65,0);for(let x of [-.9,0,.9])body(new THREE.BoxGeometry(.35,.35,.48),0xe6d7c2,x,1.42,0);break;
    case 'hedge':body(new THREE.BoxGeometry(1.8,.8,.65),0x5d986f,0,.4,0);break;
    default:body(new THREE.BoxGeometry(1,1,1),0x9fcfbd,0,.5,0);
  }
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material?.color&&o.material.color.getHex()===0xffffff)o.material.color.set(o.color||0xffffff)}});
  parent.add(group);if(!staticObject && o.id)objectMeshes.set(o.id,group);
  return group;
}
function bindWorldInput(){
  const canvas=$('world');
  canvas.addEventListener('pointerdown',e=>{pointer.down=true;pointer.x=pointer.lastX=e.clientX;pointer.y=pointer.lastY=e.clientY;canvas.setPointerCapture?.(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!pointer.down)return;const dx=e.clientX-pointer.lastX,dy=e.clientY-pointer.lastY;if(e.pointerType==='mouse'&&e.buttons===2||e.pointerType==='touch'&&Math.abs(dx)+Math.abs(dy)>4){cameraYaw-=dx*.006;cameraPitch=THREE.MathUtils.clamp(cameraPitch+dy*.003,-.2,1.15)}pointer.lastX=e.clientX;pointer.lastY=e.clientY});
  canvas.addEventListener('pointerup',e=>{if(!pointer.down)return;pointer.down=false;const moved=Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y);if(moved<10)handleGroundTap(e.clientX,e.clientY)});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('wheel',e=>{cameraDistance=THREE.MathUtils.clamp(cameraDistance+e.deltaY*.015,7,30)},{passive:true});
  addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key==='Escape'){show($('catalog'),false);show($('chatPanel'),false);show($('settingsModal'),false)}if(e.key.toLowerCase()==='b')setMode('build');if(e.key.toLowerCase()==='e')interactNearby()});
  addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
  // Touch joystick
  const joy=$('joystick'),knob=$('joyKnob');let joyRect;
  const joyStart=e=>{e.preventDefault();joyRect=joy.getBoundingClientRect();joy.setPointerCapture(e.pointerId);joyMove(e)};
  const joyMove=e=>{if(!joy.hasPointerCapture(e.pointerId))return;const dx=e.clientX-(joyRect.left+joyRect.width/2),dy=e.clientY-(joyRect.top+joyRect.height/2),max=31,len=Math.max(1,Math.hypot(dx,dy)),k=Math.min(max,len);knob.style.transform=`translate(${dx/len*k}px,${dy/len*k}px)`;move.x=dx/len*Math.min(1,len/max);move.z=dy/len*Math.min(1,len/max)};
  const joyEnd=e=>{move.x=move.z=0;knob.style.transform='translate(0,0)'};
  joy.addEventListener('pointerdown',joyStart);joy.addEventListener('pointermove',joyMove);joy.addEventListener('pointerup',joyEnd);joy.addEventListener('pointercancel',joyEnd);
  $('interactBtn').addEventListener('click',interactNearby);
}
function handleGroundTap(x,y){
  if(!$('welcome').classList.contains('hidden'))return;
  const rect=renderer.domElement.getBoundingClientRect();const mouse=new THREE.Vector2((x/rect.width)*2-1,-(y/rect.height)*2+1);raycaster.setFromCamera(mouse,camera);
  if(state.mode==='build'||state.mode==='garden'){
    if(!state.selectedItem){toast('Choose a little thing from the catalogue first ✨');show($('catalog'),true);return}
    const hits=raycaster.intersectObject(ground);if(hits.length){placeObject(state.selectedItem,hits[0].point.x,hits[0].point.z);return}
  }
  if(state.mode==='note'){openNote();return}
  const hits=raycaster.intersectObject(ground);if(hits.length){targetPos.set(hits[0].point.x,0,hits[0].point.z);toast('Off we go ✨')}
}
function setMode(mode){
  state.mode=mode;document.querySelectorAll('.dock-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  show($('catalog'),mode==='build'||mode==='garden');show($('chatPanel'),mode==='chat');$('buildHint').classList.toggle('show',mode==='build'||mode==='garden');
  if(mode==='build'||mode==='garden')renderCatalog();if(mode==='note')openNote();if(mode==='emote')doEmote();
  if(mode==='walk'){state.selectedItem=null;toast('Take a little wander 🌿')}
}
function renderCatalog(){
  const grid=$('itemGrid');grid.innerHTML='';
  catalog.filter(it=>(state.category==='all'||it.cat===state.category)).forEach(it=>{
    const b=document.createElement('button');b.className='item-card'+(state.selectedItem===it.id?' selected':'');b.innerHTML=`<span class="item-emoji">${it.emoji}</span><b>${it.name}</b><small>${it.desc}</small>`;
    b.addEventListener('click',()=>{state.selectedItem=it.id;state.mode=it.cat==='garden'?'garden':'build';renderCatalog();createPreview(it.id);toast(`${it.name} selected — tap the ground to place it`)});grid.appendChild(b);
  });
}
function createPreview(type){if(preview){scene.remove(preview);preview=null}preview=createObjectMesh({id:'preview',type,x:0,z:0,rot:0,scale:1,color:'#d5e5c8'},scene,true);preview.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.58;o.material.depthWrite=false}});preview.userData.preview=true}
function placeObject(type,x,z){
  const id=crypto.randomUUID(),obj={id,type,x:Math.round(x*2)/2,z:Math.round(z*2)/2,rot:0,scale:1,color:defaultColor(type),by:state.localId,created:Date.now()};
  commitAction(()=>{state.objects.push(obj);createObjectMesh(obj);state.gardenCount=state.objects.filter(o=>['tree','blossom','flower','mushroom','hedge','arch'].includes(o.type)).length;updateQuest()});
  state.selectedItem=null;if(preview){scene.remove(preview);preview=null}saveWorld();broadcast({type:'object:add',object:obj});toast('A little more ours ✨');playTone(660,.08);
}
function defaultColor(type){return ({cottage:'#f0d6b8',house:'#c7dfd1',tower:'#e8d7c5',shop:'#f2d4ad'})[type]||'#ffffff'}
function commitAction(fn){state.undo.push(JSON.stringify({objects:state.objects,notes:state.notes}));if(state.undo.length>40)state.undo.shift();state.redo=[];fn()}
function undo(){if(!state.undo.length){toast('Nothing to undo yet');return}state.redo.push(JSON.stringify({objects:state.objects,notes:state.notes}));const old=JSON.parse(state.undo.pop());restoreState(old);saveWorld();toast('Undid that little change')}
function restoreState(s){state.objects=s.objects||[];state.notes=s.notes||[];for(const m of objectMeshes.values())worldGroup.remove(m);objectMeshes.clear();state.objects.forEach(o=>createObjectMesh(o));state.gardenCount=state.objects.filter(o=>['tree','blossom','flower','mushroom','hedge','arch'].includes(o.type)).length;updateQuest()}
function updateQuest(){$('gardenCount').textContent=`${Math.min(3,state.gardenCount)}/3`;$('noteCount').textContent=`${state.notes.length?1:0}/1`}
function openNote(){show($('noteModal'),true);$('noteText').focus()}
function saveNote(){
  const text=$('noteText').value.trim();if(!text){toast('Write a little something first 💌');return}
  const n={id:crypto.randomUUID(),text,x:playerPos.x+Math.sin(cameraYaw)*1.6,z:playerPos.z+Math.cos(cameraYaw)*1.6,by:state.localId,author:state.name,created:Date.now()};
  commitAction(()=>{state.notes.push(n);const obj={id:'note-'+n.id,type:'mailbox',x:n.x,z:n.z,rot:0,scale:.7};createObjectMesh(obj);objectMeshes.set(obj.id,objectMeshes.get(obj.id));});
  show($('noteModal'),false);$('noteText').value='';updateQuest();saveWorld();broadcast({type:'note:add',note:n});toast('Your little note is tucked into the world 💌');playTone(780,.12)
}
function doEmote(){const emotes=['👋','♡','✨','💃','🫶','🌸'];const e=emotes[Math.floor(Math.random()*emotes.length)];floatEmote(playerPos.x,playerPos.z,e);broadcast({type:'emote',emote:e,x:playerPos.x,z:playerPos.z});toast(({ '👋':'A little wave for your person','♡':'Sending a heart','✨':'A little sparkle','💃':'Tiny dance break','🫶':'All the love','🌸':'A flower just because'})[e]);playTone(520,.07)}
function floatEmote(x,z,emoji){const d=document.createElement('div');d.textContent=emoji;d.style.cssText='position:absolute;z-index:6;font-size:32px;pointer-events:none;transition:transform 1.5s,opacity 1.5s';$('app').appendChild(d);const p=project(new THREE.Vector3(x,2.4,z));d.style.left=p.x+'px';d.style.top=p.y+'px';requestAnimationFrame(()=>{d.style.transform='translateY(-65px) scale(1.4)';d.style.opacity='0'});setTimeout(()=>d.remove(),1600)}
function project(v){v.project(camera);return{x:(v.x+1)*innerWidth/2,y:(-v.y+1)*innerHeight/2}}
function interactNearby(){
  let nearest=null,dist=3.3;for(const o of state.objects){let d=Math.hypot(o.x-playerPos.x,o.z-playerPos.z);if(d<dist){dist=d;nearest=o}}
  if(nearest){if(nearest.type==='lamp'){nearest.lit=!nearest.lit;toast(nearest.lit?'The lamp glows warmly ✨':'Lamp switched off');}else if(nearest.type==='bench'){playerMesh.rotation.x=-.15;toast('Taking a little rest ☁️')}else if(nearest.type==='fountain'){floatEmote(nearest.x,nearest.z,'💧');toast('Make a tiny wish');}else if(nearest.type==='gift'){toast('A little surprise, just for you 🎁')}else{toast(`${catalog.find(i=>i.id===nearest.type)?.name||'This little thing'} is part of your world ♡`)}}
  else if(state.notes.length){const n=state.notes.reduce((a,b)=>Math.hypot(a.x-playerPos.x,a.z-playerPos.z)<Math.hypot(b.x-playerPos.x,b.z-playerPos.z)?a:b);if(Math.hypot(n.x-playerPos.x,n.z-playerPos.z)<5){toast(`${n.author}: “${n.text}”`);return}toast('Wander closer to something to interact with ✨')}else toast('Wander closer to something to interact with ✨')
}
function applyAtmosphere(v){state.atmosphere=v;const c=COLORS[v]||COLORS.day;scene.background.setHex(c.sky);scene.fog.color.setHex(c.fog);scene.children.forEach(o=>{if(o.isHemisphereLight){o.color.setHex(c.hemi)} });if(scene.userData.sun){scene.userData.sun.color.setHex(c.sun);scene.userData.sun.intensity=c.intensity}scene.traverse(o=>{if(o.userData.object?.type==='lamp'){o.traverse(m=>{if(m.isMesh&&m.geometry.type==='SphereGeometry')m.material.color.setHex(v==='night'?0xffd67d:0xffe6a4)})}})}
function animate(){
  requestAnimationFrame(animate);if(!renderer)return;const dt=Math.min(clock.getDelta(),.05),time=clock.elapsedTime;
  // Keyboard and joystick locomotion.
  let mx=move.x+(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),mz=move.z+(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);const len=Math.hypot(mx,mz);if(len>1){mx/=len;mz/=len}
  const speed=5.3;const dx=(mx*Math.cos(cameraYaw)+mz*Math.sin(cameraYaw))*speed*dt,dz=(mz*Math.cos(cameraYaw)-mx*Math.sin(cameraYaw))*speed*dt;
  if(len>.08){playerPos.x+=dx;playerPos.z+=dz;targetPos.copy(playerPos);playerMesh.rotation.y=Math.atan2(dx,dz);playerMesh.position.y=Math.abs(Math.sin(time*9))*.07}
  else {playerMesh.position.y=Math.sin(time*2.1)*.025}
  playerGroup.position.set(playerPos.x,terrainY(playerPos.x,playerPos.z),playerPos.z);
  const camX=playerPos.x+Math.sin(cameraYaw)*cameraDistance*Math.cos(cameraPitch),camZ=playerPos.z+Math.cos(cameraYaw)*cameraDistance*Math.cos(cameraPitch),camY=playerPos.y+cameraDistance*Math.sin(cameraPitch)+3.2;
  camera.position.lerp(new THREE.Vector3(camX,camY,camZ),.08);camera.lookAt(playerPos.x,playerPos.y+1,playerPos.z);
  scene.children.forEach(o=>{if(o.userData.cloud){o.position.x+=dt*o.userData.speed;if(o.position.x>50)o.position.x=-50}});
  if(preview&&state.selectedItem){const p=preview.position;p.set(playerPos.x+Math.sin(cameraYaw)*2,terrainY(playerPos.x+Math.sin(cameraYaw)*2,playerPos.z+Math.cos(cameraYaw)*2),playerPos.z+Math.cos(cameraYaw)*2);preview.rotation.y=Math.sin(time*.7)*.15}
  updateLabels();if(state.isOnline&&time-state.lastBroadcast>0.07){state.lastBroadcast=time;broadcast({type:'player:move',id:state.localId,name:state.name,x:playerPos.x,z:playerPos.z,rot:playerMesh.rotation.y})}
  renderer.render(scene,camera);
}
function updateLabels(){if(labels.self){const p=project(new THREE.Vector3(playerPos.x,playerPos.y+2.5,playerPos.z));labels.self.style.left=p.x+'px';labels.self.style.top=p.y+'px'}for(const [id,p] of state.players){let label=labels[id];if(!label)continue;const q=project(new THREE.Vector3(p.x,terrainY(p.x,p.z)+2.5,p.z));label.style.left=q.x+'px';label.style.top=q.y+'px'}}
function onResize(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);tuneQuality()}
function playTone(freq=600,duration=.08){if(!state.sound||state.muted)return;try{audioCtx ||= new AudioContext();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(.035,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration)}catch{}}
function broadcast(payload){if(!state.channel||!state.isOnline)return;state.channel.send({type:'broadcast',event:'world',payload:{...payload,from:state.localId,at:Date.now()}}).catch(()=>{})}
async function connectRoom(code,create=false){
  if(!supabase){toast('Online play needs Supabase setup — local play is ready');return false}
  setStatus('Connecting…',false);
  try{
    const {data:authData,error:authErr}=await supabase.auth.getSession();if(authErr)throw authErr;
    if(!authData.session){const {error}=await supabase.auth.signInAnonymously();if(error)throw error}
    const rpcName=create?'create_world':'join_world';const args=create?{p_name:state.worldName}:{p_code:code.toUpperCase(),p_name:state.name};
    const {data,error}=await supabase.rpc(rpcName,args);if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error('The world service returned no room.');
    state.roomId=row.world_id||row.id;state.roomCode=row.room_code||row.code||code;state.memberId=row.member_id||null;state.isOnline=true;
    $('roomPill').textContent=state.roomCode;$('setupNote').textContent='Connected to a shared world. Your changes sync to room members.';
    const {data:worldData,error:loadErr}=await supabase.rpc('load_world',{p_world_id:state.roomId});if(loadErr)throw loadErr;
    const saved=Array.isArray(worldData)?worldData[0]:worldData;if(saved?.world_state)applyRemoteState(saved.world_state);
    await subscribeRoom();setStatus('Online together',true);toast(create?`Your private world code is ${state.roomCode}`:'You joined the world ✨');return true;
  }catch(err){state.isOnline=false;setStatus('Local world',false);$('setupNote').textContent=`Online connection failed: ${err.message}. Local play still works.`;toast('Could not connect: '+err.message);return false}
}
async function subscribeRoom(){
  if(state.channel)await supabase.removeChannel(state.channel);
  state.channel=supabase.channel('world-'+state.roomId,{config:{broadcast:{self:false}}});
  state.channel.on('broadcast',{event:'world'},({payload})=>handleRemote(payload));
  state.channel.subscribe(status=>{if(status==='SUBSCRIBED'){setStatus('Online together',true);broadcast({type:'player:join',id:state.localId,name:state.name,x:playerPos.x,z:playerPos.z})}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setStatus('Reconnecting…',false)});
  // Snapshot presence for online list.
  state.channel.on('presence',{event:'sync'},()=>{const all=state.channel.presenceState();let count=1;for(const k in all)count+=all[k].length;$('onlineCount').textContent=`${count} here`});
  await state.channel.track({id:state.localId,name:state.name,joined:Date.now()});
}
function handleRemote(p){
  if(!p||p.from===state.localId)return;
  if(p.type==='player:move'){let pl=state.players.get(p.id);if(!pl){pl={id:p.id,name:p.name||'Friend',x:p.x,z:p.z,rot:p.rot||0};state.players.set(p.id,pl);const g=makeOther(pl);otherMeshes.set(p.id,g);const l=document.createElement('div');l.className='player-tag';l.textContent=pl.name;labels[p.id]=l;$('playerLabels').appendChild(l);toast(`${pl.name} is here ♡`)}else{pl.x=p.x;pl.z=p.z;pl.rot=p.rot||0}const g=otherMeshes.get(p.id);if(g){g.position.set(p.x,terrainY(p.x,p.z),p.z);g.rotation.y=p.rot||0}}
  if(p.type==='player:join')toast(`${p.name||'Your person'} joined the world ✨`);
  if(p.type==='player:leave'){const g=otherMeshes.get(p.id);if(g)scene.remove(g);otherMeshes.delete(p.id);state.players.delete(p.id);labels[p.id]?.remove();delete labels[p.id];toast(`${p.name||'Your person'} wandered off for now`)}
  if(p.type==='object:add'){if(!state.objects.some(o=>o.id===p.object.id)){state.objects.push(p.object);createObjectMesh(p.object);updateQuest();toast('Your person added something lovely ✨')}}
  if(p.type==='object:remove'){state.objects=state.objects.filter(o=>o.id!==p.id);const m=objectMeshes.get(p.id);if(m)worldGroup.remove(m);objectMeshes.delete(p.id)}
  if(p.type==='note:add'&&!state.notes.some(n=>n.id===p.note.id)){state.notes.push(p.note);createObjectMesh({id:'note-'+p.note.id,type:'mailbox',x:p.note.x,z:p.note.z,scale:.7});updateQuest();toast('A little note appeared 💌')}
  if(p.type==='chat'){addMessage(p.message,false);state.chat.push(p.message);$('unreadDot').classList.add('on');playTone(700,.06)}
  if(p.type==='emote')floatEmote(p.x,p.z,p.emote);
}
function makeOther(pl){const g=new THREE.Group();const body=addMesh(g,new THREE.CapsuleGeometry(.36,.55,4,8),mat(0xaec9e6),0,.72,0);addMesh(g,new THREE.SphereGeometry(.32,12,10),mat(0xf1cfb0),0,1.35,0);addMesh(g,new THREE.SphereGeometry(.35,10,8),mat(0x6a5c50),0,1.52,-.04,[1,.55,1]);addMesh(g,new THREE.SphereGeometry(.045,6,6),mat(0x3f5148),-.11,1.36,.285);addMesh(g,new THREE.SphereGeometry(.045,6,6),mat(0x3f5148),.11,1.36,.285);scene.add(g);g.position.set(pl.x,terrainY(pl.x,pl.z),pl.z);return g}
async function saveWorld(){
  if(!state.isOnline||!supabase||!state.roomId)return;
  clearTimeout(state.saveTimer);state.saveTimer=setTimeout(async()=>{
    try{const payload={name:state.worldName,atmosphere:state.atmosphere,objects:state.objects,notes:state.notes};const {error}=await supabase.rpc('save_world',{p_world_id:state.roomId,p_world_state:payload});if(error)throw error;state.lastSave=Date.now();setStatus('Saved together',true)}catch(e){setStatus('Save failed',false);toast('Could not save online. Check your connection.')}
  },450);
}
function applyRemoteState(s){if(!s)return;state.worldName=s.name||state.worldName;state.atmosphere=s.atmosphere||'day';$('worldNameInput').value=state.worldName;$('atmosphereSelect').value=state.atmosphere;restoreState({objects:s.objects||[],notes:s.notes||[]});applyAtmosphere(state.atmosphere)}
async function sendChat(text){
  const message={id:crypto.randomUUID(),author:state.name,text,at:Date.now(),by:state.localId};addMessage(message,true);state.chat.push(message);
  if(state.isOnline){broadcast({type:'chat',message});if(supabase){try{const {error}=await supabase.rpc('send_chat',{p_world_id:state.roomId,p_text:text});if(error)throw error}catch(e){toast('Message shown locally, but could not persist online.')}}}
}
function addMessage(m,mine){
  const list=$('chatMessages');list.querySelector('.empty-chat')?.remove();const div=document.createElement('div');div.className='message'+(mine?' mine':'');const time=new Date(m.at||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});const b=document.createElement('b');b.textContent=m.author||'Dreamer';const p=document.createElement('p');p.textContent=m.text;const t=document.createElement('time');t.textContent=time;div.append(b,p,t);list.appendChild(div);list.scrollTop=list.scrollHeight;
}
function startGame(){state.name=$('playerName').value.trim().slice(0,18)||'Dreamer';labels.self.textContent=state.name;$('welcome').classList.add('hidden');$('hintPill').textContent=innerWidth<700?'Use the joystick to wander · tap the ground to move':'WASD to wander · tap the ground to move · B to build · E to interact';setStatus(state.isOnline?'Online together':'Local world',state.isOnline);playTone(480,.1)}
function newLocalWorld(){state.roomId=null;state.isOnline=false;state.roomCode='DREAMLAND';state.objects=[];state.notes=[];restoreState({objects:[],notes:[]});$('roomPill').textContent='DREAMLAND';startGame();toast('Welcome to your little universe 🌿')}
function initUI(){
  document.querySelectorAll('.dock-btn').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  document.querySelectorAll('.cat-tab').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.cat;document.querySelectorAll('.cat-tab').forEach(x=>x.classList.toggle('selected',x===b));renderCatalog()}));
  $('soloBtn').addEventListener('click',newLocalWorld);
  $('createBtn').addEventListener('click',async()=>{state.name=$('playerName').value.trim()||'Dreamer';state.worldName='Dreamland';if(await connectRoom('',true))startGame()});
  $('joinBtn').addEventListener('click',async()=>{const code=$('roomCodeInput').value.trim();if(code.length<4){toast('Enter the room code your person shared');return}state.name=$('playerName').value.trim()||'Dreamer';if(await connectRoom(code,false))startGame()});
  $('homeBtn').addEventListener('click',()=>{$('welcome').classList.remove('hidden');show($('catalog'),false);show($('chatPanel'),false)});
  $('closeCatalog').addEventListener('click',()=>{show($('catalog'),false);state.selectedItem=null;if(preview){scene.remove(preview);preview=null}});
  $('closeChat').addEventListener('click',()=>show($('chatPanel'),false));
  $('chatForm').addEventListener('submit',e=>{e.preventDefault();const text=$('chatInput').value.trim();if(!text)return;$('chatInput').value='';sendChat(text)});
  $('closeNote').addEventListener('click',()=>show($('noteModal'),false));$('cancelNote').addEventListener('click',()=>show($('noteModal'),false));$('saveNote').addEventListener('click',saveNote);
  $('settingsBtn').addEventListener('click',()=>show($('settingsModal'),true));$('closeSettings').addEventListener('click',()=>show($('settingsModal'),false));
  $('timeBtn').addEventListener('click',()=>{const modes=['day','sunset','twilight','night'];const i=(modes.indexOf(state.atmosphere)+1)%modes.length;applyAtmosphere(modes[i]);$('atmosphereSelect').value=modes[i];saveWorld();toast(({day:'Minty morning 🌿',sunset:'Peachy sunset 🍑',twilight:'Dreamy twilight ✨',night:'Firefly night 🌙'})[modes[i]])});
  $('soundBtn').addEventListener('click',()=>{state.sound=!state.sound;$('soundBtn').style.opacity=state.sound?'1':'.45';toast(state.sound?'Sound effects on ♫':'Sound effects muted')});
  $('hideQuest').addEventListener('click',()=>$('questPanel').classList.toggle('hidden'));
  $('saveSettings').addEventListener('click',()=>{state.worldName=$('worldNameInput').value.trim()||'Dreamland';$('roomPill').textContent=state.roomCode==='DREAMLAND'?state.worldName.toUpperCase().slice(0,12):state.roomCode;applyAtmosphere($('atmosphereSelect').value);state.quality=$('qualitySelect').value;state.sound=$('soundToggle').checked;tuneQuality();saveWorld();show($('settingsModal'),false);toast('Your world, your atmosphere ✨')});
  $('exportBtn').addEventListener('click',()=>{const data={app:'OUR WORLD',version:1,worldName:state.worldName,atmosphere:state.atmosphere,objects:state.objects,notes:state.notes};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='our-world-backup.json';a.click();URL.revokeObjectURL(a.href);toast('Backup exported ✨')});
  $('importInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const s=JSON.parse(await f.text());if(!Array.isArray(s.objects)||!Array.isArray(s.notes))throw Error('This does not look like an OUR WORLD backup');if(!confirm('Import this backup and replace the current local world?'))return;state.worldName=s.worldName||'Dreamland';state.atmosphere=s.atmosphere||'day';restoreState(s);applyAtmosphere(state.atmosphere);saveWorld();toast('Your backup is home again ♡')}catch(err){toast(err.message)}e.target.value=''});
  // Import is available from the settings via long-press the export action.
  $('exportBtn').addEventListener('contextmenu',e=>{e.preventDefault();$('importInput').click()});
}
init3D();initUI();renderCatalog();
