import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Desmonta a árvore React entre testes (evita fugas de DOM entre casos).
afterEach(() => cleanup());

// jsdom não implementa scrollIntoView — usado pelo useAnchoredMenu (Combobox/DatePicker).
Element.prototype.scrollIntoView = vi.fn();

// jsdom não implementa URL.createObjectURL/revokeObjectURL — usados pela
// pré-visualização local (blob:) do upload diferido (FileUpload `deferred`,
// MediaGallery do Ginásio).
let blobUrlCounter = 0;
URL.createObjectURL = vi.fn(() => `blob:mock-${blobUrlCounter++}`);
URL.revokeObjectURL = vi.fn();
