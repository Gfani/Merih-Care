#!/bin/sh
mkdir -p certs
if [ ! -f certs/localhost.crt ] || [ ! -f certs/localhost.key ]; then
    echo "Generating self-signed certificate for localhost..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout certs/localhost.key -out certs/localhost.crt -subj "/CN=localhost"
else
    echo "Certificates already exist."
fi
