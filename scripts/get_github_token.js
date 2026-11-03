const cp = require('child_process');
try {
  const p = cp.spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8'
  });
  const m = p.stdout && p.stdout.match(/password=(.+)/);
  if (m && m[1]) {
    process.stdout.write(m[1].trim());
  } else {
    process.exit(1);
  }
} catch (e) {
  process.exit(1);
}

