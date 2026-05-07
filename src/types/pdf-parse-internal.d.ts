// pdf-parse ships its types only for the package root, but we import the
// internal entry point to bypass its module-load debug code. This redirects
// the subpath to the package's existing types.
declare module "pdf-parse/lib/pdf-parse.js" {
  import pdfParse from "pdf-parse";
  export default pdfParse;
}
