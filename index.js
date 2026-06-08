const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    SlashCommandBuilder,
    REST,
    Routes
} = require('discord.js');

const fs = require('fs');

const config = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const DONO_ID = "1134947177987330159";

const DATA_FILE = './roubos.json';

function carregarDados() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        return {
            painel: null,
            canal: null,
            roubos: {}
        };
    }
}

function salvarDados(dados) {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(dados, null, 2)
    );
}

let dados = carregarDados();

function formatarTempo(ms) {

    if (ms <= 0) {
        return 'Liberado';
    }

    const minutos = Math.floor(ms / 60000);

    const horas = Math.floor(minutos / 60);

    const mins = minutos % 60;

    if (horas > 0) {
        return `${horas}h ${mins}min`;
    }

    return `${mins}min`;
}

function formatarHorario(timestamp) {
    return new Date(timestamp).toLocaleTimeString(
        'pt-BR',
        {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit'
        }
    );
}
        
async function atualizarPainel() {

    if (!dados.painel || !dados.canal) {
        return;
    }

    try {

        const canal =
            await client.channels.fetch(
                dados.canal
            );

        const mensagem =
            await canal.messages.fetch(
                dados.painel
            );

        const embed =
            new EmbedBuilder()
                .setTitle('📋 CONTROLE DE ROUBOS')
                .setColor('Blue')
                .setTimestamp();

        const locais = Object.keys(
            config.cooldowns
        );

        for (const local of locais) {

            const info =
                dados.roubos[local];

            if (!info) {

                embed.addFields({
                    name: local.toUpperCase(),
                    value:
               '⏰ Disponível às: AGORA\n' +
               '⌛ Tempo restante: 0min\n' +
               '🟢 Liberado'
              });

                continue;
            }

            const restante =
                info.libera - Date.now();

            if (restante <= 0) {

                embed.addFields({
                    name: local.toUpperCase(),
                    value:
                 '⏰ Disponível às: AGORA\n' +
                 '⌛ Tempo restante: 0min\n' +
                 '🟢 Liberado'
                });

            } else {

                embed.addFields({
                    name: local.toUpperCase(),
                    value:
                 `⏰ Disponível às: ${formatarHorario(info.libera)}\n` +
                 `⌛ Tempo restante: ${formatarTempo(restante)}\n` +
                 `🔴 Em cooldown`
                });

            }
        }

        await mensagem.edit({
            embeds: [embed]
        });

    } catch (erro) {
        console.log(
            'Erro ao atualizar painel:',
            erro.message
        );
    }
}

async function verificarLiberacoes() {

    let alterou = false;

    for (const local of Object.keys(dados.roubos)) {

        const info = dados.roubos[local];

        if (!info) continue;

        if (
            Date.now() >= info.libera &&
            !info.avisado
        ) {

            try {

                const canal =
                    await client.channels.fetch(
                        dados.canal
                    );

                await canal.send(
                    `✅ **${local.toUpperCase()}** está liberado novamente!`
                );

            } catch (erro) {
                console.log(
                    'Erro ao avisar:',
                    erro.message
                );
            }

            info.avisado = true;

            alterou = true;
        }
    }

    if (alterou) {
        salvarDados(dados);
    }

    atualizarPainel();
}

client.on(
    'messageCreate',
    async (message) => {

        if (message.author.bot) return;

        const texto =
            message.content
                .trim()
                .toLowerCase();

        if (!texto.startsWith('up ')) {
            return;
        }

        const local =
            texto.replace('up ', '');

        if (
            !config.cooldowns[local]
        ) {

            return message.reply(
                '❌ Local não encontrado.'
            );
        }

        const cooldown =
            config.cooldowns[local];

        const libera =
            Date.now() +
            cooldown * 60000;

        dados.roubos[local] = {
            libera,
            avisado: false
        };

        salvarDados(dados);

        await atualizarPainel();

        return message.reply(
            `✅ ${local.toUpperCase()} atualizado!\n\n` +
            `⏰ Disponível às: ${formatarHorario(libera)}`
        );
    }
);

setInterval(
    verificarLiberacoes,
    60000
);

const commands = [
    new SlashCommandBuilder()
        .setName('painel-roubo')
        .setDescription(
            'Cria o painel de roubos'
        ),

    new SlashCommandBuilder()
        .setName('roubos-config')
        .setDescription(
            'Configura canal e cargo'
        )
        .addChannelOption(option =>
            option
                .setName('canal')
                .setDescription('Canal dos roubos')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName('cargo')
                .setDescription('Cargo para avisos')
                .setRequired(true)
        )

].map(command =>
    command.toJSON()
);

client.once(
    ''clientReady'',
    async () => {

        console.log(
            `${client.user.tag} online!`
        );

        try {

            const rest =
                new REST({
                    version: '10'
                }).setToken(TOKEN);

            await rest.put(
                Routes.applicationCommands(
                    CLIENT_ID
                ),
                {
                    body: commands
                }
            );

            console.log(
                'Comandos registrados: painel-roubo e roubos-config.'
            );

        } catch (erro) {

            console.log(
                'Erro ao registrar comandos:',
                erro
            );

        }

        atualizarPainel();
    }
);

client.on(
    'interactionCreate',
    async interaction => {

        if (
            !interaction.isChatInputCommand()
        ) {
            return;
        }

        if (
            interaction.commandName ===
            'painel-roubo'
        ) {

            if (interaction.user.id !== DONO_ID) {
                return interaction.reply({
                    content: '❌ Apenas o dono do bot pode usar este comando.',
                    ephemeral: true
                });
            }

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        '📋 CONTROLE DE ROUBOS'
                    )
                    .setColor('Blue')
                    .setDescription(
                        'Painel criado com sucesso.'
                    );

            const mensagem =
                await interaction.channel.send({
                    embeds: [embed]
                });

            dados.painel =
                mensagem.id;

            dados.canal =
                interaction.channel.id;

            salvarDados(dados);

            await atualizarPainel();

            return interaction.reply({
                content:
                    '✅ Painel criado!',
                ephemeral: true
            });
        }

        if (
            interaction.commandName ===
            'roubos-config'
        ) {

            if (interaction.user.id !== DONO_ID) {
                return interaction.reply({
                    content: '❌ Apenas o dono do bot pode usar este comando.',
                    ephemeral: true
                });
            }

            const canal =
                interaction.options.getChannel(
                    'canal'
                );

            const cargo =
                interaction.options.getRole(
                    'cargo'
                );

            config.canalPermitido =
                canal.id;

            config.cargoAviso =
                cargo.id;

            fs.writeFileSync(
                './config.json',
                JSON.stringify(
                    config,
                    null,
                    2
                )
            );

            return interaction.reply({
                content:
                    `✅ Configuração salva!\n\n` +
                    `📢 Canal: ${canal}\n` +
                    `🏷️ Cargo: ${cargo}`,
                ephemeral: true
            });
        }
    }
);

client.login(TOKEN);
