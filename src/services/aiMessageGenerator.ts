import { JobPost } from '@prisma/client';

const GOOGLE_AI_MODEL = 'gemini-2.5-flash';
const GOOGLE_AI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_AI_MODEL}:generateContent`;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export async function generateJobMessage(job: JobPost): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('Configure GOOGLE_AI_API_KEY no arquivo .env.');
  }

  const response = await fetch(GOOGLE_AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildPrompt(job) }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 500,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro ao gerar mensagem com Google AI Studio: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const message = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();

  if (!message) {
    throw new Error('Google AI Studio nao retornou uma mensagem valida.');
  }

  return message;
}

function buildPrompt(job: JobPost): string {
  const structuredData = {
    cargo: clean(job.title),
    empresa: clean(job.company),
    local: clean(job.location),
    modalidade: clean(job.modality),
    nivel: clean(job.level),
    link: clean(job.url),
    fonte: clean(job.source),
  };

  return `
Voce escreve mensagens curtas, uteis e humanas para alunos iniciantes em tecnologia da escola Projeto Desenvolve.

Use uma linguagem amigavel, jovem e profissional.
Chame os alunos ocasionalmente de PDevs.
Use referencias leves a programacao, carreira, deploy, codigo, bugs ou evolucao profissional.
Nao exagere nos emojis.
Nao invente informacoes.
Nao prometa contratacao.
Nao diga que a vaga e perfeita.
Se algum dado estiver ausente, apenas omita.
A mensagem deve ser pronta para postar no Discord.

Estrutura sugerida:
- Saudacao curta com identidade do Projeto Desenvolve
- Cargo
- Empresa
- Local/modalidade, se houver
- Nivel, se houver
- Pequena chamada motivacional
- Link de candidatura
- Dica rapida para candidatura

Dados estruturados da vaga:
${JSON.stringify(structuredData, null, 2)}

Texto bruto da vaga, quando existir:
${clean(job.rawText) ?? 'Nao informado'}

Retorne somente a mensagem final para o Discord, sem explicacoes adicionais.
`.trim();
}

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}
