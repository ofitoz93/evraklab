import { parsePdfLogic } from './_shared/parsePdfLogic';

export { parsePdfLogic } from './_shared/parsePdfLogic';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { fileData, fileName } = req.body;
    if (!fileData) {
      return res.status(400).json({ success: false, error: 'Missing fileData in request body' });
    }

    const fileBuffer = Buffer.from(fileData, 'base64');

    // Read Gemini API Key from process environment
    const geminiApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    const data = await parsePdfLogic(fileBuffer, fileName || 'regulation.pdf', geminiApiKey);

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('[API Error] PDF parsing failed:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}
