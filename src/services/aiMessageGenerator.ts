import { JobPost } from '@prisma/client';
import { logger } from '../lib/logger';

const GOOGLE_AI_MODEL = 'gemini-2.5-flash';
const GOOGLE_AI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_AI_MODEL}:generateContent`;
const MAX_DISCORD_MESSAGE_CHARS = 1600;

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
        temperature: 0.45,
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
Nao exagere nos emojis.
Nao invente informacoes.
Nao prometa contratacao.
Nao diga que a vaga e perfeita.
Nao invente beneficios, salario, tecnologias ou modalidade.
Se algum dado estiver ausente, apenas omita.
A mensagem deve ser pronta para postar no Discord.
Use Markdown do Discord com negrito nos rotulos.
Nao repita a saudacao.
Nao repita a mesma linha.
Use cada secao no maximo uma vez.
A mensagem inteira deve ter no maximo ${MAX_DISCORD_MESSAGE_CHARS} caracteres.
A mensagem deve ser curta, escaneavel e direta.
Nao use paragrafos longos.
Nao copie frases juridicas, rodapes, requisitos repetidos, contrato, area profissional ou blocos administrativos.

Estrutura sugerida:
- Saudacao curta com identidade do Projeto Desenvolve
- Cargo
- Empresa
- Local/modalidade, se houver
- Nivel, se houver
- Stacks, se houver
- Faixa salarial, se houver
- Sobre a vaga em bullets curtos, se houver descricao
- Link de candidatura
- Dica rapida para candidatura

Comportamento:
- Deve incluir stacks quando existirem.
- Deve incluir faixa salarial quando existir.
- A secao "Sobre a vaga" deve ser um resumo forte e breve da oportunidade, nunca uma copia da descricao original.
- A secao "Sobre a vaga" deve ter de 3 a 5 bullets quando houver informacoes suficientes.
- Cada bullet de "Sobre a vaga" deve ter no maximo 140 caracteres.
- Priorize: atividade principal, requisitos, formacao, formato de trabalho, treinamento, bolsa, carga horaria ou numero de vagas.
- Inclua informacoes que ajudem o aluno a decidir se vale clicar no link, mas sem transformar em edital.
- Escreva a descricao de forma natural, util e direta para alunos iniciantes.
- Evite textos longos e blocos grandes.
- Se rawText for grande, use-o apenas como fonte de contexto.
- Se descricaoBreve existir, use como base, mas tambem resuma se estiver grande.
- Nao copie o rawText inteiro.
- Nao inclua requisitos, beneficios, horarios, contrato ou salario dentro de "Sobre a vaga" se eles nao forem essenciais.
- Stacks devem ficar no campo 🛠️ **Stacks**.
- Faixa salarial deve ficar no campo 💰 **Faixa salarial**.
- Pode usar rawText para extrair uma descricao breve, mas nao deve inventar informacoes.
- Se nao houver descricao, omita a secao.
- Se nao houver salario, omita a secao.
- Se nao houver stacks, omita a secao.
- Se houver contradicao entre campos estruturados e texto bruto, prefira os campos estruturados.

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
• [atividade principal]
• [requisitos principais]
• [formacao ou modelo de trabalho, se houver]
• [treinamento, bolsa, carga horaria ou vagas, se houver]

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
