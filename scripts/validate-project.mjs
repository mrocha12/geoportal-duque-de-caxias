import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

for (const file of await walk(path.join(root, "js"))) {
  if (!file.endsWith(".js")) continue;
  try {
    new vm.Script(await readFile(file, "utf8"), { filename: path.relative(root, file) });
  } catch (error) {
    failures.push(`${path.relative(root, file)}: ${error.message}`);
  }
}

for (const file of await walk(path.join(root, "data"))) {
  if (!file.endsWith(".js")) continue;
  try {
    new vm.Script(await readFile(file, "utf8"), { filename: path.relative(root, file) });
  } catch (error) {
    failures.push(`${path.relative(root, file)}: ${error.message}`);
  }
}

const html = await readFile(path.join(root, "index.html"), "utf8");
const localReferences = [
  ...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/gi)
].map(match => match[1]);

for (const reference of localReferences) {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(reference)) continue;
  const relativePath = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  const target = path.resolve(root, relativePath);
  if (!target.startsWith(root + path.sep) || !(await stat(target).catch(() => null))) {
    failures.push(`index.html: recurso local inexistente: ${reference}`);
  }
}

if (/<span\b[^>]*class="at-link"/i.test(html) ||
    /<span\b[^>]*class="at-filter-remove"/i.test(await readFile(path.join(root, "js", "attribute-table.js"), "utf8"))) {
  failures.push("Ações da Tabela de Atributos devem usar controles de botão.");
}

if (failures.length) {
  console.error("Validação do projeto falhou:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Validação concluída: sintaxe JavaScript e referências locais válidas.");
}
