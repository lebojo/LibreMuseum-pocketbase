# Pinned version: PocketBase is pre-1.0, an upgrade can break the schema.
# Bump it here deliberately, after testing the migrations.
ARG PB_VERSION=0.39.10

FROM alpine:3.21

ARG PB_VERSION
ARG TARGETARCH

RUN apk add --no-cache ca-certificates unzip wget

# The PocketBase archive name uses amd64/arm64, which already matches the
# TARGETARCH provided by buildx.
RUN wget -q -O /tmp/pb.zip \
      "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
    && unzip -q /tmp/pb.zip -d /usr/local/bin/ \
    && rm /tmp/pb.zip \
    && chmod +x /usr/local/bin/pocketbase

WORKDIR /pb

# Schema and application logic. pb_data/ is NOT copied: it is a volume.
COPY pb_migrations/ /pb/pb_migrations/
COPY pb_hooks/ /pb/pb_hooks/

# Demo content (~800 KB), so that `pocketbase seed` also works inside a
# container. The command refuses to run if content already exists, so it is
# harmless on a production instance.
COPY seed/ /pb/seed/

EXPOSE 8090

# Explicit paths: PocketBase resolves them by default relative to the BINARY
# (/usr/local/bin/), and would therefore start with no schema and no hooks.
# Migrations in pb_migrations/ are applied automatically at startup.
CMD ["pocketbase", "serve", \
     "--http=0.0.0.0:8090", \
     "--dir=/pb/pb_data", \
     "--hooksDir=/pb/pb_hooks", \
     "--migrationsDir=/pb/pb_migrations"]
