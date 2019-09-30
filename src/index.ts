import fetch, { Headers } from "node-fetch";
import * as fs from "fs";
import * as util from "util";
import chalk from "chalk";
import * as rimraf from "rimraf";

if (process.argv.length < 3) {
  console.log("Usage: node setup.js <file-key> [figma-dev-token]");
  process.exit(1);
}
const fileKey = process.argv[2];
const devToken = process.argv[3];
const outputPath = "./ui.js";
const cacheDir = ".cache";

async function get(path: string): Promise<any> {
  const headers = new Headers();
  headers.append("X-Figma-Token", devToken);
  const res = await fetch(`https://api.figma.com/v1${path}`, { headers });
  return res.json();
}

async function traverse(
  node: any,
  f: (node: any, depth: number, index: number) => void,
  depth = 0,
  index = 0
) {
  f(node, depth, index);
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      traverse(child, f, depth + 1, i);
    }
  }
}

async function load(fileKey: string): Promise<any> {
  rimraf.sync(cacheDir);
  fs.mkdirSync(cacheDir);
  const data = await get(`/files/${fileKey}`);
  fs.writeFileSync(cacheDir + "/data.json", JSON.stringify(data, null, 2));
  return data;
}
function showAll(data: any): void {
  console.log(util.inspect(data, { colors: true, depth: null }));
}
function showSummary(document: DocumentNode): void {
  traverse(document, (node, depth) => {
    const kv: string[] = [];
    for (const key in node) {
      if (key === "type" || key === "children") {
        continue;
      }
      if (["name"].includes(key)) {
        kv.push(chalk.cyan(key) + "=" + JSON.stringify(node[key]));
      }
    }
    console.log(
      `${"  ".repeat(depth)}${chalk.green(node.type)} (${kv.join(" ")})`
    );
  });
}

async function run() {
  const data = await load(fileKey);
  const doc = data.document as DocumentNode;
  console.log(chalk.bgMagenta("# Data"));
  console.log();
  showAll(data);
  console.log();
  console.log(chalk.bgMagenta("# Summary"));
  console.log();
  showSummary(doc);
  console.log();
  const canvas = doc.children[0] as PageNode;

  const components: ComponentNode[] = [];
  for (let child of canvas.children) {
    if (child.type === "COMPONENT") {
      components.push(child);
    }
  }

  let html = ``;
  for (const component of components) {
    html += `<div>${component.name}</div>\n`;
  }

  fs.writeFileSync(outputPath, html);
}

run().catch(err => {
  console.error(err);
  console.error(err.stack);
  process.exit(1);
});
