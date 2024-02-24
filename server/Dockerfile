FROM rust:bookworm as builder

# Build server
WORKDIR /build
RUN --mount=source=Cargo.lock,target=Cargo.lock \
    --mount=source=Cargo.toml,target=Cargo.toml \
    --mount=source=src,target=src \
    --mount=source=public,target=/build/public \
    --mount=source=templates,target=/build/templates \
    --mount=type=cache,target=/build/target/ \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    <<EOF
set -e
cargo build --locked --release
cp ./target/release/spellingbeeplus /build
EOF

FROM debian:bookworm-slim as runner
LABEL org.opencontainers.image.source=https://github.com/jason0x43/spellingbeeplus
LABEL org.opencontainers.image.description="A sync server for SpellingBeePlus"
LABEL org.opencontainers.image.licenses="MIT"
COPY --from=builder /build/spellingbeeplus /bin/

STOPSIGNAL SIGQUIT
ENTRYPOINT ["/bin/spellingbeeplus"]
