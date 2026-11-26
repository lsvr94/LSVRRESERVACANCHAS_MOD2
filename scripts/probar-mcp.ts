// Cliente MCP de prueba (SDK v2), sin agente. Sesiones 3, 4 y 5.
//   npm run mcp:probar -- <servidor.ts | URL http> [herramienta [clave=valor ...] | uri://resource]
// Es un cliente de terminal: aquí sí se usa stdout (console.log).
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { parsearArgumentos, USO } from "./mcp-util";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const TSX = path.join(RAIZ, "node_modules", ".bin", "tsx");

function transporte(servidor: string) {
  if (servidor.startsWith("http")) {
    return new StreamableHTTPClientTransport(new URL(servidor));
  }
  const archivo = path.resolve(servidor);
  if (!existsSync(archivo)) throw new Error(`No existe el servidor '${servidor}'.`);
  // El stderr del servidor se ve en la terminal (útil para depurar); stdout es el protocolo.
  return new StdioClientTransport({ command: TSX, args: [archivo], stderr: "inherit" });
}

function textoDe(contenido: unknown): string {
  if (!Array.isArray(contenido)) return "";
  return contenido
    .map((c: { type?: string; text?: string }) => (c.type === "text" ? (c.text ?? "") : `[contenido ${c.type}]`))
    .join("\n");
}

async function main() {
  const entrada = parsearArgumentos(process.argv.slice(2));
  if (!entrada.ok) {
    console.error(`${entrada.error}\n\n${USO}`);
    process.exitCode = 1;
    return;
  }

  const cliente = new Client({ name: "probar-mcp", version: "1.0.0" });
  try {
    await cliente.connect(transporte(entrada.servidor));
    const { tools } = await cliente.listTools();
    console.log(`Herramientas: [${tools.map((t) => t.name).join(", ")}]`);
    if (cliente.getServerCapabilities()?.resources) {
      const { resources } = await cliente.listResources();
      console.log(`Recursos: [${resources.map((r) => r.uri).join(", ")}]`);
    }

    if (entrada.recurso) {
      const { contents } = await cliente.readResource({ uri: entrada.recurso });
      console.log(contents.map((c) => ("text" in c ? c.text : `[contenido binario ${c.mimeType ?? ""}]`)).join("\n"));
    } else if (entrada.herramienta) {
      const resultado = await cliente.callTool({ name: entrada.herramienta, arguments: entrada.argumentos });
      console.log(`¿Error?: ${resultado.isError === true}`);
      console.log(textoDe(resultado.content));
    }
  } catch (error) {
    console.error(`No se pudo probar el servidor: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await cliente.close().catch(() => {});
  }
}

void main();
