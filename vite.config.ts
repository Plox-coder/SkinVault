import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Rutas relativas para que Pages funcione con cualquier nombre de repositorio.
export default defineConfig({
  plugins: [react()],
  base: './',
});
