"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = __importDefault(require("net"));
const DataType_1 = require("./commons/enums/DataType");
const ErrorContext_1 = require("./commons/enums/ErrorContext");
class peer {
    constructor(name, port = 0, state) {
        // Abre o servidor para este peer
        this.createServer = (onServerCreated = null) => {
            this.server = net_1.default.createServer((socket) => {
                // Adiciona esta conexão estabelecida ao array de conexões
                this.addConnection(socket);
                // Adiciona listeners para este socket
                this.addSocketListeners(socket);
                // Se apresenta para o peer cliente
                this.introduceMyselfTo(socket, this.port);
            });
            this.server.listen(this.port, () => {
                /* O port passado como parâmetro no listen pode ser 0, que faz
                com que seja gerado uma porta aleatória e livre para o servidor
                ouvir, então, o this.port recebe esta nova porta gerada */
                this.port = this.server.address().port;
                console.log(`\nOuvindo na porta ${this.port}...`);
                // Se o cliente tiver fornecido uma callback, invocá-la
                if (onServerCreated) {
                    onServerCreated();
                }
            })
                .on('error', err => this.onError(err, ErrorContext_1.ErrorContext.SERVER));
        };
        this.handleDisconnection = (socket) => {
            this.forgetConnection(socket);
        };
        // Remove o socket dos arrays de conexões e hosts conhecidas
        this.forgetConnection = (socket) => {
            /* Atribui um novo array para o this.connections,
            porem, sem o socket desconectado */
            this.connections = this.connections.filter(conn => {
                return conn !== socket;
            });
            this.knownHosts.forEach(host => {
                const isKnownPort = (host.portImConnected === socket.remotePort
                    || host.serverPort === socket.remotePort);
                if (host.ip === socket.remoteAddress
                    && isKnownPort) {
                    const indexToRemove = this.knownHosts.indexOf(host);
                    this.knownHosts.splice(indexToRemove, 1);
                    this.onDisconnect(host, socket);
                }
            });
        };
        /* Envia as hosts conhecidas por este
        peer para o peer cliente */
        this.sendKnownHostsTo = (socket, knownHosts) => {
            const data = {
                type: DataType_1.DataType.KNOWN_HOSTS,
                senderName: this.name,
                content: knownHosts
            };
            this.sendData(socket, data);
        };
        // Envia o estado deste peer para o peer cliente
        this.sendStateTo = (socket, state) => {
            const data = {
                type: DataType_1.DataType.STATE,
                senderName: this.name,
                content: state
            };
            this.sendData(socket, data);
        };
        // Tenta se conectar em um IP:PORTA
        this.connectTo = (host, port, opts = null) => {
            const connect = () => {
                const socket = net_1.default.createConnection({ port, host }, () => {
                    // Caso o cliente tenha fornecido uma callback, invocá-la
                    if (opts && opts.onConnect) {
                        opts.onConnect();
                    }
                    /* Se o host em que este peer estiver conectando
                    não for conhecido, adiciona ao array de conhecidos
            
                    Obs: o nome é desconhecido, só após o servidor se
                    apresentar que ele será atribuido */
                    const hostImConnected = {
                        name: '', ip: host,
                        portImConnected: socket.remotePort,
                        serverPort: port
                    };
                    if (!this.isKnownHost(hostImConnected)) {
                        this.addKnownHost(hostImConnected);
                    }
                    // Adiciona esta conexão estabelecida ao array de conexões
                    this.addConnection(socket);
                    // Adiciona listeners para este socket
                    this.addSocketListeners(socket);
                    // Envia o nome e a porta do servidor deste peer 
                    this.introduceMyselfTo(socket, this.port);
                    /* Tirando o time out estabelecido anteriormente para caso
                    a conexão não tivesse sido estabelecida no tempo definido */
                    socket.setTimeout(0);
                })
                    .on('error', err => this.onError(err, ErrorContext_1.ErrorContext.CONNECT));
                /* Definindo o time out para a tentativa de conexão
                Obs: se o time out não for fornecido, o padrão é 20 segundos */
                socket.setTimeout(((opts === null || opts === void 0 ? void 0 : opts.timeoutInSeconds) || 20) * 1000, () => {
                    this.onError(new Error('ETIMEDOUT'), ErrorContext_1.ErrorContext.CONNECT);
                    socket.destroy();
                });
            };
            /* Apenas se conecta se o servidor deste peer estiver aberto
            (caso não esteja, abre um e se conecta) */
            this.server ? connect() : this.createServer(connect);
        };
        // Adiciona a host para o array de hosts conhecidas
        this.addKnownHost = (host) => {
            this.knownHosts.push(host);
        };
        // Adiciona a conexão para o array de conexões conhecidas
        this.addConnection = (socket) => {
            this.connections.push(socket);
        };
        // Verifica se a host passada está entre o array de hosts conhecidas
        this.isKnownHost = (host) => {
            const hostFound = this.knownHosts.find((knownHost) => {
                const isKnownIp = knownHost.ip === host.ip.slice(7) || knownHost.ip === host.ip;
                const isKnownPort = knownHost.serverPort === host.serverPort;
                const isKnownName = knownHost.name === host.name;
                return (isKnownIp && isKnownPort) || isKnownName;
            });
            return hostFound !== undefined;
        };
        // Verifica se o nome passado está sendo usado por uma host
        this.isNameUsed = (name) => {
            // Verifica se há um nome igual entre as hosts conhecidas
            for (let i = 0; i < this.knownHosts.length; i++) {
                if (this.knownHosts[i].name === name) {
                    return true;
                }
            }
            // Se o nome não for igual ao deste peer, então retorna false
            return name === this.name;
        };
        // Recebe as hosts conhecidas de outro peer
        this.receiveKnownHosts = (senderSocket, data) => {
            if (data.type !== DataType_1.DataType.KNOWN_HOSTS) {
                return;
            }
            /* Para cada host recebida pelo servidor, caso este
            peer não conheça alguma, adiciona no próprio array
            de hosts conhecidas e se conecta com ela */
            data.content.forEach((host) => {
                if (!this.isKnownHost(host)) {
                    const connectOptions = {
                        onConnect: () => { this.addKnownHost(host); }
                    };
                    this.connectTo(host.ip, host.serverPort, connectOptions);
                }
            });
        };
        // Recebe o estado da sala
        this.receiveState = (data) => {
            if (data.type !== DataType_1.DataType.STATE) {
                return;
            }
            this.state = data.content;
        };
        // Recebe o nome de um peer e a porta em que ele está ouvindo
        this.receiveIntroduction = (socket, data) => {
            if (data.type !== DataType_1.DataType.PEER_INTRODUCTION) {
                return;
            }
            for (let i = 0; i < this.knownHosts.length; i++) {
                const currentHost = this.knownHosts[i];
                // Se a porta já for conhecida
                if (currentHost.serverPort === data.content) {
                    /* Se o nome estiver vazio, é sinal de que o servidor
                    em que este peer conectou se apresentou */
                    if (currentHost.name.length === 0) {
                        currentHost.name = data.senderName;
                    }
                    /* Retorne pois o servidor já é conhecido e
                    este peer já configurou seus listeners */
                    return;
                }
            }
            // Verifica e atribui um nome disponível para o peer conectado
            const availableNameForSender = this
                .findAvailableName(data.senderName);
            // Se o nome do peer cliente for diferente do nome disponível
            if (availableNameForSender !== data.senderName) {
                const nameChangedData = {
                    type: DataType_1.DataType.NAME_CHANGED,
                    senderName: this.name,
                    content: availableNameForSender
                };
                // Avisa o peer para que ele possa alterar o seu nome
                this.sendData(socket, nameChangedData);
            }
            /* Chamar o callback de onConnection pois o peer
            se conectou com sucesso */
            this.onConnection(socket, availableNameForSender);
            /* Este peer envia para o cliente todas as hosts que
            conhece para que ele também possa se conectar nos
            outros peers da rede */
            this.sendKnownHostsTo(socket, this.knownHosts);
            // Adiciona o peer ao array de hosts conhecidas
            this.addKnownHost({
                name: availableNameForSender,
                ip: socket.remoteAddress || '',
                portImConnected: socket.remotePort,
                serverPort: data.content
            });
            // Enviando o estado atual para o cliente
            this.sendStateTo(socket, this.state);
        };
        // Função chamada quando o peer servidor altera o nome deste peer
        this.handleNameChanged = (socket, data) => {
            if (data.type !== DataType_1.DataType.NAME_CHANGED) {
                return;
            }
            this.name = data.content;
        };
        /* Gera um nome disponível na rede
        Obs: se o próprio nome passado estiver disponível, retorna ele */
        this.findAvailableName = (name) => {
            let count = 0;
            // Se o nome não estiver disponível, altera-lo
            while (this.isNameUsed(name)) {
                const id = parseInt(name[name.length - 1]);
                if (count === 0) {
                    // Se o ultimo char do nome passado for um número
                    if (Number.isInteger(id)) {
                        name = name.slice(0, -1);
                        name += `${id + 1}`;
                    }
                    else {
                        name += '1';
                    }
                    // Vai para a próxima iteração
                    continue;
                }
                // Incrementando o ID
                name = name.slice(0, -1);
                name += `${id + 1}`;
                count++;
            }
            return name;
        };
        // Manda o nome e a porta do servidor deste peer para outro peer
        this.introduceMyselfTo = (socket, portImListening) => {
            const data = {
                type: DataType_1.DataType.PEER_INTRODUCTION,
                senderName: this.name,
                content: portImListening
            };
            this.sendData(socket, data);
        };
        // Envia dados para um único peer
        this.sendData = (socket, data) => {
            // Concatenando com um '\n' para marcar o fim do JSON no buffer
            const jsonData = JSON.stringify(data).concat('\n');
            try {
                if (!socket.writableEnded) {
                    socket.write(jsonData);
                }
            }
            catch (err) {
                this.onError(err, ErrorContext_1.ErrorContext.SOCKET);
            }
        };
        // Envia dados para todos os Peers conhecidos (este não está incluso)
        this.broadcast = (data) => {
            this.connections.forEach(socket => {
                this.sendData(socket, data);
            });
        };
        /* Escuta os dados enviados pelo cliente
          
        Obs: as mensagem são transmitidas atráves da
        interface "Data" em formato JSON
        */
        this.listenClientData = (socket) => {
            socket.on('data', bufferData => {
                const buffer = bufferData.toString();
                /* Se houver mais de um Json no buffer,
                eles são separados pela line break */
                const jsonDatas = buffer
                    .split(/\r?\n/)
                    .filter(json => json.length !== 0);
                jsonDatas.forEach(jsonData => {
                    const data = JSON.parse(jsonData);
                    this.receiveState(data);
                    this.receiveKnownHosts(socket, data);
                    this.receiveIntroduction(socket, data);
                    this.handleNameChanged(socket, data);
                    this.onData(socket, data);
                });
            });
        };
        this.addSocketListeners = (socket) => {
            socket.setEncoding('utf8');
            socket.on('close', hadError => {
                this.handleDisconnection(socket);
            });
            socket.on('end', () => {
                this.handleDisconnection(socket);
            });
            socket.on('error', err => this.onError(err, ErrorContext_1.ErrorContext.SOCKET));
            /* Adiciona uma escuta para ouvir quando
            o socket cliente enviar dados */
            this.listenClientData(socket);
        };
        this.state = state; // Estado da sala
        this.name = name; // Nome único do peer
        this.port = port; // Porta em que este peer irá ouvir conexões
        this.server = null; // Servidor TCP deste peer
        this.connections = []; // Conexões estabelecidas por este peer
        this.knownHosts = []; // Hosts conhecidas por este peer
    }
    // Essa função deve ser sobrescrita pelo cliente
    onConnection(socket, peerName) {
        throw Error('peer.onConnection não foi implementado');
    }
    // Essa função pode ser sobrescrita pelo cliente
    onDisconnect(host, socket) { }
    // Essa função deve ser sobrescrita pelo cliente
    onData(socket, data) {
        throw Error('peer.onData não foi implementado');
    }
    // Essa função pode ser sobrescrita pelo cliente
    onError(err, context) {
        console.warn('Peer.onError -> erro não tratado:', err);
    }
}
exports.default = peer;
