import { performance } from 'node:perf_hooks';
import { createDatabase } from '../src/server/db/index.js';
import { ArtifactService } from '../src/server/artifacts/artifact-service.js';
import { AtlasGraphBuilder } from '../src/server/atlas/graph-builder.js';
import { canonicalizeVideoUrl } from '../src/shared/url-canonicalizer.js';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[idx];
}

async function runBenchmarks() {
  console.log('=== Afterframe Phase 7 Performance & Query-Plan Benchmark ===');
  const db = await createDatabase({ dataDir: 'memory://' });
  const userId = 'usr_bench_500';

  await db.query(
    `INSERT INTO users (id, email, display_name, is_guest) VALUES ($1, 'bench@example.com', 'Bench', FALSE)`,
    [userId]
  );

  const topics = ['coding', 'git', 'python', 'devops', 'workflow'];
  for (const slug of topics) {
    await db.query(
      `INSERT INTO categories (id, owner_user_id, name, slug) VALUES ($1, $2, $3, $4)`,
      [`cat_${slug}`, userId, slug.toUpperCase(), slug]
    );
  }

  for (let s = 0; s < 25; s++) {
    const vid = `benchVid${s.toString().padStart(3, '0')}`;
    await db.query(
      `INSERT INTO sources (id, user_id, platform, submitted_url, canonical_url, platform_content_id, metadata_json)
       VALUES ($1, $2, 'youtube', $3, $3, $4, '{"title":"Benchmark Short"}'::jsonb)`,
      [
        `src_${s}`,
        userId,
        `https://www.youtube.com/shorts/${vid}`,
        vid,
      ]
    );
  }

  // Insert 500 artifacts in isolated benchmark DB (NFR-005 target: 500 items)
  for (let i = 0; i < 500; i++) {
    const artId = `art_bench_${i.toString().padStart(4, '0')}`;
    const type = i % 3 === 0 ? 'ai_skill' : 'task';
    const topicSlug = topics[i % topics.length];
    const srcId = `src_${i % 25}`;
    await db.query(
      `INSERT INTO artifacts (id, user_id, artifact_type, title, description, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [
        artId,
        userId,
        type,
        `Configure ${topicSlug} workflow step ${i}`,
        `Detailed grounded procedure for ${topicSlug} automation item ${i} with git status verification.`,
      ]
    );
    await db.query(
      `INSERT INTO artifact_sources (artifact_id, source_id) VALUES ($1, $2)`,
      [artId, srcId]
    );
    await db.query(
      `INSERT INTO artifact_categories (artifact_id, category_id) VALUES ($1, $2)`,
      [artId, `cat_${topicSlug}`]
    );
  }

  await db.query(`ANALYZE`);

  // 1. URL Canonicalization benchmark (1,000 runs)
  const urlTimes: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const t0 = performance.now();
    canonicalizeVideoUrl(
      'https://www.youtube.com/shorts/SWx0YfIjjx8?feature=share&si=xyz'
    );
    urlTimes.push(performance.now() - t0);
  }
  urlTimes.sort((a, b) => a - b);

  // 2. Library Search + Filter benchmark across 500 items (50 runs)
  const artifactService = new ArtifactService(db);
  const searchTimes: number[] = [];
  for (let i = 0; i < 50; i++) {
    const t0 = performance.now();
    await artifactService.listArtifacts(userId, {
      q: 'git workflow',
      type: 'task',
      topic: 'git',
      limit: 50,
    });
    searchTimes.push(performance.now() - t0);
  }
  searchTimes.sort((a, b) => a - b);

  // 3. Atlas 2-hop BFS + 300-node Topic Clustering benchmark across 530 total graph nodes (30 runs)
  const atlasBuilder = new AtlasGraphBuilder(db);
  const atlasTimes: number[] = [];
  for (let i = 0; i < 30; i++) {
    const t0 = performance.now();
    await atlasBuilder.buildUserAtlas(userId);
    atlasTimes.push(performance.now() - t0);
  }
  atlasTimes.sort((a, b) => a - b);

  // 4. EXPLAIN ANALYZE query plan verification (Phase 7 Task 2)
  const explainFts = await db.query<{ 'QUERY PLAN': string }>(
    `EXPLAIN ANALYZE
     SELECT a.id, a.title
     FROM artifacts a
     WHERE a.user_id = $1
       AND a.deleted_at IS NULL
       AND to_tsvector('simple', coalesce(a.title, '') || ' ' || coalesce(a.description, ''))
           @@ plainto_tsquery('simple', 'git workflow')
     ORDER BY a.created_at DESC
     LIMIT 50`,
    [userId]
  );

  const report = {
    url_canonicalization_ms: {
      p50: Number(percentile(urlTimes, 50).toFixed(4)),
      p95: Number(percentile(urlTimes, 95).toFixed(4)),
    },
    library_search_500_items_ms: {
      p50: Number(percentile(searchTimes, 50).toFixed(2)),
      p95: Number(percentile(searchTimes, 95).toFixed(2)),
      nfr_005_budget_ms: 300,
      passes_budget: percentile(searchTimes, 95) < 300,
    },
    atlas_graph_530_nodes_clustered_to_300_ms: {
      p50: Number(percentile(atlasTimes, 50).toFixed(2)),
      p95: Number(percentile(atlasTimes, 95).toFixed(2)),
    },
    explain_analyze_fts_plan: explainFts.rows.map((r) => r['QUERY PLAN']),
  };

  console.log(JSON.stringify(report, null, 2));
  await db.close();
}

runBenchmarks().catch((err) => {
  console.error(err);
  process.exit(1);
});
