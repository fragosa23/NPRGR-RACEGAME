# Implementation Plan: NPRGR RACEGAME (Burnout Style)

## 1. Objective
Create a realistic 3D racing minigame in Three.js (WebGL) inspired by *Burnout Takedown*. The game features a 1vs1 race through real-world Porto locations (Monteiro Ribas & Circunvalação) with "Takedown" mechanics and realistic graphics.

## 2. Key Files & Context
- **`index.html`**: Main entry point and HUD.
- **`game.js`**: Core game logic, Three.js scene management.
- **`physics.js`**: Vehicle dynamics and collision logic (using Rapier.js).
- **`assets/`**: GLB models for BMW 320d, Opel Corsa B, and common Portuguese traffic.
- **`environments/`**: Logic for switching 360° Street View panoramas.

## 3. Implementation Steps

### Phase 1: Environment & Route Logic
- [ ] **Track Mapping**: Create an invisible spline path representing the 8km route (Monteiro Ribas -> AEP Roundabout -> Ameal -> Monteiro Ribas).
- [ ] **Panorama Engine**: Implement a system that loads high-res 360° textures based on the car's progress along the spline.
- [ ] **Start/End Zone**: Specifically model the Monteiro Ribas employee parking lot with parked commuter cars (standard Portuguese models).

### Phase 2: Vehicles & Physics
- [ ] **Player Vehicle**: Integrate a black 2007 BMW 320d (E90) with PBR materials for realistic paint/reflections.
- [ ] **Rival AI**: Integrate a "tuned" Opel Corsa B with aggressive driving behavior.
- [ ] **Traffic System**: Procedurally spawn common cars (Clio, Golf, STCP Bus) on the Circunvalação.
- [ ] **Collision System**: Use Rapier.js to handle car-to-car and car-to-environment collisions.

### Phase 3: Gameplay Mechanics
- [ ] **Takedown Bar**: UI element that fills based on near-misses and drifts.
- [ ] **Takedown Move**: When the bar is full, a "Boost/Bash" move is enabled to wreck the rival.
- [ ] **Counter-Attack System**: 2-second warning system when the AI attempts a Takedown. If the player brakes or uses nitro, the AI crashes into traffic.

### Phase 4: Audio & Visual Polish
- [ ] **Visuals**: Add post-processing (Bloom, Color Grading, Motion Blur) for a cinematic feel.
- [ ] **Audio**: BMW engine sounds, tire screeches, "Metal Crunch" sound for Takedowns, and an adrenaline-pumping soundtrack.

## 4. Verification & Testing
- [ ] Verify the route accuracy against Google Maps data.
- [ ] Test the "2-second warning" timing to ensure it's challenging but fair.
- [ ] Benchmark performance in common browsers (Chrome/Firefox) to maintain high FPS.
- [ ] Ensure seamless transitions between Street View panoramas.
