import {ProtractorPlugin} from "protractor";
import {Server} from "..";

// creating a "var module: any" will allow use of module.exports
declare var module: any;

const plugin: ProtractorPlugin = {

  onPrepare() {
    console.log("Starting mock server");
    const server = new Server();
    return server.run()
      .then(() => console.log("Started mock server"))
      .catch((err) => console.error("Failed to start mock server", err));
  },
};

module.exports = plugin;
