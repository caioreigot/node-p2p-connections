export default interface ConnectOptions {
  senderName: string; 
  loopback: boolean;
  timeoutInSeconds: number;
  onConnect: () => void;
}