// OpenAI API integration for kcal estimation - conversational mode with macros & advice

const SYSTEM_PROMPTS = {
  meal: `Tu es un nutritionniste expert intégré dans une app de suivi calorique. L'utilisateur te décrit ce qu'il a mangé.

RÈGLES :
1. Si pas assez de détails, pose UNE question courte avec des choix numérotés (1, 2, 3).
2. Sois BREF. 1-2 lignes max par message.
3. Quand tu as assez d'infos, propose ton estimation en UNE ligne et demande : "OK ?"
4. Si l'utilisateur confirme, réponds avec UNIQUEMENT un JSON :
   FINAL_RESULT:{"items":[{"description":"<nom court>","kcal":<nombre>,"proteins":<g>,"lipids":<g>,"carbs":<g>}],"detail":"<explication brève>","advice":"<conseil nutritionnel court : points positifs et/ou négatifs du repas + suggestion amélioration si pertinent>"}
5. Dans "advice", donne un vrai conseil utile. Ex: "Top, 35g de protéines ! Mais un peu riche en lipides (28g). Remplace la sauce par du citron pour gagner 100 kcal." ou "Bon apport en fibres avec les légumes. Ajoute une source de protéines (oeuf, poulet) pour un repas plus complet."
6. Estime TOUJOURS proteins, lipids, carbs en grammes.
7. Si correction, ajuste et redemande confirmation.
8. Tutoie. Concis.`,

  activity: `Tu es un coach sportif expert intégré dans une app de suivi calorique. L'utilisateur te décrit une activité physique.

RÈGLES :
1. Si pas assez de détails (durée, intensité), pose UNE question courte avec des choix numérotés.
2. Sois BREF. 1-2 lignes max par message.
3. Quand tu as assez d'infos, propose ton estimation en UNE ligne et demande : "OK ?"
4. Si l'utilisateur confirme, réponds avec UNIQUEMENT :
   FINAL_RESULT:{"items":[{"description":"<nom court>","kcal":<nombre>}],"detail":"<explication brève>"}
5. Tutoie. Concis.`,

  photo: `Tu es un nutritionniste expert. L'utilisateur t'envoie une photo de son repas/aliment.

RÈGLES :
1. Identifie les aliments visibles.
2. Liste-les et propose une estimation kcal + macros. Demande confirmation.
3. Si pas clair, demande une précision COURTE avec des choix.
4. Quand confirmé, réponds UNIQUEMENT avec :
   FINAL_RESULT:{"items":[{"description":"<nom court>","kcal":<nombre>,"proteins":<g>,"lipids":<g>,"carbs":<g>}],"detail":"<explication>","advice":"<conseil nutritionnel : points positifs/négatifs + suggestion amélioration>"}
5. Dans "advice", donne un vrai conseil utile et personnalisé au plat.
6. Sois BREF, tutoie, 1-2 lignes max.`,
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
