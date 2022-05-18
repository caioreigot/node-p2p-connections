export default interface ConnectOptions {
  senderName: string; 
  timeoutInSeconds: number;
  onConnect: () => void;
}