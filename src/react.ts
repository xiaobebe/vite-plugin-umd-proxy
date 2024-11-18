import { createHash } from "crypto";
import * as fs from "fs";
import mkdirp from "mkdirp-sync";
import { resolvePath } from "mlly";
import * as path from "path";
import { getExportsRuntime } from "pkg-exports";
import { mergeConfig, type Plugin } from "vite";

async function getExternalCode(npmName: string, windowName: string) {
	try {
		const exports = await getExportsRuntime(npmName);

		const eachExport = exports
			.filter((key) => {
				if (!/^[\w|_]+$/.test(key)) {
					return false;
				}
				if (["default", "__esModule"].includes(key)) {
					return false;
				}

				return true;
			})
			.map((key) => `export const ${key} = modules["${key}"];`);

		return `
    import * as OModule from "O:${npmName}";

    var modules = window["${windowName}"] || OModule;
        
        ${eachExport.join("\n")}

        export default modules;`;
	} catch (e) {
		console.warn(`Could not load external code for ${npmName}`);
	}
}

export function getAssetHash(content: Buffer | string) {
	return createHash("sha256")
		.update(Buffer.isBuffer(content) ? new Uint8Array(content) : content)
		.digest("hex")
		.slice(0, 8);
}

const optimizeCacheDir = path.join(
	process.cwd(),
	"node_modules/.vite-plugin-var-proxy",
);

const cdnExternals = (
	externals: Record<
		string,
		string | { windowName: string; find: string | RegExp }
	> = {
		react: {
			windowName: "React",
			find: /^react$/,
		},
		"react-dom": {
			windowName: "ReactDOM",
			find: /^react-dom$/,
		},
	},
) => {
	mkdirp(optimizeCacheDir);

	return {
		name: "vite:cdn-externals",
		enforce: "post",
		apply: "serve",
		async config(config) {
			const alias = (
				await Promise.all(
					Object.entries(externals).map(async ([npmName, option]) => {
						let windowName = option;
						let find = npmName;
						if (typeof option === "object") {
							windowName = option.windowName;
							find = <string>option.find;
						}

						const code = await getExternalCode(npmName, <string>windowName);
						if (!code) {
							return null;
						}

						const hash = getAssetHash(code);
						const fileName = `${npmName.replace("/", "_")}.${hash}.js`;
						const dependencyFile = path.resolve(optimizeCacheDir, fileName);
						if (!fs.existsSync(dependencyFile)) {
							fs.writeFileSync(dependencyFile, code);
						}

						return [
							{
								find,
								replacement: dependencyFile,
							},
						];
					}),
				)
			)
				.filter(Boolean)
				.flat();

			const result = mergeConfig(config, {
				resolve: {
					alias,
				},
				optimizeDeps: {
					esbuildOptions: {
						plugins: [
							{
								name: "vite-plugin-dayjs-to-moment",
								setup(build) {
									build.onResolve({ filter: /^O:react/ }, async (args) => {
										const realPath = await resolvePath(
											args.path.replace(/^O:/, ""),
										);
										return { path: realPath };
									});
								},
							},
						],
					},
				},
			});
			return result;
		},
	} as Plugin;
};
export default cdnExternals;
