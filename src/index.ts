import { cleanUrl, getTsOrTsx } from "./utils";
import { send, ViteDevServer } from "vite";

const viteVarProxy = ({ name, proxy = "dist" }) => {
  let originServerHost: string;
  let server: ViteDevServer;
  const proxyRe = new RegExp(`^/${proxy}/`);
  const hmrProxy = `hmr-${proxy}`;
  return {
    name: "vite:var-proxy",
    configureServer: function (_server) {
      server = _server;
      const { middlewares } = server;

      const options = server.config.server || {};

      let hostname = options.host || "localhost";
      if (hostname === "0.0.0.0") hostname = "localhost";
      const protocol = options.https ? "https" : "http";

      middlewares.use(async (req, res, next) => {
        if (
          req.method !== "GET"
          // || req.headers.accept?.includes("text/html")
        ) {
          return next();
        }

        const url = cleanUrl(req.url);
        if (!proxyRe.test(url)) {
          return next();
        }

        res.setHeader("access-control-allow-origin", "*");
        const port = _server.httpServer.address().port;
        originServerHost = `${protocol}://${hostname}:${port}`;

        if (/\.css$/.test(url)) {
          return send(req, res, "body{}", "css", {});
        }

        const modulePath = getTsOrTsx(url.replace(proxyRe, "./src/"))?.replace(
          ".",
          ""
        );

        if (!modulePath) {
          return next();
        }

        const code = `
    const scriptDom = document.createElement('script');
    scriptDom.setAttribute('type', 'module');
    const moduleVarName = \`$vite_module_\${new Date().valueOf()}\`;
    window[moduleVarName] = [];

    scriptDom.innerHTML = \`
      import '${originServerHost}${modulePath}?${hmrProxy}';
      window[moduleVarName][0]();
    \`;
    document.body.append(scriptDom);
    window["${name}"] = new Promise((resolve,reject)=> {
      window[moduleVarName] = [resolve,reject];
    });
`;

        return send(req, res, code, "js", {});
      });
    },
    resolveId(id) {
      if (new RegExp(`\\?${hmrProxy}`).test(id)) {
        return id;
      }
    },
    async load(id) {
      if (!new RegExp(`\\?${hmrProxy}`).test(id)) {
        return;
      }
      const file = cleanUrl(id);

      const code = `
    import * as varProxyModule from '${file}';
    
    let update;
    window["${name}"] = Object.create(varProxyModule, {
      onModuleUpdate:{
        value:function(cb) {
           update = cb;
        }
      }
    });
    
    import.meta.hot.accept(() => {
      update?.(window["${name}"]);
    });
`;
      return code;
    },
  };
};

export default viteVarProxy;
