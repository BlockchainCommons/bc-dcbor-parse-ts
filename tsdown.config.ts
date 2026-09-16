import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", lexer: "src/lexer.ts" },
  format: ["cjs", "esm"],
  dts: true,
  inputOptions: {
    // The rolldown-plugin-dts "fake-js" pass transforms .d.ts content without
    // emitting a sourcemap, producing a spurious SOURCEMAP_BROKEN warning even
    // though the real JS sourcemaps are correct. Filter only that case.
    onwarn(warning, defaultHandler) {
      if (warning.code === "SOURCEMAP_BROKEN") return;
      defaultHandler(warning);
    },
  },
  clean: true,
  treeshake: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  outDir: "dist",
  target: "es2022",
});
