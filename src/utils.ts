import * as fs from "fs";

const queryRE = /\?.*$/;
const hashRE = /#.*$/;

export const cleanUrl = (url) => url.replace(hashRE, "").replace(queryRE, "");

export const htmlProxyRE = /\?html-proxy&index=(\d+)\.js$/;
export const isHTMLProxy = (id) => htmlProxyRE.test(id);

/**
 * 根据文件逻辑获取是Ts或者Tsx
 * @param filePath
 * @returns {*}
 */
export function getTsOrTsx(filePath) {
  const paths = [
    filePath.replace(/\.[tj]sx?$/, ".ts"),
    filePath.replace(/\.[tj]sx?$/, ".tsx"),
  ];

  return paths.find((path) => fs.existsSync(path));
}
