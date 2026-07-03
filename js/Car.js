import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Física afinada a partir do pmndrs/racing-game (o jogo de referência)
const CONFIG = {
  mass: 500,
  chassisHalf: new CANNON.Vec3(0.85, 0.42, 2.05),
  engineForce: 1850,
  reverseForce: 1100,
  brakeForce: 78,
  handbrakeForce: 100,
  maxSteer: 0.55,
  wheel: {
    radius: 0.38,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    axleLocal: new CANNON.Vec3(-1, 0, 0),
    suspensionStiffness: 34,
    suspensionRestLength: 0.35,
    frictionSlip: 3.6,
    dampingRelaxation: 3.4,
    dampingCompression: 5.8,
    maxSuspensionForce: 100000,
    rollInfluence: 0.01,
    maxSuspensionTravel: 0.14,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true,
  },
  // ligação das rodas ao chassis (x: eixo, y: altura, z: frente/trás)
  // o nariz do modelo 3D fica em +z (a câmara persegue o carro a partir de -z)
  connections: [
    [-0.78, -0.1,  1.35], // frente esquerda
    [ 0.78, -0.1,  1.35], // frente direita
    [-0.78, -0.1, -1.3],  // trás esquerda
    [ 0.78, -0.1, -1.3],  // trás direita
  ],
  frontWheels: [0, 1],
  rearWheels: [2, 3],
};

