// Vercel Serverless Function entrypoint for the NestJS backend.
// Imports the already-compiled bootstrap from dist/ (produced by `nest build`
// via the vercel-build script) so decorator metadata is emitted correctly by
// tsc — esbuild, which Vercel uses to bundle this file, would otherwise strip it.
// @ts-ignore - importing the compiled JS output; types are not needed here.
import handler from '../dist/serverless';

export default handler;
