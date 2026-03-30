// OpenAI API integration for kcal estimation - conversational mode with macros & advice

const SYSTEM_PROMPTS = {
  meal: `Tu es un nutritionniste expert intégré dans une app de suivi calorique. L'utilisateur te décrit ce qu'il a mangé.

RÈGLES STRICTES DE FORMAT :
1. TOUJOURS répondre en 1-2 lignes MAX. Pas de paragraphes.
2. Pour les questions, TOUJOURS utiliser ce format exact avec des choix numérotés sur des lignes séparées :
   Question courte ?
   1. Choix A
   2. Choix B
   3. Choix C
3. Quand tu as assez d'infos, propose l'estimation sur UNE ligne et termine par exactement "On valide ?" sur une nouvelle ligne.
4. Quand l'utilisateur confirme (oui, ok, c'est bon, valide, un numéro de choix), réponds avec UNIQUEMENT :
   FINAL_RESULT:{"items":[{"description":"<nom court>","kcal":<nombre>,"proteins":<g>,"lipids":<g>,"carbs":<g>}],"detail":"<explication brève>","advice":"<conseil nutritionnel>"}
5. "advice" = 1 phrase utile : point positif + suggestion d'amélioration.
6. Estime TOUJOURS proteins, lipids, carbs en grammes.
7. Si correction demandée, ajuste et redemande "On valide ?"
8. Tutoie. Ultra concis. Pas de blabla.
9. Si l'utilisateur dit juste un aliment simple (ex: "une pomme", "un café"), pas besoin de poser de question, propose directement l'estimation.`,

  activity: `Tu es un coach sportif expert intégré dans une app de suivi calorique. L'utilisateur te décrit une activité physique.

RÈGLES STRICTES DE FORMAT :
1. TOUJOURS répondre en 1-2 lignes MAX.
2. Pour les questions, TOUJOURS ce format :
   Question courte ?
   1. Choix A
   2. Choix B
   3. Choix C
3. Quand tu as assez d'infos, estimation sur UNE ligne + "On valide ?" sur une nouvelle ligne.
4. Quand confirmé, réponds UNIQUEMENT :
   FINAL_RESULT:{"items":[{"description":"<nom court>","kcal":<nombre>}],"detail":"<explication brève>"}
5. Tutoie. Ultra concis.
6. Si activité simple avec durée (ex: "30 min de course"), propose directement l'estimation.`,

  photo: `Tu es un nutritionniste expert. L'utilisateur t'envoie une photo de son repas/aliment.

RÈGLES STRICTES DE FORMAT :
1. Identifie les aliments visibles en UNE liste courte.
2. Propose estimation kcal + macros. Termine par "On valide ?" sur une nouvelle ligne.
3. Si pas clair, question COURTE avec choix numérotés :
   1. Option A
   2. Option B
4. Quand confirmé, réponds UNIQUEMENT :
   FINAL_RESULT:{"items":[{"description":"<nom court>","kcal":<nombre>,"proteins":<g>,"lipids":<g>,"carbs":<g>}],"detail":"<explication>","advice":"<conseil nutritionnel>"}
5. "advice" = 1 phrase utile personnalisée au plat.
6. Ultra concis, tutoie.`,
};

// Send a message in the conversation and get the assistant's reply
export async function chatWithAI(apiKey, history, type) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: type === 'photo' ? 'gpt-4o' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.meal },
        ...history,
      ],
      temperature: 0.4,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erreur API OpenAI: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();

  // Check if this is a final result
  const finalMatch = content.match(/FINAL_RESULT:\s*(\{[\s\S]*\})/);
  if (finalMatch) {
    let jsonStr = finalMatch[1].trim();
    const codeMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) {
      jsonStr = codeMatch[1].trim();
    }
    const result = JSON.parse(jsonStr);
    return {
      type: 'final',
      items: result.items,
      detail: result.detail,
      advice: result.advice || '',
      displayText: content.replace(/FINAL_RESULT:\s*\{[\s\S]*\}/, '').trim(),
    };
  }

  return {
    type: 'message',
    content,
  };
}

// Generate a motivation message
export async function getMotivationMessage(apiKey, profile, deficit, target) {
  const occasion = profile.occasion || '';
  const prompt = `L'utilisateur suit un régime pour perdre ${profile.targetWeightLoss}kg${occasion ? ` pour ${occasion}` : ''}.
Aujourd'hui son déficit est de ${deficit} kcal (objectif: ${target} kcal).
${deficit >= target ? "Il a atteint son objectif !" : `Il lui reste ${target - deficit} kcal de déficit à faire.`}

Écris un message de motivation de 1-2 lignes MAX. Sois encourageant, positif et ${occasion ? `fais référence à son objectif (${occasion})` : 'dynamique'}. Tutoie. Pas d'emoji excessif, 1-2 max.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 100,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch {
    return null;
  }
}
