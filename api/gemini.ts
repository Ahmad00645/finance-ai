import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;

  try {
    switch (action) {
      case 'scanReceipt': {
        const { base64Data, mimeType } = req.body;
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [
            { inlineData: { data: base64Data, mimeType } },
            {
              text: 'Extract the vendor name, date, total amount, and category from this receipt. If any field is missing, return null for that field. The category should be one of: Food, Transport, Shopping, Rent, Bills, Entertainment, Health, Education, Other.',
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                vendor: { type: Type.STRING },
                date: { type: Type.STRING, description: 'ISO 8601 format YYYY-MM-DD' },
                amount: { type: Type.NUMBER },
                category: { type: Type.STRING },
              },
              required: ['vendor', 'amount', 'category'],
            },
          },
        });

        let text = (response.text ?? '').trim();
        if (text.includes('```')) {
          const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match?.[1]) text = match[1].trim();
        }
        text = text.replace(/:\s*undefined\b/g, ': null');

        if (text.startsWith('{') && text.endsWith('}')) {
          return res.status(200).json(JSON.parse(text));
        }
        return res.status(200).json(null);
      }

      case 'getAIInsights': {
        const { expenses, budgets } = req.body;
        const prompt = `Analyze these expenses and budgets and provide 3-5 short, actionable financial insights.
Expenses: ${JSON.stringify((expenses ?? []).slice(0, 20))}
Budgets: ${JSON.stringify(budgets ?? [])}
Return insights as a simple numbered list of strings.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
        });

        const lines = (response.text ?? '')
          .split('\n')
          .filter((s) => s.trim().length > 0)
          .map((s) => s.replace(/^\d+\.\s*/, '').trim());

        return res.status(200).json({ insights: lines });
      }

      case 'categorizeExpense': {
        const { description } = req.body;
        const prompt = `Categorize this expense description: "${description}".
Options: Food, Transport, Shopping, Rent, Bills, Entertainment, Health, Education, Other.
Return ONLY the category name as a single word.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
        });

        const validCategories = [
          'Food', 'Transport', 'Shopping', 'Rent', 'Bills',
          'Entertainment', 'Health', 'Education', 'Other',
        ];
        const category = (response.text ?? '').trim();
        return res.status(200).json({
          category: validCategories.includes(category) ? category : 'Other',
        });
      }

      case 'chat': {
        const { message, history, context } = req.body;
        const systemInstruction = `You are AI Assistant, a helpful and professional financial assistant.
You help users manage their expenses, budgets, and overall financial health.
Current context (if available): ${JSON.stringify(context ?? {})}
Guidelines:
1. Provide concise, actionable advice.
2. Be empathetic but professional.
3. If the user asks about specific features of this app, guide them (Expenses, Budgets, Analytics, AI Insights, Accounts).
4. Do not provide certified financial advice, but offer general principles.
5. Always refer to yourself as AI Assistant.`;

        const chat = ai.chats.create({
          model: 'gemini-2.0-flash',
          config: { systemInstruction },
          history: history?.length > 0 ? history : undefined,
        });

        const result = await chat.sendMessage({ message });
        return res.status(200).json({ text: result.text });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (e) {
    console.error('Gemini API error:', e);
    return res.status(500).json({ error: 'Gemini request failed' });
  }
}
