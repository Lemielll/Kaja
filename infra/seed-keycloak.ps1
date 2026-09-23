# Keycloak Auto-Seeding Script
# File: infra/seed-keycloak.ps1

param(
    [string]$KeycloakUrl = "http://localhost:8080",
    [string]$AdminPassword = $env:KC_ADMIN_PASSWORD
)

$ErrorActionPreference = "Stop"

Write-Host "=== Keycloak Auto-Seeding Script ===" -ForegroundColor Cyan
Write-Host "Keycloak URL: $KeycloakUrl`n"

# Load .env file if exists
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value)
        }
    }
    if (-not $AdminPassword) {
        $AdminPassword = $env:KC_ADMIN_PASSWORD
    }
}

if (-not $AdminPassword) {
    Write-Host "ERROR: KC_ADMIN_PASSWORD not set" -ForegroundColor Red
    exit 1
}

# Wait for Keycloak
Write-Host "1. Waiting for Keycloak..." -ForegroundColor Green
$ready = $false
for ($i = 1; $i -le 20; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "$KeycloakUrl/" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {
        Write-Host "  Attempt $i/20: Not ready yet..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}

if (-not $ready) {
    Write-Host "ERROR: Keycloak not ready" -ForegroundColor Red
    exit 1
}
Write-Host "  OK`n" -ForegroundColor Green

# Get admin token
Write-Host "2. Getting admin token..." -ForegroundColor Green
$tokenResponse = Invoke-RestMethod -Uri "$KeycloakUrl/realms/master/protocol/openid-connect/token" `
    -Method Post `
    -Body @{
        client_id = "admin-cli"
        username = "admin"
        password = $AdminPassword
        grant_type = "password"
    } `
    -ContentType "application/x-www-form-urlencoded"

$token = $tokenResponse.access_token
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}
Write-Host "  OK`n" -ForegroundColor Green

# Create realm
Write-Host "3. Creating realm 'kaja'..." -ForegroundColor Green
try {
    $realmBody = @{
        realm = "kaja"
        enabled = $true
        displayName = "Kaja - Heavy Equipment Rental"
        accessTokenLifespan = 900
        refreshTokenMaxReuse = 0
        revokeRefreshToken = $true
    } | ConvertTo-Json

    Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms" `
        -Method Post -Headers $headers -Body $realmBody
    Write-Host "  OK`n" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "  Already exists`n" -ForegroundColor Yellow
    } else {
        throw
    }
}

# Create scopes
Write-Host "4. Creating scopes..." -ForegroundColor Green
$scopes = @("equipment:read", "rentals:read", "rentals:write", "inspections:write")
foreach ($scopeName in $scopes) {
    try {
        $scopeBody = @{
            name = $scopeName
            protocol = "openid-connect"
            attributes = @{
                "include.in.token.scope" = "true"
            }
        } | ConvertTo-Json

        Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms/kaja/client-scopes" `
            -Method Post -Headers $headers -Body $scopeBody
        Write-Host "  Created: $scopeName" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 409) {
            Write-Host "  Exists: $scopeName" -ForegroundColor Yellow
        }
    }
}
Write-Host ""

# Get scope IDs
$clientScopes = Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms/kaja/client-scopes" `
    -Method Get -Headers $headers
$scopeIds = @{}
foreach ($scopeName in $scopes) {
    $found = $clientScopes | Where-Object { $_.name -eq $scopeName }
    if ($found) {
        $scopeIds[$scopeName] = $found.id
    }
}

# Create web-app client (production)
Write-Host "5. Creating client 'web-app' (production)..." -ForegroundColor Green
try {
    $clientBody = @{
        clientId = "web-app"
        name = "Web Application (Production)"
        enabled = $true
        publicClient = $true
        standardFlowEnabled = $true
        directAccessGrantsEnabled = $false
        redirectUris = @(
            "http://localhost:3000/callback",
            "http://localhost:3000/silent-renew"
        )
        webOrigins = @("http://localhost:3000")
        attributes = @{
            "pkce.code.challenge.method" = "S256"
        }
    } | ConvertTo-Json -Depth 10

    Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms/kaja/clients" `
        -Method Post -Headers $headers -Body $clientBody
    Write-Host "  OK" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "  Already exists" -ForegroundColor Yellow
    }
}

# Create test-cli client (testing only)
Write-Host "6. Creating client 'test-cli' (automated testing)..." -ForegroundColor Green
try {
    $testClientBody = @{
        clientId = "test-cli"
        name = "Test CLI (Automated Testing Only)"
        enabled = $true
        publicClient = $true
        standardFlowEnabled = $false
        directAccessGrantsEnabled = $true
        description = "Used for automated contract tests. NOT for production."
    } | ConvertTo-Json -Depth 10

    Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms/kaja/clients" `
        -Method Post -Headers $headers -Body $testClientBody
    Write-Host "  OK`n" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "  Already exists`n" -ForegroundColor Yellow
    }
}

# Assign scopes to both clients
$clients = Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms/kaja/clients?clientId=web-app" `
    -Method Get -Headers $headers
$webAppId = $clients[0].id

$testClients = Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms/kaja/clients?clientId=test-cli" `
    -Method Get -Headers $headers
$testCliId = $testClients[0].id

Write-Host "7. Assigning scopes to web-app..." -ForegroundColor Green
foreach ($scopeName in $scopeIds.Keys) {
    $scopeId = $scopeIds[$scopeName]
    try {
        Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms/kaja/clients/$webAppId/optional-client-scopes/$scopeId" `
            -Method Put -Headers $headers
        Write-Host "  Assigned: $scopeName" -ForegroundColor Green
    } catch {
        # Ignore errors
    }
}

