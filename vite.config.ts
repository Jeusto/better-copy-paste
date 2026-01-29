import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import { crx, defineManifest } from "@crxjs/vite-plugin";

import pkg from "./package.json";

const root = resolve(__dirname, "src");
const pagesDir = resolve(root, "pages");
const assetsDir = resolve(root, "assets");

const browser = process.env.BROWSER || "chrome";
const isFirefox = browser === "firefox";

export default defineConfig(({ mode }) => {
  const manifest = defineManifest({
    manifest_version: 3,
    version: pkg.version,
    name:
      mode === "development" ? `[Dev] Better Copy Paste` : "Better Copy Paste",
    description:
      "Easily copy and paste text without formatting using keyboard shortcuts or the context menu",
    options_ui: {
      page: "src/pages/options/index.html",
    },
    background: isFirefox
      ? {
          scripts: ["src/pages/background/background.ts"],
          type: "module" as const,
        }
      : {
          service_worker: "src/pages/background/background.ts",
          type: "module" as const,
        },
    action: {
      default_popup: "src/pages/popup/index.html",
      default_icon: {
        "32": "icon-32.png",
      },
    },
    icons: {
      "128": "icon-128.png",
    },
    permissions: [
      "activeTab",
      "contextMenus",
      "clipboardRead",
      "clipboardWrite",
      "scripting",
    ],
    host_permissions: ["http://*/*", "https://*/*", "file:///*", "ftp://*/*"],
    commands: {
      copy_without_formatting: {
        suggested_key: {
          default: "Ctrl+Shift+Y",
          mac: "Command+Shift+Y",
        },
        description: "Copy selected text without formatting",
      },
      paste_without_formatting: {
        suggested_key: {
          default: "Ctrl+Shift+U",
          mac: "Command+Shift+U",
        },
        description: "Paste text without formatting",
      },
    },
    ...(isFirefox && {
      browser_specific_settings: {
        gecko: {
          id: "better-copy-paste@example.com",
          strict_min_version: "109.0",
          data_collection_permissions: {
            required: ["none"],
          },
        },
      },
    }),
  });

  return {
    root: ".",
    server: {
      port: 5000,
    },
    resolve: {
      alias: {
        "@src": root,
        "@assets": assetsDir,
        "@pages": pagesDir,
      },
    },
    build: {
      outDir: isFirefox ? "dist-firefox" : "dist",
    },
    plugins: [react(), crx({ manifest })],
  };
});
