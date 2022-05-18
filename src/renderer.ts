import { ipcRenderer } from 'electron';

let peerName: string;

var waitingTextAnimationInterval: number;

let connectBtnText: string;
var connectBtnAnimationInterval: number;

const nameInput: HTMLInputElement = document
  .querySelector('#name-input')!;

const portToListenInput: HTMLInputElement = document
  .querySelector('#port-input-container .port-input')!;

const ipToConnectInput: HTMLInputElement = document
  .querySelector('#ip-input')!;

const portToConnectInput: HTMLInputElement = document
  .querySelector('#connect-container .port-input')!;

const connectionContainer: HTMLDivElement = document
  .querySelector('#connection-container')!;

const mainMenuWrapper: HTMLDivElement = document
  .querySelector('#connection-container .wrapper')!;

const listenButton: HTMLButtonElement = document
  .querySelector('#port-input-container .connection-buttons')!;

const connectButton: HTMLButtonElement = document
  .querySelector('#connect-container .connection-buttons')!;

const chatContainer: HTMLDivElement = document
  .querySelector('#chat-container')!;

const waitingText: HTMLParagraphElement = document
  .querySelector('#waiting-text')!;

const incrementCounterBtn: HTMLButtonElement = document
  .querySelector('#increase-count')!;

const countNumber: HTMLParagraphElement = document
  .querySelector('#count p')!;

const nickname: HTMLParagraphElement = document
  .querySelector('#nickname')!;

const messageInput: HTMLInputElement = document
  .querySelector('#message-input')!;

const messages: HTMLDivElement = document
  .querySelector('#messages')!;

// Botão de "Ouvir"
listenButton.addEventListener('click', listenButtonOnClick);

// Botão de "Conectar"
connectButton.addEventListener('click', connectButtonOnClick);

incrementCounterBtn.onclick = () => {
  incrementCounter();

  // Avisa ao Main que o counter foi incrementado
  ipcRenderer.send('incremented-counter');
}

messageInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    const entry = messageInput.value;
    messageInput.value = '';

    ipcRenderer.send('message-sent', entry);
    renderMessage(peerName, entry);
  }
});

portToListenInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    listenButtonOnClick();
  }
});

portToConnectInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    connectButtonOnClick();
  }
});

function listenButtonOnClick() {
  /* Se a string tiver um tamanho maior que 0 e 
  não for formada de espaços */
  const portToListen = parseInt(portToListenInput.value);
  ipcRenderer.send('listen', nameInput.value, portToListen);
}

function connectButtonOnClick() {
  const ip = ipToConnectInput.value;
  const port = portToConnectInput.value;
  
  ipcRenderer.send('connect', nameInput.value, { 
    ip, port 
  });

  animateConnectButton();
}

function renderMessage(senderName: string, message: string) {
  const pElement: HTMLParagraphElement = document.createElement('p');
  const strongElement: HTMLElement = document.createElement('strong');

  strongElement.innerText = senderName;
  pElement.innerText = `: ${message}`;

  pElement.prepend(strongElement);
  
  messages.appendChild(pElement);

  // Scrollando (se preciso) pra ultima mensagem
  messages.scrollTop = messages.scrollHeight;
}

function renderLog(log: string) {
  const pElement: HTMLParagraphElement = document.createElement('p');
  pElement.innerHTML = `${log}`;
  
  messages.appendChild(pElement);

  // Scrollando (se preciso) pra ultima mensagem
  messages.scrollTop = messages.scrollHeight;
}

function incrementCounter() {
  const incrementedValue: number = parseInt(countNumber.innerText) + 1;
  countNumber.innerText = incrementedValue.toString();
}

function setCounter(value: number) {
  countNumber.innerText = value.toString();
}

function showChat() {
  chatContainer.style.display = 'flex';
}

// Anima os 3 pontos no final do texto após clicar para ouvir uma porta
function animateWaitingConnectionText(port: number) {
  if (waitingTextAnimationInterval) {
    window.clearInterval(waitingTextAnimationInterval);
  }

  let count = 0;
  const baseText = `Waiting for connections on port ${port}.`;
  
  waitingText.innerText = baseText;
  
  waitingTextAnimationInterval = window.setInterval(() => {
    if (count !== 2) {
      count++;
      waitingText.innerText = waitingText.innerText.concat('.');
    } else {
      count = 0;
      waitingText.innerText = baseText;
    }
  }, 1000); 
}

// Anima 3 pontos após clicar no botão de conectar
function animateConnectButton() {
  if (connectBtnAnimationInterval) {
    window.clearInterval(connectBtnAnimationInterval);
  }

  let count = 0;
  connectBtnText = connectButton.innerText;

  connectButton.innerText = '';

  connectBtnAnimationInterval = window.setInterval(() => {
    if (count !== 3) {
      count++;
      connectButton.innerText = connectButton.innerText.concat('.');
    } else {
      count = 0;
      connectButton.innerText = '';
    }
  }, 500);
}

// Quando o main process diz que criou um servidor
ipcRenderer.on('server-created', (event, port: number) => {
  mainMenuWrapper.style.display = 'none';
  waitingText.style.display = 'block';

  animateWaitingConnectionText(port);
});


// Quando o main process diz que houve um erro ao criar o servidor
ipcRenderer.on('listen-port-error', event => {
  // Volta ao menu principal
  mainMenuWrapper.style.display = 'block';
  waitingText.style.display = 'none';

  window.clearInterval(waitingTextAnimationInterval);
});

// Quando o main process diz que houve um erro ao se conectar
ipcRenderer.on('connect-error', event => {
  window.clearInterval(connectBtnAnimationInterval);
  connectButton.innerText = connectBtnText;
});

// Quando o main process pede para mostrar o chat
ipcRenderer.on('show-chat', (event, name) => {
  peerName = name;

  waitingText.style.display = 'none';
  connectionContainer.style.display = 'none';

  nickname.innerText = name;

  window.clearInterval(waitingTextAnimationInterval);
  window.clearInterval(connectBtnAnimationInterval);

  showChat();
});

// Quando o main process envia um log pro chat
ipcRenderer.on('log-chat', (event, log) => {
  renderLog(log);
});

// Quando o main process diz que enviou uma mensagem
ipcRenderer.on('new-message', (event, senderName, message) => {
  renderMessage(senderName, message);
});

// Quando o main process pede pra atualizar o state
ipcRenderer.on('set-state', (event, state) => {
  setCounter(state.counter);
});