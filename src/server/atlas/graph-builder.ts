import type { DatabaseClient } from '../db/index.js';

export const HARD_ATLAS_NODE_CAP = 300;

export type AtlasNodeKind =
  | 'source'
  | 'task'
  | 'ai_skill'
  | 'topic'
  | 'cluster';

export type AtlasNodeShape = 'square' | 'circle' | 'diamond' | 'ring';

export interface AtlasNode {
  id: string;
  kind: AtlasNodeKind;
  shape: AtlasNodeShape;
  label: string;
  subtitle: string;
  entityId: string;
  platform?: string | null;
  topicSlug?: string | null;
  clusterCount?: number;
  x: number;
  y: number;
  z: number;
}

export interface AtlasEdge {
  id: string;
  source: string;
  target: string;
  relationship: 'derived_from' | 'categorized_as' | 'clustered_in';
}

export interface AtlasGraphResponse {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  adjacency: Record<string, string[]>;
  totalUnclusteredNodes: number;
  clustered: boolean;
  focusNodeId: string | null;
  maxHops: number;
  legend: Array<{
    kind: AtlasNodeKind;
    shape: AtlasNodeShape;
    label: string;
  }>;
}

export interface AtlasQueryOptions {
  type?: 'task' | 'ai_skill';
  topic?: string;
  platform?: 'youtube' | 'instagram' | 'manual';
  q?: string;
  focusNodeId?: string;
  maxHops?: number;
  expandClusterTopic?: string;
}

/**
 * Deterministic 32-bit FNV-1a hash for seeded node layout (Section 6.5.1).
 */
export function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function computeSeededPosition(
  nodeId: string,
  kind: AtlasNodeKind
): { x: number; y: number; z: number } {
  const h1 = fnv1aHash(nodeId);
  const h2 = fnv1aHash(`${nodeId}:y`);
  const h3 = fnv1aHash(`${nodeId}:z`);

  const angle = ((h1 % 36000) / 36000) * Math.PI * 2;
  const baseRadius =
    kind === 'topic' || kind === 'cluster'
      ? 110
      : kind === 'task' || kind === 'ai_skill'
        ? 230
        : 340;
  const jitter = ((h2 % 1000) / 1000 - 0.5) * 55;
  const r = baseRadius + jitter;

  const x = Math.round(Math.cos(angle) * r * 100) / 100;
  const y = Math.round(Math.sin(angle) * r * 100) / 100;
  const z = Math.round((((h3 % 2000) / 2000 - 0.5) * 180) * 100) / 100;

  return { x, y, z };
}

