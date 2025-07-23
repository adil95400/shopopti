// src/lib/openai.ts

// Simple in-memory request tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 seconde minimum entre les requêtes

export async function askChatGPT(prompt: string): Promise<string> {
  try {
    // Limitation de débit simple
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
      throw new Error(
        'Veuillez patienter quelques secondes avant de poser une nouvelle question.'
      );
    }
    lastRequestTime = now;

    const response = await fetch("/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw { status: response.status, message: errData.error || "Erreur inconnue" };
    }

    const data = await response.json();
    return data.result || "Aucune réponse générée";
  } catch (error: any) {
    console.error("OpenAI API Error:", error);

    if (error?.status === 429) {
      throw new Error(
        'Notre service AI est temporairement indisponible en raison d\'une utilisation élevée. ' +
        'Nous vous suggérons de :\n\n' +
        '1. Réessayer dans quelques minutes\n' +
        '2. Contacter notre support à support@shopopti.com si le problème persiste\n' +
        '3. Consulter notre centre d\'aide pour des réponses aux questions fréquentes'
      );
    }

    if (error?.status === 401) {
      throw new Error(
        'Erreur d\'authentification avec notre service AI. ' +
        'Veuillez contacter le support technique à support@shopopti.com.'
      );
    }

    throw new Error(
      'Une erreur est survenue lors de la communication avec notre service AI. ' +
      'Veuillez réessayer plus tard ou contacter notre support.'
    );
  }
}
