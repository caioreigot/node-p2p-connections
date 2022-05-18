import net, { AddressInfo } from 'net';
import Data from './commons/interfaces/Data';
import Host from './commons/interfaces/Host';
import ConnectOptions from './commons/interfaces/ConnectOptions';
import { DataType } from './commons/enums/DataType';
import { ErrorContext } from './commons/enums/ErrorContext';

export default class peer {
  
  public state: State;
  public name: string;
  public port: number;
  private server: net.Server | null;
  private connections: net.Socket[];
  private knownHosts: Host[];

  constructor(
    name: string, 
    port: number = 0,
    state: State
  ) {
    this.state = state; // Estado da sala
    this.name = name; // Nome único do peer
    this.port = port; // Porta em que este peer irá ouvir conexões
    this.server = null; // Servidor TCP deste peer
    this.connections = []; // Conexões estabelecidas por este peer
    this.knownHosts = []; // Hosts conhecidas por este peer
  }

  // Abre o servidor para este peer
  createServer = (
    onServerCreated: (() => void) | null = null
  ) => {
    this.server = net.createServer((socket: net.Socket) => {
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
      this.port = (this.server!.address() as AddressInfo).port;
      
      console.log(`\nOuvindo na porta ${this.port}...`);

      // Se o cliente tiver fornecido uma callback, invocá-la
      if (onServerCreated) {
        onServerCreated();
      }
    })
      .on('error', err =>
        this.onError(err, ErrorContext.SERVER)
      );
  }

  private handleDisconnection = (socket: net.Socket) => {
    this.forgetConnection(socket);
  }

  // Remove o socket dos arrays de conexões e hosts conhecidas
  private forgetConnection = (socket: net.Socket) => {
    /* Atribui um novo array para o this.connections,
    porem, sem o socket desconectado */
    this.connections = this.connections.filter(conn => {
      return conn !== socket;
    });

    this.knownHosts.forEach(host => {
      const isKnownPort = (host.portImConnected === socket.remotePort 
        || host.serverPort === socket.remotePort);

      if (host.ip === socket.remoteAddress
        && isKnownPort
      ) {
        const indexToRemove = this.knownHosts.indexOf(host);
        this.knownHosts.splice(indexToRemove, 1);

        this.onDisconnect(host, socket);
      }
    });
  }

  /* Envia as hosts conhecidas por este 
  peer para o peer cliente */
  private sendKnownHostsTo = (
    socket: net.Socket,
    knownHosts: Host[]
  ) => {
    const data: Data = {
      type: DataType.KNOWN_HOSTS,
      senderName: this.name,
      content: knownHosts
    };

    this.sendData(socket, data);
  }

  // Envia o estado deste peer para o peer cliente
  private sendStateTo = (
    socket: net.Socket,
    state: State
  ) => {
    const data: Data = {
      type: DataType.STATE,
      senderName: this.name,
      content: state
    };

    this.sendData(socket, data);
  }
  