export class AtlasGraphBuilder {
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  async buildUserAtlas(
    userId: string,
    options: AtlasQueryOptions = {}
  ): Promise<AtlasGraphResponse> {
    const values: unknown[] = [userId];
    const conditions: string[] = [
      `a.user_id = $1`,
      `a.deleted_at IS NULL`,
      `a.status != 'pending_delete'`,
    ];

    if (options.type === 'task' || options.type === 'ai_skill') {
      values.push(options.type);
      conditions.push(`a.artifact_type = $${values.length}`);
    }

    if (options.topic && options.topic.trim()) {
      values.push(options.topic.trim().toLowerCase());
      conditions.push(`EXISTS (
        SELECT 1 FROM artifact_categories ac
        JOIN categories c ON c.id = ac.category_id
        WHERE ac.artifact_id = a.id AND c.slug = $${values.length}
      )`);
    }

    if (options.platform) {
      values.push(options.platform);
      conditions.push(`EXISTS (
        SELECT 1 FROM artifact_sources asrc
        JOIN sources s ON s.id = asrc.source_id
        WHERE asrc.artifact_id = a.id AND s.platform = $${values.length}
      )`);
    }

    if (options.q && options.q.trim()) {
      values.push(`%${options.q.trim()}%`);
      conditions.push(
        `(a.title ILIKE $${values.length} OR a.description ILIKE $${values.length})`
      );
    }

    // Load artifacts matching filters (bounded query to check if >300 clustering is needed)
    const artifactsRes = await this.db.query<{
      id: string;
      artifact_type: 'task' | 'ai_skill';
      title: string;
      provenance_mode: string;
    }>(
      `SELECT a.id, a.artifact_type, a.title, a.provenance_mode
       FROM artifacts a
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.created_at DESC, a.id ASC
       LIMIT 1000`,
      values
    );

    const artifactIds = artifactsRes.rows.map((a) => a.id);
    if (artifactIds.length === 0) {
      return {
        nodes: [],
        edges: [],
        adjacency: {},
        totalUnclusteredNodes: 0,
        clustered: false,
        focusNodeId: options.focusNodeId ?? null,
        maxHops: options.maxHops ?? 2,
        legend: getAtlasLegend(),
      };
    }

    // Load linked sources for these artifacts
    const sourcesRes = await this.db.query<{
      artifact_id: string;
      source_id: string;
      platform: string;
      canonical_url: string;
      platform_content_id: string;
      metadata_json: { title?: string; author_name?: string };
    }>(
      `SELECT
        asrc.artifact_id,
        s.id AS source_id,
        s.platform,
        s.canonical_url,
        s.platform_content_id,
        s.metadata_json
       FROM artifact_sources asrc
       JOIN sources s ON s.id = asrc.source_id
       WHERE s.user_id = $1`,
      [userId]
    );

    // Load linked categories/topics
    const catsRes = await this.db.query<{
      artifact_id: string;
      category_id: string;
      name: string;
      slug: string;
    }>(
      `SELECT
        ac.artifact_id,
        c.id AS category_id,
        c.name,
        c.slug
       FROM artifact_categories ac
       JOIN categories c ON c.id = ac.category_id
       WHERE c.owner_user_id = $1`,
      [userId]
    );

    const activeArtifactSet = new Set(artifactIds);
    const nodeMap = new Map<string, AtlasNode>();
    const edgeList: AtlasEdge[] = [];

    for (const art of artifactsRes.rows) {
      const nodeId = `artifact:${art.id}`;
      const pos = computeSeededPosition(nodeId, art.artifact_type);
      nodeMap.set(nodeId, {
        id: nodeId,
        kind: art.artifact_type,
        shape: art.artifact_type === 'task' ? 'circle' : 'diamond',
        label: art.title,
        subtitle: art.artifact_type === 'task' ? 'Task' : 'AI skill',
        entityId: art.id,
        ...pos,
      });
    }

    for (const src of sourcesRes.rows) {
      if (!activeArtifactSet.has(src.artifact_id)) continue;
      const srcNodeId = `source:${src.source_id}`;
      if (!nodeMap.has(srcNodeId)) {
        const pos = computeSeededPosition(srcNodeId, 'source');
        const label =
          src.metadata_json?.title ||
          `${src.platform}:${src.platform_content_id}`;
        nodeMap.set(srcNodeId, {
          id: srcNodeId,
          kind: 'source',
          shape: 'square',
          label,
          subtitle: `Source (${src.platform})`,
          entityId: src.source_id,
          platform: src.platform,
          ...pos,
        });
      }
      const artNodeId = `artifact:${src.artifact_id}`;
      edgeList.push({
        id: `edge:${srcNodeId}->${artNodeId}`,
        source: srcNodeId,
        target: artNodeId,
        relationship: 'derived_from',
      });
    }

    const artifactPrimaryTopic = new Map<string, string>();
    for (const cat of catsRes.rows) {
      if (!activeArtifactSet.has(cat.artifact_id)) continue;
      const topNodeId = `topic:${cat.slug}`;
      if (!nodeMap.has(topNodeId)) {
        const pos = computeSeededPosition(topNodeId, 'topic');
        nodeMap.set(topNodeId, {
          id: topNodeId,
          kind: 'topic',
          shape: 'ring',
          label: cat.name,
          subtitle: `Topic #${cat.slug}`,
          entityId: cat.category_id,
          topicSlug: cat.slug,
          ...pos,
        });
      }
      const artNodeId = `artifact:${cat.artifact_id}`;
      if (!artifactPrimaryTopic.has(artNodeId)) {
        artifactPrimaryTopic.set(artNodeId, cat.slug);
      }
      edgeList.push({
        id: `edge:${artNodeId}->${topNodeId}`,
        source: artNodeId,
        target: topNodeId,
        relationship: 'categorized_as',
      });
    }

    const totalUnclusteredNodes = nodeMap.size;
    const maxHops = Math.min(Math.max(options.maxHops ?? 2, 1), 3);

    // Build full adjacency list
    const fullAdjacency = buildAdjacencyMap(
      Array.from(nodeMap.keys()),
      edgeList
    );

    // If focusNodeId is provided and exists, extract bounded 2-hop neighborhood via BFS (O(V + E))
    if (options.focusNodeId && nodeMap.has(options.focusNodeId)) {
      const visited = bfsNeighborhood(
        options.focusNodeId,
        fullAdjacency,
        maxHops,
        HARD_ATLAS_NODE_CAP
      );
      const filteredNodes = Array.from(visited)
        .map((id) => nodeMap.get(id)!)
        .filter(Boolean);
      const filteredEdges = edgeList.filter(
        (e) => visited.has(e.source) && visited.has(e.target)
      );
      const subAdj = buildAdjacencyMap(
        filteredNodes.map((n) => n.id),
        filteredEdges
      );

      return {
        nodes: filteredNodes,
        edges: filteredEdges,
        adjacency: subAdj,
        totalUnclusteredNodes,
        clustered: false,
        focusNodeId: options.focusNodeId,
        maxHops,
        legend: getAtlasLegend(),
      };
    }

    // Section 6.5.3: Hard cap of 300 rendered nodes; beyond 300, cluster by topic
    if (nodeMap.size > HARD_ATLAS_NODE_CAP) {
      const clustered = clusterGraphByTopic(
        nodeMap,
        edgeList,
        artifactPrimaryTopic,
        options.expandClusterTopic
      );
      const clusterAdj = buildAdjacencyMap(
        clustered.nodes.map((n) => n.id),
        clustered.edges
      );
      return {
        nodes: clustered.nodes,
        edges: clustered.edges,
        adjacency: clusterAdj,
        totalUnclusteredNodes,
        clustered: true,
        focusNodeId: null,
        maxHops,
        legend: getAtlasLegend(),
      };
    }

    const nodes = Array.from(nodeMap.values());
    return {
      nodes,
      edges: edgeList,
      adjacency: fullAdjacency,
      totalUnclusteredNodes,
      clustered: false,
      focusNodeId: null,
      maxHops,
      legend: getAtlasLegend(),
    };
  }
}

