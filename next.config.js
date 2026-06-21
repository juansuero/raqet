const path = require('path')

const localRuntimeTraceExcludes = [
  'data/**',
  'data/**/*',
  './data/**/*',
  './data/**',
  'apps/**',
  'apps/**/*',
  './apps/**/*',
  './apps/**',
  '*.log',
  './*.log',
  'codex-*.log',
  './codex-*.log',
  'next.config.js',
  './next.config.js',
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingExcludes: {
    '/api/**': localRuntimeTraceExcludes,
    '/api/coach': localRuntimeTraceExcludes,
    '/clips/**': localRuntimeTraceExcludes,
  },
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
