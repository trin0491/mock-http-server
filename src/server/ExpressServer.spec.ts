import {ExpressServer} from "./ExpressServer";

describe("ExpressServer", () => {

  const PORT = 3000;

  let server: ExpressServer;
  let mockApp;

  beforeEach(() => {
    mockApp = jasmine.createSpyObj("app", ["use", "listen"]);
    server = new ExpressServer(mockApp);
  });

  describe("run()", () => {

    it("should start express on the port specified", () => {
      mockApp.listen.and.callFake((port, callback) => {
        expect(port).toBe(PORT);
        callback();
      });
      return server.run({port: PORT}).then(() => {
        expect(mockApp.listen).toHaveBeenCalled();
      });
    });

    it("should rethrow errors from express", () => {
      mockApp.listen.and.callFake((port, callback) => {
        callback(new Error("Express failed to start"));
      });
      return server.run({port: PORT}).then(() => fail()).catch((err) => {
        expect(err.message).toBe("Express failed to start");
      });
    });

    it("should reject calls when already running", () => {
      mockApp.listen.and.callFake((port, callback) => {
        callback();
      });

      return server.run({port: PORT}).then(() => {
        return server.run({port: PORT}).catch((err) => {
          expect(mockApp.listen).toHaveBeenCalledTimes(1);
          expect(err.message).toBe("Server is already running");
        });
      });
    });
  });

});
