import * as THREE from 'three';

class Vehicle {
    constructor(scene, color, isPlayer = false) {
        this.scene = scene;
        this.isPlayer = isPlayer;
        this.velocity = new THREE.Vector3();
        this.speed = 0;
        this.maxSpeed = isPlayer ? 1.2 : 1.1; 
        this.acceleration = 0.01;
        this.friction = 0.96;
        this.steering = 0;
        this.angle = 0;
        this.drift = 0;
        
        // Combat states
        this.isRamming = false;
        this.ramTarget = null;
        this.warningActive = false;

        this.createModel(color);
    }

    createModel(color) {
        this.mesh = new THREE.Group();
        
        const bodyGeo = new THREE.BoxGeometry(1.8, 0.6, 4);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: color, 
            metalness: 0.8, 
            roughness: 0.2 
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.4;
        this.mesh.add(body);

        const cabinGeo = new THREE.BoxGeometry(1.4, 0.6, 2);
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111111, transparent: true, opacity: 0.8 });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.y = 1.0;
        cabin.position.z = -0.2;
        this.mesh.add(cabin);

        // Simple wheels
        const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const wheelPos = [
            [-0.9, 0.4, 1.3], [0.9, 0.4, 1.3],
            [-0.9, 0.4, -1.3], [0.9, 0.4, -1.3]
        ];
        wheelPos.forEach(p => {
            const w = new THREE.Mesh(wheelGeo, wheelMat);
            w.rotation.z = Math.PI / 2;
            w.position.set(...p);
            this.mesh.add(w);
        });

        this.scene.add(this.mesh);
    }

    update(playerPos = null) {
        if (this.isPlayer) {
            this.handleInput();
        } else {
            this.handleAI(playerPos);
        }

        // Drifting physics logic
        const driftFactor = this.isPlayer && window.keys['Shift'] ? 1.5 : 1.0;
        this.speed *= this.friction;
        this.angle += this.steering * (this.speed * 0.4);
        
        // Apply velocity with inertia (drift)
        const targetX = Math.sin(this.angle) * this.speed;
        const targetZ = Math.cos(this.angle) * this.speed;
        
        this.velocity.x += (targetX - this.velocity.x) * 0.1;
        this.velocity.z += (targetZ - this.velocity.z) * 0.1;

        this.mesh.position.add(this.velocity);
        this.mesh.rotation.y = this.angle;
        
        // Tilt mesh on turns
        this.mesh.rotation.z = -this.steering * 5;

        this.steering *= 0.85;
    }

    handleInput() {
        if (window.keys['ArrowUp'] || window.keys['w']) this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration);
        if (window.keys['ArrowDown'] || window.keys['s']) this.speed -= this.acceleration * 0.5;
        if (window.keys['ArrowLeft'] || window.keys['a']) this.steering += 0.02;
        if (window.keys['ArrowRight'] || window.keys['d']) this.steering -= 0.02;
        
        // Nitro
        if (window.keys[' ']) {
            this.speed = Math.min(this.maxSpeed * 1.5, this.speed + this.acceleration * 2);
        }
    }

    handleAI(playerPos) {
        if (!playerPos) return;

        const dist = this.mesh.position.distanceTo(playerPos);
        
        // Aggressive AI behavior
        if (dist < 15 && !this.isRamming && Math.random() < 0.01) {
            this.triggerRamMode();
        }

        if (this.isRamming) {
            // Steering towards player
            const angleToPlayer = Math.atan2(playerPos.x - this.mesh.position.x, playerPos.z - this.mesh.position.z);
            let diff = angleToPlayer - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.steering += diff * 0.1;
            this.speed = Math.min(this.maxSpeed * 1.2, this.speed + this.acceleration);
        } else {
            // Just follow path (stay relative to player for demo)
            const targetZ = playerPos.z + 10;
            if (this.mesh.position.z < targetZ) this.speed += this.acceleration;
            else this.speed *= 0.99;
            
            this.steering += (Math.random() - 0.5) * 0.02;
        }
    }

    triggerRamMode() {
        this.isRamming = true;
        this.warningActive = true;
        // Broadcast warning to game
        window.dispatchEvent(new CustomEvent('takedown-warning', { detail: { active: true } }));
        
        setTimeout(() => {
            this.isRamming = false;
            this.warningActive = false;
            window.dispatchEvent(new CustomEvent('takedown-warning', { detail: { active: false } }));
        }, 2000);
    }
}

export default Vehicle;
