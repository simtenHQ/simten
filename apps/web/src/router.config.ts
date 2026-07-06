// src/router.config.ts
export default {
  routes: './routes', // relative to src/
  output: './routes/routeTree.gen.ts',
  fileSystemRoutes: true, // automatically generate routes from .tsx files
};
