import * as THREE from 'three';
import Vehicle from './Vehicle.js';

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        this.keys = {};
        window.keys = this.keys;

        this.takedownProgress = 0;
        this.rivalHealth = 100;
        this.isWarning = false;
        
        this.traffic = [];
        this.particles = [];
        
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.container.appendChild(this.renderer.domElement);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(100, 200, 100);
        this.scene.add(sun);

        this.setupEnvironment();
        this.setupTrack();

        this.player = new Vehicle(this.scene, 0x050505, true); // Black BMW
        this.rival = new Vehicle(this.scene, 0xffaa00, false); // Orange Corsa
        this.rival.mesh.position.set(10, 0, 50);

        this.setupTraffic();

        window.addEventListener('keydown', (e) => this.keys[e.key] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);
        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('takedown-warning', (e) => this.handleWarning(e.detail.active));

        this.animate();
    }

    setupEnvironment() {
        const geometry = new THREE.SphereGeometry(2000, 60, 40);
        geometry.scale(-1, 1, 1);
        this.envMat = new THREE.MeshBasicMaterial({ color: 0x001a33 }); 
        this.envSphere = new THREE.Mesh(geometry, this.envMat);
        this.scene.add(this.envSphere);
        
        // Loader for panoramas
        this.textureLoader = new THREE.TextureLoader();
    }

    setupTrack() {
        this.trackSpline = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),      // Monteiro Ribas
            new THREE.Vector3(50, 0, 1000),  // Via Norte
            new THREE.Vector3(200, 0, 2500), // AEP Roundabout
            new THREE.Vector3(50, 0, 1000),  // Back
            new THREE.Vector3(-100, 0, -1000), // Ameal
            new THREE.Vector3(0, 0, 0)       // Return
        ]);
    }

    setupTraffic() {
        for (let i = 0; i < 20; i++) {
            const car = new Vehicle(this.scene, Math.random() * 0xffffff, false);
            car.mesh.position.set((Math.random() - 0.5) * 40, 0, Math.random() * 2000);
            car.maxSpeed = 0.4 + Math.random() * 0.2;
            this.traffic.push(car);
        }
    }

    createParticles(pos, color, count = 5) {
        for (let i = 0; i < count; i++) {
            const p = new THREE.Mesh(
                new THREE.SphereGeometry(0.2),
                new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 })
            );
            p.position.copy(pos);
            p.velocity = new THREE.Vector3((Math.random()-0.5)*0.2, Math.random()*0.2, (Math.random()-0.5)*0.2);
            p.life = 1.0;
            this.scene.add(p);
            this.particles.push(p);
        }
    }

    handleWarning(active) {
        this.isWarning = active;
        const overlay = document.getElementById('warning-overlay');
        if (active) overlay.classList.remove('hidden');
        else overlay.classList.add('hidden');
    }

    checkCollisions() {
        const dist = this.player.mesh.position.distanceTo(this.rival.mesh.position);
        if (dist < 4) {
            if (this.isWarning && (this.keys[' '] || this.keys['s'])) {
                this.rivalHealth -= 20;
                this.takedownProgress = Math.min(100, this.takedownProgress + 30);
                this.cameraShake(0.5);
                this.rival.speed *= 0.5;
                this.handleWarning(false);
                this.createParticles(this.rival.mesh.position, 0xffaa00, 20);
            } else if (this.isWarning) {
                this.player.speed *= 0.3;
                this.cameraShake(1.0);
                this.createParticles(this.player.mesh.position, 0xff0000, 10);
            }
        }

        document.getElementById('rival-health').style.width = `${this.rivalHealth}%`;
        document.getElementById('boost-bar').style.width = `${this.takedownProgress}%`;
        
        if (this.rivalHealth <= 0) {
            console.log("TAKEDOWN!");
            this.rivalHealth = 100;
        }
    }

    cameraShake(intensity) {
        const startTime = performance.now();
        const duration = 500;
        const originalPos = this.camera.position.clone();

        const shake = () => {
            const elapsed = performance.now() - startTime;
            if (elapsed < duration) {
                this.camera.position.x += (Math.random() - 0.5) * intensity;
                this.camera.position.y += (Math.random() - 0.5) * intensity;
                requestAnimationFrame(shake);
            }
        };
        shake();
    }

    updateHUD() {
        const speedKmh = Math.floor(this.player.speed * 300);
        document.querySelector('.speed').innerText = speedKmh;
        this.takedownProgress = Math.min(100, this.takedownProgress + 0.05);
    }

    updateCamera() {
        const offset = new THREE.Vector3(0, 2.5, -8);
        offset.applyQuaternion(this.player.mesh.quaternion);
        this.camera.position.copy(this.player.mesh.position).add(offset);
        this.camera.lookAt(this.player.mesh.position);
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.position.add(p.velocity);
            p.life -= 0.02;
            p.material.opacity = p.life;
            if (p.life <= 0) {
                this.scene.remove(p);
                this.particles.splice(i, 1);
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.player.update();
        this.rival.update(this.player.mesh.position);
        
        this.traffic.forEach(car => {
            car.update();
            if (car.mesh.position.z < this.player.mesh.position.z - 100) car.mesh.position.z += 1000;
        });

        if (this.keys[' ']) { // Nitro effects
            this.createParticles(this.player.mesh.position, 0x00d2ff, 2);
        }

        this.updateParticles();
        this.checkCollisions();
        this.updateCamera();
        this.updateHUD();
        
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

new Game();
