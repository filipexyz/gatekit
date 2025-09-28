#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';

async function validateContracts(): Promise<void> {
  const contractsPath = path.join(
    __dirname,
    '../../generated/contracts/contracts.json',
  );
  const exists = await fileExists(contractsPath);
  if (!exists) {
    throw new Error(
      `Contracts file not found at ${contractsPath}. Run extract:contracts first.`,
    );
  }

  const raw = await fs.readFile(contractsPath, 'utf-8');
  const contracts = JSON.parse(raw);
  if (!Array.isArray(contracts) || contracts.length === 0) {
    throw new Error('Contracts file is empty or malformed.');
  }

  const typeDefinitions = contracts[0]?.typeDefinitions || {};
  const definedTypes = new Set(Object.keys(typeDefinitions));
  const missing = new Set<string>();

  for (const contract of contracts) {
    const { inputType, outputType } = contract.contractMetadata || {};
    [inputType, outputType]
      .filter((type): type is string => Boolean(type) && type !== 'any')
      .forEach((typeName) => {
        const canonical = typeName.replace(/\[\]$/, '');
        if (!definedTypes.has(canonical)) {
          missing.add(canonical);
        }
      });
  }

  if (missing.size > 0) {
    throw new Error(
      `Contracts missing type definitions for: ${Array.from(missing).join(', ')}`,
    );
  }

  console.log('✅ Contract type definitions look good.');
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

if (require.main === module) {
  validateContracts().catch((error) => {
    console.error('❌ Contract validation failed:', error.message || error);
    process.exit(1);
  });
}
