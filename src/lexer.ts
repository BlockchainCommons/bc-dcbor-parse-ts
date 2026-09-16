/**
 * The tokenizer, for languages that embed dCBOR diagnostic notation in their
 * own syntax: `@blockchaincommons/dcbor-parse/lexer`.
 *
 * A `Lexer` is iterable and yields `Token`s with their spans; text no token
 * matches throws `DcborParseError` from the root entry.
 *
 * @beta
 * @module lexer
 */
export { Lexer, type Token } from "./token";
export type { TokenKind } from "./error";
