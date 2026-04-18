#!/usr/bin/env node
/**
 * scripts/release.js
 * Run with: npm run release
 * Bumps version, commits, tags, and pushes to GitHub.
 * GitHub Actions takes it from there — builds the DMG and creates the release.
 */

const { execSync } = require('child_process');
const readline      = require('readline');
const fs            = require('fs');
const path          = require('path');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

function run(cmd, opts = {}) {
  console.log(`  → ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

async function main() {
  console.log('\n🚀  ElevateFlow Release Script\n');

  // ── Get version ──────────────────────────────────────────────
  const pkgPath    = path.join(__dirname, '..', 'package.json');
  const tauriPath  = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
  const notifPath    = path.join(__dirname, '..', 'src', 'UpdateNotifier.jsx');
  const updaterPath  = path.join(__dirname, '..', 'src', 'useUpdater.js');

  const pkg    = JSON.parse(fs.readFileSync(pkgPath,   'utf8'));
  const tauri  = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
  const current = pkg.version || '0.1.0';

  console.log(`  Current version: ${current}`);
  const version = (await ask(`  New version (e.g. 0.2.0): `)).trim();

  if (!version.match(/^\d+\.\d+\.\d+$/)) {
    console.error('\n❌  Invalid version format. Use X.Y.Z (e.g. 0.2.0)\n');
    process.exit(1);
  }

  const notes = (await ask(`  Release notes (one line): `)).trim() || `ElevateFlow ${version}`;
  rl.close();

  console.log('\n📝  Updating version numbers...');

  // ── Update package.json ───────────────────────────────────────
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // ── Update tauri.conf.json ────────────────────────────────────
  tauri.version = version;
  fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n');

  // ── Update CURRENT_VER in UpdateNotifier.jsx ──────────────────
  let notif = fs.readFileSync(notifPath, 'utf8');
  notif = notif.replace(
    /const CURRENT_VER\s*=\s*'[^']*'/,
    `const CURRENT_VER  = '${version}'`
  );
  fs.writeFileSync(notifPath, notif);

  // ── Update CURRENT_VER in useUpdater.js ────────────────────────
  if (fs.existsSync(updaterPath)) {
    let updater = fs.readFileSync(updaterPath, 'utf8');
    updater = updater.replace(
      /const CURRENT_VER = '[^']*'/,
      `const CURRENT_VER = '${version}'`
    );
    fs.writeFileSync(updaterPath, updater);
  }

  console.log('  ✓ package.json');
  console.log('  ✓ src-tauri/tauri.conf.json');
  console.log('  ✓ src/UpdateNotifier.jsx');

  // ── Git commit + tag + push ───────────────────────────────────
  console.log('\n📦  Committing and tagging...');
  run('git add package.json src-tauri/tauri.conf.json src/UpdateNotifier.jsx src/useUpdater.js');
  run(`git commit -m "Release v${version}"`);
  run(`git tag v${version}`);

  console.log('\n🚀  Pushing to GitHub...');
  run('git push');
  run('git push --tags');

  console.log(`
✅  Done! v${version} is on its way.

   GitHub Actions is now building the DMG.
   Check progress at: https://github.com/jjstudiowork-spec/elevateflow/actions

   Once done, users will see the update prompt next time they open ElevateFlow.
`);
}

main().catch(e => { console.error(e); process.exit(1); });
