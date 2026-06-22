import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "test-cases", "generated", "src");
const metadataPath = path.join(root, "test-cases", "generated", ".metadata.json");
const requested = process.env.GENERATED_MODULES ?? process.argv[2] ?? "750";
const moduleCount = Number.parseInt(requested, 10);

if (!Number.isInteger(moduleCount) || moduleCount < 1 || moduleCount > 10_000) {
  throw new Error(`GENERATED_MODULES must be an integer from 1 to 10000; received ${requested}`);
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const imports = [];
const values = [];

for (let index = 0; index < moduleCount; index += 1) {
  const suffix = String(index).padStart(4, "0");
  const fileName = `module-${suffix}.ts`;
  const typeName = `Record${suffix}`;
  const valueName = `record${suffix}`;

  const source = `export interface ${typeName} {\n  readonly id: number;\n  label: \`record-${suffix}\`;\n  tags: readonly string[];\n  metrics: { score: number; active: boolean };\n}\n\nexport type Partial${typeName} = {\n  [Key in keyof ${typeName}]?: ${typeName}[Key];\n};\n\nexport const ${valueName}: ${typeName} = {\n  id: ${index},\n  label: \"record-${suffix}\",\n  tags: [\"generated\", \"typescript\"],\n  metrics: { score: ${index % 101}, active: ${index % 2 === 0} }\n};\n\nexport function normalize${suffix}<Value extends ${typeName}>(value: Value): Value & { readonly normalized: true } {\n  return Object.assign({}, value, { normalized: true as const });\n}\n`;

  await writeFile(path.join(outputDir, fileName), source, "utf8");
  imports.push(`import { ${valueName} } from \"./module-${suffix}.js\";`);
  values.push(valueName);
}

const indexSource = `${imports.join("\n")}\n\nconst records = [${values.join(", ")}] as const;\n\nexport const generatedChecksum = records.reduce((total, record) => total + record.id + record.metrics.score, 0);\nexport const generatedRecordCount = records.length;\n`;

await writeFile(path.join(outputDir, "index.ts"), indexSource, "utf8");
await writeFile(
  metadataPath,
  `${JSON.stringify({ moduleCount, generatedAt: new Date().toISOString() }, null, 2)}\n`,
  "utf8"
);

console.log(`Generated ${moduleCount} TypeScript modules in ${path.relative(root, outputDir)}`);
