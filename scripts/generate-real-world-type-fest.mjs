import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(root, "test-cases", "real-world-type-fest");
const sourceDir = path.join(outputRoot, "src");
const expectedVersion = "5.7.0";

function readInteger(name, fallback, minimum, maximum) {
  const raw = process.env[name] ?? String(fallback);
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}; received ${raw}`);
  }
  return value;
}

const fileCount = readInteger("REAL_WORLD_FILES", 24, 1, 256);
const packageJsonPath = path.join(root, "node_modules", "type-fest", "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

if (packageJson.version !== expectedVersion) {
  throw new Error(`Expected type-fest ${expectedVersion}, found ${packageJson.version ?? "unknown"}`);
}

await rm(sourceDir, { recursive: true, force: true });
await mkdir(sourceDir, { recursive: true });

const importedTypes = [
  "CamelCasedPropertiesDeep",
  "ConditionalPickDeep",
  "Get",
  "Jsonify",
  "KebabCasedPropertiesDeep",
  "MergeDeep",
  "PartialDeep",
  "Paths",
  "ReadonlyDeep",
  "RequireExactlyOne",
  "RequiredDeep",
  "SimplifyDeep",
  "UnionToIntersection",
  "WritableDeep"
];

for (let index = 0; index < fileCount; index += 1) {
  const suffix = String(index).padStart(3, "0");
  const fields = Array.from({ length: 8 }, (_, fieldIndex) =>
    `    field_${suffix}_${fieldIndex}: { value: string; rank: ${fieldIndex}; enabled: boolean };`
  ).join("\n");

  const source = `import type {
  CamelCasedPropertiesDeep,
  ConditionalPickDeep,
  Get,
  Jsonify,
  KebabCasedPropertiesDeep,
  MergeDeep,
  PartialDeep,
  Paths,
  ReadonlyDeep,
  RequireExactlyOne,
  RequiredDeep,
  SimplifyDeep,
  UnionToIntersection,
  WritableDeep
} from "type-fest";

type Entity${suffix} = {
  id: "entity-${suffix}";
  profile: {
    display_name: string;
    contact: {
      email: string;
      phone?: string;
    };
    preferences: {
      email_notifications: boolean;
      theme_mode: "light" | "dark";
      locale_code: "en" | "tr" | "ru";
    };
  };
  audit: {
    created_at: Date;
    updated_at?: Date;
  };
  fields: {
${fields}
  };
  variants:
    | { kind: "text"; text_value: string }
    | { kind: "numeric"; numeric_value: number }
    | { kind: "flag"; flag_value: boolean };
};

type Patch${suffix} = PartialDeep<Entity${suffix}>;
type RequiredModel${suffix} = RequiredDeep<Patch${suffix}>;
type ReadModel${suffix} = ReadonlyDeep<Entity${suffix}>;
type MutableModel${suffix} = WritableDeep<ReadModel${suffix}>;
type ApiModel${suffix} = CamelCasedPropertiesDeep<Entity${suffix}>;
type RouteModel${suffix} = KebabCasedPropertiesDeep<Entity${suffix}>;
type MergedModel${suffix} = MergeDeep<Entity${suffix}, {
  profile: { preferences: { timezone_name: string } };
  audit: { revision: number };
}>;
type EntityPaths${suffix} = Paths<Entity${suffix}>;
type EmailValue${suffix} = Get<Entity${suffix}, "profile.contact.email">;
type StringFields${suffix} = ConditionalPickDeep<Entity${suffix}, string>;
type JsonModel${suffix} = Jsonify<Entity${suffix}>;
type DeliveryChoice${suffix} = RequireExactlyOne<{
  email: string;
  sms: string;
  push: string;
}>;
type VariantIntersection${suffix} = UnionToIntersection<Entity${suffix}["variants"]>;

export type BenchmarkCase${suffix} = SimplifyDeep<{
  patch: Patch${suffix};
  required: RequiredModel${suffix};
  readonly: ReadModel${suffix};
  mutable: MutableModel${suffix};
  api: ApiModel${suffix};
  route: RouteModel${suffix};
  merged: MergedModel${suffix};
  paths: EntityPaths${suffix};
  email: EmailValue${suffix};
  strings: StringFields${suffix};
  json: JsonModel${suffix};
  delivery: DeliveryChoice${suffix};
  variants: VariantIntersection${suffix};
}>;
`;

  await writeFile(path.join(sourceDir, `case-${suffix}.ts`), source, "utf8");
}

const indexSource = Array.from({ length: fileCount }, (_, index) => {
  const suffix = String(index).padStart(3, "0");
  return `export type * from "./case-${suffix}.js";`;
}).join("\n");
await writeFile(path.join(sourceDir, "index.ts"), `${indexSource}\n`, "utf8");

const metadata = {
  kind: "pinned real-world dependency consumer",
  packageName: packageJson.name,
  packageVersion: packageJson.version,
  upstreamRepository: "https://github.com/sindresorhus/type-fest",
  upstreamRelease: "v5.7.0",
  license: packageJson.license,
  generatedConsumerFiles: fileCount,
  sourceFilesIncludingIndex: fileCount + 1,
  importedTypes
};
await writeFile(path.join(outputRoot, ".metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

console.log(`Generated ${fileCount} type-fest consumer files using type-fest ${packageJson.version}.`);
