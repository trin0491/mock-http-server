import {ProtractorPlugin} from "protractor";
import {server} from "..";

// creating a "var module: any" will allow use of module.exports
declare var module: any;

const plugin: ProtractorPlugin = {

  onPrepare() {
    const config = {
      paths: ["/api"],
      port: 3000,
    };
    return server.start(config)
      .then(() => console.log(`Started mock server on http:localhost:${config.port}`))
      .catch((err) => console.error("Failed to start mock server", err));
  },
};

module.exports = plugin;
