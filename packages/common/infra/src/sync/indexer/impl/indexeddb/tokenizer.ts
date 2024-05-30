export interface Tokenizer {
  tokenize(text: string): Token[];
}

export interface Token {
  term: string;
  start: number;
  end: number;
}

export class SimpleTokenizer implements Tokenizer {
  tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let start = 0;
    let end = 0;
    let inWord = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c.match(/[\n\r\p{Z}\p{P}]/u)) {
        if (inWord) {
          end = i;
          tokens.push({
            term: text.substring(start, end).toLowerCase(),
            start,
            end,
          });
          inWord = false;
        }
      } else {
        if (!inWord) {
          start = i;
          end = i;
          inWord = true;
        }
      }
    }
    if (inWord) {
      tokens.push({
        term: text.substring(start).toLowerCase(),
        start,
        end: text.length,
      });
    }
    return tokens;
  }
}
