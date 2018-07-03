export interface ITestRequest {
  body: any;
  method: string;
  url: string;
  headers: { [header: string]: string | string[] };
}