Write-Host "8. Assigning scopes to test-cli..." -ForegroundColor Green
foreach ($scopeName in $scopeIds.Keys) {
    $scopeId = $scopeIds[$scopeName]
    try {
        Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms/kaja/clients/$testCliId/optional-client-scopes/$scopeId" `
            -Method Put -Headers $headers
        Write-Host "  Assigned: $scopeName" -ForegroundColor Green
    } catch {
        # Ignore errors
    }
}
Write-Host ""

# Create roles
Write-Host "9. Creating roles..." -ForegroundColor Green
$roles = @("contractor", "warehouse-admin", "field-operator")
foreach ($roleName in $roles) {
    try {
        $roleBody = @{ name = $roleName } | ConvertTo-Json
        Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms/kaja/roles" `
            -Method Post -Headers $headers -Body $roleBody
        Write-Host "  Created: $roleName" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 409) {
            Write-Host "  Exists: $roleName" -ForegroundColor Yellow
        }
    }
}
Write-Host ""

# Create users
Write-Host "10. Creating users..." -ForegroundColor Green
$users = @(
    @{ username = "contractor-a"; email = "contractor-a@test.local"; firstName = "Contractor"; lastName = "Alpha"; role = "contractor" }
    @{ username = "contractor-b"; email = "contractor-b@test.local"; firstName = "Contractor"; lastName = "Beta"; role = "contractor" }
    @{ username = "warehouse-admin-a"; email = "warehouse-admin-a@test.local"; firstName = "Warehouse"; lastName = "Admin A"; role = "warehouse-admin" }
    @{ username = "warehouse-admin-b"; email = "warehouse-admin-b@test.local"; firstName = "Warehouse"; lastName = "Admin B"; role = "warehouse-admin" }
    @{ username = "field-operator-a"; email = "field-operator-a@test.local"; firstName = "Field"; lastName = "Operator A"; role = "field-operator" }
    @{ username = "field-operator-b"; email = "field-operator-b@test.local"; firstName = "Field"; lastName = "Operator B"; role = "field-operator" }
)

foreach ($user in $users) {
    try {
        $userBody = @{
            username = $user.username
            email = $user.email
            firstName = $user.firstName
            lastName = $user.lastName
            enabled = $true
            emailVerified = $true
            credentials = @(
                @{
                    type = "password"
                    value = "test123"
                    temporary = $false
                }
            )
        } | ConvertTo-Json -Depth 10

        Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms/kaja/users" `
            -Method Post -Headers $headers -Body $userBody
        
        Write-Host "  Created: $($user.username)" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 409) {
            Write-Host "  Already exists: $($user.username)" -ForegroundColor Yellow
        } else {
            $errorDetails = $_.ErrorDetails.Message
            Write-Host "  Error creating: $($user.username) - $errorDetails" -ForegroundColor Red
            continue
        }
    }
    
    # Get user ID and assign role
    try {
        Start-Sleep -Milliseconds 300
        $createdUsers = Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms/kaja/users?username=$($user.username)&exact=true" `
            -Method Get -Headers $headers
        
        if ($createdUsers.Count -eq 0) {
            Write-Host "  Warning: User $($user.username) not found after creation" -ForegroundColor Yellow
            continue
        }
        
        $userId = $createdUsers[0].id
        
        $roleObj = Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms/kaja/roles/$($user.role)" `
            -Method Get -Headers $headers
        
        $roleAssignment = @(@{
            id = $roleObj.id
            name = $roleObj.name
        })
        $roleBody = $roleAssignment | ConvertTo-Json -Depth 5 -Compress
        
        Invoke-RestMethod -Uri "$KeycloakUrl/admin/realms/kaja/users/$userId/role-mappings/realm" `
            -Method Post -Headers $headers -Body $roleBody -ContentType "application/json"
        
        Write-Host "  Assigned role $($user.role) to $($user.username)" -ForegroundColor Green
    } catch {
        $errorDetails = $_.ErrorDetails.Message
        Write-Host "  Error assigning role: $($user.username) - $errorDetails" -ForegroundColor Red
    }
}
Write-Host ""

# Test token with test-cli
Write-Host "11. Testing token with test-cli..." -ForegroundColor Green
try {
    $testResponse = Invoke-RestMethod -Uri "$KeycloakUrl/realms/kaja/protocol/openid-connect/token" `
        -Method Post `
        -Body @{
            grant_type = "password"
            client_id = "test-cli"
            username = "contractor-a"
            password = "test123"
            scope = "equipment:read rentals:read"
        } `
        -ContentType "application/x-www-form-urlencoded"
    
    Write-Host "  Token OK`n" -ForegroundColor Green
} catch {
    Write-Host "  Token test failed`n" -ForegroundColor Yellow
}

Write-Host "=== Seeding Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor White
Write-Host "  OIDC_ISSUER=$KeycloakUrl/realms/kaja"
Write-Host "  OIDC_JWKS_URI=$KeycloakUrl/realms/kaja/protocol/openid-connect/certs"
Write-Host "  OIDC_AUDIENCE=web-app"
Write-Host ""
Write-Host "Clients:" -ForegroundColor White
Write-Host "  web-app       - Production client (Authorization Code + PKCE, NO direct grant)"
Write-Host "  test-cli      - Test client (Direct Grant enabled for automated tests)"
Write-Host ""
Write-Host "Test users (password: test123):" -ForegroundColor White
Write-Host "  contractor-a, contractor-b"
Write-Host "  warehouse-admin-a, warehouse-admin-b"
Write-Host "  field-operator-a, field-operator-b"
Write-Host ""
Write-Host "Security notes:" -ForegroundColor Yellow
Write-Host "  ✓ web-app uses exact redirect URIs (no wildcards)"
Write-Host "  ✓ Direct Grant disabled on production client"
Write-Host "  ✓ test-cli only for automated testing"
Write-Host ""
