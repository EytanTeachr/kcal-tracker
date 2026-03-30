// OpenAI API integration for kcal estimation - conversational mode

const SYSTEM_PROMPTS = {
  meal: `Tu es un nutritionniste expert intégré dans une app de suivi calorique. L'utilisateur te décrit ce qu'il a mangé.

RÈGLES IMPORTANTES :
1. Si l'utilisateur ne donne pas assez de détails, pose UNE question courte et claire. Propose des options rapides sous forme de choix numérotés (1, 2, 3) pour que l'utilisateur puisse répondre vite.
2. Exemple : "Quelle quantité ? 1) Petite portion 2) Portion normale 3) Grande portion"
3. Sois BREF. Pas de longs paragraphes. 1-2 lignes max par message.
4. Quand tu as assez d'infos, propose ton estimation en UNE ligne et demande : "OK ?"
5. Si l'utilisateur confirme (oui, ok, c'est bon, valide, un numéro de choix suivi de confirmation), réponds avec UNIQUEMENT :
   FINAL_RESULT:{"items":[{"description":"<nom court>","kcal":<nombre>}],"detail":"<explication brève>"}
6. Le JSON peut contenir plusieurs items si plusieurs aliments.
7. Si l'utilisateur fait une correction, ajuste et redemande confirmation.
8. Tutoie. Sois sympa mais concis.
9. Ne mets le FINAL_RESULT que quand l'utilisateur a confirmé.`,

  activity: `Tu es un coach sportif expert intégré dans une app de suivi calorique. L'utilisateur te décrit une activité physique.

RÈGLES IMPORTANTES :
1. Si l'utilisateur ne donne pas assez de détails (durée, intensité), pose UNE question courte avec des choix numérotés.
2. Exemple : "Combien de temps ? 1) ~15 min 2) ~30 min 3) ~45 min 4) ~1h"
3. Sois BREF. 1-2 lignes max par message.
4. Quand tu as assez d'infos, propose ton estimation en UNE ligne et demande : "OK ?"
5. Si l'utilisateur confirme, réponds avec UNIQUEMENT :
   FINAL_RESULT:{"items":[{"description":"<nom court>","kcal":<nombre>}],"detail":"<explication brève>"}
6. Plusieurs items si plusieurs activités.
7. Tutoie. Sois concis.
8. Ne mets le FINAL_RESULT que quand l'utilisateur a confirmé.`,

  photo: `Tu es un nutritionniste expert. L'utilisateur t'envoie une photo de son repas/aliment.

RÈGLES :
1. Identifie les aliments visibles sur la photo.
2. Si tu vois clairement le plat, liste les aliments identifiés et propose une estimation des kcal en UNE question : "Je vois : [liste]. Ça te semble correct ? Si non, corrige-moi."
3. Si c'est pas clair, demande une précision COURTE avec des choix.
4. Quand l'utilisateur confirme, réponds UNIQUEMENT avec :
   FINAL_RESULT:{"items":[{"description":"<nom court>","kcal":<nombre>}],"detail":"<explication>"}
5. Sois BREF, tutoie, 1-2 lignes max.`,
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
      max_tokens: 500,
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
