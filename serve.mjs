// Local preview: node serve.mjs (no dependencies). Netlify serves the folder as-is in production.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const root = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
const port = Number(process.env.PORT) || 5190

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([\\/]\.\.)+/, '')
  const file = join(root, path.endsWith('/') || path.endsWith('\\') ? 'index.html' : path)
  try {
    const body = await readFile(file)
    // no-store: while editing, a normal refresh must always load the latest files.
    res.writeHead(200, { 'Content-Type': (types[extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(body)
  } catch {
    res.writeHead(404).end('Not found')
  }
}).listen(port, () => console.log(`http://localhost:${port}`))
