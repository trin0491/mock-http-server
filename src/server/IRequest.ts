export interface IRequest {
  body: any;
  method: string;
  url: string;
  headers: { [header: string]: string | string[] };
}
