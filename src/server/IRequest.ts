export interface IRequest {
  method: string;
  url: string;
  headers: { [header: string]: string | string[] };
}