function buildAdjacencyMap(
  nodeIds: string[],
  edges: AtlasEdge[]
): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};
  for (const id of nodeIds) {
    map[id] = new Set();
  }
  for (const e of edges) {
    if (map[e.source] && map[e.target]) {
      map[e.source].add(e.target);
      map[e.target].add(e.source);
    }
  }
  const out: Record<string, string[]> = {};
  for (const [id, set] of Object.entries(map)) {
    out[id] = Array.from(set).sort();
  }
  return out;
}

/**
 * Bounded BFS neighborhood traversal in O(V_sub + E_sub) time (Section 8.3).
 */
export function bfsNeighborhood(
  startNodeId: string,
  adjacency: Record<string, string[]>,
  maxHops: number,
  maxNodes: number
): Set<string> {
  const visited = new Set<string>([startNodeId]);
  const queue: Array<{ id: string; depth: number }> = [
    { id: startNodeId, depth: 0 },
  ];
  let head = 0;

  while (head < queue.length && visited.size < maxNodes) {
    const current = queue[head++];
    if (current.depth >= maxHops) continue;

    const neighbors = adjacency[current.id] ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        if (visited.size >= maxNodes) break;
        queue.push({ id: neighbor, depth: current.depth + 1 });
      }
    }
  }

  return visited;
}

