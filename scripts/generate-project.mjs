import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readInteger(name, fallback, minimum, maximum) {
  const raw = process.env[name] ?? String(fallback);
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}; received ${raw}`);
  }
  return value;
}

const moduleCount = readInteger("GENERATED_MODULES", 750, 1, 10_000);
const typeHeavyFileCount = readInteger("TYPE_HEAVY_FILES", 80, 1, 2_000);
const projectPackageCount = readInteger("PROJECT_PACKAGES", 8, 2, 64);
const projectFilesPerPackage = readInteger("PROJECT_FILES_PER_PACKAGE", 40, 1, 500);

async function resetDirectory(directory) {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
}

async function generateManyFiles() {
  const baseDir = path.join(root, "test-cases", "generated");
  const outputDir = path.join(baseDir, "src");
  await resetDirectory(outputDir);

  const imports = [];
  const values = [];
  for (let index = 0; index < moduleCount; index += 1) {
    const suffix = String(index).padStart(5, "0");
    const typeName = `Record${suffix}`;
    const valueName = `record${suffix}`;
    const source = `export interface ${typeName} {\n  readonly id: number;\n  label: \`record-${suffix}\`;\n  tags: readonly string[];\n  metrics: { score: number; active: boolean };\n}\n\nexport type Partial${typeName} = {\n  [Key in keyof ${typeName}]?: ${typeName}[Key];\n};\n\nexport const ${valueName}: ${typeName} = {\n  id: ${index},\n  label: \"record-${suffix}\",\n  tags: [\"generated\", \"typescript\"],\n  metrics: { score: ${index % 101}, active: ${index % 2 === 0} }\n};\n\nexport function normalize${suffix}<Value extends ${typeName}>(value: Value): Value & { readonly normalized: true } {\n  return Object.assign({}, value, { normalized: true as const });\n}\n`;
    await writeFile(path.join(outputDir, `module-${suffix}.ts`), source, "utf8");
    imports.push(`import { ${valueName} } from \"./module-${suffix}.js\";`);
    values.push(valueName);
  }

  const indexSource = `${imports.join("\n")}\n\nconst records = [${values.join(", ")}] as const;\n\nexport const generatedChecksum = records.reduce((total, record) => total + record.id + record.metrics.score, 0);\nexport const generatedRecordCount = records.length;\n`;
  await writeFile(path.join(outputDir, "index.ts"), indexSource, "utf8");
  return { moduleCount, sourceFileCount: moduleCount + 1 };
}

async function generateTypeHeavy() {
  const baseDir = path.join(root, "test-cases", "type-heavy");
  const outputDir = path.join(baseDir, "src");
  await resetDirectory(outputDir);

  const exports = [];
  for (let index = 0; index < typeHeavyFileCount; index += 1) {
    const suffix = String(index).padStart(4, "0");
    const eventEntries = Array.from({ length: 16 }, (_, eventIndex) => {
      const eventSuffix = String(eventIndex).padStart(2, "0");
      return `  \"entity-${suffix}.${eventIndex % 2 === 0 ? "created" : "updated"}.${eventSuffix}\": { readonly id: \"${suffix}-${eventSuffix}\"; value: number; tags: readonly [\"type-heavy\", \"${eventSuffix}\"] };`;
    }).join("\n");

    const source = `type Primitive = string | number | boolean | bigint | symbol | null | undefined;\n\ntype DeepReadonly<Value> =\n  Value extends Primitive | ((...args: never[]) => unknown) ? Value :\n  Value extends readonly (infer Item)[] ? readonly DeepReadonly<Item>[] :\n  Value extends object ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> } :\n  Value;\n\ntype Split<Path extends string> = Path extends \`${"${infer Head}"}.${"${infer Tail}"}\` ? [Head, ...Split<Tail>] : [Path];\n\ntype UnionToIntersection<Union> =\n  (Union extends unknown ? (value: Union) => void : never) extends (value: infer Intersection) => void\n    ? Intersection\n    : never;\n\ninterface EventMap${suffix} {\n${eventEntries}\n}\n\ntype HandlerMap${suffix} = {\n  [Event in keyof EventMap${suffix} as \`on${"${Capitalize<string & Event>}"}\`]:\n    (payload: DeepReadonly<EventMap${suffix}[Event]>) => Promise<{ event: Event; segments: Split<string & Event> }>;\n};\n\ntype HandlerUnion${suffix} = HandlerMap${suffix}[keyof HandlerMap${suffix}];\nexport type HandlerIntersection${suffix} = UnionToIntersection<HandlerUnion${suffix}>;\nexport type EventNames${suffix} = keyof EventMap${suffix};\nexport type EventSegments${suffix} = { [Event in EventNames${suffix}]: Split<string & Event> };\nexport const handlers${suffix}: Partial<HandlerMap${suffix}> = {};\n`;

    await writeFile(path.join(outputDir, `types-${suffix}.ts`), source, "utf8");
    exports.push(`export type { EventNames${suffix}, EventSegments${suffix}, HandlerIntersection${suffix} } from \"./types-${suffix}.js\";`);
  }

  await writeFile(path.join(outputDir, "index.ts"), `${exports.join("\n")}\n`, "utf8");
  return { fileCount: typeHeavyFileCount + 1, generatedTypeFiles: typeHeavyFileCount };
}

