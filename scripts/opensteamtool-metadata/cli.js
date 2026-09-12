#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const patterns = require('./pattern-definitions');
const ipcDefinitions = require('./ipc-definitions');

const DEFAULT_OUTDIR = path.resolve(process.cwd(), 'tmp', 'opensteamtool-metadata');

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { _: command ? [command] : [] };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function ensureFile(filePath, label) {
  if (!filePath) {
    throw new Error(`Missing required --${label} argument.`);
  }
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${label} not found: ${resolved}`);
  }
  return resolved;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sha256Of(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function parseSignature(signature) {
  return signature.split(/\s+/).map((token) => {
    if (token === '??') return null;
    return parseInt(token, 16);
  });
}

function findPatternOffsets(buffer, signature) {
  const bytes = parseSignature(signature);
  const limit = buffer.length - bytes.length;
  const offsets = [];
  for (let offset = 0; offset <= limit; offset += 1) {
    let matches = true;
    for (let i = 0; i < bytes.length; i += 1) {
      if (bytes[i] === null) continue;
      if (buffer[offset + i] !== bytes[i]) {
        matches = false;
        break;
      }
    }
    if (matches) offsets.push(offset);
  }
  return offsets;
}

function fileOffsetToRva(buffer, fileOffset) {
  if (buffer.length < 0x40 || buffer.readUInt16LE(0) !== 0x5A4D) {
    throw new Error('Expected a valid PE file.');
  }

  const peOffset = buffer.readUInt32LE(0x3C);
  const fileHeaderOffset = peOffset + 4;
  if (peOffset + 24 > buffer.length || buffer.readUInt32LE(peOffset) !== 0x4550) {
    throw new Error('Expected a valid PE header.');
  }

  const sectionCount = buffer.readUInt16LE(fileHeaderOffset + 2);
  const optionalHeaderSize = buffer.readUInt16LE(fileHeaderOffset + 16);
  const sectionTableOffset = fileHeaderOffset + 20 + optionalHeaderSize;
  for (let index = 0; index < sectionCount; index += 1) {
    const sectionOffset = sectionTableOffset + (index * 40);
    if (sectionOffset + 40 > buffer.length) break;
    const virtualAddress = buffer.readUInt32LE(sectionOffset + 12);
    const rawSize = buffer.readUInt32LE(sectionOffset + 16);
    const rawOffset = buffer.readUInt32LE(sectionOffset + 20);
    if (fileOffset >= rawOffset && fileOffset < rawOffset + rawSize) {
      return virtualAddress + (fileOffset - rawOffset);
    }
  }

  throw new Error(`Pattern offset 0x${fileOffset.toString(16)} is outside PE sections.`);
}

function formatHex(value) {
  return `0x${value.toString(16).toUpperCase()}`;
}

function renderPatternToml(entries) {
  return entries.map((entry) => (
    `[${entry.id}]
name = "${entry.name}"
rva = "${entry.rva}"
sig = "${entry.sig}"`
  )).join('\n\n') + '\n';
}

function generatePatternToml(component, dllPath, outDir) {
  const sha256 = sha256Of(dllPath);
  const buffer = fs.readFileSync(dllPath);
  const definitions = patterns[component];
  const entries = definitions.map((definition) => {
    let offsets = findPatternOffsets(buffer, definition.sig);
    if (offsets.length !== 1 && definition.preferredRva) {
      offsets = offsets.filter((offset) => fileOffsetToRva(buffer, offset) === definition.preferredRva);
    }
    if (offsets.length !== 1) {
      throw new Error(`${component}:${definition.name} expected one signature match, found ${offsets.length}.`);
    }
    return {
      ...definition,
      rva: formatHex(fileOffsetToRva(buffer, offsets[0]))
    };
  });

  const targetDir = path.join(outDir, 'pattern', component);
  ensureDir(targetDir);
  const outputPath = path.join(targetDir, `${sha256}.toml`);
  fs.writeFileSync(outputPath, renderPatternToml(entries), 'utf8');
  return { component, sha256, outputPath };
}

function loadIpcInput(inputPath) {
  if (!inputPath) {
    throw new Error('Missing required --input for ipc generation.');
  }
  const resolved = ensureFile(inputPath, 'input');
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function getIpcMethodArgc(interfaceName, methodName) {
  const iface = ipcDefinitions.interfaces.find((item) => item.name === interfaceName);
  if (!iface) return 0;
  const method = iface.methods.find((item) => item.name === methodName);
  return method ? method.argc : 0;
}

function getInterfaceId(interfaceName) {
  const iface = ipcDefinitions.interfaces.find((item) => item.name === interfaceName);
  if (!iface) {
    throw new Error(`Unknown IPC interface: ${interfaceName}`);
  }
  return iface.interface_id;
}

function renderIpcToml(input) {
  const blocks = [];
  for (const iface of input.interfaces || []) {
    blocks.push(
      `[${iface.name}]`,
      `interface_id = ${getInterfaceId(iface.name)}`,
      `vtable_rva = "${iface.vtable_rva || '0x0'}"`,
      ''
    );

    for (const method of iface.methods || []) {
      blocks.push(
        `[${iface.name}.${method.name}]`,
        `method_index = ${Number.isInteger(method.method_index) ? method.method_index : 0}`,
        `funcHash = "${method.funcHash || '0x00000000'}"`,
        `wrapper_rva = "${method.wrapper_rva || '0x0'}"`,
        `fencepost = "${method.fencepost || '0x00000000'}"`,
        `argc = ${getIpcMethodArgc(iface.name, method.name)}`,
        ''
      );
    }
  }
  return `${blocks.join('\n').trim()}\n`;
}

function generateIpcToml(dllPath, inputPath, outDir) {
  const sha256 = sha256Of(dllPath);
  const input = loadIpcInput(inputPath);
  const targetDir = path.join(outDir, 'ipc', 'steamclient');
  ensureDir(targetDir);
  const outputPath = path.join(targetDir, `${sha256}.toml`);
  fs.writeFileSync(outputPath, renderIpcToml(input), 'utf8');
  return { sha256, outputPath };
}

function printHashes(steamclientPath, steamuiPath) {
  const result = {};
  if (steamclientPath) result.steamclient = sha256Of(steamclientPath);
  if (steamuiPath) result.steamui = sha256Of(steamuiPath);
  console.log(JSON.stringify(result, null, 2));
}

function printUsage() {
  console.log(`Usage:
  npm run metadata:opensteamtool -- hash --steamclient <path> [--steamui <path>]
  npm run metadata:opensteamtool -- pattern --steamclient <path> --steamui <path> [--outdir <path>]
  npm run metadata:opensteamtool -- ipc --steamclient <path> --input <json> [--outdir <path>]`);
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const command = args._[0];
    const outDir = path.resolve(args.outdir || DEFAULT_OUTDIR);

    if (!command) {
      printUsage();
      process.exitCode = 1;
      return;
    }

    if (command === 'hash') {
      const steamclient = args.steamclient ? ensureFile(args.steamclient, 'steamclient') : null;
      const steamui = args.steamui ? ensureFile(args.steamui, 'steamui') : null;
      printHashes(steamclient, steamui);
      return;
    }

    if (command === 'pattern') {
      const steamclient = ensureFile(args.steamclient, 'steamclient');
      const steamui = ensureFile(args.steamui, 'steamui');
      const steamclientResult = generatePatternToml('steamclient', steamclient, outDir);
      const steamuiResult = generatePatternToml('steamui', steamui, outDir);
      console.log(JSON.stringify({ steamclient: steamclientResult, steamui: steamuiResult }, null, 2));
      return;
    }

    if (command === 'ipc') {
      const steamclient = ensureFile(args.steamclient, 'steamclient');
      const result = generateIpcToml(steamclient, args.input, outDir);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    printUsage();
    process.exitCode = 1;
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}

main();
