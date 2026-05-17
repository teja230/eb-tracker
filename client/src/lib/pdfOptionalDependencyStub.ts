export default function unavailablePdfHtmlRenderer(): never {
  throw new Error(
    "HTML-to-PDF rendering is disabled; EB Tracker exports use jsPDF primitives."
  );
}
