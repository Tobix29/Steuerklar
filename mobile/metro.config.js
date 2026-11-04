// Metro: erlaubt Laufzeit-Importe der reinen Steuer-Engine aus ../src/lib (Aliase @core/* und @/* aus tsconfig.json).
// Nur reine TypeScript-Module (Steuerberechnung, Spar-Check, Kontoauszug-Zuordnung) – kein Server-Code.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.join(workspaceRoot, "src", "lib"), path.join(workspaceRoot, "node_modules", "zod")];
// Pakete zuerst aus mobile/node_modules (React, React Native), danach aus dem Web-Projekt (zod)
config.resolver.nodeModulesPaths = [path.join(projectRoot, "node_modules"), path.join(workspaceRoot, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

// Server-Module dürfen niemals in die App gelangen
const forbidden = /[\\/]src[\\/]lib[\\/](server|security)[\\/]|^server-only$|^@anthropic-ai|^next(\/|$)|^pdf-lib$|^sharp$/;
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (forbidden.test(moduleName)) throw new Error(`Server-Modul in der App nicht erlaubt: ${moduleName} (aus ${context.originModulePath})`);
  const aliased = moduleName.startsWith("@core/")
    ? path.join(workspaceRoot, "src", "lib", moduleName.slice(6))
    : moduleName.startsWith("@/")
      ? path.join(workspaceRoot, "src", moduleName.slice(2))
      : moduleName;
  return (defaultResolve ?? context.resolveRequest)(context, aliased, platform);
};

module.exports = config;