  // Tenta se conectar em um IP:PORTA
  connectTo = (
    host: string, 
    port: number,
    opts: ConnectOptions | null = null
  ) => {
    const connect = () => {
      const socket = net.createConnection({ port, host }, () => {
        // Caso o cliente tenha fornecido uma callback, invocá-la
        if (opts && opts.onConnect) {
          opts.onConnect();
        }
  
        /* Se o host em que este peer estiver conectando
        não for conhecido, adiciona ao array de conhecidos

        Obs: o nome é desconhecido, só após o servidor se 
        apresentar que ele será atribuido */
        const hostImConnected: Host = {
          name: '', ip: host, 
          portImConnected: socket.remotePort!, 
          serverPort: port
        }

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
        .on('error', err => this.onError(err, ErrorContext.CONNECT));
  
      /* Definindo o time out para a tentativa de conexão
      Obs: se o time out não for fornecido, o padrão é 20 segundos */
      socket.setTimeout((opts?.timeoutInSeconds || 20) * 1000, () => {
        this.onError(new Error('ETIMEDOUT'), ErrorContext.CONNECT);
        socket.destroy();
      });
    }

    /* Apenas se conecta se o servidor deste peer estiver aberto
    (caso não esteja, abre um e se conecta) */
    this.server ? connect() : this.createServer(connect);
  }

  // Adiciona a host para o array de hosts conhecidas
  private addKnownHost = (host: Host) => {
    this.knownHosts.push(host);
  }

  // Adiciona a conexão para o array de conexões conhecidas
  private addConnection = (socket: net.Socket) => {
    this.connections.push(socket);
  }

  // Verifica se a host passada está entre o array de hosts conhecidas
  private isKnownHost = (host: Host) => {

    const hostFound = this.knownHosts.find(
      (knownHost) => {
        const isKnownPort = knownHost.serverPort === host.serverPort;
        return knownHost.ip === host.ip && isKnownPort
      }
    );

    return hostFound !== undefined;
  }

  // Verifica se o nome passado está sendo usado por uma host
  private isNameUsed = (name: string) => {
    // Verifica se há um nome igual entre as hosts conhecidas
    for (let i = 0; i < this.knownHosts.length; i++) {
      if (this.knownHosts[i].name === name) {
        return true;
      }
    }

    // Se o nome não for igual ao deste peer, então retorna false
    return name === this.name;
  }

  // Recebe as hosts conhecidas de outro peer
  private receiveKnownHosts = (senderSocket: net.Socket, data: Data) => {
    if (data.type !== DataType.KNOWN_HOSTS) {
      return;
    }
    
    /* Para cada host recebida pelo servidor, caso este 
    peer não conheça alguma, adiciona no próprio array 
    de hosts conhecidas e se conecta com ela */
    data.content.forEach((host: Host) => {
      if (!this.isKnownHost(host)) {
        const connectOptions = {
          onConnect: () => { this.addKnownHost(host); }
        } as ConnectOptions;

        this.connectTo(host.ip, host.serverPort, connectOptions);
      }
    });
  }

  // Recebe o estado da sala
  private receiveState = (data: Data) => {
    if (data.type !== DataType.STATE) {
      return;
    }

    this.state = data.content;
  }

  // Recebe o nome de um peer e a porta em que ele está ouvindo
  private receiveIntroduction = (socket: net.Socket, data: Data) => {
    if (data.type !== DataType.PEER_INTRODUCTION) {
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
    const availableNameForSender: string = this
      .findAvailableName(data.senderName);

    // Se o nome do peer cliente for diferente do nome disponível
    if (availableNameForSender !== data.senderName) {
      const nameChangedData: Data = {
        type: DataType.NAME_CHANGED,
        senderName: this.name,
        content: availableNameForSender
      }

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
    } as Host);

    // Enviando o estado atual para o cliente
    this.sendStateTo(socket, this.state);
  }

  // Função chamada quando o peer servidor altera o nome deste peer
  private handleNameChanged = (socket: net.Socket, data: Data) => {
    if (data.type !== DataType.NAME_CHANGED) {
      return;
    }

    this.name = data.content;
  } 

  /* Gera um nome disponível na rede
  Obs: se o próprio nome passado estiver disponível, retorna ele */
  private findAvailableName = (name: string): string => {
    let count: number = 0;

    // Se o nome não estiver disponível, altera-lo
    while (this.isNameUsed(name)) {
      const id = parseInt(name[name.length - 1]);

      if (count === 0) {
        // Se o ultimo char do nome passado for um número
        if (Number.isInteger(id)) {
          name = name.slice(0, -1);
          name += `${id + 1}`;
        } else {
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
  }

  // Manda o nome e a porta do servidor deste peer para outro peer
  private introduceMyselfTo = (
    socket: net.Socket,
    portImListening: number
  ) => {
    const data: Data = {
      type: DataType.PEER_INTRODUCTION,
      senderName: this.name,
      content: portImListening
    }

    this.sendData(socket, data);
  }

  // Envia dados para um único peer
  sendData = (
    socket: net.Socket,
    data: Data
  ) => {
    // Concatenando com um '\n' para marcar o fim do JSON no buffer
    const jsonData: string = JSON.stringify(data).concat('\n');

    try {
      if (!socket.writableEnded) {
        socket.write(jsonData);
      }
    } catch (err: any) {
      this.onError(err, ErrorContext.SOCKET);
    }
  }

  // Envia dados para todos os Peers conhecidos (este não está incluso)
  broadcast = (
    data: Data
  ) => {
    this.connections.forEach(socket => {
      this.sendData(socket, data);
    });
  }

  /* Escuta os dados enviados pelo cliente
    
  Obs: as mensagem são transmitidas atráves da
  interface "Data" em formato JSON
  */
  private listenClientData = (socket: net.Socket) => {
    socket.on('data', bufferData => {
      const buffer = bufferData.toString();
      
      /* Se houver mais de um Json no buffer,
      eles são separados pela line break */
      const jsonDatas = buffer
        .split(/\r?\n/)
        .filter(json => json.length !== 0);

      jsonDatas.forEach(jsonData => {
        const data: Data = JSON.parse(jsonData);
        
        this.receiveState(data);
        this.receiveKnownHosts(socket, data);
        this.receiveIntroduction(socket, data);
        this.handleNameChanged(socket, data);

        this.onData(socket, data);
      });
    });
  }

  private addSocketListeners = (socket: net.Socket) => {
    socket.setEncoding('utf8');
    
    socket.on('close', hadError => {
      this.handleDisconnection(socket);
    });

    socket.on('end', () => {
      this.handleDisconnection(socket);
    });

    socket.on('error', err => this.onError(err, ErrorContext.SOCKET));

    /* Adiciona uma escuta para ouvir quando
    o socket cliente enviar dados */
    this.listenClientData(socket);
  }

  // Essa função deve ser sobrescrita pelo cliente
  onConnection(socket: net.Socket, peerName: string) {
    throw Error('peer.onConnection não foi implementado');
  }

  // Essa função pode ser sobrescrita pelo cliente
  onDisconnect(host: Host, socket: net.Socket) {}

  // Essa função deve ser sobrescrita pelo cliente
  onData(socket: net.Socket, data: Data) {
    throw Error('peer.onData não foi implementado');
  }

  // Essa função pode ser sobrescrita pelo cliente
  onError(err: Error, context: ErrorContext) {
    console.warn('Peer.onError -> erro não tratado:', err);
  }
}