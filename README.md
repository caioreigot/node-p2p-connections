# P2P Communication

The code, which only uses Node's internal "net" module, establishes a TCP connection between the sockets. There is no centralized connection, the Peers connect to each other and are aware of each other, maintaining a decentralized network.

<strong>Note:</strong> The framework "Electron" was used for a more interactive interface, <strong>Peer.ts</strong> and the logic presented in this repository can be used in any other Node.js project.

## How to use:
```sh
# Install dependencies
npm i

# Run the program
npm run dev
```