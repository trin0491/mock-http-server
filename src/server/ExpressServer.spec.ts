import {IncomingMessage} from "http";
import {ExpressServer} from "./ExpressServer";
import {IConfig} from "./IConfig";
import {IMockResponse} from "./IMockResponse";
import {IRequest} from "./IRequest";

describe("ExpressServer", () => {

  const PORT = 3000;
  const URL = "/api/some/path?withParam=abc";
  const METHOD = "GET";

  let server: ExpressServer;
  let mockApp;
  let mockHttp;
  let requestCallback: (req, res, next) => void;
  let config: IConfig;

  beforeEach(() => {
    requestCallback = null;
    config = {port: PORT, paths: ["/api"]};
    mockApp = jasmine.createSpyObj("app", ["use", "listen"]);
    mockHttp = jasmine.createSpyObj("http.Server", ["close"]);
    server = new ExpressServer(mockApp);
  });

  function expectListen() {
    mockApp.use.and.callFake((path, callback) => {
      expect(path).toBe(config.paths[0]);
      expect(callback).toBeDefined();
      requestCallback = callback;
    });

    mockApp.listen.and.callFake((port, callback) => {
      expect(port).toBe(PORT);
      setTimeout(callback, 0);
      return mockHttp;
    });
  }

  function expectClose() {
    mockHttp.close.and.callFake((callback) => {
      setTimeout(callback, 0);
    });
  }

  function newMockResponse(): IMockResponse {
    return {
      data: {aKey: "aValue"},
      expression: "/api/some/path",
      method: "GET",
    };
  }

  function newMockHttpRequest() {
    const req = jasmine.createSpyObj("express.Request", ["get"]);
    req.url = URL;
    req.method = METHOD;
    const res = jasmine.createSpyObj("express.Response", ["json", "status", "sendStatus"]);
    const next = jasmine.createSpy("express.NextFunction");
    return [req, res, next];
  }

  function expectResponse(mockRes, mockResponse: IMockResponse) {
    expect(mockRes.status).toHaveBeenCalledWith(mockResponse.status ? mockResponse.status : 200);
    expect(mockRes.json).toHaveBeenCalledWith(mockResponse.data);
  }

  function expectNoResponse(mockRes) {
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  }

  function expectRequest(request: IRequest, mockReq: IncomingMessage) {
    expect(request.method).toBe(mockReq.method);
    expect(request.url).toBe(mockReq.url);
    expect(request.headers).toBeDefined();
  }

  describe("start()", () => {
    it("should start express on the port specified", () => {
      expectListen();
      return server.start(config).then(() => {
        expect(mockApp.use).toHaveBeenCalled();
        expect(requestCallback).not.toBeNull();
        expect(mockApp.listen).toHaveBeenCalled();
        expect(server.isStarted()).toBe(true);
      });
    });

    it("should rethrow errors from express", () => {
      mockApp.listen.and.callFake((port, callback) => {
        setTimeout(() => callback(new Error("Express failed to start")), 0);
        return server;
      });
      return server.start(config).catch((err) => {
        expect(err.message).toBe("Express failed to start");
        expect(mockApp.use).toHaveBeenCalled();
        expect(mockApp.listen).toHaveBeenCalled();
        expect(server.isStarted()).toBe(false);
      });
    });

    it("should reject calls when it has already been started", () => {
      expectListen();
      return server.start(config).then(() => {
        return server.start(config).catch((err) => {
          expect(mockApp.use).toHaveBeenCalledTimes(1);
          expect(mockApp.listen).toHaveBeenCalledTimes(1);
          expect(err.message).toBe("Server is already running");
          expect(server.isStarted()).toBe(true);
        });
      });
    });
  });

  describe("stop()", () => {
    it("should stop the server if it has been started", () => {
      expectListen();
      return server.start(config).then(() => {
        expectClose();
        return server.stop().then(() => {
          expect(mockHttp.close).toHaveBeenCalled();
          expect(server.isStarted()).toBe(false);
        });
      });
    });

    it("should rethrow errors from express", () => {
      expectListen();
      return server.start(config).then(() => {
        mockHttp.close.and.callFake((callback) => {
          setTimeout(() => callback(new Error("Server failed to stop")), 0);
        });
        return server.stop().catch((err) => {
          expect(err.message).toBe("Server failed to stop");
          expect(server.isStarted()).toBe(true);
        });
      });
    });

    it("should not stop the server if it has not been started", () => {
      return server.stop().catch((err) => {
        expect(err.message).toBe("Server has not been started");
        expect(mockHttp.close).not.toHaveBeenCalled();
        expect(server.isStarted()).toBe(false);
      });
    });
  });

  describe("respond()", () => {
    it("should throw an error if the server has not been started", () => {
      const mockResponse = newMockResponse();
      expect(() => server.respond(mockResponse)).toThrow();
    });

    it("should queue the response if the request has not been received", async () => {
      expectListen();
      await server.start(config);

      const mockResponse = newMockResponse();
      server.respond(mockResponse);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectResponse(mockRes, mockResponse);
    });

    it("should immediately respond if the request has already been received", async () => {
      expectListen();
      await server.start(config);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectNoResponse(mockRes);

      const mockResponse = newMockResponse();
      server.respond(mockResponse);

      expectResponse(mockRes, mockResponse);
    });

    it("should ignore requests if the path does not match", async () => {
      expectListen();
      await server.start(config);

      const mockResponse = newMockResponse();
      mockResponse.expression = "/api/a/different/path";
      server.respond(mockResponse);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectNoResponse(mockRes);
    });

    it("should ignore requests if the method does not match", async () => {
      expectListen();
      await server.start(config);

      const mockResponse = newMockResponse();
      mockResponse.method = "POST";
      server.respond(mockResponse);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectNoResponse(mockRes);
    });

    it("should use the mock response status if it is provided", async () => {
      expectListen();
      await server.start(config);

      const mockResponse = newMockResponse();
      mockResponse.status = 401;
      server.respond(mockResponse);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectResponse(mockRes, mockResponse);
    });

    it("should return the first matching mock response", async () => {
      expectListen();
      await server.start(config);

      const mockResponse1 = newMockResponse();
      mockResponse1.method = "POST";
      mockResponse1.data = {value: "1"};
      server.respond(mockResponse1);

      const mockResponse2 = newMockResponse();
      mockResponse2.data = {value: "2"};
      server.respond(mockResponse2);

      const mockResponse3 = newMockResponse();
      mockResponse3.data = {value: "3"};
      server.respond(mockResponse3);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectResponse(mockRes, mockResponse2);
    });

    it("should only respond once", async () => {
      expectListen();
      await server.start(config);

      const mockResponse = newMockResponse();
      server.respond(mockResponse);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectResponse(mockRes, mockResponse);

      requestCallback(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledTimes(1);
      expect(mockRes.json).toHaveBeenCalledTimes(1);
    });

    it("should return 404 to http requests when the server is stopped", async () => {
      expectListen();
      await server.start(config);

      const mockResponse = newMockResponse();
      server.respond(mockResponse);

      expectClose();
      await server.stop();

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expect(mockRes.sendStatus).toHaveBeenCalledWith(404);
    });

    it("should pass any error response error back to express to be sent as a fault", async () => {
      expectListen();
      await server.start(config);

      const mockResponse = newMockResponse();
      mockResponse.data = () => { /* this wouldn't parse to json */
      };
      server.respond(mockResponse);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      const errorMsg = "Failed to parse mock response into json";
      mockRes.json.and.throwError(errorMsg);

      requestCallback(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error(errorMsg));
    });
  });

  describe("getRequest()", () => {
    it("should reject calls if the server has not been started", () => {
      server.getRequest(newMockResponse()).catch((err) => {
        expect(err.message).toBe("Server has not been started");
      });
    });

    it("should return the request when it is received", async () => {
      expectListen();
      await server.start(config);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();

      const requestValidated = server.getRequest(newMockResponse())
        .then((request: IRequest) => expectRequest(request, mockReq))
        .then(() => expectNoResponse(mockRes));

      requestCallback(mockReq, mockRes, mockNext);

      return requestValidated;
    });

    it("should not return a request that has already been received", async () => {
      expectListen();
      await server.start(config);

      const [mockReq1, mockRes1, mockNext1] = newMockHttpRequest();
      const [mockReq2, mockRes2, mockNext2] = newMockHttpRequest();

      requestCallback(mockReq1, mockRes1, mockNext1);

      const requestValidated = server.getRequest(newMockResponse())
        .then((request: IRequest) => expectRequest(request, mockReq2));

      requestCallback(mockReq2, mockRes2, mockNext2);

      return requestValidated;
    });

    it("should allow a response to be sent", async () => {
      expectListen();
      await server.start(config);

      const [mockReq1, mockRes1, mockNext1] = newMockHttpRequest();

      const mockResponse = newMockResponse();

      const requestValidated = server.getRequest(mockResponse)
        .then((request: IRequest) => expectRequest(request, mockReq1))
        .then(() => server.respond(mockResponse))
        .then(() => expectResponse(mockRes1, mockResponse));

      requestCallback(mockReq1, mockRes1, mockNext1);

      return requestValidated;
    });
  });

});
