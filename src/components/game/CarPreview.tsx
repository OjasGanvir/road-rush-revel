import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getCar } from "../../game/config/cars";
import { getPaint, getTrail, getWheel } from "../../game/config/cosmetics";
import { buildCar } from "../../game/entities/car";

type Props = {
  carId: string;
  paintId: string;
  wheelId: string;
  trailId?: string;
  className?: string;
};

/** Interactive studio 3D showroom preview for garage cars & cosmetics. */
export function CarPreview({ carId, paintId, wheelId, trailId, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const aspect = (el.clientWidth || 1) / (el.clientHeight || 1);
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    camera.position.set(4.2, 2.8, 3.4);
    camera.lookAt(0, 0.75, 0);

    const resize = () => {
      if (!el) return;
      const width = el.clientWidth || 1;
      const height = el.clientHeight || 1;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    el.appendChild(renderer.domElement);

    // Studio Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(-4, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x90b0ff, 0.7);
    fillLight.position.set(5, 3, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffd580, 0.8);
    rimLight.position.set(0, 5, -6);
    scene.add(rimLight);

    // 3D Car
    const carDef = getCar(carId);
    const car = buildCar({
      car: carDef,
      paintColor: getPaint(paintId).value,
      wheelId: getWheel(wheelId).id,
    });
    scene.add(car);

    // Studio Showroom Stage
    const stageGroup = new THREE.Group();
    const platformGeo = new THREE.CylinderGeometry(3.2, 3.4, 0.25, 48);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x1e2433,
      roughness: 0.3,
      metalness: 0.7,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.125;
    platform.receiveShadow = true;
    stageGroup.add(platform);

    // Stage rim accent glow ring
    const ringGeo = new THREE.TorusGeometry(3.3, 0.04, 16, 64);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4d7cff });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.005;
    stageGroup.add(ring);
    scene.add(stageGroup);

    // Nitro trail particles preview setup
    const activeTrail = trailId ? getTrail(trailId) : null;
    const trailColor = activeTrail?.trailColor ? new THREE.Color(activeTrail.trailColor) : null;
    const particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; max: number }[] = [];
    const pGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const pMat = new THREE.MeshBasicMaterial({ color: trailColor ?? 0xffffff, transparent: true });

    let isDragging = false;
    let previousMouseX = 0;
    let targetRotationY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      previousMouseX = e.clientX;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const delta = e.clientX - previousMouseX;
      previousMouseX = e.clientX;
      targetRotationY += delta * 0.01;
    };
    const onPointerUp = () => {
      isDragging = false;
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);

      if (!isDragging) {
        targetRotationY += 0.007;
      }
      car.rotation.y += (targetRotationY - car.rotation.y) * 0.1;

      // Spawn trail particles if previewing a Nitro trail
      if (trailColor && Math.random() < 0.4) {
        const pMesh = new THREE.Mesh(pGeo, pMat.clone());
        const rearZ = carDef.size[2] / 2;
        const localPos = new THREE.Vector3(
          (Math.random() - 0.5) * 0.4,
          0.35,
          rearZ + 0.1,
        ).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.rotation.y);

        pMesh.position.copy(car.position).add(localPos);
        scene.add(pMesh);

        particles.push({
          mesh: pMesh,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 0.02,
            Math.random() * 0.03 + 0.01,
            (Math.random() - 0.5) * 0.02,
          ),
          life: 0,
          max: 30 + Math.random() * 20,
        });
      }

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.mesh.position.add(p.vel);
        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 1 - p.life / p.max;
        if (p.life >= p.max) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          mat.dispose();
          particles.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
    };
    animate();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
    };
  }, [carId, paintId, wheelId, trailId]);

  return (
    <div
      ref={ref}
      className={`cursor-grab active:cursor-grabbing touch-none select-none ${className ?? ""}`}
    />
  );
}
