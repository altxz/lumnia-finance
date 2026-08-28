interface ImportFingerprintInput {
  fileName: string;
  rowIndex: number;
  date: string;
  description: string;
  value: number;
  type: string;
  originType: string;
  destinationId: string;
  invoiceMonth?: string;
}
function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

export function buildImportFingerprint(input: ImportFingerprintInput): string {
  const payload = [
    normalize(input.fileName),
    input.rowIndex,
    input.date,
    normalize(input.description),
    Math.round(input.value * 100),
    input.type,
    input.originType,
    input.destinationId,
    input.invoiceMonth || '',
  ].join('|');

  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= BigInt(payload.charCodeAt(index));
    hash = (hash * prime) & mask;
  }

  return `import:${hash.toString(16).padStart(16, '0')}`;
}
