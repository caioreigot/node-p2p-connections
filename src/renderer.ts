import { ipcRenderer } from 'electron';

let peerName: string;

var waitingTextAnimationInterval: number;

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

/* Botão de "Ouvir" */
document.querySelector('#port-input-container .connection-buttons')
  ?.addEventListener('click', listenButtonOnClick);

/* Botão de "Conectar" */
document.querySelector('#connect-container .connection-buttons')
  ?.addEventListener('click', connectButtonOnClick);

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
  if (portToListenInput.value.replace(/\s/g, "").length) {
    const portToListen = parseInt(portToListenInput.value);
    
    ipcRenderer.send('listen', nameInput.value, portToListen);
  }
}

function connectButtonOnClick() {
  /* Se as strings tiverem um tamanho maior que 
  0 e não forem formadas por espaços */
  if (ipToConnectInput.value.replace(/\s/g, "").length 
    && portToConnectInput.value.replace(/\s/g, "").length
  ) {
    const ip = ipToConnectInput.value;
    const port = parseInt(portToConnectInput.value);
    
    ipcRenderer.send('connect', nameInput.value, { 
        ip, port 
    });
  }
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

// Anima os 3 pontos no final do texto
function animateWaitingText(port: number) {
  let count = 0;
  const baseText = `Waiting for connections on port ${port}.`;
  
  waitingText.innerText = baseText;
  
  waitingTextAnimationInterval = window.setInterval(() => {
    count++;

    waitingText.innerText = waitingText.innerText.concat('.');

    if (count == 3) {
      waitingText.innerText = baseText;
      count = 0;
    }
  }, 1000); 
}

// Quando o main process diz que criou um servidor
ipcRenderer.on('server-created', (event, port: number) => {
  mainMenuWrapper.style.display = 'none';
  waitingText.style.display = 'block';

  animateWaitingText(port);
});

// Quando o main process pede para mostrar o chat
ipcRenderer.on('show-chat', (event, name) => {
  peerName = name;

  waitingText.style.display = 'none';
  connectionContainer.style.display = 'none';

  nickname.innerText = name;

  window.clearInterval(waitingTextAnimationInterval);

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