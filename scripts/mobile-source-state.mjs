import { execFileSync } from 'node:child_process';

// A source SHA is useful only when it describes all packaged inputs, including
// new files. Ignored build output and local configuration are not source files.
export function requireCommittedMobileSource(cwd = process.cwd()) {
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const source = git(['rev-parse', 'HEAD']);
  if (!/^[a-f0-9]{40}$/.test(source)) throw new Error('Exact source commit is required.');
  if (git(['status', '--porcelain', '--untracked-files=all'])) {
    throw new Error('Mobile build requires committed source: commit or isolate all tracked changes and untracked files first.');
  }
  return source;
}
