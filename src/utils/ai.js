// OpenAI API integration for kcal estimation - conversational mode

const SYSTEM_PROMPTS = {
  meal: `Tu es un nutritionniste expert intégré dans une app de suivi calorique. L'utilisateur va te décrire ce qu'il a mangé.

RÈGLES IMPORTANTES :
1. Si l'utilisateur ne donne pas assez de détails (quantité, taille de portion, accompagnements...), pose-lui des questions précises pour affiner ton estimation. Ne propose JAMAIS une estimation sans avoir assez d'informations.
2. Par exemple si quelqu'un dit "j'ai mangé du riz", demande combien (une assiette ? un bol ? 200g ?), avec quoi, etc.
3. Quand tu as suffisamment d'informations, propose ton estimation et demande confirmation à l'utilisateur.
4. Si l'utilisateur fait une correction ou un ajustement, prends-le en compte.
5. Quand l'utilisateur confirme (oui, ok, c'est bon, valide, etc.), réponds avec UNIQUEMENT un JSON sur une seule ligne au format :
   FINAL_RESULT:{"items":[{"description":"<nom court>","kcal":<nombre>}],"detail":"<explication>"}
6. Le JSON peut contenir plusieurs items si l'utilisateur a décrit plusieurs aliments dans la conversation.
7. Sois naturel et conversationnel en français. Tutoie l'utilisateur.
8. Ne mets le FINAL_RESULT que quand l'utilisateur a explicitement confirmé.`,

  activity: `Tu es un coach sportif expert intégré dans une app de suivi calorique. L'utilisateur va te décrire une activité physique.

RÈGLES IMPORTANTES :
1. Si l'utilisateur ne donne pas assez de détails (durée, intensité, vitesse, type précis...), pose-lui des questions. Ne propose JAMAIS une estimation sans avoir assez d'informations.
2. Par exemple si quelqu'un dit "j'ai couru", demande combien de temps, à quelle allure/vitesse, sur quel terrain, etc.
3. Quand tu as suffisamment d'informations, propose ton estimation et demande confirmation.
4. Si l'utilisateur fait une correction, prends-la en compte.
5. Quand l'utilisateur confirme (oui, ok, c'est bon, valide, etc.), réponds avec UNIQUEMENT un JSON sur une seule ligne au format :
   FINAL_RESULT:{"items":[{"description":"<nom court>","kcal":<nombre>}],"detail":"<explication>"}
6. Le JSON peut contenir plusieurs items si l'utilisateur a décrit plusieurs activités.
7. Sois naturel et conversationnel en français. Tutoie l'utilisateur.
8. Ne mets le FINAL_RESULT que quand l'utilisateur a explicitement confirmé.`,
};

// Send a message in the conversation and get the assistant's reply
// `history` is the full array of {role, content} messages so far (without system)
export async function chatWithAI(apiKey, history, type) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[type] },
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
    // Handle markdown code blocks
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
