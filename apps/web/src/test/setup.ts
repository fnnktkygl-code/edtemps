import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined" && typeof window.alert !== "function") {
  window.alert = () => {};
}

