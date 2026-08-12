import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

type CoverageCase = { id: string; acIds: string[]; dimensionIds?: string[]; scenario?: string };
type CoverageDocument = {
  version: number;
  acs: Array<{ id: string; description: string; caseIds: string[] }>;
  dimensions: Array<{ id: string; description: string; required?: boolean; caseIds: string[] }>;
  decisions?: Array<{ id: string; question: string; branches: Array<{ id: string; label: string; caseIds: string[] }> }>;
  cases: CoverageCase[];
};

function fail(message: string): never {
  throw new Error(`coverage validation: ${message}`);
}

function asObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${path} must be a non-empty string`);
  return value;
}

function asStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    fail(`${path} must be an array of non-empty strings`);
  }
  return value as string[];
}

function unique(ids: string[], path: string): void {
  if (new Set(ids).size !== ids.length) fail(`${path} contains duplicate IDs`);
}

function loadCoverage(path: string): CoverageDocument {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const root = asObject(raw, "root");
  if (root.version !== 1) fail("version must be 1");

  const acs = Array.isArray(root.acs) ? root.acs.map((item, i) => {
    const value = asObject(item, `acs[${i}]`);
    return { id: asString(value.id, `acs[${i}].id`), description: asString(value.description, `acs[${i}].description`), caseIds: asStringArray(value.caseIds, `acs[${i}].caseIds`) };
  }) : fail("acs must be an array");

  const dimensions = Array.isArray(root.dimensions) ? root.dimensions.map((item, i) => {
    const value = asObject(item, `dimensions[${i}]`);
    return { id: asString(value.id, `dimensions[${i}].id`), description: asString(value.description, `dimensions[${i}].description`), required: value.required !== false, caseIds: asStringArray(value.caseIds, `dimensions[${i}].caseIds`) };
  }) : fail("dimensions must be an array");

  const cases = Array.isArray(root.cases) ? root.cases.map((item, i) => {
    const value = asObject(item, `cases[${i}]`);
    return { id: asString(value.id, `cases[${i}].id`), acIds: asStringArray(value.acIds, `cases[${i}].acIds`), dimensionIds: value.dimensionIds === undefined ? [] : asStringArray(value.dimensionIds, `cases[${i}].dimensionIds`), scenario: value.scenario === undefined ? undefined : asString(value.scenario, `cases[${i}].scenario`) };
  }) : fail("cases must be an array");

  const decisions = root.decisions === undefined ? [] : Array.isArray(root.decisions) ? root.decisions.map((item, i) => {
    const value = asObject(item, `decisions[${i}]`);
    const branches = Array.isArray(value.branches) ? value.branches.map((branch, j) => {
      const b = asObject(branch, `decisions[${i}].branches[${j}]`);
      return { id: asString(b.id, `decisions[${i}].branches[${j}].id`), label: asString(b.label, `decisions[${i}].branches[${j}].label`), caseIds: asStringArray(b.caseIds, `decisions[${i}].branches[${j}].caseIds`) };
    }) : fail(`decisions[${i}].branches must be an array`);
    return { id: asString(value.id, `decisions[${i}].id`), question: asString(value.question, `decisions[${i}].question`), branches };
  }) : fail("decisions must be an array");

  return { version: 1, acs, dimensions, decisions, cases };
}

function validateCoverage(document: CoverageDocument): void {
  unique(document.acs.map((item) => item.id), "AC IDs");
  unique(document.dimensions.map((item) => item.id), "dimension IDs");
  unique(document.cases.map((item) => item.id), "case IDs");
  unique(document.decisions?.map((item) => item.id) ?? [], "decision IDs");

  const acIds = new Set(document.acs.map((item) => item.id));
  const dimensionIds = new Set(document.dimensions.map((item) => item.id));
  const caseIds = new Set(document.cases.map((item) => item.id));

  for (const ac of document.acs) {
    if (ac.caseIds.length === 0) fail(`AC ${ac.id} has no covering case`);
    for (const caseId of ac.caseIds) if (!caseIds.has(caseId)) fail(`AC ${ac.id} references unknown case ${caseId}`);
  }

  for (const dimension of document.dimensions) {
    if (dimension.required !== false && dimension.caseIds.length === 0) fail(`required dimension ${dimension.id} has no covering case`);
    for (const caseId of dimension.caseIds) if (!caseIds.has(caseId)) fail(`dimension ${dimension.id} references unknown case ${caseId}`);
  }

  for (const testCase of document.cases) {
    if (testCase.acIds.length === 0) fail(`case ${testCase.id} maps to no AC`);
    for (const acId of testCase.acIds) if (!acIds.has(acId)) fail(`case ${testCase.id} references unknown AC ${acId}`);
    for (const dimensionId of testCase.dimensionIds ?? []) if (!dimensionIds.has(dimensionId)) fail(`case ${testCase.id} references unknown dimension ${dimensionId}`);
  }

  for (const decision of document.decisions ?? []) {
    if (decision.branches.length < 2) fail(`decision ${decision.id} must have at least two branches`);
    unique(decision.branches.map((branch) => branch.id), `decision ${decision.id} branch IDs`);
    for (const branch of decision.branches) {
      if (branch.caseIds.length === 0) fail(`decision ${decision.id} branch ${branch.id} has no covering case`);
      for (const caseId of branch.caseIds) if (!caseIds.has(caseId)) fail(`decision ${decision.id} branch ${branch.id} references unknown case ${caseId}`);
    }
  }
}

function validateCompiledCases(coverage: CoverageDocument, casesPath: string): void {
  if (!existsSync(casesPath)) fail(`compiled cases file not found: ${casesPath}`);
  const raw = parse(readFileSync(casesPath, "utf8")) as unknown;
  const root = asObject(raw, "cases.yaml");
  const steps = Array.isArray(root.steps) ? root.steps : fail("cases.yaml.steps must be an array");
  const compiled = new Set<string>();
  for (const [index, step] of steps.entries()) {
    const value = asObject(step, `cases.yaml.steps[${index}]`);
    if (typeof value.case === "string" && value.case.trim()) compiled.add(value.case);
  }
  for (const testCase of coverage.cases) if (!compiled.has(testCase.id)) fail(`coverage case ${testCase.id} is not present in compiled cases.yaml`);
}

const [coveragePath, casesPath] = process.argv.slice(2);
if (!coveragePath) {
  console.error("Usage: pnpm e2e:coverage:validate <coverage.json> [cases.yaml]");
  process.exit(1);
}

try {
  const coverage = loadCoverage(resolve(coveragePath));
  validateCoverage(coverage);
  if (casesPath) validateCompiledCases(coverage, resolve(casesPath));
  console.log(`✓ Coverage valid: ${coverage.acs.length} ACs, ${coverage.cases.length} cases, ${coverage.dimensions.length} dimensions, ${coverage.decisions?.length ?? 0} decisions`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
