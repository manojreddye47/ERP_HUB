import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface Warehouse3DProps {
  interactive?: boolean;
}

export const Warehouse3D: React.FC<Warehouse3DProps> = ({ interactive = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 400;
    const height = containerRef.current.clientHeight || 400;

    let renderer: THREE.WebGLRenderer | null = null;
    let animationFrameId: number;

    // Track objects for disposal
    const geomsToDispose: THREE.BufferGeometry[] = [];
    const matsToDispose: THREE.Material[] = [];

    const registerGeometry = <T extends THREE.BufferGeometry>(g: T): T => {
      geomsToDispose.push(g);
      return g;
    };

    const registerMaterial = <T extends THREE.Material>(m: T): T => {
      matsToDispose.push(m);
      return m;
    };

    try {
      // 1. Scene & Setup
      const scene = new THREE.Scene();
      scene.background = null;

      // Camera
      const camera = new THREE.PerspectiveCamera(40, width / height, 1, 1000);
      camera.position.set(10, 8, 10);
      camera.lookAt(0, 0, 0);

      // WebGL Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      containerRef.current.appendChild(renderer.domElement);

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
      scene.add(ambientLight);

      const lightAccentBlue = new THREE.DirectionalLight(0x5c6bc0, 1.2);
      lightAccentBlue.position.set(5, 10, 5);
      scene.add(lightAccentBlue);

      const lightAccentTeal = new THREE.DirectionalLight(0x26a69a, 0.8);
      lightAccentTeal.position.set(-5, 5, -5);
      scene.add(lightAccentTeal);

      const pointLight = new THREE.PointLight(0xef4444, 1.5, 6);
      pointLight.position.set(0, 1, 0); // Red light near scanner
      scene.add(pointLight);

      // 2. Futuristic Grid Floor
      const gridHelper = new THREE.GridHelper(20, 20, 0x5c6bc0, 0x222228);
      gridHelper.position.y = -0.8;
      scene.add(gridHelper);

      // 3. Conveyor System
      const conveyorGroup = new THREE.Group();
      scene.add(conveyorGroup);

      // Conveyor Track Frame
      const trackGeom = registerGeometry(new THREE.BoxGeometry(1.4, 0.15, 12));
      const trackMat = registerMaterial(new THREE.MeshPhongMaterial({ color: 0x1a1a1d, shininess: 40 }));
      const trackFrame = new THREE.Mesh(trackGeom, trackMat);
      trackFrame.position.y = -0.4;
      conveyorGroup.add(trackFrame);

      // Neon Side Rails
      const railGeom = registerGeometry(new THREE.BoxGeometry(0.06, 0.08, 12));
      const railMat = registerMaterial(new THREE.MeshBasicMaterial({ color: 0x26a69a })); // Glowing teal rails
      const leftRail = new THREE.Mesh(railGeom, railMat);
      leftRail.position.set(-0.72, -0.3, 0);
      const rightRail = new THREE.Mesh(railGeom, railMat);
      rightRail.position.set(0.72, -0.3, 0);
      conveyorGroup.add(leftRail, rightRail);

      // Conveyor Rollers
      const rollers: THREE.Mesh[] = [];
      const rollerGeom = registerGeometry(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 8));
      const rollerMat = registerMaterial(new THREE.MeshPhongMaterial({ color: 0x475569, specular: 0xffffff, shininess: 80 }));
      for (let z = -5.5; z <= 5.5; z += 0.8) {
        const roller = new THREE.Mesh(rollerGeom, rollerMat);
        roller.rotation.z = Math.PI / 2;
        roller.position.set(0, -0.3, z);
        conveyorGroup.add(roller);
        rollers.push(roller);
      }

      // 4. Cybernetic Scanner Gate
      const scannerGroup = new THREE.Group();
      scannerGroup.position.set(0, -0.3, 0);
      scene.add(scannerGroup);

      // Posts
      const postGeom = registerGeometry(new THREE.BoxGeometry(0.12, 2.2, 0.12));
      const gateMat = registerMaterial(new THREE.MeshPhongMaterial({ color: 0x0f172a, shininess: 120, specular: 0x5c6bc0 }));
      
      const postLeft = new THREE.Mesh(postGeom, gateMat);
      postLeft.position.set(-0.85, 1.1, 0);
      const postRight = new THREE.Mesh(postGeom, gateMat);
      postRight.position.set(0.85, 1.1, 0);

      // Top arch crossbeam
      const topBeamGeom = registerGeometry(new THREE.BoxGeometry(1.82, 0.12, 0.12));
      const topBeam = new THREE.Mesh(topBeamGeom, gateMat);
      topBeam.position.set(0, 2.2, 0);
      scannerGroup.add(postLeft, postRight, topBeam);

      // Glowing Neon Arch Accents
      const accentGeom = registerGeometry(new THREE.BoxGeometry(0.04, 2.2, 0.04));
      const redNeonMat = registerMaterial(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      const accentLeft = new THREE.Mesh(accentGeom, redNeonMat);
      accentLeft.position.set(-0.92, 1.1, 0);
      const accentRight = new THREE.Mesh(accentGeom, redNeonMat);
      accentRight.position.set(0.92, 1.1, 0);
      scannerGroup.add(accentLeft, accentRight);

      // Translucent Laser Scanner Sheet
      const laserSheetGeom = registerGeometry(new THREE.PlaneGeometry(1.6, 2.1));
      const laserSheetMat = registerMaterial(new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      }));
      const laserSheet = new THREE.Mesh(laserSheetGeom, laserSheetMat);
      laserSheet.position.set(0, 1.05, 0);
      scannerGroup.add(laserSheet);

      // Sweeping Laser Beam Line
      const laserLineGeom = registerGeometry(new THREE.BoxGeometry(1.6, 0.03, 0.03));
      const laserLineMat = registerMaterial(new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      const laserLine = new THREE.Mesh(laserLineGeom, laserLineMat);
      laserLine.position.set(0, 1.05, 0.01);
      scannerGroup.add(laserLine);

      // 5. Dynamic Cargo Boxes
      const cargoBoxes: THREE.Group[] = [];
      const cargoCount = 4;
      const spacingZ = 2.8;

      const colorsList = [0x5c6bc0, 0x26a69a, 0xff7043, 0xffca28];

      for (let i = 0; i < cargoCount; i++) {
        const cargo = new THREE.Group();

        // Vary crate sizing
        const w = 0.5 + Math.random() * 0.15;
        const h = 0.4 + Math.random() * 0.15;
        const d = 0.5 + Math.random() * 0.15;
        
        const boxGeom = registerGeometry(new THREE.BoxGeometry(w, h, d));
        const color = colorsList[i % colorsList.length];
        const boxMat = registerMaterial(new THREE.MeshPhongMaterial({
          color: color,
          specular: 0xffffff,
          shininess: 90,
          emissive: color,
          emissiveIntensity: 0.1
        }));
        const boxMesh = new THREE.Mesh(boxGeom, boxMat);
        boxMesh.position.y = h / 2;
        cargo.add(boxMesh);

        // Add glowing neon ribbon band around package
        const ribbonGeom = registerGeometry(new THREE.BoxGeometry(w + 0.01, 0.06, d + 0.01));
        const ribbonMat = registerMaterial(new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const ribbon = new THREE.Mesh(ribbonGeom, ribbonMat);
        ribbon.position.y = h / 2;
        cargo.add(ribbon);

        // Position along the track
        const zPos = -5.0 + i * spacingZ;
        cargo.position.set(0, -0.2, zPos);
        scene.add(cargo);
        cargoBoxes.push(cargo);
      }

      // 6. Holographic Data Upload Particles
      const particleCount = 25;
      const particleGeom = registerGeometry(new THREE.BufferGeometry());
      const particlePositions = new Float32Array(particleCount * 3);
      const particleSpeeds = new Float32Array(particleCount);

      for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 1.3; // X
        particlePositions[i * 3 + 1] = 0.2 + Math.random() * 1.8; // Y
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.2; // Z
        particleSpeeds[i] = 0.008 + Math.random() * 0.012;
      }
      particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particleMat = registerMaterial(new THREE.PointsMaterial({
        color: 0x26a69a,
        size: 0.12,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
      }));
      const dataParticles = new THREE.Points(particleGeom, particleMat);
      scene.add(dataParticles);

      // 7. Stylized 3D Humanoid Warehouse Operator
      const workerGroup = new THREE.Group();
      workerGroup.position.set(1.0, -0.4, 0.6); // Standing right next to the conveyor
      workerGroup.rotation.y = -Math.PI / 1.5; // Facing conveyor/console
      scene.add(workerGroup);

      // Legs / Pants
      const legGeom = registerGeometry(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8));
      const legMat = registerMaterial(new THREE.MeshPhongMaterial({ color: 0x1e3a8a, shininess: 30 })); // Blue work jeans
      const leftLeg = new THREE.Mesh(legGeom, legMat);
      leftLeg.position.set(-0.09, 0.3, 0);
      const rightLeg = new THREE.Mesh(legGeom, legMat);
      rightLeg.position.set(0.09, 0.3, 0);
      workerGroup.add(leftLeg, rightLeg);

      // Steel-toe Work Boots
      const bootGeom = registerGeometry(new THREE.BoxGeometry(0.08, 0.08, 0.15));
      const bootMat = registerMaterial(new THREE.MeshPhongMaterial({ color: 0x1f2937 }));
      const leftBoot = new THREE.Mesh(bootGeom, bootMat);
      leftBoot.position.set(-0.09, 0.04, 0.03);
      const rightBoot = new THREE.Mesh(bootGeom, bootMat);
      rightBoot.position.set(0.09, 0.04, 0.03);
      workerGroup.add(leftBoot, rightBoot);

      // Torso / High-Vis Safety Vest
      const torsoGeom = registerGeometry(new THREE.CylinderGeometry(0.14, 0.11, 0.68, 8));
      const vestMat = registerMaterial(new THREE.MeshPhongMaterial({ color: 0xf97316, shininess: 50 })); // Safety Orange
      const torso = new THREE.Mesh(torsoGeom, vestMat);
      torso.position.set(0, 0.94, 0);
      workerGroup.add(torso);

      // Reflective Silver Striping on Vest
      const stripeGeom = registerGeometry(new THREE.CylinderGeometry(0.146, 0.142, 0.06, 8));
      const stripeMat = registerMaterial(new THREE.MeshBasicMaterial({ color: 0xe2e8f0 }));
      const stripe = new THREE.Mesh(stripeGeom, stripeMat);
      stripe.position.set(0, 0.96, 0);
      workerGroup.add(stripe);

      // Jacket Sleeves & Arms
      const armGeom = registerGeometry(new THREE.CylinderGeometry(0.045, 0.04, 0.48, 8));
      const armMat = registerMaterial(new THREE.MeshPhongMaterial({ color: 0x334155 })); // Dark jacket sleeves
      
      const leftArm = new THREE.Mesh(armGeom, armMat);
      leftArm.position.set(-0.18, 0.94, 0);
      leftArm.rotation.z = Math.PI / 12;
      
      const rightArm = new THREE.Mesh(armGeom, armMat);
      rightArm.position.set(0.18, 0.94, 0.1);
      rightArm.rotation.x = -Math.PI / 3; // Reaching forward
      rightArm.rotation.z = -Math.PI / 12;
      workerGroup.add(leftArm, rightArm);

      // Head
      const headGeom = registerGeometry(new THREE.SphereGeometry(0.11, 12, 12));
      const headMat = registerMaterial(new THREE.MeshPhongMaterial({ color: 0xffe4e6 })); // Skin tone
      const head = new THREE.Mesh(headGeom, headMat);
      head.position.set(0, 1.38, 0);
      workerGroup.add(head);

      // Hard Hat Safety Helmet
      const helmetGeom = registerGeometry(new THREE.SphereGeometry(0.125, 12, 12, 0, Math.PI * 2, 0, Math.PI / 1.8));
      const helmetMat = registerMaterial(new THREE.MeshPhongMaterial({ color: 0x0284c7, shininess: 85 })); // Blue Hard Hat
      const helmet = new THREE.Mesh(helmetGeom, helmetMat);
      helmet.position.set(0, 1.4, 0);
      helmet.rotation.x = -0.12; // tilted slightly forward
      workerGroup.add(helmet);

      // 8. Floating Holographic Control Console Terminal
      const consoleGroup = new THREE.Group();
      consoleGroup.position.set(0.7, -0.4, 0.85); // Positioned directly in front of the operator
      consoleGroup.rotation.y = Math.PI / 4;
      scene.add(consoleGroup);

      const consoleStandGeom = registerGeometry(new THREE.BoxGeometry(0.06, 0.85, 0.06));
      const consoleStandMat = registerMaterial(new THREE.MeshPhongMaterial({ color: 0x475569 }));
      const consoleStand = new THREE.Mesh(consoleStandGeom, consoleStandMat);
      consoleStand.position.y = 0.425;
      consoleGroup.add(consoleStand);

      const consoleBaseGeom = registerGeometry(new THREE.BoxGeometry(0.28, 0.04, 0.22));
      const consoleBase = new THREE.Mesh(consoleBaseGeom, consoleStandMat);
      consoleBase.position.set(0, 0.85, 0);
      consoleBase.rotation.x = -Math.PI / 6;
      consoleGroup.add(consoleBase);

      const consoleDisplayGeom = registerGeometry(new THREE.PlaneGeometry(0.24, 0.18));
      const consoleDisplayMat = registerMaterial(new THREE.MeshBasicMaterial({ color: 0x26a69a, side: THREE.DoubleSide }));
      const consoleDisplay = new THREE.Mesh(consoleDisplayGeom, consoleDisplayMat);
      consoleDisplay.position.set(0, 0.875, 0.01);
      consoleDisplay.rotation.x = -Math.PI / 6;
      consoleGroup.add(consoleDisplay);

      // Interactive Mouse Variables
      let mouseX = 0;
      let mouseY = 0;

      const handleMouseMove = (event: MouseEvent) => {
        if (!interactive) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        mouseX = ((event.clientX - rect.left) / width) * 2 - 1;
        mouseY = -((event.clientY - rect.top) / height) * 2 + 1;
      };

      window.addEventListener('mousemove', handleMouseMove);

      // 9. Animation Loop
      const clock = new THREE.Clock();

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // Rotate Rollers
        rollers.forEach((r) => {
          r.rotation.x = elapsedTime * 3;
        });

        // Sweep red laser gate line
        laserLine.position.y = 1.05 + Math.sin(elapsedTime * 3) * 0.95;

        // Move Packages along Conveyor belt
        cargoBoxes.forEach((cargo) => {
          cargo.position.z += 0.018; // speed

          // Loop reset
          if (cargo.position.z > 6) {
            cargo.position.z = -5.0;
          }

          // Scanner flash interaction when packages pass the gate (z=0)
          if (Math.abs(cargo.position.z) < 0.22) {
            laserSheetMat.opacity = 0.45 + Math.sin(elapsedTime * 40) * 0.25;
            pointLight.intensity = 2.5 + Math.sin(elapsedTime * 30) * 0.5;
          }
        });

        // Reset laser intensity when scanner is empty
        const anyNearGate = cargoBoxes.some(c => Math.abs(c.position.z) < 0.22);
        if (!anyNearGate) {
          laserSheetMat.opacity = 0.15;
          pointLight.intensity = 0.8;
        }

        // Animate uploading holographic particles
        const posArray = dataParticles.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          posArray[i * 3 + 1] += particleSpeeds[i];
          if (posArray[i * 3 + 1] > 2.0) {
            posArray[i * 3 + 1] = 0.2; // restart at base
            posArray[i * 3] = (Math.random() - 0.5) * 1.3;
          }
        }
        dataParticles.geometry.attributes.position.needsUpdate = true;

        // Orbit camera around warehouse center smoothly
        const orbitAngle = elapsedTime * 0.07;
        const radius = 10;
        
        camera.position.x = radius * Math.cos(orbitAngle) + mouseX * 1.5;
        camera.position.z = radius * Math.sin(orbitAngle) + mouseY * 1.5;
        camera.position.y = 5.5 + Math.sin(elapsedTime * 0.12) * 1.2;
        camera.lookAt(0, 0.4, 0);

        if (renderer) {
          renderer.render(scene, camera);
        }
      };

      animate();

      const handleResize = () => {
        if (!containerRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (renderer) {
          renderer.setSize(w, h);
        }
      };

      window.addEventListener('resize', handleResize);

      // 10. Cleanup
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);
        if (containerRef.current && renderer && renderer.domElement) {
          containerRef.current.removeChild(renderer.domElement);
        }

        geomsToDispose.forEach((g) => g.dispose());
        matsToDispose.forEach((m) => m.dispose());
        if (renderer) renderer.dispose();
      };
    } catch (err) {
      console.warn("WebGL not supported or Three.js failed to initialize:", err);
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); text-align: center; padding: 24px; font-family: var(--font-body)">
            <div style="font-size: 48px; margin-bottom: 16px">📦</div>
            <h4 style="color: var(--text-primary); margin-bottom: 8px; font-family: var(--font-display)">Nexus Waretrack ERP</h4>
            <p style="font-size: 12px; max-width: 260px; line-height: 1.4">Interactive 3D preview offline (WebGL unsupported). Standard ERP features fully functional.</p>
          </div>
        `;
      }
    }
  }, [interactive]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '300px' }} />;
};

export default Warehouse3D;
