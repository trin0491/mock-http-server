export interface IMockResponse {
  expression: string;
  method: "GET" | "POST" | "UPDATE";
  scenario: IMockScenario;
}

export interface IMockScenario {
  status?: number;
  data?: any;
  headers?: { [key: string]: string };
  statusText?: string;
  delay?: number;
}