function clusterGraphByTopic(
  nodeMap: Map<string, AtlasNode>,
  edgeList: AtlasEdge[],
  artifactPrimaryTopic: Map<string, string>,
  expandClusterTopic?: string
): { nodes: AtlasNode[]; edges: AtlasEdge[] } {
  const topicCounts = new Map<string, number>();
  for (const [, slug] of artifactPrimaryTopic) {
    topicCounts.set(slug, (topicCounts.get(slug) ?? 0) + 1);
  }

  const outNodes: AtlasNode[] = [];
  const outNodeIds = new Set<string>();

  // Always include topic nodes and cluster nodes
  for (const node of nodeMap.values()) {
    if (node.kind === 'topic') {
      const slug = node.topicSlug ?? 'general';
      const count = topicCounts.get(slug) ?? 0;
      if (expandClusterTopic === slug) {
        outNodes.push(node);
        outNodeIds.add(node.id);
      } else {
        const clusterNode: AtlasNode = {
          ...node,
          id: `cluster:${slug}`,
          kind: 'cluster',
          shape: 'ring',
          label: `${node.label} (${count} items)`,
          subtitle: `Topic cluster · click to expand`,
          clusterCount: count,
        };
        outNodes.push(clusterNode);
        outNodeIds.add(clusterNode.id);
      }
    }
  }

  // Add expanded topic's artifacts and sources up to HARD_ATLAS_NODE_CAP
  for (const node of nodeMap.values()) {
    if (outNodes.length >= HARD_ATLAS_NODE_CAP) break;
    if (node.kind === 'task' || node.kind === 'ai_skill') {
      const slug = artifactPrimaryTopic.get(node.id) ?? 'general';
      if (
        expandClusterTopic === slug ||
        outNodes.length < Math.floor(HARD_ATLAS_NODE_CAP * 0.65)
      ) {
        outNodes.push(node);
        outNodeIds.add(node.id);
      }
    }
  }

  for (const node of nodeMap.values()) {
    if (outNodes.length >= HARD_ATLAS_NODE_CAP) break;
    if (node.kind === 'source') {
      const connectedToVisible = edgeList.some(
        (e) => e.source === node.id && outNodeIds.has(e.target)
      );
      if (connectedToVisible) {
        outNodes.push(node);
        outNodeIds.add(node.id);
      }
    }
  }

  const outEdges: AtlasEdge[] = [];
  for (const e of edgeList) {
    if (outNodeIds.has(e.source) && outNodeIds.has(e.target)) {
      outEdges.push(e);
    } else if (outNodeIds.has(e.source) && e.target.startsWith('topic:')) {
      const slug = e.target.slice('topic:'.length);
      const clusterId = `cluster:${slug}`;
      if (outNodeIds.has(clusterId)) {
        outEdges.push({
          id: `edge:${e.source}->${clusterId}`,
          source: e.source,
          target: clusterId,
          relationship: 'clustered_in',
        });
      }
    }
  }

  return {
    nodes: outNodes.slice(0, HARD_ATLAS_NODE_CAP),
    edges: outEdges,
  };
}

function getAtlasLegend() {
  return [
    { kind: 'source' as const, shape: 'square' as const, label: 'Source video / transcript' },
    { kind: 'task' as const, shape: 'circle' as const, label: 'Task artifact' },
    { kind: 'ai_skill' as const, shape: 'diamond' as const, label: 'AI skill artifact' },
    { kind: 'topic' as const, shape: 'ring' as const, label: 'Topic category' },
  ];
}
