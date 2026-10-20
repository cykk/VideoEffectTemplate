const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function parseArgs(argv) {
  const options = {
    input: "",
    output: "",
    preset: "content",
    overwrite: false,
    validate: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--input") {
      options.input = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--output") {
      options.output = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--preset") {
      options.preset = argv[index + 1] ?? options.preset;
      index += 1;
      continue;
    }

    if (arg === "--overwrite") {
      options.overwrite = true;
      continue;
    }

    if (arg === "--validate") {
      options.validate = true;
    }
  }

  return options;
}

function ensureDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getPresetOptions(preset) {
  if (preset === "content") {
    return {
      jpeg: {
        quality: 76,
        mozjpeg: true,
        progressive: true,
        chromaSubsampling: "4:4:4",
      },
      png: {
        compressionLevel: 9,
        quality: 80,
        palette: true,
      },
      webp: {
        quality: 78,
      },
      avif: {
        quality: 50,
      },
    };
  }

  throw new Error(`Unsupported preset: ${preset}`);
}

async function optimizeFile(sourceFile, targetFile, presetOptions) {
  const extension = path.extname(sourceFile).toLowerCase();
  const pipeline = sharp(sourceFile, { sequentialRead: true }).rotate();

  if (extension === ".jpg" || extension === ".jpeg") {
    await pipeline.jpeg(presetOptions.jpeg).toFile(targetFile);
    return;
  }

  if (extension === ".png") {
    await pipeline.png(presetOptions.png).toFile(targetFile);
    return;
  }

  if (extension === ".webp") {
    await pipeline.webp(presetOptions.webp).toFile(targetFile);
    return;
  }

  if (extension === ".avif") {
    await pipeline.avif(presetOptions.avif).toFile(targetFile);
    return;
  }

  fs.copyFileSync(sourceFile, targetFile);
}

async function validatePair(sourceFile, targetFile) {
  const [sourceMeta, targetMeta] = await Promise.all([
    sharp(sourceFile).metadata(),
    sharp(targetFile).metadata(),
  ]);

  const sourceSize = fs.statSync(sourceFile).size;
  const targetSize = fs.statSync(targetFile).size;

  if (sourceMeta.width !== targetMeta.width || sourceMeta.height !== targetMeta.height) {
    throw new Error(
      `Validation failed for ${path.basename(sourceFile)}: dimensions changed from ${sourceMeta.width}x${sourceMeta.height} to ${targetMeta.width}x${targetMeta.height}`
    );
  }

  return {
    sourceSize,
    targetSize,
    delta: sourceSize - targetSize,
    ratio: sourceSize > 0 ? Number((((sourceSize - targetSize) / sourceSize) * 100).toFixed(2)) : 0,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.input || !options.output) {
    throw new Error("Missing required --input or --output");
  }

  const inputDir = path.resolve(options.input);
  const outputDir = path.resolve(options.output);

  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input directory not found: ${inputDir}`);
  }

  if (options.overwrite && fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  ensureDirectory(outputDir);

  const presetOptions = getPresetOptions(options.preset);
  const files = fs
    .readdirSync(inputDir)
    .filter((name) => fs.statSync(path.join(inputDir, name)).isFile());

  const results = [];

  for (const file of files) {
    const sourceFile = path.join(inputDir, file);
    const targetFile = path.join(outputDir, file);
    await optimizeFile(sourceFile, targetFile, presetOptions);

    let validation = null;
    if (options.validate) {
      validation = await validatePair(sourceFile, targetFile);
    }

    results.push({
      file,
      sourceFile,
      targetFile,
      validation,
    });
  }

  console.log(JSON.stringify({ inputDir, outputDir, preset: options.preset, files: results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
