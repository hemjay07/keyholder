// File: programs/keyholder/src/lib.rs
// [VERIFIED] — Module tree and program entrypoint

pub mod parsers;

pub use parsers::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parsers_compile() {
        // Just verify parsers module is available
    }
}
