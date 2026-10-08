import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `vite build --mode single` inlines everything into one index.html that can be hosted anywhere.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    chunkSizeWarningLimit: 1500,
    copyPublicDir: mode !== 'single',
    // The single-file build goes straight into netlify-upload/, ready for Netlify drag-and-drop.
    outDir: mode === 'single' ? 'netlify-upload' : 'dist',
  },
}))
