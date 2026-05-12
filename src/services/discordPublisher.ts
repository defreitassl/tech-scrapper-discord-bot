import { Client, GatewayIntentBits } from 'discord.js';

export async function sendDiscordMessage(message: string): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    throw new Error('Configure DISCORD_TOKEN e DISCORD_CHANNEL_ID no arquivo .env.');
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  try {
    await client.login(token);
    await waitUntilReady(client);

    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isSendable()) {
      throw new Error('O canal configurado nao foi encontrado ou nao aceita mensagens.');
    }

    await channel.send(message);
  } finally {
    client.destroy();
  }
}

function waitUntilReady(client: Client): Promise<void> {
  if (client.isReady()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    client.once('ready', () => resolve());
  });
}
