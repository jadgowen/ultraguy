// Publish the game to GitHub Pages.
//
//   npm run deploy
//
// Builds (typecheck + tests + Vite), then pushes dist/ as the only commit on
// the `gh-pages` branch of `origin`. Pages serves that branch at
// https://<user>.github.io/<repo>/.

import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const root = new URL('..', import.meta.url).pathname;

run('npm run build', root);

const dir = mkdtempSync(join(tmpdir(), 'ultraguy-pages-'));
try {
  // A throwaway worktree, so the push uses this repo's remote and credentials.
  run(`git worktree add --detach "${dir}"`, root);
  run('git checkout --orphan gh-pages-build', dir);
  run('git rm -rf --quiet .', dir);
  cpSync(join(root, 'dist'), dir, { recursive: true });
  writeFileSync(join(dir, '.nojekyll'), ''); // serve files as-is
  run('git add -A', dir);
  const rev = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
  run(`git commit --quiet -m "Deploy ${rev}"`, dir);
  run('git push --force origin HEAD:gh-pages', dir);
} finally {
  execSync(`git worktree remove --force "${dir}"`, { cwd: root });
  execSync('git branch -D gh-pages-build', { cwd: root, stdio: 'ignore' });
  rmSync(dir, { recursive: true, force: true });
}
console.log('\nDeployed. Pages updates within a minute or two.');
