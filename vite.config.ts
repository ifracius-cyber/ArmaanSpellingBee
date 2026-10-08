import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `vite build --mode single` inlines everything into one HTML file that can be shared or hosted anywhere.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    chunkSizeWarningLimit: 1500,
    outDir: mode === 'single' ? 'dist-single' : 'dist',
  },
}))
