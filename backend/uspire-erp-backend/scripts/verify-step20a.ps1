$ErrorActionPreference = 'Stop'

$tenantId = 'af7464e3-166a-4681-a851-99d895db6c98'
$base = 'http://localhost:3000'

function Login([string]$email, [string]$password) {
  $body = @{ email = $email; password = $password } | ConvertTo-Json
  $resp = Invoke-RestMethod -Method Post -Uri ($base + '/auth/login') -Headers @{ 'x-tenant-id' = $tenantId } -ContentType 'application/json' -Body $body
  return $resp.accessToken
}

$adminToken = Login 'admin@uspire.local' 'Admin123!'
$viewerToken = Login 'viewer@uspire.local' 'Viewer123!'

$periodName = 'VERIFY-' + (Get-Date -Format 'yyyyMMdd-HHmmss')

$periods = Invoke-RestMethod -Method Get -Uri ($base + '/gl/periods') -Headers @{ 'x-tenant-id' = $tenantId; Authorization = ('Bearer ' + $adminToken) }
$maxEnd = $null
foreach ($p in $periods) {
  $ed = [DateTime]::Parse($p.endDate)
  if ($null -eq $maxEnd -or $ed -gt $maxEnd) { $maxEnd = $ed }
}

if ($null -eq $maxEnd) {
  $start = (Get-Date).Date
} else {
  $start = $maxEnd.Date.AddDays(1)
}

$end = $start.AddDays(27)

$periodBody = @{ name = $periodName; startDate = $start.ToString('yyyy-MM-dd'); endDate = $end.ToString('yyyy-MM-dd') } | ConvertTo-Json

$period = Invoke-RestMethod -Method Post -Uri ($base + '/gl/periods') -Headers @{ 'x-tenant-id' = $tenantId; Authorization = ('Bearer ' + $adminToken) } -ContentType 'application/json' -Body $periodBody

$initial = Invoke-RestMethod -Method Get -Uri ($base + '/period-close/checklist/' + $period.id) -Headers @{ 'x-tenant-id' = $tenantId; Authorization = ('Bearer ' + $adminToken) }

$firstItem = $initial.checklist.items | Select-Object -First 1
$secondItem = $initial.checklist.items | Select-Object -Skip 1 -First 1

$completeOk = Invoke-RestMethod -Method Post -Uri ($base + '/period-close/checklist/' + $period.id + '/items/' + $firstItem.id + '/complete') -Headers @{ 'x-tenant-id' = $tenantId; Authorization = ('Bearer ' + $adminToken) }

$viewerBlocked = $null
try {
  Invoke-RestMethod -Method Post -Uri ($base + '/period-close/checklist/' + $period.id + '/items/' + $secondItem.id + '/complete') -Headers @{ 'x-tenant-id' = $tenantId; Authorization = ('Bearer ' + $viewerToken) } | Out-Null
  $viewerBlocked = @{ blocked = $false }
} catch {
  $status = $null
  try { $status = $_.Exception.Response.StatusCode.value__ } catch {}
  $viewerBlocked = @{ blocked = $true; status = $status; message = $_.ErrorDetails.Message }
}

$recompleteBlocked = $null
try {
  Invoke-RestMethod -Method Post -Uri ($base + '/period-close/checklist/' + $period.id + '/items/' + $firstItem.id + '/complete') -Headers @{ 'x-tenant-id' = $tenantId; Authorization = ('Bearer ' + $adminToken) } | Out-Null
  $recompleteBlocked = @{ blocked = $false }
} catch {
  $status = $null
  try { $status = $_.Exception.Response.StatusCode.value__ } catch {}
  $recompleteBlocked = @{ blocked = $true; status = $status; message = $_.ErrorDetails.Message }
}

$after = Invoke-RestMethod -Method Get -Uri ($base + '/period-close/checklist/' + $period.id) -Headers @{ 'x-tenant-id' = $tenantId; Authorization = ('Bearer ' + $adminToken) }
$auditItem = $after.checklist.items | Where-Object { $_.id -eq $firstItem.id } | Select-Object -First 1

$result = [ordered]@{
  period = $after.period
  initialItemsPendingCount = ($initial.checklist.items | Where-Object { $_.status -eq 'PENDING' }).Count
  completedItem = $completeOk
  viewerBlocked = $viewerBlocked
  recompleteBlocked = $recompleteBlocked
  auditCheck = [ordered]@{
    completedByEmail = $auditItem.completedBy.email
    completedAt = $auditItem.completedAt
  }
}

$result | ConvertTo-Json -Depth 10
