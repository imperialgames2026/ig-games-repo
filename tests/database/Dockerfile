FROM postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24 AS build
ADD --checksum=sha256:d950bc29155f31017567e23a31d268ff672e98276c0e9d062512fb7870351f03 https://codeload.github.com/citusdata/pg_cron/tar.gz/refs/tags/v1.6.7 /tmp/pg_cron.tar.gz
RUN apk add --no-cache build-base \
 && mkdir /tmp/pg_cron \
 && tar xzf /tmp/pg_cron.tar.gz --strip-components=1 -C /tmp/pg_cron \
 && make -C /tmp/pg_cron with_llvm=no \
 && make -C /tmp/pg_cron with_llvm=no install
FROM postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
COPY --from=build /usr/local/lib/postgresql/pg_cron.so /usr/local/lib/postgresql/
COPY --from=build /usr/local/share/postgresql/extension/pg_cron* /usr/local/share/postgresql/extension/
