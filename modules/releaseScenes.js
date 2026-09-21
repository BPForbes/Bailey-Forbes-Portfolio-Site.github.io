import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3
} from "three";
function trackedMaterial(color, owned) {
  const material = new MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15 });
  owned.push(material);
  return material;
}
function trackedMesh(geometry, material, owned) {
  owned.push(geometry);
  return new Mesh(geometry, material);
}
function disposer(geometries, materials) {
  return () => {
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  };
}
const buildNetworking = (color) => {
  const geometries = [];
  const materials = [];
  const group = new Group();
  const material = trackedMaterial(color, materials);
  const dot = trackedMesh(new SphereGeometry(0.16, 20, 16), material, geometries);
  dot.position.y = -0.75;
  group.add(dot);
  const arcs = [];
  for (let i = 0; i < 3; i++) {
    const radius = 0.55 + i * 0.4;
    const arc = new TorusGeometry(radius, 0.05, 12, 32, Math.PI * 0.9);
    const mesh = trackedMesh(arc, material, geometries);
    mesh.position.y = -0.75;
    mesh.rotation.z = Math.PI + Math.PI * 0.05;
    mesh.rotation.x = Math.PI / 2;
    group.add(mesh);
    arcs.push(mesh);
  }
  return {
    group,
    animate(elapsedSeconds, reduced) {
      if (reduced) return;
      arcs.forEach((arc, i) => {
        const phase = elapsedSeconds * 1.6 - i * 0.4;
        const pulse = (Math.sin(phase) + 1) / 2;
        arc.material.opacity = 0.55 + pulse * 0.45;
      });
    },
    dispose: disposer(geometries, materials)
  };
};
const buildStorage = (color) => {
  const geometries = [];
  const materials = [];
  const group = new Group();
  const material = trackedMaterial(color, materials);
  const disks = [];
  for (let i = 0; i < 4; i++) {
    const disk = trackedMesh(new CylinderGeometry(0.7, 0.7, 0.14, 28), material, geometries);
    disk.position.y = -0.6 + i * 0.26;
    group.add(disk);
    disks.push(disk);
  }
  return {
    group,
    animate(elapsedSeconds, reduced) {
      if (reduced) return;
      group.rotation.y = elapsedSeconds * 0.5;
    },
    dispose: disposer(geometries, materials)
  };
};
const buildSecurity = (color) => {
  const geometries = [];
  const materials = [];
  const group = new Group();
  const material = trackedMaterial(color, materials);
  const body = trackedMesh(new BoxGeometry(1.1, 0.85, 0.55), material, geometries);
  body.position.y = -0.35;
  group.add(body);
  const shackle = trackedMesh(new TorusGeometry(0.42, 0.09, 12, 24, Math.PI), material, geometries);
  shackle.position.y = 0.3;
  shackle.rotation.z = Math.PI;
  group.add(shackle);
  const keyhole = trackedMesh(new CylinderGeometry(0.08, 0.08, 0.2, 12), material, geometries);
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(0, -0.3, 0.3);
  group.add(keyhole);
  return {
    group,
    animate(elapsedSeconds, reduced) {
      if (reduced) return;
      group.rotation.y = Math.sin(elapsedSeconds * 0.8) * 0.35;
    },
    dispose: disposer(geometries, materials)
  };
};
const buildCompute = (color) => {
  const geometries = [];
  const materials = [];
  const group = new Group();
  const material = trackedMaterial(color, materials);
  const ring = trackedMesh(new TorusGeometry(0.55, 0.16, 10, 24), material, geometries);
  group.add(ring);
  const hub = trackedMesh(new CylinderGeometry(0.22, 0.22, 0.3, 16), material, geometries);
  hub.rotation.x = Math.PI / 2;
  group.add(hub);
  const teeth = 8;
  for (let i = 0; i < teeth; i++) {
    const angle = i / teeth * Math.PI * 2;
    const tooth = trackedMesh(new BoxGeometry(0.18, 0.18, 0.22), material, geometries);
    tooth.position.set(Math.cos(angle) * 0.72, Math.sin(angle) * 0.72, 0);
    tooth.rotation.z = angle;
    group.add(tooth);
  }
  return {
    group,
    animate(elapsedSeconds, reduced) {
      if (reduced) return;
      group.rotation.z = elapsedSeconds * 0.6;
    },
    dispose: disposer(geometries, materials)
  };
};
const buildInfrastructure = (color) => {
  const geometries = [];
  const materials = [];
  const group = new Group();
  const material = trackedMaterial(color, materials);
  const windowMaterial = new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.6,
    roughness: 0.6
  });
  materials.push(windowMaterial);
  const heights = [0.7, 1.3, 0.9, 1.6, 1, 0.6];
  const windows = [];
  heights.forEach((height, i) => {
    const width = 0.28;
    const x = (i - (heights.length - 1) / 2) * 0.36;
    const building = trackedMesh(new BoxGeometry(width, height, width), material, geometries);
    building.position.set(x, height / 2 - 0.8, 0);
    group.add(building);
    const dot = trackedMesh(new BoxGeometry(0.05, 0.05, 0.02), windowMaterial, geometries);
    dot.position.set(x, height - 0.8 - 0.15, width / 2 + 0.01);
    group.add(dot);
    windows.push(dot);
  });
  const base = trackedMesh(new BoxGeometry(2.4, 0.1, 0.6), material, geometries);
  base.position.y = -0.85;
  group.add(base);
  return {
    group,
    animate(elapsedSeconds, reduced) {
      if (reduced) return;
      windows.forEach((w, i) => {
        const on = Math.sin(elapsedSeconds * 1.2 + i) > 0;
        w.material.emissiveIntensity = on ? 0.9 : 0.15;
      });
    },
    dispose: disposer(geometries, materials)
  };
};
const buildCommunity = (color) => {
  const geometries = [];
  const materials = [];
  const group = new Group();
  const material = trackedMaterial(color, materials);
  const lineMaterial = new LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
  materials.push(lineMaterial);
  const positions = [
    new Vector3(0, 0.4, 0),
    new Vector3(-0.7, -0.2, 0.2),
    new Vector3(0.7, -0.2, -0.2),
    new Vector3(-0.3, -0.7, -0.3),
    new Vector3(0.4, -0.6, 0.3)
  ];
  const nodes = positions.map((position) => {
    const node = trackedMesh(new SphereGeometry(0.15, 16, 12), material, geometries);
    node.position.copy(position);
    group.add(node);
    return node;
  });
  const edges = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 4]
  ];
  for (const [a, b] of edges) {
    const lineGeometry = new BufferGeometry().setFromPoints([positions[a], positions[b]]);
    geometries.push(lineGeometry);
    group.add(new Line(lineGeometry, lineMaterial));
  }
  return {
    group,
    animate(elapsedSeconds, reduced) {
      if (reduced) return;
      nodes.forEach((node, i) => {
        node.position.y = positions[i].y + Math.sin(elapsedSeconds * 1.4 + i) * 0.05;
      });
    },
    dispose: disposer(geometries, materials)
  };
};
const buildQuantum = (color) => {
  const geometries = [];
  const materials = [];
  const group = new Group();
  const material = trackedMaterial(color, materials);
  const lineMaterial = new LineBasicMaterial({ color, transparent: true, opacity: 0.5 });
  materials.push(lineMaterial);
  const rows = 3;
  const cols = 4;
  const qubits = [];
  for (let r = 0; r < rows; r++) {
    const rowNodes = [];
    const points = [];
    for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * 0.45;
      const y = (r - (rows - 1) / 2) * 0.45;
      const point = new Vector3(x, y, 0);
      points.push(point);
      const node = trackedMesh(new SphereGeometry(0.08, 12, 10), material, geometries);
      node.position.copy(point);
      group.add(node);
      rowNodes.push(node);
    }
    const wireGeometry = new BufferGeometry().setFromPoints(points);
    geometries.push(wireGeometry);
    group.add(new Line(wireGeometry, lineMaterial));
    qubits.push(rowNodes);
  }
  const gates = [];
  const gatePositions = [
    [1, 0],
    [2, 1],
    [0, 2],
    [3, 1]
  ];
  for (const [c, r] of gatePositions) {
    const x = (c - (cols - 1) / 2) * 0.45;
    const y = (r - (rows - 1) / 2) * 0.45;
    const gate = trackedMesh(new BoxGeometry(0.2, 0.2, 0.2), material, geometries);
    gate.position.set(x, y, 0);
    group.add(gate);
    gates.push(gate);
  }
  return {
    group,
    animate(elapsedSeconds, reduced) {
      if (reduced) return;
      gates.forEach((gate, i) => {
        const s = 1 + Math.sin(elapsedSeconds * 2 + i) * 0.15;
        gate.scale.setScalar(s);
      });
    },
    dispose: disposer(geometries, materials)
  };
};
const buildCrypto = (color) => {
  const geometries = [];
  const materials = [];
  const group = new Group();
  const material = trackedMaterial(color, materials);
  const leaves = [];
  function branch(origin, direction, length, depth) {
    const end = origin.clone().add(direction.clone().multiplyScalar(length));
    const mid = origin.clone().lerp(end, 0.5);
    const radius = 0.05 * (depth + 1);
    const cylinder = trackedMesh(new CylinderGeometry(radius * 0.6, radius, length, 8), material, geometries);
    cylinder.position.copy(mid);
    cylinder.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
    group.add(cylinder);
    if (depth === 0) {
      const leaf = trackedMesh(new SphereGeometry(0.09, 12, 10), material, geometries);
      leaf.position.copy(end);
      group.add(leaf);
      leaves.push(leaf);
      return;
    }
    const spread = 0.55;
    const left = direction.clone().applyAxisAngle(new Vector3(0, 0, 1), spread).normalize();
    const right = direction.clone().applyAxisAngle(new Vector3(0, 0, 1), -spread).normalize();
    branch(end, left, length * 0.72, depth - 1);
    branch(end, right, length * 0.72, depth - 1);
  }
  branch(new Vector3(0, -0.9, 0), new Vector3(0, 1, 0), 0.55, 2);
  return {
    group,
    animate(elapsedSeconds, reduced) {
      if (reduced) return;
      leaves.forEach((leaf, i) => {
        const s = 1 + Math.sin(elapsedSeconds * 2.2 + i) * 0.2;
        leaf.scale.setScalar(s);
      });
    },
    dispose: disposer(geometries, materials)
  };
};
const buildMedical = (color) => {
  const geometries = [];
  const materials = [];
  const group = new Group();
  const material = trackedMaterial(color, materials);
  const points = [
    new Vector3(-1.1, 0, 0),
    new Vector3(-0.6, 0, 0),
    new Vector3(-0.35, 0.15, 0),
    new Vector3(-0.15, -0.55, 0),
    new Vector3(0, 0.75, 0),
    new Vector3(0.2, -0.1, 0),
    new Vector3(0.5, 0, 0),
    new Vector3(1.1, 0, 0)
  ];
  const curve = new CatmullRomCurve3(points, false, "catmullrom", 0.2);
  const tube = new TubeGeometry(curve, 64, 0.045, 8, false);
  geometries.push(tube);
  const pulseLine = trackedMesh(tube, material, geometries);
  group.add(pulseLine);
  const marker = trackedMesh(new SphereGeometry(0.1, 14, 12), material, geometries);
  group.add(marker);
  return {
    group,
    animate(elapsedSeconds, reduced) {
      if (reduced) {
        marker.visible = false;
        return;
      }
      marker.visible = true;
      const t = elapsedSeconds * 0.3 % 1;
      const position = curve.getPointAt(t);
      marker.position.copy(position);
    },
    dispose: disposer(geometries, materials)
  };
};
const buildCore = (color) => {
  const geometries = [];
  const materials = [];
  const group = new Group();
  const material = trackedMaterial(color, materials);
  const shape = trackedMesh(new IcosahedronGeometry(0.75, 0), material, geometries);
  group.add(shape);
  return {
    group,
    animate(elapsedSeconds, reduced) {
      if (reduced) return;
      group.rotation.y = elapsedSeconds * 0.4;
      group.rotation.x = elapsedSeconds * 0.15;
    },
    dispose: disposer(geometries, materials)
  };
};
const THEME_BUILDERS = {
  networking: buildNetworking,
  storage: buildStorage,
  security: buildSecurity,
  compute: buildCompute,
  infrastructure: buildInfrastructure,
  community: buildCommunity,
  quantum: buildQuantum,
  crypto: buildCrypto,
  medical: buildMedical,
  core: buildCore
};
function buildScene(theme, color) {
  return THEME_BUILDERS[theme](color);
}
export {
  buildScene
};
