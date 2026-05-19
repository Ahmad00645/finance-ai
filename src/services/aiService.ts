async function callApi(url: string, body: object) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const scanReceipt = async (base64Data: string, mimeType: string) => {
  try {
    const data = await callApi('/api/gemini', { action: 'scanReceipt', base64Data, mimeType });
    return data ?? null;
  } catch (e) {
    console.error('Receipt scanning failed', e);
    return null;
  }
};

export const getAIInsights = async (expenses: any[], budgets: any[]) => {
  try {
    const data = await callApi('/api/gemini', { action: 'getAIInsights', expenses, budgets });
    return data.insights ?? ['Track your expenses regularly for better insights.'];
  } catch {
    return ['AI Insights currently unavailable. Check your spending distribution in Analytics.'];
  }
};

export const categorizeExpense = async (description: string) => {
  try {
    const data = await callApi('/api/gemini', { action: 'categorizeExpense', description });
    return data.category ?? 'Other';
  } catch (e) {
    console.error('AI Categorization failed', e);
    return 'Other';
  }
};

export const getChatResponse = async (
  message: string,
  history: { role: string; parts: { text: string }[] }[] = [],
  context?: any
) => {
  try {
    const data = await callApi('/api/gemini', { action: 'chat', message, history, context });
    return data.text ?? "I'm sorry, I'm having trouble connecting right now. Please try again.";
  } catch (e) {
    console.error('Chat failed', e);
    return "I'm sorry, I'm having trouble connecting right now. Please try again.";
  }
};
