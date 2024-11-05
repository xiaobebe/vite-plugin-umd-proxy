import { loadConfig } from "@unocss/config";
import { type ViteDevServer, send } from "vite";
import cdnExternals from "./react";
import { cleanUrl, getTsOrTsx } from "./utils";

async function hasUno() {
	const config = await loadConfig();

	return config.sources?.length ? config : undefined;
}

const viteVarProxy = ({ name, proxy = "dist", forceHmr = false }) => {
	let originServerHost: string;
	let server: ViteDevServer;
	const proxyRe = new RegExp(`^/${proxy}/`);
	const hmrProxy = `hmr-${proxy}`;

	return [
		{
			name: "vite:var-proxy",
			apply: "serve",
			configureServer(_server) {
				server = _server;
				const { middlewares } = server;

				const options = server.config.server || {};

				let hostname =
					typeof options.host === "string" ? options.host : "localhost";
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

					const modulePath = getTsOrTsx(
						url.replace(proxyRe, "./src/"),
					)?.replace(".", "");

					if (!modulePath) {
						return next();
					}

					const code = `
    const scriptDom = document.createElement('script');
    scriptDom.setAttribute('type', 'module');
    const moduleVarName = \`$vite_module_\${new Date().valueOf()}\`;
    window[moduleVarName] = [];

    window.$RefreshReg$ = undefined;
    scriptDom.innerHTML = \`
    import * as RefreshRuntime from "${originServerHost}/@react-refresh";
    if (!window.$RefreshReg$) {
      try {
        const injectIntoGlobalHook =
          RefreshRuntime?.injectIntoGlobalHook ??
          RefreshRuntime?.default?.injectIntoGlobalHook;

        injectIntoGlobalHook(window);
      } catch (e) {}
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
    }

      import('${originServerHost}${modulePath}?${hmrProxy}').then(()=>{
        window[moduleVarName][0]();
      });
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

				const hasUnocss = await hasUno();

				const file = cleanUrl(id);

				const code = `
    import * as varProxyModule from '${file}';

    ${hasUnocss ? "import 'uno.css';" : ""}
    
    let update;
    window["${name}"] = Object.create(varProxyModule, {
      onModuleUpdate:{
        value:function(cb) {
           update = cb;
        }
      }
    });
    
    import.meta.hot.accept(() => {
      ${forceHmr ? "update?.(window['${name}']);" : `console.log('Module ${name} updated');`}
    });
`;
				return code;
			},
		},
		cdnExternals(),
	];
};

export default viteVarProxy;
