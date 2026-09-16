//! Replays tests/vectors/vectors.json against the tracked dcbor-parse release.
//!
//!   cargo run --release -- ../vectors/vectors.json
//!   VERBOSE=1 cargo run --release -- ../vectors/vectors.json   # print every classified row
//!
//! Every vector is the dCBOR hex, `hex@length` for a prefix parse, or
//! `throw:<Variant>[(<TokenKind>)]@start-end`. Rust spans are byte offsets;
//! the harness converts them to UTF-16 code units so they compare with the
//! port's. Classes (see RUST_DIVERGENCES.md):
//!   match    identical outcome
//!   S1       both reject with the same variant at a different span
//!   S2       both reject; the reference's lexer fails the whole literal
//!            (UnrecognizedToken) where the port names the literal error
//!   S3       a prefix parse consumed a different length before an
//!            unterminated `/…` comment (the port stops at the `/`)
//!   S4       both reject a non-ASCII digit; different variant
//!   D2       `Unit` inside a container: the reference rejects it
//!   N1       the port's nesting limit (`NestingTooDeep`); the reference has none
//!   U1       the reference panics; the port rejects
//!   js-only  a `domain` recipe the reference's types cannot express
//!   pending  a divergence a later wave closes (P-B2 base64 trailing bits,
//!            P-B5 keyword before `(`); expected to reach zero
//!   MISMATCH anything else; exit 1
use dcbor_parse::{
    compose_dcbor_array, compose_dcbor_map, parse_dcbor_item, parse_dcbor_item_partial,
    ParseError as Error,
};
use serde::Deserialize;
use std::collections::BTreeMap;
use std::panic::{catch_unwind, AssertUnwindSafe};

#[derive(Deserialize)]
struct File {
    count: usize,
    vectors: Vec<Vector>,
}
#[derive(Deserialize)]
struct Vector {
    name: String,
    recipe: serde_json::Value,
    expect: String,
}

/// Byte offset → UTF-16 code-unit offset.
fn cu(src: &str, byte: usize) -> usize {
    let b = byte.min(src.len());
    let mut i = b;
    while i > 0 && !src.is_char_boundary(i) {
        i -= 1;
    }
    src[..i].encode_utf16().count() + (b - i)
}
fn span(src: &str, s: &std::ops::Range<usize>) -> String {
    format!("@{}-{}", cu(src, s.start), cu(src, s.end))
}
fn token_name(t: &dcbor_parse::Token) -> String {
    let d = format!("{t:?}");
    d.split(|c| c == '(' || c == ' ').next().unwrap_or(&d).to_string()
}
fn describe(src: &str, e: &Error) -> String {
    match e {
        Error::EmptyInput => "EmptyInput".into(),
        Error::UnexpectedEndOfInput => "UnexpectedEndOfInput".into(),
        Error::ExtraData(s) => format!("ExtraData{}", span(src, s)),
        Error::UnexpectedToken(t, s) => format!("UnexpectedToken({}){}", token_name(t), span(src, s)),
        Error::UnrecognizedToken(s) => format!("UnrecognizedToken{}", span(src, s)),
        Error::ExpectedComma(s) => format!("ExpectedComma{}", span(src, s)),
        Error::ExpectedColon(s) => format!("ExpectedColon{}", span(src, s)),
        Error::UnmatchedParentheses(s) => format!("UnmatchedParentheses{}", span(src, s)),
        Error::UnmatchedBraces(s) => format!("UnmatchedBraces{}", span(src, s)),
        Error::ExpectedMapKey(s) => format!("ExpectedMapKey{}", span(src, s)),
        Error::InvalidTagValue(_, s) => format!("InvalidTagValue{}", span(src, s)),
        Error::UnknownTagName(_, s) => format!("UnknownTagName{}", span(src, s)),
        Error::InvalidHexString(s) => format!("InvalidHexString{}", span(src, s)),
        Error::InvalidBase64String(s) => format!("InvalidBase64String{}", span(src, s)),
        Error::UnknownUrType(_, s) => format!("UnknownUrType{}", span(src, s)),
        Error::InvalidUr(_, s) => format!("InvalidUr{}", span(src, s)),
        Error::InvalidKnownValue(_, s) => format!("InvalidKnownValue{}", span(src, s)),
        Error::UnknownKnownValueName(_, s) => format!("UnknownKnownValueName{}", span(src, s)),
        Error::InvalidDateString(_, s) => format!("InvalidDateString{}", span(src, s)),
        Error::DuplicateMapKey(s) => format!("DuplicateMapKey{}", span(src, s)),
    }
}
fn describe_compose(items: &[&str], e: &dcbor_parse::ComposeError) -> String {
    use dcbor_parse::ComposeError as C;
    match e {
        C::OddMapLength => "Compose:OddMapLength".into(),
        C::DuplicateMapKey => "Compose:DuplicateMapKey".into(),
        C::ParseError(inner) => {
            // the failing item is the first one that does not parse on its own
            let src = items
                .iter()
                .find(|s| parse_dcbor_item(s).is_err())
                .copied()
                .unwrap_or("");
            format!("Compose:ParseError:{}", describe(src, inner))
        }
    }
}

