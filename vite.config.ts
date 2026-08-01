import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // App code changes far more often than its dependencies, so react and
        // leaflet get their own chunks and stay cached across deploys. Firebase
        // isn't listed: it's imported dynamically (see lib/firebase.ts), so
        // rollup already splits it into a chunk only streaming ever loads.
        //
        // Matched on module id rather than by package name — react's real code
        // lives in react/cjs/*, which the by-name form leaves in whichever
        // chunk happens to import it (it ended up inside leaflet's).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules[\\/](react-)?leaflet[\\/]/.test(id)) return "leaflet";
          if (/node_modules[\\/]@react-leaflet[\\/]/.test(id)) return "leaflet";
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
        },
      },
    },
  },
});
