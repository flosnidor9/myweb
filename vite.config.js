import { defineConfig } from 'vite';

// GitHub Pages projects are hosted below the repository path (for example,
// /myweb/). The deployment workflow supplies that path during its build.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
});
