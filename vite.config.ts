import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { parsePdfLogic } from './api/parse-pdf'
import { googleOauthLogic } from './api/google-oauth'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Inject into process.env so parsePdfLogic can access it
  process.env.VITE_GEMINI_API_KEY = env.VITE_GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;

  return {
    plugins: [
      react(),
      {
        name: 'api-parse-pdf-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith('/api/parse-pdf')) {
              if (req.method !== 'POST') {
                res.statusCode = 405;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
                return;
              }

              let body = '';
              req.on('data', (chunk) => {
                body += chunk;
              });

              req.on('end', async () => {
                try {
                  const parsedBody = JSON.parse(body);
                  const { fileData, fileName } = parsedBody;
                  if (!fileData) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, error: 'Missing fileData in request body' }));
                    return;
                  }

                  const fileBuffer = Buffer.from(fileData, 'base64');
                  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

                  const data = await parsePdfLogic(fileBuffer, fileName || 'regulation.pdf', apiKey);

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, data }));
                } catch (err: any) {
                  console.error('[Vite Middleware Error] PDF parsing failed:', err);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }));
                }
              });
              return;
            }

            if (req.url?.startsWith('/api/google-oauth')) {
              if (req.method !== 'POST') {
                res.statusCode = 405;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
                return;
              }

              let body = '';
              req.on('data', (chunk) => {
                body += chunk;
              });

              req.on('end', async () => {
                try {
                  const parsedBody = JSON.parse(body);
                  const data = await googleOauthLogic(parsedBody);
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, data }));
                } catch (err: any) {
                  console.error('[Vite Middleware Error] Google OAuth failed:', err);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }));
                }
              });
              return;
            }

            next();
          });
        }
      }
    ],
    optimizeDeps: {
      include: ['pdfjs-dist'],
    },
    server: {
      proxy: {
        '/marker-api': {
          target: 'http://127.0.0.1:8001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/marker-api/, '')
        }
      }
    }
  };
})

