# Seeds a QA user, board, lists and cards through the real REST API.
# Writes .uiqa/seed.json for the browser harness.
#
# Usage: powershell -ExecutionPolicy Bypass -File tools\seed.ps1 [-Base http://host:port/api]
param(
  # API base URL. Overridable so the harness can point at a non-default backend.
  [string]$Base = 'http://localhost:8080/api'
)
$ErrorActionPreference = 'Stop'
$base = $Base.TrimEnd('/')
$outDir = Join-Path $PSScriptRoot '..\.uiqa'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$email = 'qa.raman@example.com'
$password = 'Passw0rd!23'
$displayName = 'Raman QA'

$signupBody = @{ email = $email; displayName = $displayName; password = $password } | ConvertTo-Json
# Sign-up answers 201 even when the address is already registered (it no longer
# reveals which addresses exist), so a successful call is not proof the account
# was created. Fall back to sign-in whenever the response has no user.
$auth = Invoke-RestMethod -Method Post -Uri "$base/auth/signup" -ContentType 'application/json' -Body $signupBody
if ($auth.user) {
  Write-Output 'auth: signed up new QA user'
} else {
  $loginBody = @{ email = $email; password = $password } | ConvertTo-Json
  $auth = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body $loginBody
  Write-Output 'auth: address already registered, logged in existing QA user'
}

$headers = @{ Authorization = "Bearer $($auth.token)" }

$board = Invoke-RestMethod -Method Post -Uri "$base/boards" -Headers $headers -ContentType 'application/json' `
  -Body (@{ name = 'Sprint 42 - Payments' } | ConvertTo-Json)
Write-Output "board: $($board.id) '$($board.name)'"

$detail = Invoke-RestMethod -Uri "$base/boards/$($board.id)" -Headers $headers
$lists = @($detail.lists | Sort-Object position)
Write-Output ("lists auto-created: " + (($lists | ForEach-Object { $_.name }) -join ', '))

$review = Invoke-RestMethod -Method Post -Uri "$base/boards/$($board.id)/lists" -Headers $headers -ContentType 'application/json' `
  -Body (@{ name = 'In Review' } | ConvertTo-Json)
Write-Output "list added: $($review.name)"

$seedCards = @(
  @{ list = 0; title = 'Design the WebSocket fan-out'; priority = 'HIGH';    description = 'Fan out card events per board topic, and make sure the client resubscribes after a reconnect.' },
  @{ list = 0; title = 'Audit JWT refresh flow';         priority = 'MEDIUM';  description = 'Confirm 401 handling wipes the session and bounces to the login screen with the expired notice.' },
  @{ list = 1; title = 'Fix optimistic lock on drag';    priority = 'URGENT';  description = 'Concurrent drags return 409; revert the local move and surface a toast explaining what happened.' },
  @{ list = 1; title = 'Virtualize long card lists';     priority = 'LOW';     description = '' },
  @{ list = 2; title = 'Add per-board activity pagination'; priority = 'MEDIUM'; description = 'Feed currently caps at 30 events.' }
)

foreach ($c in $seedCards) {
  $targetList = $lists[$c.list]
  if (-not $targetList) { continue }
  $payload = @{ title = $c.title; priority = $c.priority; description = $c.description } | ConvertTo-Json
  $card = Invoke-RestMethod -Method Post -Uri "$base/boards/$($board.id)/lists/$($targetList.id)/cards" -Headers $headers `
    -ContentType 'application/json' -Body $payload
  Write-Output "card: [$($targetList.name)] $($card.title) ($($card.priority))"
}

$seed = [ordered]@{
  token   = $auth.token
  user    = $auth.user
  boardId = $board.id
  email   = $email
  password = $password
}
$seed | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $outDir 'seed.json') -Encoding utf8
Write-Output 'seed.json written'
