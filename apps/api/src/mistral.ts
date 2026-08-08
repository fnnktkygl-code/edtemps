export async function explainConflictWithMistral(conflictMessage: string): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return `Diagnostic automatique : ${conflictMessage}. (Conseil : Vérifier la disponibilité de l'enseignant ou réserver une autre salle).`;
  }

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "ministral-8b-latest",
        messages: [
          {
            role: "system",
            content:
              "Tu es un assistant IA expert pour la direction d'un collège/lycée français. Réponds en 2 phrases concises et très professionnelles sans aucune donnée personnelle.",
          },
          {
            role: "user",
            content: `Reformule et explique de manière bienveillante ce conflit d'emploi du temps pour le chef d'établissement : "${conflictMessage}"`,
          },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur API Mistral HTTP ${response.status}`);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? conflictMessage;
  } catch (error) {
    return `Diagnostic automatique : ${conflictMessage}.`;
  }
}
