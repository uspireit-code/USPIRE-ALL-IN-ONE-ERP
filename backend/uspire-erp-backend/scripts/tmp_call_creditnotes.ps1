$ErrorActionPreference = 'Stop'

$tenantId = '638340fe-e775-4d2e-85fe-b6b1c344c847'
$baseUrl = 'http://127.0.0.1:3000'

$loginBody = @{ email = 'officer@uspire.local'; password = 'Officer123' } | ConvertTo-Json

$login = Invoke-RestMethod -Method Post -Uri "$baseUrl/auth/login" -Headers @{ 'Content-Type' = 'application/json'; 'x-tenant-id' = $tenantId } -Body $loginBody

$token = $login.accessToken
if (-not $token) { throw 'No accessToken in login response' }

$resp = Invoke-RestMethod -Method Get -Uri "$baseUrl/finance/ar/credit-notes" -Headers @{ 'Authorization' = "Bearer $token"; 'x-tenant-id' = $tenantId }

$resp | ConvertTo-Json -Depth 10
