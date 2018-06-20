import {IConfig} from "..";
import {IMockResponse} from "../model/IMockResponse";
import app from "./app";

export class Server {

  public respond(mockResponse: IMockResponse): void {
  }

  public getRequest(): Promise<any> {
    return null;
  }

  public run(configuration?: IConfig): Promise<void> {
    // TODO
    return new Promise((resolve, reject) => {
      app.listen(3000, (err) => {
        console.log("Example app listening on port 3000!");
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
