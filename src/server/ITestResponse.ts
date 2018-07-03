export interface ITestResponse {
  expression: string;
  method: "GET" | "POST" | "UPDATE";
  status?: number;
  data?: any;
  headers?: { [key: string]: string };
  statusText?: string;
  delay?: number;
}
