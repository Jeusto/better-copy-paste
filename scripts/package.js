import { createWriteStream, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";
import pkg from "../package.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const browser = process.argv[2];
if (!browser || !["chrome", "firefox"].includes(browser)) {
  console.error("Usage: node scripts/package.js <chrome|firefox>");
  process.exit(1);
}

const isFirefox = browser === "firefox";
const srcDir = isFirefox ? "dist-firefox" : "dist";
const ext = isFirefox ? "xpi" : "zip";
const outputDir = resolve(rootDir, "releases");
const outputFile = `better-copy-paste-${browser}-v${pkg.version}.${ext}`;
const outputPath = resolve(outputDir, outputFile);

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const output = createWriteStream(outputPath);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  console.log(`✓ Created ${outputFile} (${archive.pointer()} bytes)`);
});

archive.on("error", (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(resolve(rootDir, srcDir), false);
archive.finalize();
