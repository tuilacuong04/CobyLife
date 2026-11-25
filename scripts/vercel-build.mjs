#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPENGYM_FRONTEND = path.join(ROOT, 'opengym', 'frontend');
const OPENGYM_OUT = path.join(ROOT, 'public', 'opengym');
const MEDIA_CACHE_DIR = path.join(ROOT, 'node_modules', '.cache', 'opengym-media');
const UPSTREAM_REPO = 'https://github.com/DuarteSantos8/openGym.git';

function run(cmd, { env: extraEnv, ...restOpts } = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, {
    cwd: ROOT,
    stdio: 'inherit',
    ...restOpts,
    env: { ...process.env, ...(extraEnv || {}) },
  });
}

// 1. Ensure openGym frontend dependencies are installed
if (!existsSync(path.join(OPENGYM_FRONTEND, 'node_modules'))) {
  console.log('[vercel-build] Installing opengym/frontend dependencies...');
  run('npm --prefix opengym/frontend ci');
}

// 2. Build openGym static demo bundle into public/opengym
console.log('[vercel-build] Building openGym frontend into public/opengym...');
run('npm --prefix opengym/frontend run build -- --outDir ../../public/opengym --emptyOutDir', {
  env: { VITE_DEMO: '1' },
});

// 3. Stage 180px exercise stills & MP4 animations (cached across Vercel deployments)
if (process.env.SKIP_OPENGYM_MEDIA === '1') {
  console.log('[vercel-build] Skipping openGym exercise media staging (SKIP_OPENGYM_MEDIA=1).');
} else {
  const stageScript = path.join(MEDIA_CACHE_DIR, 'scripts', 'catalogue', 'stage-media.mjs');
  const stillDir = path.join(MEDIA_CACHE_DIR, 'catalogue', 'media', 'still');
  const clipDir = path.join(MEDIA_CACHE_DIR, 'catalogue', 'media', 'clip');

  if (!existsSync(stageScript) || !existsSync(stillDir) || !existsSync(clipDir)) {
    console.log('[vercel-build] Fetching openGym 180px exercise media catalogue...');
    rmSync(MEDIA_CACHE_DIR, { recursive: true, force: true });
    mkdirSync(path.dirname(MEDIA_CACHE_DIR), { recursive: true });
    run(`git clone --depth=1 --filter=blob:none --sparse ${UPSTREAM_REPO} "${MEDIA_CACHE_DIR}"`);
    run(`git -C "${MEDIA_CACHE_DIR}" sparse-checkout set catalogue/media scripts/catalogue`);
  } else {
    console.log('[vercel-build] Using cached openGym media catalogue from node_modules/.cache/opengym-media');
  }

  console.log('[vercel-build] Staging exercise media into public/opengym/exercise-media...');
  run(`node "${stageScript}" "${OPENGYM_OUT}"`);
}

// 4. Build Coby LIFE Hub (TypeScript check + Vite bundle -> dist/)
console.log('[vercel-build] Building Coby LIFE Personal OS...');
run('npm run build');
console.log('[vercel-build] Build completed successfully! Output ready in dist/');
