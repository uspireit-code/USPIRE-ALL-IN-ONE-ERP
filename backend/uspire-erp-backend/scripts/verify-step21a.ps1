$ErrorActionPreference = 'Stop'

$tenantId = 'af7464e3-166a-4681-a851-99d895db6c98'
$base = 'http://localhost:3000'

function Login([string]$email, [string]$password) {
  $body = @{ email = $email; password = $password } | ConvertTo-Json
  $resp = Invoke-RestMethod -Method Post -Uri ($base + '/auth/login') -Headers @{ 'x-tenant-id' = $tenantId } -ContentType 'application/json' -Body $body
  return $resp.accessToken
}

$adminToken = Login 'admin@uspire.local' 'Admin123!'

# 1) Create a new accounting period (so we have a clean checklist to complete)
$periodName = 'AUDIT-VERIFY-' + (Get-Date -Format 'yyyyMMdd-HHmmss')

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

# 2) Complete one checklist item (should emit PERIOD_CHECKLIST_COMPLETE SUCCESS)
$checklist = Invoke-RestMethod -Method Get -Uri ($base + '/gl/periods/' + $period.id + '/checklist') -Headers @{ 'x-tenant-id' = $tenantId; Authorization = ('Bearer ' + $adminToken) }
$item = $checklist.items | Where-Object { $_.completed -eq $false } | Select-Object -First 1
$completedItem = Invoke-RestMethod -Method Post -Uri ($base + '/gl/periods/' + $period.id + '/checklist/items/' + $item.id + '/complete') -Headers @{ 'x-tenant-id' = $tenantId; Authorization = ('Bearer ' + $adminToken) }

# 3) Trigger a blocked journal post (maker cannot post own journal) -> JOURNAL_POST BLOCKED
$accounts = Invoke-RestMethod -Method Get -Uri ($base + '/gl/accounts?balanceSheetOnly=true') -Headers @{ 'x-tenant-id' = $tenantId; Authorization = ('Bearer ' + $adminToken) }
$acc1 = $accounts | Select-Object -First 1
$acc2 = $accounts | Select-Object -Skip 1 -First 1

$journalBody = @{ 
  journalDate = $start.ToString('yyyy-MM-dd');
  reference = ('AUDIT-VERIFY-JE-' + (Get-Date -Format 'HHmmss'));
  description = 'Audit verify journal entry';
  lines = @(
    @{ accountId = $acc1.id; debit = 10; credit = 0 },
    @{ accountId = $acc2.id; debit = 0; credit = 10 }
  )
} | ConvertTo-Json -Depth 6

$je = Invoke-RestMethod -Method Post -Uri ($base + '/gl/journals') -Headers @{ 'x-tenant-id' = $tenantId; Authorization = ('Bearer ' + $adminToken) } -ContentType 'application/json' -Body $journalBody

$journalPostBlocked = $null
try {
  Invoke-RestMethod -Method Post -Uri ($base + '/gl/journals/' + $je.id + '/post') -Headers @{ 'x-tenant-id' = $tenantId; Authorization = ('Bearer ' + $adminToken) } | Out-Null
  $journalPostBlocked = @{ blocked = $false }
} catch {
  $status = $null
  try { $status = $_.Exception.Response.StatusCode.value__ } catch {}
  $journalPostBlocked = @{ blocked = $true; status = $status; message = $_.ErrorDetails.Message }
}

# 4) Query audit events (should return rows)
$fromIso = $start.ToString('yyyy-MM-dd')
$auditResp = Invoke-RestMethod -Method Get -Uri ($base + '/audit/events?from=' + $fromIso + '&limit=50') -Headers @{ 'x-tenant-id' = $tenantId; Authorization = ('Bearer ' + $adminToken) }

$result = [ordered]@{
  period = $period
  checklistItemCompleted = $completedItem
  journalPostBlocked = $journalPostBlocked
  audit = [ordered]@{
    total = $auditResp.total
    returned = ($auditResp.rows | Measure-Object).Count
    sample = ($auditResp.rows | Select-Object -First 5)
  }
}

$result | ConvertTo-Json -Depth 10
