// api/google-oauth.ts
export async function googleOauthLogic(body: {
  action: 'exchange' | 'refresh';
  code?: string;
  client_id: string;
  client_secret: string;
  refresh_token?: string;
  redirect_uri?: string;
}) {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  
  if (body.action === 'exchange') {
    const params = new URLSearchParams({
      code: body.code || '',
      client_id: body.client_id,
      client_secret: body.client_secret,
      redirect_uri: body.redirect_uri || '',
      grant_type: 'authorization_code',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error('OAuth exchange failed: ' + errText);
    }

    return await response.json();
  } else if (body.action === 'refresh') {
    const params = new URLSearchParams({
      client_id: body.client_id,
      client_secret: body.client_secret,
      refresh_token: body.refresh_token || '',
      grant_type: 'refresh_token',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error('OAuth refresh failed: ' + errText);
    }

    return await response.json();
  } else {
    throw new Error('Invalid action');
  }
}

// Vercel serverless function entrypoint
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
    return;
  }

  try {
    const data = await googleOauthLogic(req.body);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, data }));
  } catch (err: any) {
    console.error('Google OAuth API Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }));
  }
}
