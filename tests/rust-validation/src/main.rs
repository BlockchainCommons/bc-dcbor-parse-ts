//! Replays tests/vectors/vectors.json against bc-dcbor-parse 0.11.1.
//!
//!   cargo run --release -- ../vectors/vectors.json
use dcbor_parse::{compose_dcbor_array, compose_dcbor_map, parse_dcbor_item, parse_dcbor_item_partial, ParseError as Error};
use serde::Deserialize;

#[derive(Deserialize)]
struct File { count: usize, vectors: Vec<Vector> }
#[derive(Deserialize)]
struct Vector { name: String, recipe: serde_json::Value, expect: String }

/// Byte offset → UTF-16 code-unit offset (TypeScript spans are in code units).
fn cu(src: &str, byte: usize) -> usize {
    let b = byte.min(src.len());
    let mut i = b;
    while i > 0 && !src.is_char_boundary(i) { i -= 1; }
    src[..i].encode_utf16().count() + (b - i)
}
fn span(src: &str, s: &std::ops::Range<usize>) -> String { format!("@{}-{}", cu(src, s.start), cu(src, s.end)) }
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
            let src = items.iter().find(|s| parse_dcbor_item(s).is_err()).copied().unwrap_or("");
            format!("Compose:ParseError:{}", describe(src, inner))
        }
    }
}
fn run(r: &serde_json::Value) -> String {
    let k = r["k"].as_str().unwrap();
    match k {
        "parse" => {
            let src = r["src"].as_str().unwrap();
            match parse_dcbor_item(src) { Ok(c) => hex::encode(c.to_cbor_data()), Err(e) => format!("throw:{}", describe(src, &e)) }
        }
        "partial" => {
            let src = r["src"].as_str().unwrap();
            match parse_dcbor_item_partial(src) {
                Ok((c, n)) => format!("{}@{}", hex::encode(c.to_cbor_data()), cu(src, n)),
                Err(e) => format!("throw:{}", describe(src, &e)),
            }
        }
        _ => {
            let items: Vec<&str> = r["items"].as_array().unwrap().iter().map(|s| s.as_str().unwrap()).collect();
            let res = if k == "composeArray" { compose_dcbor_array(&items) } else { compose_dcbor_map(&items) };
            match res { Ok(c) => hex::encode(c.to_cbor_data()), Err(e) => format!("throw:{}", describe_compose(&items, &e)) }
        }
    }
}
fn main() {
    bc_tags::register_tags();
    let path = std::env::args().nth(1).expect("vectors.json");
    let file: File = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(file.count, file.vectors.len());
    let (mut mismatches, mut expected) = (0, 0);
    for v in &file.vectors {
        let got = run(&v.recipe);
        if got == v.expect { continue; }
        if let Some(class) = expected_divergence(&v.recipe, &got, &v.expect) {
            expected += 1;
            if std::env::var("VERBOSE").is_ok() { eprintln!("expected [{class}] {}\n  rust: {got}\n  ts:   {}", v.name, v.expect); }
            continue;
        }
        mismatches += 1;
        eprintln!("MISMATCH {}\n  rust: {got}\n  ts:   {}", v.name, v.expect);
    }
    println!("{} vectors - {} match, {} expected-divergence, {} MISMATCH", file.vectors.len(), file.vectors.len() - mismatches - expected, expected, mismatches);
    if mismatches > 0 { std::process::exit(1); }
}
/// Expected divergences (see RUST_DIVERGENCES.md):
/// S1  both reject with the same variant at a different span (Logos error
///     spans cover the maximal unmatched run, or the previous token).
/// S2  both reject; the reference's lexer fails the whole literal
///     (UnrecognizedToken) where TypeScript names the literal error.
/// D2  `Unit` inside an array or map: the reference rejects it
///     (UnexpectedToken(Unit)); TypeScript accepts it as it does at top level.
fn expected_divergence(recipe: &serde_json::Value, got: &str, want: &str) -> Option<&'static str> {
    let variant = |s: &str| s.trim_start_matches("throw:").split('@').next().unwrap_or("").to_string();
    let both_reject = got.starts_with("throw:") && want.starts_with("throw:");
    if both_reject && variant(got) == variant(want) { return Some("S1"); }
    if both_reject && variant(got) == "UnrecognizedToken" && matches!(variant(want).as_str(), "InvalidHexString" | "InvalidBase64String" | "ExtraData" | "InvalidUr" | "UnrecognizedToken") {
        return Some("S2");
    }
    if variant(got) == "UnexpectedToken(Unit)" { return Some("D2"); }
    None
}
