export interface TranslationProvider {
  readonly name: string;
  translate(texts: string[], target: string, source?: string): Promise<string[]>;
}
