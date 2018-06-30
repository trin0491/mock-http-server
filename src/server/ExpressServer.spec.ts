import {ExpressServer} from "./ExpressServer";
import {IMockResponse} from "./IMockResponse";

describe("ExpressServer", () => {

  const PORT = 3000;
  const URL = "/api/some/path?withParam=abc";

  let server: ExpressServer;
  let mockApp;
  let mockHttp;
  let requestCallback: (req, res) => void;
  let config;

  beforeEach(() => {
    requestCallback = null;
    config = {port: PORT};
    mockApp = jasmine.createSpyObj("app", ["use", "listen"]);
    mockHttp = jasmine.createSpyObj("http.Server", ["close"]);
    server = new ExpressServer(mockApp);
  });

  function expectListen() {
    mockApp.use.and.callFake((path, callback) => {
      // TODO specify path from config
      expect(path).toBeDefined();
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

  function newMockHttpRequestEvent() {
    const req = jasmine.createSpyObj("express.Request", ["get"]);
    req.url = URL;
    req.method = "GET";
    const res = jasmine.createSpyObj("express.Response", ["json", "status", "sendStatus"]);
    return [req, res];
  }

  function expectResponse(mockRes, mockResponse: IMockResponse) {
    expect(mockRes.status).toHaveBeenCalledWith(mockResponse.status ? mockResponse.status : 200);
    expect(mockRes.json).toHaveBeenCalledWith(mockResponse.data);
  }

  function expectNoResponse(mockRes) {
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
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
        expect(err.message).toBe("Server is not started");
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

      const [mockReq, mockRes] = newMockHttpRequestEvent();
      requestCallback(mockReq, mockRes);

      expectResponse(mockRes, mockResponse);
    });

    it("should immediately respond if the request has already been received", async () => {
      expectListen();
      await server.start(config);

      const [mockReq, mockRes] = newMockHttpRequestEvent();
      requestCallback(mockReq, mockRes);

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

      const [mockReq, mockRes] = newMockHttpRequestEvent();
      requestCallback(mockReq, mockRes);

      expectNoResponse(mockRes);
    });

    it("should ignore requests if the method does not match", async () => {
      expectListen();
      await server.start(config);

      const mockResponse = newMockResponse();
      mockResponse.method = "POST";
      server.respond(mockResponse);

      const [mockReq, mockRes] = newMockHttpRequestEvent();
      requestCallback(mockReq, mockRes);

      expectNoResponse(mockRes);
    });

    it("should use the mock response status if it is provided", async () => {
      expectListen();
      await server.start(config);

      const mockResponse = newMockResponse();
      mockResponse.status = 401;
      server.respond(mockResponse);

      const [mockReq, mockRes] = newMockHttpRequestEvent();
      requestCallback(mockReq, mockRes);

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

      const [mockReq, mockRes] = newMockHttpRequestEvent();
      requestCallback(mockReq, mockRes);

      expectResponse(mockRes, mockResponse2);
    });

    it("should only respond once", async () => {
      expectListen();
      await server.start(config);

      const mockResponse = newMockResponse();
      server.respond(mockResponse);

      const [mockReq, mockRes] = newMockHttpRequestEvent();
      requestCallback(mockReq, mockRes);

      expectResponse(mockRes, mockResponse);

      requestCallback(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledTimes(1);
      expect(mockRes.json).toHaveBeenCalledTimes(1);
    });

    it("should reject http requests when the server is stopped", async () => {
      expectListen();
      await server.start(config);

      const mockResponse = newMockResponse();
      server.respond(mockResponse);

      expectClose();
      await server.stop();

      const [mockReq, mockRes] = newMockHttpRequestEvent();
      requestCallback(mockReq, mockRes);

      expect(mockRes.sendStatus).toHaveBeenCalledWith(404);
    });
  });

});
