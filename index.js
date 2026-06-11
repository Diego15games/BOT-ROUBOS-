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
    paineis: [],
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

    if (!dados.paineis || dados.paineis.length === 0) {
        return;
    }

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

    for (const painelInfo of dados.paineis) {

        try {

            const canal =
                await client.channels.fetch(
                    painelInfo.canal
                );

            const mensagem =
                await canal.messages.fetch(
                    painelInfo.painel
                );

            await mensagem.edit({
                embeds: [embed]
            });

        } catch (erro) {

            console.log(
                'Erro painel:',
                erro.message
            );

        }

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

                for (const painelInfo of dados.paineis) {

    try {

        const canal =
            await client.channels.fetch(
                painelInfo.canal
            );

        await canal.send(
            `<@&${config.cargoAviso}>\n\n` +
            `✅ **${local.toUpperCase()}** DISPONÍVEL!\n\n` +
            `🏦 Já pode ser roubado novamente.`
        );

    } catch (erro) {

        console.log(
            'Erro ao avisar:',
            erro.message
        );

     }       
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

        if (
    config.canalPermitido &&
    message.channel.id !== config.canalPermitido
) {
    return;
        }

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
    'clientReady',
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
    'Comandos:',
    commands.map(cmd => cmd.name)
);

console.log(
    'Comandos registrados.'
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

if (
    config.canalPermitido &&
    interaction.channel.id !== config.canalPermitido
) {
    return interaction.reply({
        content: '❌ Este comando só pode ser usado no canal configurado.',
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

            const painelExistente = dados.paineis.find(
    p => p.servidor === interaction.guild.id
);

if (painelExistente) {
    painelExistente.painel = mensagem.id;
    painelExistente.canal = interaction.channel.id;
} else {
    dados.paineis.push({
        servidor: interaction.guild.id,
        canal: interaction.channel.id,
        painel: mensagem.id
    });
        }

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

            console.log("Canal configurado:", config.canalPermitido);
            console.log("Canal atual:", interaction.channel.id);

            if (
    config.canalPermitido &&
    interaction.channel.id !== config.canalPermitido
) {
    return interaction.reply({
        content: '❌ Este comando só pode ser usado no canal configurado.',
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

            console.log("Canal salvo:", canal.id);
            console.log("Cargo salvo:", cargo.id);

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
