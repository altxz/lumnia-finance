import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const projectRoot = process.cwd();
const configPath = join(projectRoot, "supabase", "config.toml");
const config = readFileSync(configPath, "utf8");
const projectRef = /^project_id\s*=\s*"([^"]+)"/m.exec(config)?.[1];

if (!projectRef) {
  throw new Error("Não foi possível obter project_id em supabase/config.toml.");
}

const dependencies = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")).dependencies ?? {};

function npmSpecifier(specifier) {
  const packageName = specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.split("/")[0];
  const subpath = specifier.slice(packageName.length);
  const version = packageName === "@lovable.dev/mcp-js" ? "0.26.3" : dependencies[packageName];
  return `npm:${packageName}${version ? `@${version}` : ""}${subpath}`;
}

const entry = `
import mcp from ${JSON.stringify(join(projectRoot, "src", "lib", "mcp", "index.ts"))};
import { createSupabaseHandler } from "@lovable.dev/mcp-js/stacks/supabase";
Deno.serve(createSupabaseHandler(mcp, { functionName: "lumnia-mcp" }));
`;

const result = await build({
  stdin: {
    contents: entry,
    resolveDir: projectRoot,
    sourcefile: "lumnia-mcp-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  target: "esnext",
  define: {
    "import.meta.env": JSON.stringify({ VITE_SUPABASE_PROJECT_ID: projectRef }),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(projectRef),
  },
  plugins: [
    {
      name: "lumnia-mcp-npm-imports",
      setup(plugin) {
        plugin.onResolve({ filter: /.*/ }, (args) => {
          if (
            args.path.startsWith(".") ||
            args.path.startsWith("/") ||
            isAbsolute(args.path) ||
            /^(npm|node|jsr|https?|data):/.test(args.path)
          ) {
            return null;
          }
          return { path: npmSpecifier(args.path), external: true };
        });
      },
    },
  ],
});

const output = result.outputFiles[0]?.text;
if (!output || /C:\\\\Users|project-ref-unset/.test(output)) {
  throw new Error("O bundle MCP contém uma referência inválida ao ambiente local.");
}

const target = resolve(projectRoot, "supabase", "functions", "lumnia-mcp", "index.ts");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(
  target,
  `// Gerado por scripts/build-lumnia-mcp.mjs. Não editar manualmente.\n// MCP privado do Lumnia, empacotado de forma portátil para Supabase Edge Functions.\n${output}`,
  "utf8",
);

console.log(`MCP pronto para ${projectRef}: ${target}`);
