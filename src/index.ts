import 'dotenv/config';
import { sendDiscordMessage } from './services/discordPublisher';

(async (): Promise<void> => {
  await sendDiscordMessage('Teste: bot de vagas conectado com sucesso.');
  console.log('Mensagem de teste enviada com sucesso via Bot Discord.');
})().catch((error: unknown) => {
  console.error('Erro ao enviar mensagem de teste via Bot Discord:', error);
  process.exit(1);
});
