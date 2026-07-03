import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ─────────────────────────────────────────────────────────────────────────────
// Mundo: Circunvalação (Porto) em low-poly
//   Eixos: +x = Este, -x = Oeste, -z = Norte, +z = Sul
//   Rotunda da AEP em x=-380 · Fábrica Monteiro Ribas em x=0 (lado norte)
//   Cruzamento do Amial em x=+320
// ─────────────────────────────────────────────────────────────────────────────

const ROAD_Y = 0.02;
const MARK_Y = 0.045;

const PALETTE = {
  grass:    '#79b45d',
  grassDim: '#6da452',
  asphalt:  '#3d3d44',
  asphalt2: '#46464d',
  kerb:     '#8d8d94',
  white:    '#f2f2f2',
  factory:  '#d8d3c6',
  factory2: '#b9b2a0',
  brick:    '#a4553d',
  building: ['#e8d8c3', '#d9b8a2', '#c9d2d8', '#e6e2d3', '#b8c4b0', '#d8c8e0', '#e0c9a8'],
  carPaint: ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#7f8c8d', '#27ae60', '#34495e', '#e67e22'],
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.0, ...opts });
}

export function buildWorld(scene, physics) {
  const statics = new THREE.Group();
  scene.add(statics);

  const addStaticBox = (x, y, z, w, h, d, yaw = 0) => {
    const body = new CANNON.Body({ type: CANNON.Body.STATIC });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
    body.position.set(x, y, z);
    body.quaternion.setFromEuler(0, yaw, 0);
    physics.addBody(body);
    return body;
  };

  // ── Chão (relvado do parque) ───────────────────────────────────────────────
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 500), mat(PALETTE.grass));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-20, 0, -20);
  ground.receiveShadow = true;
  statics.add(ground);

  const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC });
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  physics.addBody(groundBody);

  // ── Estrada principal (Circunvalação, 2 faixas por sentido) ───────────────
  const addFlat = (x, z, w, d, color, y = ROAD_Y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    statics.add(m);
    return m;
  };

  addFlat(-5, 0, 710, 16, PALETTE.asphalt);                 // reta principal x∈[-360,350]
  addFlat(320, 0, 8, 250, PALETTE.asphalt, ROAD_Y - 0.004); // rua do Amial (perpendicular)
  addFlat(-62, -23, 118, 27, PALETTE.asphalt2);             // parque de estacionamento (x∈[-121,-3])

  // Rotunda da AEP: disco de asfalto + ilha central
  const disc = new THREE.Mesh(new THREE.CircleGeometry(28, 48), mat(PALETTE.asphalt));
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(-380, ROAD_Y + 0.002, 0);
  disc.receiveShadow = true;
  statics.add(disc);

  const island = new THREE.Mesh(new THREE.CircleGeometry(13, 40), mat(PALETTE.grassDim));
  island.rotation.x = -Math.PI / 2;
  island.position.set(-380, ROAD_Y + 0.02, 0);
  island.receiveShadow = true;
  statics.add(island);

  const islandKerb = new THREE.Mesh(new THREE.RingGeometry(12.8, 14, 40), mat(PALETTE.kerb));
  islandKerb.rotation.x = -Math.PI / 2;
  islandKerb.position.set(-380, ROAD_Y + 0.015, 0);
  statics.add(islandKerb);

  const islandBody = new CANNON.Body({ type: CANNON.Body.STATIC });
  islandBody.addShape(new CANNON.Cylinder(13, 13, 2, 16));
  islandBody.position.set(-380, 1, 0);
  physics.addBody(islandBody);

  // Monumento da rotunda (estilizado)
  const monument = new THREE.Mesh(new THREE.ConeGeometry(2.6, 17, 4), mat('#f4f4f0', { roughness: 0.5 }));
  monument.position.set(-380, 8.5 + ROAD_Y, 0);
  monument.castShadow = true;
  statics.add(monument);

  // Saída poente da rotunda (decorativa)
  addFlat(-433, 0, 50, 12, PALETTE.asphalt, ROAD_Y - 0.004);

  // ── Separador central (com aberturas no Amial e junto à rotunda) ──────────
  // Apenas visual (sem colisão): um lancil baixo (0.26m) travava o carro por
  // completo ao ser tocado, o que fazia parecer "perda de controlo" sempre que
  // se desviava ligeiramente do centro da via numa curva a alta velocidade.
  const kerbGeoCache = new Map();
  const addKerb = (x, z, len, alongX = true) => {
    const key = `${len}|${alongX}`;
    if (!kerbGeoCache.has(key)) {
      kerbGeoCache.set(key, new THREE.BoxGeometry(alongX ? len : 2, 0.26, alongX ? 2 : len));
    }
    const m = new THREE.Mesh(kerbGeoCache.get(key), mat(PALETTE.kerb));
    m.position.set(x, 0.13, z);
    m.castShadow = true;
    m.receiveShadow = true;
    statics.add(m);
  };
  addKerb(-21, 0, 658);   // x∈[-350, 308]
  addKerb(338, 0, 12);    // retoma depois do cruzamento

  // ── Marcações rodoviárias ──────────────────────────────────────────────────
  const dashGeo = new THREE.BoxGeometry(3, 0.02, 0.16);
  const dashMat = mat(PALETTE.white, { roughness: 0.6 });
  const dashes = [];
  for (let x = -348; x <= 304; x += 9) {
    dashes.push([x, -4.5, 0], [x, 4.5, 0]);
  }
  for (let z = -116; z <= 116; z += 9) {
    if (Math.abs(z) < 12) continue;
    dashes.push([320, z, Math.PI / 2]);
  }
  for (let i = 0; i < 26; i++) { // faixa da rotunda
    const a = (i / 26) * Math.PI * 2;
    dashes.push([-380 + Math.cos(a) * 20.5, Math.sin(a) * 20.5, -a + Math.PI / 2]);
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const dummy = new THREE.Object3D();
  dashes.forEach(([x, z, yaw], i) => {
    dummy.position.set(x, MARK_Y, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.updateMatrix();
    dashMesh.setMatrixAt(i, dummy.matrix);
  });
  statics.add(dashMesh);

  // Linhas contínuas nas bermas
  [[-7.85], [-1.25], [1.25], [7.85]].forEach(([z]) => {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(700, 0.16), dashMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(-5, MARK_Y, z);
    statics.add(line);
  });

  // ── Fábrica Monteiro Ribas (lado norte, x≈0) ──────────────────────────────
  const factory = (x, z, w, h, d, color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    statics.add(m);
    addStaticBox(x, h / 2, z, w, h, d);
    return m;
  };
  factory(0, -58, 78, 11, 26, PALETTE.factory);    // nave principal
  factory(30, -40, 26, 7, 10, PALETTE.factory2);   // edifício de escritórios
  factory(-48, -52, 20, 8, 16, PALETTE.factory2);  // armazém

  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 24, 12), mat(PALETTE.brick));
  chimney.position.set(-32, 12, -62);
  chimney.castShadow = true;
  statics.add(chimney);
  addStaticBox(-32, 12, -62, 4, 24, 4);

  // Letreiro "MONTEIRO RIBAS"
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024; signCanvas.height = 128;
  const sctx = signCanvas.getContext('2d');
  sctx.fillStyle = '#0d4f36'; sctx.fillRect(0, 0, 1024, 128);
  sctx.fillStyle = '#ffffff';
  sctx.font = 'bold 84px Arial';
  sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
  sctx.fillText('MONTEIRO RIBAS', 512, 68);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 4.5),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  sign.position.set(0, 9, -44.9);
  statics.add(sign);

  // Lugares pintados + carros estacionados
  const stallMat = mat(PALETTE.white, { roughness: 0.6 });
  for (let i = 0; i <= 14; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 5.5), stallMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(-112 + i * 6, ROAD_Y + 0.01, -30);
    statics.add(line);
  }
  const parkedBody = new THREE.BoxGeometry(2.2, 1.0, 4.6);
  const parkedCabin = new THREE.BoxGeometry(1.9, 0.7, 2.2);
  for (let i = 0; i < 10; i++) {
    if (i === 4 || i === 5) continue; // lugares livres perto do jogador
    const x = -109 + i * 6;
    const color = PALETTE.carPaint[i % PALETTE.carPaint.length];
    const b = new THREE.Mesh(parkedBody, mat(color, { roughness: 0.4, metalness: 0.3 }));
    b.position.set(x, 0.5, -30);
    b.castShadow = true;
    statics.add(b);
    const c = new THREE.Mesh(parkedCabin, mat('#20242a', { roughness: 0.2, metalness: 0.4 }));
    c.position.set(x, 1.2, -30.3);
    statics.add(c);
    addStaticBox(x, 0.8, -30, 2.2, 1.6, 4.6);
  }

  // ── Cidade (edifícios ao longo da Circunvalação) ──────────────────────────
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  const cityBuilding = (x, z, alongX = true) => {
    const w = 10 + rand() * 9;
    const d = 10 + rand() * 5;
    const h = 7 + rand() * 17;
    const color = PALETTE.building[Math.floor(rand() * PALETTE.building.length)];
    factory(x, z + (alongX ? (z > 0 ? d / 2 : -d / 2) : 0), w, h, d, color);
  };
  for (let x = -352; x < 345; x += 20 + rand() * 8) {
    if (rand() > 0.14) cityBuilding(x, 16);            // lado sul, contínuo
  }
  for (let x = 64; x < 345; x += 20 + rand() * 8) {
    if (rand() > 0.2) cityBuilding(x, -16);            // lado norte, a nascente da fábrica
  }
  for (const z of [-40, -70, 40, 70]) {                // rua do Amial
    factory(304, z, 12, 8 + rand() * 10, 14, PALETTE.building[Math.floor(rand() * 7)]);
    factory(336, z, 12, 8 + rand() * 10, 14, PALETTE.building[Math.floor(rand() * 7)]);
  }

  // ── Semáforos no cruzamento do Amial ──────────────────────────────────────
  const lightPole = (x, z) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.4, 8), mat('#2f3338'));
    pole.position.set(x, 2.2, z);
    pole.castShadow = true;
    statics.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.35), mat('#1c1f23'));
    head.position.set(x, 4.4, z);
    statics.add(head);
    ['#ff3b30', '#ffcc00', '#34c759'].forEach((c, i) => {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 8, 8),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i === 2 ? 1.4 : 0.12 })
      );
      lamp.position.set(x, 4.8 - i * 0.4, z + 0.18);
      statics.add(lamp);
    });
  };
  lightPole(313, -10); lightPole(327, -10); lightPole(313, 10); lightPole(327, 10);

  // ── Árvores (parque + separador central) ──────────────────────────────────
  const treePos = [];
  for (let i = 0; i < 170; i++) { // parque a norte/poente
    const x = -360 + rand() * 250;
    const z = -14 - rand() * 110;
    if (x > -130 && x > -130 && z > -46) continue; // não invadir o estacionamento
    treePos.push([x, z, 0.8 + rand() * 0.9]);
  }
  for (let i = 0; i < 40; i++) { // em volta da rotunda
    const a = rand() * Math.PI * 2;
    const r = 34 + rand() * 42;
    treePos.push([-380 + Math.cos(a) * r, Math.sin(a) * r, 0.7 + rand() * 0.7]);
  }
  for (let x = -330; x < 300; x += 42) treePos.push([x, 0, 0.55]); // separador
  for (let i = 0; i < 30; i++) treePos.push([60 + rand() * 260, -50 - rand() * 60, 0.8 + rand() * 0.8]);

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 1.7, 6);
  const canopyGeo = new THREE.IcosahedronGeometry(1.9, 0);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, mat('#7a5230'), treePos.length);
  const canopyMesh = new THREE.InstancedMesh(canopyGeo, mat('#4e8f3a'), treePos.length);
  canopyMesh.castShadow = true;
  const cColor = new THREE.Color();
  treePos.forEach(([x, z, s], i) => {
    dummy.position.set(x, 0.85 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.y = (1.7 + 1.2) * s;
    dummy.updateMatrix();
    canopyMesh.setMatrixAt(i, dummy.matrix);
    canopyMesh.setColorAt(i, cColor.setHSL(0.29 + rand() * 0.06, 0.55, 0.32 + rand() * 0.14));
  });
  statics.add(trunkMesh, canopyMesh);

  // ── Nuvens ────────────────────────────────────────────────────────────────
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), cloudMat);
    cloud.scale.set(9 + rand() * 12, 2.2, 5 + rand() * 5);
    cloud.position.set(-450 + rand() * 900, 65 + rand() * 30, -180 + rand() * 300);
    statics.add(cloud);
  }

  // ── Paredes-limite invisíveis ─────────────────────────────────────────────
  addStaticBox(-490, 3, 0, 4, 6, 500);
  addStaticBox(470, 3, 0, 4, 6, 500);
  addStaticBox(-20, 3, -150, 1000, 6, 4);
  addStaticBox(-20, 3, 140, 1000, 6, 4);

  // ── Checkpoints (percurso real: fábrica → AEP → fábrica → Amial → fábrica) ─
  // heading: yaw em que forward mundial = (sin, 0, cos)
  const W = -Math.PI / 2, E = Math.PI / 2, S = 0, N = Math.PI;
  const checkpoints = [
    { x: -150, z: -4.5,  heading: W, r: 9,  label: 'Circunvalação · sentido poente' },
    { x: -380, z: -20.5, heading: W, r: 8,  label: 'Rotunda da AEP' },
    { x: -400.5, z: 0,   heading: S, r: 8,  label: 'Rotunda da AEP · volta' },
    { x: -380, z: 20.5,  heading: E, r: 8,  label: 'Saída da rotunda' },
    { x: -150, z: 4.5,   heading: E, r: 9,  label: 'Sentido nascente' },
    { x: 150,  z: 4.5,   heading: E, r: 9,  label: 'Passagem pela fábrica' },
    { x: 320,  z: 2,     heading: E, r: 10, label: 'Cruzamento do Amial · inverter' },
    { x: 150,  z: -4.5,  heading: W, r: 9,  label: 'Regresso' },
    { x: -55,  z: -21,   heading: W, r: 9,  label: 'META · Parque Monteiro Ribas', finish: true },
  ];

  // Portais visuais
  const gateMat = new THREE.MeshStandardMaterial({
    color: '#00d2ff', emissive: '#00d2ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.9,
  });
  const finishMat = new THREE.MeshStandardMaterial({
    color: '#ffcc00', emissive: '#ffcc00', emissiveIntensity: 0.8,
  });
  checkpoints.forEach((cp) => {
    const g = new THREE.Group();
    const m = cp.finish ? finishMat : gateMat.clone();
    const half = cp.r * 0.62;
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 5.4, 10), m);
      pylon.position.set(side * half, 2.7, 0);
      pylon.castShadow = true;
      g.add(pylon);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.6, 0.4, 0.4), m);
    bar.position.y = 5.4;
    g.add(bar);
    if (cp.finish) {
      const bannerCanvas = document.createElement('canvas');
      bannerCanvas.width = 512; bannerCanvas.height = 96;
      const bctx = bannerCanvas.getContext('2d');
      bctx.fillStyle = '#111'; bctx.fillRect(0, 0, 512, 96);
      bctx.fillStyle = '#ffcc00'; bctx.font = 'bold 64px Arial';
      bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
      bctx.fillText('M E T A', 256, 52);
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(half * 2, 1.8),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bannerCanvas), side: THREE.DoubleSide })
      );
      banner.position.y = 4.4;
      g.add(banner);
    }
    g.position.set(cp.x, 0, cp.z);
    g.rotation.y = cp.heading;
    g.visible = false;
    scene.add(g);
    cp.gate = g;
    cp.mat = m;
  });

  return { checkpoints };
}

export const SPAWN = { x: -85, z: -21, heading: -Math.PI / 2 };
