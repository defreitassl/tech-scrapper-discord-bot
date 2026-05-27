import { JobPost } from '@prisma/client';
import { Client, GatewayIntentBits } from 'discord.js';
import type { APIEmbed, APIEmbedField, MessageCreateOptions } from 'discord.js';
import { logger } from '../lib/logger';

const DISCORD_JOB_CONTENT = '📌 Nova vaga para PDevs';
const DISCORD_EMBED_COLOR = 0x0f766e;
const MAX_EMBED_DESCRIPTION_LENGTH = 3500;
const MAX_EMBED_FIELD_LENGTH = 1024;

export type DiscordJobPayload = Pick<MessageCreateOptions, 'content' | 'embeds'>;

export async function sendDiscordMessage(message: string): Promise<void> {
  await sendDiscordPayload(message, {
    messageLength: message.length,
    mode: 'plain_text',
  });
}

export async function sendDiscordJobMessage(job: JobPost, messageText: string): Promise<void> {
  const payload = buildDiscordJobPayload(job, messageText);

  try {
    await sendDiscordPayload(payload, {
      jobId: job.id,
      title: job.title,
      messageLength: messageText.length,
      mode: 'embed',
    });
    return;
  } catch (error) {
    logger.warn('Falha ao enviar embed da vaga. Tentando texto puro como fallback.', {
      jobId: job.id,
      title: job.title,
      error: formatError(error),
    });
  }

  await sendDiscordPayload(messageText, {
    jobId: job.id,
    title: job.title,
    messageLength: messageText.length,
    mode: 'plain_text_fallback',
  });
}

export function buildDiscordJobPayload(job: JobPost, messageText: string): DiscordJobPayload {
  const embed: APIEmbed = {
    title: cleanValue(job.title) ?? 'Nova vaga para PDevs',
    description: truncateForDiscord(messageText, MAX_EMBED_DESCRIPTION_LENGTH),
    color: DISCORD_EMBED_COLOR,
    fields: buildEmbedFields(job),
    footer: {
      text: buildFooterText(job.source),
    },
    timestamp: new Date().toISOString(),
  };

  const url = cleanUrl(job.url);

  if (url) {
    embed.url = url;
  }

  return {
    content: DISCORD_JOB_CONTENT,
    embeds: [embed],
  };
}

async function sendDiscordPayload(payload: string | MessageCreateOptions, context: Record<string, unknown>): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    throw new Error('Configure DISCORD_TOKEN e DISCORD_CHANNEL_ID no arquivo .env.');
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  try {
    logger.info('Conectando ao Discord para envio de mensagem.', {
      channelId,
      ...context,
    });

    await client.login(token);
    await waitUntilReady(client);

    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isSendable()) {
      throw new Error('O canal configurado nao foi encontrado ou nao aceita mensagens.');
    }

    await channel.send(payload);
    logger.info('Mensagem enviada ao Discord.', {
      channelId,
      ...context,
    });
  } finally {
    client.destroy();
  }
}

function buildEmbedFields(job: JobPost): APIEmbedField[] {
  return [
    buildField('Empresa', job.company),
    buildField('Local', job.location),
    buildField('Modalidade', job.modality),
    buildField('Nível', job.level),
    buildField('Stacks', job.stacks),
    buildField('Faixa salarial', job.salaryRange),
  ].filter((field): field is APIEmbedField => field !== null);
}

function buildField(name: string, value: string | null): APIEmbedField | null {
  const clean = cleanValue(value);

  if (!clean) {
    return null;
  }

  return {
    name,
    value: truncateForDiscord(clean, MAX_EMBED_FIELD_LENGTH),
    inline: true,
  };
}

function buildFooterText(source: string | null): string {
  const cleanSource = cleanValue(source);

  if (!cleanSource) {
    return 'Projeto Desenvolve';
  }

  return `Projeto Desenvolve • Fonte: ${cleanSource}`;
}

function cleanValue(value: string | null): string | null {
  const clean = value?.replace(/\s+/g, ' ').trim();

  return clean || null;
}

function cleanUrl(value: string | null): string | null {
  const clean = cleanValue(value);

  if (!clean) {
    return null;
  }

  try {
    const url = new URL(clean);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function truncateForDiscord(value: string, maxLength: number): string {
  const clean = value.trim();

  if (clean.length <= maxLength) {
    return clean;
  }

  const truncated = clean.slice(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > Math.floor(maxLength * 0.7)) {
    return `${truncated.slice(0, lastSpace).trim()}...`;
  }

  return `${truncated.trim()}...`;
}

function formatError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return error;
}

function waitUntilReady(client: Client): Promise<void> {
  if (client.isReady()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    client.once('ready', () => resolve());
  });
}
