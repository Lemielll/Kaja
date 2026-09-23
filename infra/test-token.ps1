# Test Token Generation Script
# File: infra/test-token.ps1

param(
    [string]$KeycloakUrl = "http://localhost:8080",
    [string]$Username = "contractor-a",
    [string]$Password = "test123"
)

Write-Host "=== Testing Token Generation ===" -ForegroundColor Cyan
Write-Host "User: $Username`n"

# Get token
try {
    $response = Invoke-RestMethod -Uri "$KeycloakUrl/realms/kaja/protocol/openid-connect/token" `
        -Method Post `
        -Body @{
            grant_type = "password"
            client_id = "web-app"
            username = $Username
            password = $Password
            scope = "equipment:read rentals:read rentals:write inspections:write"
        } `
        -ContentType "application/x-www-form-urlencoded"
    
    $TOKEN = $response.access_token
    Write-Host "Token obtained successfully`n" -ForegroundColor Green
    
    # Decode JWT payload
    $parts = $TOKEN -split '\.'
    $payload = $parts[1]
    
    # Pad base64 string if needed
    while ($payload.Length % 4) { $payload += '=' }
    $payload = $payload.Replace('-', '+').Replace('_', '/')
    
    # Decode base64
    $bytes = [Convert]::FromBase64String($payload)
    $json = [System.Text.Encoding]::UTF8.GetString($bytes)
    $decoded = $json | ConvertFrom-Json
    
    # Display decoded token
    Write-Host "Token Payload:" -ForegroundColor White
    Write-Host "  iss: $($decoded.iss)" -ForegroundColor Gray
    Write-Host "  aud: $($decoded.aud)" -ForegroundColor Gray
    Write-Host "  sub: $($decoded.sub)" -ForegroundColor Gray
    Write-Host "  scope: $($decoded.scope)" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "Full Access Token:" -ForegroundColor White
    Write-Host $TOKEN -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host "Token generation failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
