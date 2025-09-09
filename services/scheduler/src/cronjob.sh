#!/bin/sh

# Add cron job to run every hour
echo "0 * * * * curl -X POST http://api:3000/generate -H 'Content-Type: application/json' -d '{\"url\":\"https://example.com/llms\"}'" >> /etc/crontabs/root

# Start cron daemon
crond -f -l 8 