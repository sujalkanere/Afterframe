import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { AtlasEdge, AtlasNode } from '../../server/atlas/graph-builder.js';

export interface Atlas3DCanvasProps {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onWebGLUnavailable: () => void;
}

/**
 * Lazy-loaded optional 3D WebGL Atlas renderer (Section 6.5.2, Section 6.11).
 * Loaded via dynamic import only when requested inside the Atlas view.
 * Automatically notifies parent to fall back to 2D if WebGL context creation fails (NFR-018).
 */
const Atlas3DCanvas: React.FC<Atlas3DCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onWebGLUnavailable,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [angleY, setAngleY] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onWebGLUnavailable();
      return;
    }

    const width = container.clientWidth || 720;
    const height = 460;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 2500);
    camera.position.set(
      Math.sin(angleY) * 680,
      140,
      Math.cos(angleY) * 680
    );
    camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xf0b35a, 1.2, 1600);
    pointLight.position.set(200, 350, 300);
    scene.add(pointLight);

    const nodeLookup = new Map<string, AtlasNode>();
    nodes.forEach((n) => nodeLookup.set(n.id, n));

    // Edges
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x363d46,
      transparent: true,
      opacity: 0.7,
    });

    for (const edge of edges) {
      const s = nodeLookup.get(edge.source);
      const t = nodeLookup.get(edge.target);
      if (!s || !t) continue;
      const points = [
        new THREE.Vector3(s.x, s.z, s.y),
        new THREE.Vector3(t.x, t.z, t.y),
      ];
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geom, lineMaterial);
      scene.add(line);
    }

    // Nodes by shape: square=box, circle=sphere, diamond=octahedron, ring=torus
    const meshes: Array<{ mesh: THREE.Mesh; nodeId: string }> = [];

    for (const node of nodes) {
      const isSelected = node.id === selectedNodeId;
      const color = isSelected
        ? 0x8fd0ff
        : node.kind === 'source'
          ? 0x7cc4d2
          : node.kind === 'ai_skill'
            ? 0xb9a6e8
            : node.kind === 'task'
              ? 0xf0b35a
              : 0x9ba4ae;

      let geom: THREE.BufferGeometry;
      if (node.shape === 'square') {
        geom = new THREE.BoxGeometry(18, 18, 18);
      } else if (node.shape === 'diamond') {
        geom = new THREE.OctahedronGeometry(13);
      } else if (node.shape === 'ring') {
        geom = new THREE.TorusGeometry(12, 3.5, 12, 24);
      } else {
        geom = new THREE.SphereGeometry(11, 20, 20);
      }

      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.15,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(node.x, node.z, node.y);
      scene.add(mesh);
      meshes.push({ mesh, nodeId: node.id });
    }

    renderer.render(scene, camera);

    const handleClick = (ev: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshes.map((m) => m.mesh));
      if (hits.length > 0) {
        const hitMesh = hits[0].object;
        const found = meshes.find((m) => m.mesh === hitMesh);
        if (found) onSelectNode(found.nodeId);
      }
    };

    renderer.domElement.addEventListener('click', handleClick);

    return () => {
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.dispose();
    };
  }, [nodes, edges, selectedNodeId, angleY, onWebGLUnavailable, onSelectNode]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-2)',
          gap: 'var(--space-2)',
        }}
      >
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          3D spatial projection (seeded coordinates · click node to inspect)
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="af-btn"
            onClick={() => setAngleY((a) => a - 0.35)}
          >
            Rotate left
          </button>
          <button
            type="button"
            className="af-btn"
            onClick={() => setAngleY((a) => a + 0.35)}
          >
            Rotate right
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '460px',
          borderRadius: 'var(--radius-panel)',
          border: '1px solid var(--line)',
          background: 'var(--surface-1)',
          overflow: 'hidden',
        }}
      />
    </div>
  );
};

export default Atlas3DCanvas;
