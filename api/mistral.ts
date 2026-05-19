import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Mistral } from '@mistralai/mistralai';

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;

  try {
    switch (action) {
      case 'scanReceipt': {
        const { base64Data, mimeType } = req.body;
        const response = await mistral.chat.complete({
          model: 'pixtral-12b-2409',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  imageUrl: `data:${mimeType};base64,${base64Data}`,
                },
                {
                  type: 'text',
                  text: `Extract the vendor name, date, total amount, and category from this receipt and return ONLY a valid JSON object with no extra text.
Format: {"vendor": string, "date": "YYYY-MM-DD or null", "amount": number, "category": string}
Category must be one of: Food, Transport, Shopping, Rent, Bills, Entertainment, Health, Education, Other.
If a field is missing return null for that field.`,
                },
              ],
            },
          ],
        });

        let text = (response.choices?.[0]?.message?.content as string ?? '').trim();
        if (text.includes('```')) {
          const match = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(text);
          if (match?.[1]) text = match[1].trim();
        }
        text = text.replace(/:\s*undefined\b/g, ': null');

        if (text.startsWith('{') && text.endsWith('}')) {
          return res.status(200).json(JSON.parse(text));
        }
        return res.status(200).json(null);
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (e) {
    console.error('Mistral API error:', e);
    return res.status(500).json({ error: 'Mistral request failed' });
  }
}