async function generateProjectReferences() {
  const baseDir = path.join(root, "test-cases", "project-references");
  await resetDirectory(baseDir);

  const aggregatorIndex = projectPackageCount - 1;
  const leafIndices = Array.from({ length: aggregatorIndex }, (_, index) => index);
  const rootReferences = [];

  for (let packageIndex = 0; packageIndex < projectPackageCount; packageIndex += 1) {
    const packageSuffix = String(packageIndex).padStart(2, "0");
    const packageDir = path.join(baseDir, `pkg-${packageSuffix}`);
    const sourceDir = path.join(packageDir, "src");
    const isAggregator = packageIndex === aggregatorIndex;
    await mkdir(sourceDir, { recursive: true });

    const references = isAggregator
      ? leafIndices.map((leafIndex) => ({ path: `../pkg-${String(leafIndex).padStart(2, "0")}` }))
      : [];
    const packageConfig = {
      compilerOptions: {
        composite: true,
        declaration: true,
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        noUncheckedSideEffectImports: true,
        stableTypeOrdering: true,
        rootDir: "./src",
        outDir: "./lib",
        types: [],
        newLine: "lf"
      },
      include: ["src/**/*.ts"],
      references
    };
    await writeFile(path.join(packageDir, "tsconfig.json"), `${JSON.stringify(packageConfig, null, 2)}\n`, "utf8");

    const exports = [];
    for (let fileIndex = 0; fileIndex < projectFilesPerPackage; fileIndex += 1) {
      const fileSuffix = String(fileIndex).padStart(3, "0");
      const typeName = `Package${packageSuffix}Model${fileSuffix}`;
      const valueName = `package${packageSuffix}Value${fileSuffix}`;
      const source = `export interface ${typeName} {\n  readonly packageId: \"pkg-${packageSuffix}\";\n  readonly fileId: ${fileIndex};\n  payload: { value: number; enabled: boolean };\n}\n\nexport const ${valueName}: ${typeName} = {\n  packageId: \"pkg-${packageSuffix}\",\n  fileId: ${fileIndex},\n  payload: { value: ${packageIndex * 1000 + fileIndex}, enabled: ${fileIndex % 2 === 0} }\n};\n`;
      await writeFile(path.join(sourceDir, `module-${fileSuffix}.ts`), source, "utf8");
      exports.push(`export { ${valueName} } from \"./module-${fileSuffix}.js\";`);
    }

    const dependencyImports = isAggregator
      ? leafIndices.map((leafIndex) => {
        const leafSuffix = String(leafIndex).padStart(2, "0");
        return `import type { PackageSummary as PackageSummary${leafSuffix} } from \"../../pkg-${leafSuffix}/src/index.js\";`;
      }).join("\n") + "\n"
      : "";
    const dependencyTypeNames = leafIndices.map((leafIndex) => `PackageSummary${String(leafIndex).padStart(2, "0")}`);
    const dependencyField = isAggregator
      ? `  dependencies?: readonly [${dependencyTypeNames.join(", ")}];\n`
      : "";
    const indexSource = `${dependencyImports}${exports.join("\n")}\n\nexport interface PackageSummary {\n  packageId: \"pkg-${packageSuffix}\";\n${dependencyField}  moduleCount: ${projectFilesPerPackage};\n}\n\nexport const packageSummary: PackageSummary = { packageId: \"pkg-${packageSuffix}\", moduleCount: ${projectFilesPerPackage} };\n`;
    await writeFile(path.join(sourceDir, "index.ts"), indexSource, "utf8");
    rootReferences.push({ path: `./pkg-${packageSuffix}` });
  }

  await writeFile(
    path.join(baseDir, "tsconfig.json"),
    `${JSON.stringify({ files: [], references: rootReferences }, null, 2)}\n`,
    "utf8"
  );
  return {
    packageCount: projectPackageCount,
    leafPackageCount: leafIndices.length,
    aggregatorPackageCount: 1,
    topology: "parallel-leaves-with-aggregator",
    filesPerPackage: projectFilesPerPackage,
    sourceFileCount: projectPackageCount * (projectFilesPerPackage + 1)
  };
}

const metadata = {
  generatedAt: new Date().toISOString(),
  manyFiles: await generateManyFiles(),
  typeHeavy: await generateTypeHeavy(),
  projectReferences: await generateProjectReferences()
};

const metadataPath = path.join(root, "test-cases", ".generated-metadata.json");
await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
console.log(`Generated benchmark workloads: ${JSON.stringify(metadata)}`);
