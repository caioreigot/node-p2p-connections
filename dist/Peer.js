"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = __importDefault(require("net"));
const DataType_1 = require("./commons/enums/DataType");
class Peer {
    constructor(name, port = 0, state, onServerCreated = null) {
        /* Lida com uma comunicação fechada prematuramente
        Exemplo: tentar se conectar em uma rede
        de Peers com um nome já em uso */
        this.handleClosedCommunication = (socket, data) => {
            /* Aqui é possivel verificar qualquer outro tipo
            de erro que encerre antecipadamente a comunicação */
            if (data.type !== DataType_1.DataType.NAME_IN_USE) {
                return;
            }
            this.server.close(() => {
                console.log('[!] O servidor deste Peer foi encerrado.');
            });
        };
        this.handleDisconnection = (socket) => {
            this.onDisconnect(socket);
        };
        // Remove o socket dos arrays de conexões e hosts conhecidas
        this.forgetConnection = (socket) => {
            /* Atribui um novo array para o this.connections,
            porém, sem o socket desconectado */
            this.connections = this.connections.filter(conn => {
                return conn !== socket;
            });
            this.knownHosts.forEach(host => {
                if (host.ip === socket.remoteAddress) {
                    const indexToRemove = this.knownHosts.indexOf(host);
                    this.knownHosts.splice(indexToRemove, 1);
                    return host.name;
                }
            });
        };
        /* Envia as hosts conhecidas por este
        Peer para o Peer cliente */
        this.sendKnownHostsTo = (socket, knownHosts) => {
            const data = {
                signature: null,
                type: DataType_1.DataType.KNOWN_HOSTS,
                senderName: this.name,
                content: knownHosts
            };
            this.sendData(socket, data);
        };
        // Envia o estado deste Peer para o Peer cliente
        this.sendStateTo = (socket, state) => {
            const data = {
                signature: null,
                type: DataType_1.DataType.STATE,
                senderName: this.name,
                content: state
            };
            this.sendData(socket, data);
        };
        // Se conecta em um IP:PORTA
        this.connectTo = (host, port, senderName = null, loopback = false, onConnect = null) => {
            const socket = net_1.default.createConnection({ port, host }, () => {
                // Caso o cliente tenha fornecido uma callback, invocá-la
                if (onConnect) {
                    onConnect();
                }
                /* Se o host em que este Peer estiver conectando
                não for conhecido, adiciona ao array de conhecidos */
                const hostConnected = {
                    name: senderName ? senderName : '',
                    ip: host,
                    port: port
                };
                // Se não for uma host conhecida, adiciona ao array de conhecidos
                if (!this.isKnownHost(hostConnected)) {
                    this.addKnownHost(hostConnected);
                }
                // Adiciona esta conexão estabelecida ao array de conexões
                this.addConnection(socket);
                // Adiciona listeners para este socket
                this.addSocketListeners(socket);
                /* Envia a porta e o nome deste Peer para o Peer conectado
                para que ele também possa se conectar neste Peer */
                this.askServerToConnect(socket, loopback);
            });
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
            const hostFound = this.knownHosts.find((knownHost) => knownHost.ip === host.ip && knownHost.port === host.port);
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
            // Se o nome não for igual ao deste Peer, então retorna false
            return name === this.name;
        };
        // Recebe as hosts conhecidas de outro Peer
        this.receiveKnownHosts = (senderSocket, data) => {
            if (data.type !== DataType_1.DataType.KNOWN_HOSTS) {
                return;
            }
            /* O Peer que enviou suas hosts conhecidas aceitou
            a conexão, então ele manda seu nome para este Peer
            poder atualizar em suas hosts conhecidas */
            this.knownHosts.forEach(host => {
                if (host.name.length === 0
                    && host.ip === senderSocket.remoteAddress
                    && host.port === senderSocket.remotePort) {
                    host.name = data.senderName;
                }
            });
            /* Para cada host recebida pelo servidor, caso este
            Peer não conheça alguma, adiciona no próprio array
            de hosts conhecidas e se conecta com ela */
            data.content.forEach((host) => {
                if (!this.isKnownHost(host)) {
                    this.connectTo(host.ip, host.port, null, false, () => {
                        this.addKnownHost(host);
                    });
                }
            });
        };
        this.receiveState = (data) => {
            if (data.type !== DataType_1.DataType.STATE) {
                return;
            }
            this.state = data.content;
        };
        // Recebe um pedido para que este Peer se conecte ao Peer cliente requisitante
        this.receiveAskToConnect = (socket, data) => {
            if (data.type !== DataType_1.DataType.ASK_TO_CONNECT) {
                return;
            }
            /* Se o nome do sender for igual ao nome deste Peer ou de Peers
            conhecidos, uma mensagem é enviada e o socket é destruido */
            if (this.isNameUsed(data.senderName)) {
                this.sendData(socket, {
                    type: DataType_1.DataType.NAME_IN_USE,
                    senderName: this.name,
                    content: `O nome "${data.senderName}" já está em uso, por favor, escolha outro.`
                });
                socket.destroy();
                return;
            }
            /* Chamar o callback de onConnection pois o Peer
            se conectou com sucesso */
            this.onConnection(socket, data.senderName);
            /* Este Peer envia para o cliente todas as hosts que
            conhece, como forma de aceitar a conexão e faze
            o cliente se conectar nos outros Peers da rede */
            this.sendKnownHostsTo(socket, this.knownHosts);
            // Enviando o estado atual para o cliente
            this.sendStateTo(socket, this.state);
            // Este Peer também se conecta com o cliente
            this.connectTo(socket.remoteAddress || '', data.content, data.senderName, true, () => {
                /* Adiciona o Peer ao array de hosts conhecidas
                quando a conexão for estabelecida */
                this.addKnownHost({
                    name: data.senderName,
                    ip: socket.remoteAddress || '',
                    port: data.content
                });
            });
        };
        /* Manda o nome e a porta do Peer cliente para que o servidor
        também possa se conectar neste Peer, caso o nome esteja disponível */
        this.askServerToConnect = (socket, loopback = false) => {
            if (loopback) {
                return;
            }
            const data = {
                signature: null,
                type: DataType_1.DataType.ASK_TO_CONNECT,
                senderName: this.name,
                content: this.port
            };
            this.sendData(socket, data);
        };
        // Envia dados para um único Peer
        this.sendData = (socket, data) => {
            const jsonData = JSON.stringify(data).concat('\n');
            try {
                if (!socket.writableEnded) {
                    socket.write(jsonData);
                }
            }
            catch (e) {
                console.warn('[CATCH] Peer -> sendData -> socket.write:', e);
            }
        };
        // Envia dados para todos os Peers conhecidos (este não está incluso)
        this.broadcast = (data) => {
            this.connections.forEach(socket => {
                this.sendData(socket, data);
            });
        };
        /* As mensagem são transmitidas atráves da
        interface "Data" em formato JSON */
        this.listenClientData = (socket) => {
            socket.on('data', bufferData => {
                const buffer = bufferData.toString();
                /* Se houver mais de um Json no buffer,
                eles são separados pela line break */
                const jsonDatas = buffer
                    .split(/\r?\n/)
                    .filter(e => e.length !== 0);
                jsonDatas.forEach(jsonData => {
                    const data = JSON.parse(jsonData);
                    this.handleClosedCommunication(socket, data);
                    this.receiveState(data);
                    this.receiveKnownHosts(socket, data);
                    this.receiveAskToConnect(socket, data);
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
            socket.on('error', err => {
                console.warn('[CATCH] Peer -> addSocketListeners -> Socket on error:', err.message);
            });
            /* Adiciona uma escuta para ouvir quando
            o socket cliente enviar dados */
            this.listenClientData(socket);
        };
        this.state = state; // Estado da sala
        this.name = name; // Nome único do Peer
        this.port = port; // Porta em que este Peer irá ouvir conexões
        this.server = net_1.default.createServer(); // Cria um servidor TCP
        this.connections = []; // Hosts que este Peer está conectado
        this.knownHosts = []; // Hosts conhecidas por este Peer
        this.server.on('connection', (socket) => {
            // Adiciona esta conexão estabelecida ao array de conexões
            this.addConnection(socket);
            // Adiciona listeners para este socket
            this.addSocketListeners(socket);
        })
            .on('error', err => {
            console.warn('[CATCH] Peer -> Server on error:', err.message);
        });
        this.server.listen(port, () => {
            /* O port passado como parâmetro no listen pode ser 0, o que
            faz com que seja gerado uma porta aleatória e livre para o
            servidor ouvir, então, o this.port recebe esta porta gerada
            e não o port passado como parâmetro */
            this.port = this.server.address().port;
            console.log(`Ouvindo na porta ${this.port}...`);
            // Se o cliente tiver fornecido uma callback, invocá-la
            if (onServerCreated) {
                onServerCreated();
            }
        });
    }
    // Essa função deve ser sobrescrita pelo cliente
    onConnection(socket, peerName) {
        throw Error('Peer.onConnection não foi implementado');
    }
    /* Essa função pode ser sobrescrita pelo cliente
    
    Cuidado: essa função pode ser disparada até 4 vezes
    ao desconectar uma pessoa (por conta dos vários sockets
    em que os Peer's se relacionam)*/
    onDisconnect(socket) { }
    // Essa função deve ser sobrescrita pelo cliente
    onData(socket, data) {
        throw Error('Peer.onData não foi implementado');
    }
}
exports.default = Peer;
