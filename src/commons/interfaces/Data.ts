import { DataType } from "../enums/DataType";

export default interface Data {
  signature: string | null,
  type: DataType,
  senderName: string,
  content: any
}