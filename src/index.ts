import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

const discordToken = process.env.DISCORD_TOKEN;
const discordChannelId = process.env.DISCORD_CHANNEL_ID;

if (!discordToken || !discordChannelId) {
  console.error('Configure DISCORD_TOKEN e DISCORD_CHANNEL_ID no arquivo .env.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('ready', async () => {
  console.log(`Bot conectado como ${client.user?.tag ?? 'usuario desconhecido'}.`);

  try {
    const channel = await client.channels.fetch(discordChannelId);

    if (!channel || !channel.isSendable()) {
      console.error('O canal configurado nao foi encontrado ou nao aceita mensagens.');
      return;
    }

    await channel.send('Teste: bot de vagas conectado com sucesso.');
    console.log('Mensagem de teste enviada com sucesso.');
  } catch (error) {
    console.error('Erro ao enviar mensagem de teste:', error);
  }
});

client.login(discordToken).catch((error) => {
  console.error('Erro ao conectar no Discord:', error);
  process.exit(1);
});
