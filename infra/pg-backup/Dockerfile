# Nightly logical Postgres backup to S3. postgresql18-client pins the dump
# tools to the server's major (paradedb pg18) so pg_dumpall never runs against
# a newer server. supercronic instead of busybox crond: it passes the
# container environment to jobs and logs them to stdout.
FROM alpine:3.23

RUN apk add --no-cache postgresql18-client aws-cli supercronic

COPY backup.sh /usr/local/bin/backup.sh
COPY crontab /etc/pg-backup-crontab

ENTRYPOINT ["supercronic", "-passthrough-logs", "/etc/pg-backup-crontab"]
