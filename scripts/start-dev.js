const getPort = require('get-port').default;
const { spawn } = require('child_process');

(async () => {
  const preferred = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  const port = await getPort({ port: preferred });
  if (port !== preferred) {
    console.warn(`⚠️  Port ${preferred} in use, starting dev server on ${port}`);
  }
  const dev = spawn('next', ['dev', '-p', port], { stdio: 'inherit', shell: true });
  dev.on('close', code => process.exit(code));
})(); 