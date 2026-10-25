import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

/** Dernier commit (court) : écrit dans les rapports de bug pour savoir quelle version du jeu a été jouée. */
function buildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'inconnue';
  }
}

export default defineConfig({
  base: './',
  build: { target: 'es2020' },
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
});
