import * as express from "express";
import {Server} from "http";
import {IConfig} from "./IConfig";
import {IMockResponse} from "./IMockResponse";
import {IRequest} from "./IRequest";
import {IServer} from "./server";

enum ActionType {
  GET_REQUEST,
  RESPOND,
}

interface IAction {
  type: ActionType;
  mockResponse: IMockResponse;
  options: any;
  payload?: any;
}

interface ITransaction {
  req: express.Request;
  res: express.Response;
  next: express.NextFunction;
}

export class ExpressServer implements IServer {

  private actions: IAction[] = [];
  private openTransactions: ITransaction[] = [];
  private httpServer: Server = null;

  constructor(private app: express.Express) {
  }

  public respond(mockResponse: IMockResponse, options: any = {}): void {
    if (!this.isStarted()) {
      throw new Error("Server has not been started");
    }
    this.addAction(ActionType.RESPOND, mockResponse, options);
    this.processActions();
  }

  public getRequest(mockResponse: IMockResponse, options: any = {}): Promise<IRequest> {
    return new Promise((resolve, reject) => {
      if (!this.isStarted()) {
        reject(new Error("Server has not been started"));
      }
      this.addAction(ActionType.GET_REQUEST, mockResponse, options, {resolve, reject});
      this.processActions();
    });
  }

  public isStarted(): boolean {
    return this.httpServer !== null;
  }

  public start(config: IConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isStarted()) {
        reject(new Error("Server is already running"));
        return;
      }
      this.app.use(express.json());
      config.paths.forEach((path) => this.app.use(path, this.onRequest.bind(this)));
      this.httpServer = this.app.listen(config.port, (err) => {
        if (err) {
          this.httpServer = null;
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isStarted()) {
        reject(new Error("Server has not been started"));
      }
      this.httpServer.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.httpServer = null;
          resolve();
        }
      });
    });
  }

  private onRequest(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (this.isStarted()) {
      this.openTransactions.unshift({req, res, next});
      this.processActions();
    } else {
      res.sendStatus(404);
    }
  }

  // noinspection JSMethodCanBeStatic
  private returnResponse(res: express.Response, response: IMockResponse): void {
    if (response.status) {
      res.status(response.status);
    } else {
      res.status(200);
    }
    res.json(response.data);
  }

  private addAction(type: ActionType, mockResponse: IMockResponse, options: any, payload?: any) {
    this.actions.unshift({
      mockResponse,
      options,
      payload,
      type,
    });
  }

  // noinspection JSMethodCanBeStatic
  private matches(action: IAction, tx: ITransaction): boolean {
    return tx.req.url.match(action.mockResponse.expression) && action.mockResponse.method === tx.req.method;
  }

  private processRespond(action: IAction, tx: ITransaction) {
    const mockResponse = action.mockResponse;
    if (mockResponse.delay > 0) {
      setTimeout(() => this.returnResponse(tx.res, mockResponse), mockResponse.delay);
    } else {
      this.returnResponse(tx.res, mockResponse);
    }
  }

  // noinspection JSMethodCanBeStatic
  private processGetRequest(action: IAction, tx: ITransaction) {
    const resolve = action.payload.resolve;
    const request: IRequest = {
      body: tx.req.body,
      headers: Object.assign({}, tx.req.headers),
      method: tx.req.method,
      url: tx.req.url,
    };
    resolve(request);
  }

  private processActions(): void {
    for (let i = this.openTransactions.length - 1; i >= 0; --i) {
      const tx = this.openTransactions[i];

      for (let j = this.actions.length - 1; j >= 0; --j) {
        const action = this.actions[j];

        if (this.matches(action, tx)) {
          this.actions.splice(j, 1);
          try {
            switch (action.type) {
              case ActionType.GET_REQUEST:
                this.processGetRequest(action, tx);
                break;
              case ActionType.RESPOND:
                this.openTransactions.splice(i, 1);
                this.processRespond(action, tx);
                break;
            }
          } catch (err) {
            tx.next(err);
          }
        }
      }
    }
  }
}
