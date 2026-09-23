param(
    [string]$KeycloakUrl = "http://localhost:8080",
    [string]$Username = "contractor-a",
    [string]$Password = "test123",
    [string]$ClientId = "test-cli"
)

$tokenEndpoint = "$KeycloakUrl/realms/kaja/protocol/openid-connect/token"

function Get-TokenResponse {
    param(
        [hashtable]$Body
    )

    try {
        $response = Invoke-RestMethod -Uri $tokenEndpoint `
            -Method Post `
            -Body $Body `
            -ContentType "application/x-www-form-urlencoded" `
            -ErrorAction Stop

        return @{
            StatusCode = 200
            Response = $response
        }
    } catch {
        $statusCode = 0
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }

        return @{
            StatusCode = $statusCode
            Response = $null
        }
    }
}

Write-Host "=== Refresh Token Rotation Evidence ===" -ForegroundColor Cyan

$login = Get-TokenResponse -Body @{
    grant_type = "password"
    client_id = $ClientId
    username = $Username
    password = $Password
    scope = "openid equipment:read rentals:read"
}

if ($login.StatusCode -ne 200 -or -not $login.Response.refresh_token) {
    Write-Host "FAIL: initial token request returned HTTP $($login.StatusCode)" -ForegroundColor Red
    exit 1
}

$refreshToken1 = $login.Response.refresh_token

$rotation = Get-TokenResponse -Body @{
    grant_type = "refresh_token"
    client_id = $ClientId
    refresh_token = $refreshToken1
}

if ($rotation.StatusCode -ne 200 -or -not $rotation.Response.refresh_token) {
    Write-Host "FAIL: RT1 rotation returned HTTP $($rotation.StatusCode)" -ForegroundColor Red
    exit 1
}

$refreshToken2 = $rotation.Response.refresh_token
$tokensAreDifferent = $refreshToken1 -cne $refreshToken2
if ($tokensAreDifferent) {
    Write-Host "PASS: RT2 differs from RT1" -ForegroundColor Green
} else {
    Write-Host "FAIL: RT2 is identical to RT1" -ForegroundColor Red
    exit 1
}

$reuseOldToken = Get-TokenResponse -Body @{
    grant_type = "refresh_token"
    client_id = $ClientId
    refresh_token = $refreshToken1
}

if ($reuseOldToken.StatusCode -ge 400) {
    Write-Host "PASS: reuse of RT1 rejected (HTTP $($reuseOldToken.StatusCode))" -ForegroundColor Green
} else {
    Write-Host "FAIL: reuse of RT1 was accepted" -ForegroundColor Red
    exit 1
}

$reuseRotatedToken = Get-TokenResponse -Body @{
    grant_type = "refresh_token"
    client_id = $ClientId
    refresh_token = $refreshToken2
}

if ($reuseRotatedToken.StatusCode -ge 400) {
    Write-Host "PASS: RT2 rejected after RT1 reuse (HTTP $($reuseRotatedToken.StatusCode))" -ForegroundColor Green
} else {
    Write-Host "FAIL: RT2 remained usable after RT1 reuse" -ForegroundColor Red
    exit 1
}

Write-Host "Evidence complete: no token values were printed." -ForegroundColor Cyan