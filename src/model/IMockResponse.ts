export interface IMockResponse {
  name: string;
  expression: string;
  method: string;
  responses: { [key: string]: IMockScenario };
}

export interface IMockScenario {
  status?: number;
  data?: any;
  headers?: { [key: string]: string };
  statusText?: string;
  delay?: number;
}