enum Outcome {
    Value(String),
    Panic,
    JsOnly,
}

fn run(r: &serde_json::Value) -> Outcome {
    let k = r["k"].as_str().unwrap();
    if k == "domain" {
        return Outcome::JsOnly;
    }
    let out = catch_unwind(AssertUnwindSafe(|| match k {
        "parse" => {
            let src = r["src"].as_str().unwrap();
            match parse_dcbor_item(src) {
                Ok(c) => hex::encode(c.to_cbor_data()),
                Err(e) => format!("throw:{}", describe(src, &e)),
            }
        }
        "partial" => {
            let src = r["src"].as_str().unwrap();
            match parse_dcbor_item_partial(src) {
                Ok((c, n)) => format!("{}@{}", hex::encode(c.to_cbor_data()), cu(src, n)),
                Err(e) => format!("throw:{}", describe(src, &e)),
            }
        }
        _ => {
            let items: Vec<&str> = r["items"]
                .as_array()
                .unwrap()
                .iter()
                .map(|s| s.as_str().unwrap())
                .collect();
            let res = if k == "composeArray" {
                compose_dcbor_array(&items)
            } else {
                compose_dcbor_map(&items)
            };
            match res {
                Ok(c) => hex::encode(c.to_cbor_data()),
                Err(e) => format!("throw:{}", describe_compose(&items, &e)),
            }
        }
    }));
    match out {
        Ok(s) => Outcome::Value(s),
        Err(_) => Outcome::Panic,
    }
}

fn variant(s: &str) -> String {
    s.trim_start_matches("throw:")
        .split('@')
        .next()
        .unwrap_or("")
        .to_string()
}

fn has_non_ascii_digit(src: &str) -> bool {
    src.chars().any(|c| c.is_numeric() && !c.is_ascii_digit())
}

/// The class of an expected divergence, or `None` for a mismatch.
fn classify(recipe: &serde_json::Value, got: &str, want: &str) -> Option<&'static str> {
    let src = recipe["src"].as_str().unwrap_or("");
    let both_reject = got.starts_with("throw:") && want.starts_with("throw:");
    let (gv, wv) = (variant(got), variant(want));
    if wv == "NestingTooDeep" {
        return Some("N1");
    }
    if both_reject && gv == wv {
        return Some("S1");
    }
    if both_reject
        && gv == "UnrecognizedToken"
        && matches!(wv.as_str(), "InvalidHexString" | "InvalidBase64String")
    {
        return Some("S2");
    }
    if recipe["k"] == "partial"
        && !got.starts_with("throw:")
        && !want.starts_with("throw:")
        && got.split('@').next() == want.split('@').next()
        && src.contains('/')
    {
        return Some("S3");
    }
    if both_reject && has_non_ascii_digit(src) {
        return Some("S4");
    }
    if gv == "UnexpectedToken(Unit)" {
        return Some("D2");
    }
    if gv == "InvalidBase64String" && !want.starts_with("throw:") && src.starts_with("b64'") {
        return Some("pending P-B2");
    }
    // A keyword directly followed by `(`: the reference lexes a tag name, the port the keyword.
    if ["true(", "false(", "null(", "NaN(", "Infinity(", "Unit("]
        .iter()
        .any(|k| src.starts_with(k))
    {
        return Some("pending P-B5");
    }
    None
}

fn main() {
    std::panic::set_hook(Box::new(|_| {}));
    bc_tags::register_tags();
    let path = std::env::args().nth(1).expect("vectors.json");
    let file: File = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(file.count, file.vectors.len());
    let verbose = std::env::var("VERBOSE").is_ok();
    let mut counts: BTreeMap<&'static str, usize> = BTreeMap::new();
    let mut mismatches = 0usize;
    for v in &file.vectors {
        let class: &'static str = match run(&v.recipe) {
            Outcome::JsOnly => "js-only",
            Outcome::Panic => {
                if v.expect.starts_with("throw:") {
                    "U1"
                } else {
                    mismatches += 1;
                    eprintln!("MISMATCH {} (reference panicked)\n  ts: {}", v.name, v.expect);
                    continue;
                }
            }
            Outcome::Value(got) if got == v.expect => "match",
            Outcome::Value(got) => match classify(&v.recipe, &got, &v.expect) {
                Some(class) => {
                    if verbose {
                        eprintln!("{class} {}\n  rust: {got}\n  ts:   {}", v.name, v.expect);
                    }
                    class
                }
                None => {
                    mismatches += 1;
                    eprintln!("MISMATCH {}\n  rust: {got}\n  ts:   {}", v.name, v.expect);
                    continue;
                }
            },
        };
        *counts.entry(class).or_insert(0) += 1;
    }
    let summary: Vec<String> = counts.iter().map(|(k, n)| format!("{n} {k}")).collect();
    println!(
        "{} vectors - {}, {} MISMATCH",
        file.vectors.len(),
        summary.join(", "),
        mismatches
    );
    if mismatches > 0 {
        std::process::exit(1);
    }
}
