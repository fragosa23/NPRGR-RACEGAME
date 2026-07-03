import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { buildWorld, SPAWN } from './World.js';
import { Car } from './Car.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.state = 'loading'; // loading → menu → countdown → race → finished
    this.keys = {};
    this.currentCp = 0;
    this.raceTime = 0;
    this.bestTime = Number(localStorage.getItem('nprgr-best')) || null;
    this.init();
  }

  async init() {
    // ── Renderer / cena ──────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    $('game-container').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#9fd4f5');
    this.scene.fog = new THREE.Fog('#9fd4f5', 140, 620);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);

    this.scene.add(new THREE.HemisphereLight('#cfe8ff', '#6f9b57', 0.75));
    this.sun = new THREE.DirectionalLight('#fff4e0', 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.camera.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target);

    // ── Física ───────────────────────────────────────────────────────────────
    this.physics = new CANNON.World({ gravity: new CANNON.Vec3(0, -10, 0) });
    this.physics.broadphase = new CANNON.SAPBroadphase(this.physics);
    this.physics.defaultContactMaterial.friction = 0.3;

    // ── Mundo + carro ────────────────────────────────────────────────────────
    const { checkpoints } = buildWorld(this.scene, this.physics);
    this.checkpoints = checkpoints;
    this.car = await Car.load(this.scene, this.physics);
    this.respawn = { x: SPAWN.x, z: SPAWN.z, heading: SPAWN.heading };
    this.car.reset(SPAWN.x, SPAWN.z, SPAWN.heading);

    // seta indicadora do próximo checkpoint
    this.arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 1.1, 4),
      new THREE.MeshStandardMaterial({ color: '#00d2ff', emissive: '#00d2ff', emissiveIntensity: 0.8 })
    );
    this.arrow.rotation.x = Math.PI / 2;
    this.arrowPivot = new THREE.Group();
    this.arrowPivot.add(this.arrow);
    this.arrow.position.z = 1.4;
    this.scene.add(this.arrowPivot);

    // ── Input ────────────────────────────────────────────────────────────────
    const keymap = {
      ArrowUp: 'forward', w: 'forward', W: 'forward',
      ArrowDown: 'backward', s: 'backward', S: 'backward',
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
      ' ': 'brake',
    };
    window.addEventListener('keydown', (e) => {
      if (keymap[e.key]) { this.car.input[keymap[e.key]] = true; e.preventDefault(); }
      if (e.key === 'r' || e.key === 'R') this.resetCar();
      if (e.key === 'Enter') this.onEnter();
    });
    window.addEventListener('keyup', (e) => {
      if (keymap[e.key]) this.car.input[keymap[e.key]] = false;
    });
    // ao mudar de separador/janela o browser nem sempre envia o keyup — sem
    // isto o carro ficava a acelerar ou a virar sozinho ao voltar ao jogo
    const releaseAllInputs = () => {
      for (const k of Object.keys(this.car.input)) this.car.input[k] = false;
    };
    window.addEventListener('blur', releaseAllInputs);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) releaseAllInputs();
    });
    $('start-btn').addEventListener('click', () => this.onEnter());
    window.addEventListener('resize', () => this.onResize());
    this.setupTouch();

    // ── Minimapa ─────────────────────────────────────────────────────────────
    this.minimap = $('minimap').getContext('2d');

    this.setState('menu');
    this.clock = new THREE.Clock();
    this.snapCamera();
    this.renderer.setAnimationLoop(() => this.tick());

    window.__game = this; // hook de depuração/testes
  }

  setupTouch() {
    if (!('ontouchstart' in window)) return;
    $('touch-controls').classList.remove('hidden');
    const bind = (id, key) => {
      const el = $(id);
      const on = (e) => { e.preventDefault(); this.car.input[key] = true; };
      const off = (e) => { e.preventDefault(); this.car.input[key] = false; };
      el.addEventListener('touchstart', on); el.addEventListener('touchend', off);
      el.addEventListener('touchcancel', off);
    };
    bind('t-left', 'left'); bind('t-right', 'right');
    bind('t-gas', 'forward'); bind('t-brake', 'backward');
  }

  setState(s) {
    this.state = s;
    $('start-screen').classList.toggle('hidden', s !== 'menu');
    $('finish-screen').classList.toggle('hidden', s !== 'finished');
    $('countdown').classList.toggle('hidden', s !== 'countdown');
  }

  onEnter() {
    if (this.state === 'menu' || this.state === 'finished') this.startRace();
  }

  startRace() {
    clearInterval(this.countdownTimer);
    this.currentCp = 0;
    this.raceTime = 0;
    this.respawn = { ...SPAWN };
    this.car.reset(SPAWN.x, SPAWN.z, SPAWN.heading);
    this.checkpoints.forEach((cp, i) => {
      cp.gate.visible = true;
      cp.mat.opacity = 0.9;
    });
    this.snapCamera();
    this.setState('countdown');
    let n = 3;
    $('countdown').textContent = n;
    this.countdownTimer = setInterval(() => {
      n -= 1;
      if (n > 0) { $('countdown').textContent = n; }
      else {
        clearInterval(this.countdownTimer);
        $('countdown').textContent = 'GO!';
        setTimeout(() => { if (this.state === 'race') $('countdown').classList.add('hidden'); }, 700);
        this.setState('race');
        $('countdown').classList.remove('hidden');
      }
    }, 800);
  }

  resetCar() {
    if (this.state !== 'race') return;
    this.car.reset(this.respawn.x, this.respawn.z, this.respawn.heading);
    this.snapCamera();
  }

  finishRace() {
    this.setState('finished');
    const t = this.formatTime(this.raceTime);
    $('final-time').textContent = t;
    if (!this.bestTime || this.raceTime < this.bestTime) {
      this.bestTime = this.raceTime;
      localStorage.setItem('nprgr-best', String(this.bestTime));
      $('best-note').textContent = '🏆 Novo recorde!';
    } else {
      $('best-note').textContent = `Recorde: ${this.formatTime(this.bestTime)}`;
    }
  }

  formatTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  checkCheckpoints() {
    const cp = this.checkpoints[this.currentCp];
    if (!cp) return;
    const p = this.car.chassisBody.position;
    const dx = p.x - cp.x;
    const dz = p.z - cp.z;
    if (dx * dx + dz * dz < cp.r * cp.r) {
      cp.gate.visible = false;
      this.respawn = { x: cp.x, z: cp.z, heading: cp.heading };
      this.currentCp += 1;
      if (cp.finish) this.finishRace();
    }
  }

  snapCamera() {
    const body = this.car.chassisBody;
    const back = new THREE.Vector3(0, 2.8, -7.5).applyQuaternion(body.quaternion);
    this.camera.position.set(body.position.x + back.x, body.position.y + back.y, body.position.z + back.z);
    this.camera.lookAt(body.position.x, body.position.y + 1, body.position.z);
  }

  updateCamera(dt) {
    const body = this.car.chassisBody;
    const target = new THREE.Vector3(0, 2.8, -7.5).applyQuaternion(body.quaternion)
      .add(new THREE.Vector3(body.position.x, body.position.y, body.position.z));
    target.y = Math.max(target.y, body.position.y + 1.6);
    const k = 1 - Math.exp(-dt * 4.5);
    this.camera.position.lerp(target, k);
    this.camera.lookAt(body.position.x, body.position.y + 1.1, body.position.z);
  }

  updateHUD() {
    $('speed').textContent = Math.round(this.car.speedKmh);
    $('timer').textContent = this.formatTime(this.raceTime);
    const total = this.checkpoints.length;
    const cp = this.checkpoints[this.currentCp];
    $('cp-count').textContent = `${Math.min(this.currentCp + 1, total)}/${total}`;
    $('cp-label').textContent = cp ? cp.label : '';
  }

  drawMinimap() {
    const ctx = this.minimap;
    const W = 230, H = 74;
    const mx = (x) => 18 + ((x + 420) / 790) * (W - 32);
    const mz = (z) => THREE.MathUtils.clamp(z / 3, -14, 14);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8, 14, 20, 0.65)';
    ctx.beginPath(); ctx.roundRect(0, 0, W, H, 10); ctx.fill();
    // estrada
    ctx.strokeStyle = '#9aa6ad'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(mx(-352), H / 2); ctx.lineTo(mx(345), H / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(mx(-380), H / 2, 8, 0, Math.PI * 2); ctx.stroke(); // rotunda
    ctx.beginPath(); ctx.moveTo(mx(320), H / 2 - 14); ctx.lineTo(mx(320), H / 2 + 14); ctx.stroke(); // Amial
    // fábrica
    ctx.fillStyle = '#d8d3c6';
    ctx.fillRect(mx(-20) - 4, H / 2 - 15, 14, 7);
    // próximo checkpoint
    const cp = this.checkpoints[this.currentCp];
    if (cp && Math.floor(performance.now() / 400) % 2 === 0) {
      ctx.fillStyle = cp.finish ? '#ffcc00' : '#00d2ff';
      ctx.beginPath();
      ctx.arc(mx(cp.x), H / 2 + mz(cp.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // carro
    const p = this.car.chassisBody.position;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(mx(p.x), H / 2 + mz(p.z), 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const locked = this.state !== 'race';

    this.physics.step(1 / 60, dt, 4);
    this.car.update(dt, locked);

    if (this.state === 'race') {
      this.raceTime += dt;
      this.checkCheckpoints();
      if (this.car.isFlipped) {
        this._flipTime = (this._flipTime || 0) + dt;
        if (this._flipTime > 2.2) { this.resetCar(); this._flipTime = 0; }
      } else this._flipTime = 0;
      if (this.car.chassisBody.position.y < -5) this.resetCar();
    }

    // seta para o próximo checkpoint
    const cp = this.checkpoints[this.currentCp];
    if (cp && this.state === 'race') {
      this.arrowPivot.visible = true;
      const p = this.car.chassisBody.position;
      this.arrowPivot.position.set(p.x, p.y + 2.6, p.z);
      this.arrowPivot.rotation.y = Math.atan2(cp.x - p.x, cp.z - p.z);
      const pulse = 0.9 + Math.sin(performance.now() / 180) * 0.12;
      this.arrowPivot.scale.setScalar(pulse);
      cp.mat.emissiveIntensity = 0.5 + Math.sin(performance.now() / 200) * 0.35;
    } else {
      this.arrowPivot.visible = false;
    }

    // sol acompanha o carro (sombras sempre presentes)
    const p = this.car.chassisBody.position;
    this.sun.position.set(p.x + 60, 110, p.z - 40);
    this.sun.target.position.set(p.x, 0, p.z);

    this.updateCamera(dt);
    this.updateHUD();
    this.drawMinimap();
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

new Game();
