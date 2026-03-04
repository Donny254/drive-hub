/// <reference types="vite/client" />

declare class BarcodeDetector {
  static getSupportedFormats?: () => Promise<string[]>;
  constructor(options?: { formats?: string[] });
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}
