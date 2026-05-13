import { JobPost } from '@prisma/client';
import { logger } from '../lib/logger';

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

  const prompt = buildPrompt(job);
  logger.info('Gerando mensagem com Google AI Studio.', {
    jobId: job.id,
    title: job.title,
    hasRawText: Boolean(job.rawText?.trim()),
    hasShortDescription: Boolean(job.shortDescription?.trim()),
    promptLength: prompt.length,
    model: GOOGLE_AI_MODEL,
  });

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
          parts: [{ text: prompt }],
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
    logger.error('Google AI Studio retornou erro.', undefined, {
      jobId: job.id,
      status: response.status,
      bodyPreview: truncate(errorBody, 500),
    });
    throw new Error(`Erro ao gerar mensagem com Google AI Studio: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const message = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();

  if (!message) {
    throw new Error('Google AI Studio nao retornou uma mensagem valida.');
  }

  logger.info('Mensagem gerada com Google AI Studio.', {
    jobId: job.id,
    messageLength: message.length,
    lineCount: countLines(message),
    preview: truncate(message, 180),
  });

  return message;
}

function buildPrompt(job: JobPost): string {
  const structuredData = {
    cargo: clean(job.title),
    empresa: clean(job.company),
    local: clean(job.location),
    modalidade: clean(job.modality),
    nivel: clean(job.level),
    stacks: clean(job.stacks),
    faixaSalarial: clean(job.salaryRange),
    descricaoBreve: clean(job.shortDescription),
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
Nao invente beneficios, salario, tecnologias ou modalidade.
Se algum dado estiver ausente, apenas omita.
A mensagem deve ser pronta para postar no Discord.
Nao repita a saudacao.
Nao repita a mesma linha.
Use cada secao no maximo uma vez.
Se houver dados suficientes, a mensagem deve ter mais do que apenas a saudacao.

Estrutura sugerida:
- Saudacao curta com identidade do Projeto Desenvolve
- Cargo
- Empresa
- Local/modalidade, se houver
- Nivel, se houver
- Stacks, se houver
- Faixa salarial, se houver
- Descricao breve da vaga, se houver
- Pequena chamada motivacional
- Link de candidatura
- Dica rapida para candidatura

Comportamento:
- Deve incluir stacks quando existirem.
- Deve incluir faixa salarial quando existir.
- A secao "Sobre a vaga" deve ser um resumo breve da oportunidade, nao uma copia da descricao original.
- A secao "Sobre a vaga" deve explicar em poucas linhas o que a pessoa fara ou qual e o contexto da vaga.
- A secao "Sobre a vaga" deve ter no maximo 2 a 4 linhas curtas.
- Escreva a descricao de forma natural, util e direta para alunos iniciantes.
- Evite textos longos e blocos grandes.
- Se rawText for grande, use-o apenas como fonte de contexto.
- Se descricaoBreve existir, use como base, mas tambem resuma se estiver grande.
- Nao copie o rawText inteiro.
- Nao inclua requisitos, beneficios ou salario dentro de "Sobre a vaga" se ja existirem campos proprios.
- Stacks devem ficar no campo 🛠️ **Stacks**.
- Faixa salarial deve ficar no campo 💰 **Faixa salarial**.
- Pode usar rawText para extrair uma descricao breve, mas nao deve inventar informacoes.
- Se nao houver descricao, omita a secao.
- Se nao houver salario, omita a secao.
- Se nao houver stacks, omita a secao.

Formato sugerido:
🚀 Fala, PDevs! Nova oportunidade no radar do Projeto Desenvolve.

💼 **Vaga:** [title]
🏢 **Empresa:** [company]
📍 **Local:** [location]
🧭 **Modalidade:** [modality]
🎯 **Nível:** [level]
🛠️ **Stacks:** [stacks]
💰 **Faixa salarial:** [salaryRange]

📝 **Sobre a vaga:**
[resumo curto em 2 a 4 linhas]

🔗 **Candidatura:**
[url]

💡 **Dica PD:** [dica curta]

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

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function countLines(value: string): number {
  return value.split('\n').filter((line) => line.trim()).length;
}
