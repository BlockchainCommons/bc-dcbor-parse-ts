/**
 * Parse a document with every literal kind, print it back as diagnostic
 * notation, then show how a rejection and a prefix parse are reported.
 *
 *   bun examples/parse.ts
 */
import { getGlobalTagsStore } from "@blockchaincommons/dcbor";
import { diagnostic } from "@blockchaincommons/dcbor/diagnostic";
import { registerTags } from "@blockchaincommons/tags";
import { parseDcborItem, parseDcborItemPartial, DcborParseError } from "../src";

// Tag names (`date(…)`, `envelope(…)`, `ur:…`) resolve through the tags store.
registerTags(getGlobalTagsStore());

const source = `{
  "name": "Alice",
  "born": 1990-05-15,
  "scores": [98, 87.5, -1, NaN],
  "key": h'deadbeef',
  "photo": b64'SGVsbG8=',
  "role": 'isA',
  "when": date(2023-12-25T10:30:45Z),
  "flags": [true, false, null],
  "unit": Unit
}`;

const value = parseDcborItem(source);
console.log(diagnostic(value, { annotate: true }));
console.log(`${value.toData().length} bytes`);

const bad = '{"a": 1, "a": 2}';
try {
  parseDcborItem(bad);
} catch (e) {
  if (DcborParseError.isDcborParseError(e)) {
    console.log(`${e.code}:`);
    console.log(e.fullMessage(bad));
  }
}

const { value: first, length } = parseDcborItemPartial("42 ] the rest");
console.log(`${diagnostic(first)} took ${length} characters`);
