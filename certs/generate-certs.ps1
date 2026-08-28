$certDir = Join-Path $PSScriptRoot ""
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Force -Path $certDir
}

$certFile = Join-Path $certDir "localhost.crt"
$keyFile = Join-Path $certDir "localhost.key"

if (-not (Test-Path $certFile) -or -not (Test-Path $keyFile)) {
    Write-Host "Generating self-signed certificate for localhost..."
    # Generate self-signed certificate using PowerShell New-SelfSignedCertificate
    $cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "cert:\LocalMachine\My" -KeyExportPolicy Exportable
    
    # Export certificate public key
    $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    [System.IO.File]::WriteAllBytes($certFile, $certBytes)
    
    # Export private key (mock for local docker environment or export via CNG/CryptoAPI)
    # For Docker Nginx, we need a standard PEM-encoded private key.
    # If OpenSSL is available on the path, use OpenSSL as a backup!
    try {
        & openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout $keyFile -out $certFile -subj "/CN=localhost" -quiet
        Write-Host "Certificate generated successfully via OpenSSL."
    } catch {
        # Fallback dummy certificates for testing if openssl not found
        Write-Host "OpenSSL not found. Creating placeholder cert files. Please install openssl or generate proper keys."
        $dummyCert = @"
-----BEGIN CERTIFICATE-----
MIIB7zCCAVWgAwIBAgIJAK9aG8F2oXFzMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNV
BAMTCWxvY2FsaG9zdDAeFw0yNjA4MjgwMDAwMDBaFw0yNzA4MjgwMDAwMDBhMBQx
EjAQBgNVBAMTCWxvY2FsaG9zdDCBnzANBgkqhkiG9w0BAQEFAAOBjQAwgYkCgYEA
0O614gS92X4... (Dummy Localhost Cert)
-----END CERTIFICATE-----
"@
        $dummyKey = @"
-----BEGIN PRIVATE KEY-----
MIICdgIBADANBgkqhkiG9w0BAQEFAASCAmAwggJcAgEAAoGBANDuteIEvd1+... (Dummy Localhost Key)
-----END PRIVATE KEY-----
"@
        Set-Content -Path $certFile -Value $dummyCert
        Set-Content -Path $keyFile -Value $dummyKey
    }
} else {
    Write-Host "Certificates already exist."
}
