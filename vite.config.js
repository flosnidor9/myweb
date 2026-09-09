import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function copyGeneratedBoardData() {
  return {
    name: 'copy-generated-board-data',
    writeBundle(options) {
      const source = resolve('board-data');
      if (!existsSync(source)) return;
      cpSync(source, resolve(options.dir || 'dist', 'board-data'), { recursive: true });
    },
  };
}

// GitHub Pages projects are hosted below the repository path (for example,
// /myweb/). The deployment workflow supplies that path during its build.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [copyGeneratedBoardData()],
});
