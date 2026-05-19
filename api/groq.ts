import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const GROQ_MODEL = 'llama-3.1-8b-instant';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;

  try {
    switch (action) {
      case 'categorizeExpense': {
        const { description } = req.body;
        const completion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'user',
              content: `Categorize this expense description: "${description}".
Options: Food, Transport, Shopping, Rent, Bills, Entertainment, Health, Education, Other.
Return ONLY the category name as a single word.`,
            },
          ],
          max_tokens: 10,
        });

        const validCategories = [
          'Food', 'Transport', 'Shopping', 'Rent', 'Bills',
          'Entertainment', 'Health', 'Education', 'Other',
        ];
        const category = (completion.choices[0]?.message?.content ?? '').trim();
        return res.status(200).json({
          category: validCategories.includes(category) ? category : 'Other',
        });
      }

      case 'getAIInsights': {
        const { expenses, budgets } = req.body;
        const completion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'user',
              content: `Analyze these expenses and budgets and provide 3-5 short, actionable financial insights.
Expenses: ${JSON.stringify((expenses ?? []).slice(0, 20))}
Budgets: ${JSON.stringify(budgets ?? [])}
Return insights as a simple numbered list of strings.`,
            },
          ],
          max_tokens: 500,
        });

        const lines = (completion.choices[0]?.message?.content ?? '')
          .split('\n')
          .filter((s) => s.trim().length > 0)
          .map((s) => s.replace(/^\d+\.\s*/, '').trim());

        return res.status(200).json({ insights: lines });
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

        const messages = [
          { role: 'system' as const, content: systemInstruction },
          ...(history ?? []).map((h: any) => ({
            role: h.role as 'user' | 'assistant',
            content: h.parts?.[0]?.text ?? '',
          })),
          { role: 'user' as const, content: message },
        ];

        const completion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages,
          max_tokens: 500,
        });

        return res.status(200).json({
          text: completion.choices[0]?.message?.content ?? "I'm sorry, I'm having trouble connecting right now.",
        });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (e) {
    console.error('Groq API error:', e);
    return res.status(500).json({ error: 'Groq request failed' });
  }
}