export class Car {
  static async load(scene, physics) {
    const draco = new DRACOLoader();
    draco.setDecoderPath('assets/vendor/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    const [chassisGltf, wheelGltf] = await Promise.all([
      loader.loadAsync('assets/models/chassis-draco.glb'),
      loader.loadAsync('assets/models/wheel-draco.glb'),
    ]);
    return new Car(scene, physics, chassisGltf.scene, wheelGltf.scene);
  }

  constructor(scene, physics, chassisModel, wheelModel) {
    this.scene = scene;
    this.physics = physics;
    this.input = { forward: false, backward: false, left: false, right: false, brake: false };

    // ── Corpo físico ─────────────────────────────────────────────────────────
    this.chassisBody = new CANNON.Body({ mass: CONFIG.mass });
    this.chassisBody.addShape(new CANNON.Box(CONFIG.chassisHalf), new CANNON.Vec3(0, 0.1, 0));
    this.chassisBody.angularDamping = 0.85;
    this.chassisBody.position.set(0, 2, 0);

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });
    for (const [x, y, z] of CONFIG.connections) {
      this.vehicle.addWheel({
        ...CONFIG.wheel,
        chassisConnectionPointLocal: new CANNON.Vec3(x, y, z),
      });
    }
    this.vehicle.addToWorld(physics);

    // ── Visual: chassis do pmndrs/racing-game ────────────────────────────────
    this.mesh = new THREE.Group();
    scene.add(this.mesh);

    chassisModel.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
    });
    const fitted = new THREE.Group();
    fitted.add(chassisModel);
    let bbox = new THREE.Box3().setFromObject(chassisModel);
    let size = bbox.getSize(new THREE.Vector3());
    if (size.x > size.z) { // garantir eixo longo em z
      chassisModel.rotation.y = Math.PI / 2;
      bbox = new THREE.Box3().setFromObject(fitted);
      size = bbox.getSize(new THREE.Vector3());
    }
    const scale = 4.1 / size.z;
    chassisModel.scale.multiplyScalar(scale);
    bbox = new THREE.Box3().setFromObject(fitted);
    const center = bbox.getCenter(new THREE.Vector3());
    chassisModel.position.sub(center);
    chassisModel.position.y += (bbox.max.y - bbox.min.y) / 2 - 0.52;
    this.chassisFlip = fitted; // rodar 180º se o modelo estiver de costas
    this.mesh.add(fitted);

    // ── Rodas ────────────────────────────────────────────────────────────────
    let wbox = new THREE.Box3().setFromObject(wheelModel);
    const wsize = wbox.getSize(new THREE.Vector3());
    const wradius = Math.max(wsize.y, wsize.z) / 2;
    wheelModel.scale.multiplyScalar(CONFIG.wheel.radius / wradius);
    wheelModel.traverse((o) => { if (o.isMesh) o.castShadow = true; });

    this.wheelMeshes = CONFIG.connections.map(([x], i) => {
      const w = new THREE.Group();
      const model = wheelModel.clone();
      if (x > 0) model.rotation.y = Math.PI; // espelhar rodas do lado direito
      w.add(model);
      scene.add(w);
      return w;
    });

    this.speedKmh = 0;
  }

  reset(x, z, heading) {
    this.chassisBody.position.set(x, 1.1, z);
    this.chassisBody.quaternion.setFromEuler(0, heading, 0);
    this.chassisBody.velocity.setZero();
    this.chassisBody.angularVelocity.setZero();
    this._steer = 0;
    for (let i = 0; i < 4; i++) {
      this.vehicle.applyEngineForce(0, i);
      this.vehicle.setBrake(0, i);
      this.vehicle.setSteeringValue(0, i);
    }
  }

  get isFlipped() {
    const up = new CANNON.Vec3(0, 1, 0);
    const worldUp = this.chassisBody.quaternion.vmult(up);
    return worldUp.y < 0.15;
  }

  update(dt, locked = false) {
    const { input, vehicle, chassisBody } = this;

    // velocidade no referencial local (z = frente)
    const localVel = chassisBody.quaternion.inverse().vmult(chassisBody.velocity);
    const forwardSpeed = localVel.z;
    this.speedKmh = Math.abs(chassisBody.velocity.length()) * 3.6;

    // direção com redução progressiva a alta velocidade (evita ângulos de deriva
    // grandes, que com o modelo de atrito simplificado do RaycastVehicle travam o carro)
    const steerScale = THREE.MathUtils.clamp(1 / (1 + this.speedKmh / 40), 0.12, 1);
    // nota: as rodas dirigidas estão no nariz (+z), por isso a mesma volta ao
    // volante gira o carro no sentido oposto ao que geraria em rodas traseiras
    const targetSteer = locked ? 0
      : (input.left ? 1 : 0) * CONFIG.maxSteer * steerScale
      - (input.right ? 1 : 0) * CONFIG.maxSteer * steerScale;
    this._steer = THREE.MathUtils.lerp(this._steer ?? 0, targetSteer, Math.min(1, dt * 12));
    for (const i of CONFIG.frontWheels) vehicle.setSteeringValue(this._steer, i);

    // aceleração / marcha-atrás
    let engine = 0;
    let brake = 0;
    if (!locked) {
      if (input.forward && this.speedKmh < 175) engine = CONFIG.engineForce;
      if (input.backward) {
        if (forwardSpeed > 1) brake = CONFIG.brakeForce;
        else engine = -CONFIG.reverseForce;
      }
    } else {
      brake = CONFIG.brakeForce;
    }
    // o RaycastVehicle do cannon trata -z local como "frente"; o jogo usa +z
    for (const i of CONFIG.rearWheels) vehicle.applyEngineForce(-engine, i);

    // travagem com "trail braking" automático: transfere a travagem normal
    // para o eixo traseiro conforme se vira, à semelhança do que um condutor
    // real faz ao levantar o pé do travão à entrada de uma curva. As rodas
    // dianteiras (que esterçam) ficam com o travão quase todo largado quando
    // o volante está a fundo, e o travão de mão (SPAÇO) trava sempre só as
    // traseiras, como num carro real.
    const useHandbrake = input.brake && !locked;
    const steerIntensity = Math.abs(this._steer) / CONFIG.maxSteer;
    const frontBrakeBias = THREE.MathUtils.lerp(1, 0.2, steerIntensity);
    for (const i of CONFIG.frontWheels) vehicle.setBrake(useHandbrake ? 0 : brake * frontBrakeBias, i);
    for (const i of CONFIG.rearWheels) vehicle.setBrake(useHandbrake ? CONFIG.handbrakeForce : brake, i);

    // assistência de estabilidade: quando se larga o volante, a guinada residual
    // (o carro continua a rodar por inércia enquanto as rodas voltam ao centro)
    // é amortecida depressa — sem isto, o desfasamento entre a direção das rodas
    // e a velocidade real faz o atrito "travar" o carro de repente numa curva.
    // Travar transfere peso para o eixo dianteiro (que esterça), dando-lhe mais
    // aderência lateral e por isso mais "vontade" de rodar — medido: só a virar,
    // a guinada máxima ronda 0.56 rad/s; a travar a fundo e a virar ao mesmo
    // tempo, dispara para ~1.7 rad/s mesmo com o círculo de atrito por saturar
    // (skidInfo=1 — não é falta de aderência, é o peso extra à frente). Por
    // isso reforçamos o amortecimento especificamente quando se trava, para a
    // curva continuar previsível em vez de rodar demasiado depressa.
    const isBraking = input.backward || useHandbrake;
    const yawDampRate = THREE.MathUtils.lerp(7, isBraking ? 3.6 : 0.6, steerIntensity);
    chassisBody.angularVelocity.y *= Math.max(0, 1 - yawDampRate * dt);

    // rede de segurança: nunca deixa entrar em trompo descontrolado
    const maxYaw = isBraking ? 0.85 : 1.7;
    if (Math.abs(chassisBody.angularVelocity.y) > maxYaw) {
      const excess = Math.abs(chassisBody.angularVelocity.y) - maxYaw;
      chassisBody.angularVelocity.y -= Math.sign(chassisBody.angularVelocity.y) * excess * Math.min(1, dt * 12);
    }

    // rede de segurança: a pista é plana (sem rampas), por isso qualquer
    // velocidade vertical grande só pode vir de um pico instável da física de
    // suspensão (ex.: travagem forte a descarregar o eixo traseiro e a
    // "saltar" quando a roda volta a tocar o chão) — nunca de um salto real
    const maxVertSpeed = 1.6;
    if (Math.abs(chassisBody.velocity.y) > maxVertSpeed) {
      chassisBody.velocity.y = Math.sign(chassisBody.velocity.y) * maxVertSpeed;
    }
    // e puxa-o de volta se ainda assim ganhar altura invulgar
    const restHeight = 0.78;
    if (chassisBody.position.y > restHeight + 0.35) {
      chassisBody.velocity.y -= (chassisBody.position.y - (restHeight + 0.35)) * Math.min(1, dt * 15);
    }

    // sincronizar visual
    this.mesh.position.copy(chassisBody.position);
    this.mesh.quaternion.copy(chassisBody.quaternion);
    for (let i = 0; i < 4; i++) {
      vehicle.updateWheelTransform(i);
      const t = vehicle.wheelInfos[i].worldTransform;
      this.wheelMeshes[i].position.copy(t.position);
      this.wheelMeshes[i].quaternion.copy(t.quaternion);
    }
  }
}
