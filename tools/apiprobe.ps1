<#
  API edge-case probe for the FlowBoard backend (read-mostly; creates its own data).
  Usage: powershell -ExecutionPolicy Bypass -File tools/apiprobe.ps1
  Requires: backend on http://localhost:8080, .uiqa/seed.json from tools/seed.ps1
#>
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:8080/api'
$seed = Get-Content (Join-Path $PSScriptRoot '..\.uiqa\seed.json') -Raw | ConvertFrom-Json
$A = @{ Authorization = "Bearer $($seed.token)"; 'Content-Type' = 'application/json' }
$boardId = $seed.boardId

function Probe([string]$label, [string]$method, [string]$url, [hashtable]$headers, [string]$body) {
  try {
    $p = @{ Method = $method; Uri = $url; UseBasicParsing = $true }
    if ($headers) { $p.Headers = $headers }
    if ($null -ne $body) { $p.Body = $body }
    $r = Invoke-WebRequest @p
    $snippet = ($r.Content -replace '\s+', ' ')
    if ($snippet.Length -gt 150) { $snippet = $snippet.Substring(0, 150) + '...' }
    Write-Host ("{0,-50} -> {1}  {2}" -f $label, [int]$r.StatusCode, $snippet)
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    $detail = ''
    try { $detail = (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } catch {}
    $detail = ($detail -replace '\s+', ' ')
    if ($detail.Length -gt 150) { $detail = $detail.Substring(0, 150) + '...' }
    Write-Host ("{0,-50} -> {1}  {2}" -f $label, $code, $detail)
  }
}

Write-Host "`n=== 1. Happy path (sanity) ===" -ForegroundColor Cyan
Probe 'GET /api/boards (valid token)' 'GET' "$base/boards" $A $null
Probe 'GET /api/auth/me (valid token)' 'GET' "$base/auth/me" $A $null


Write-Host "`n=== 4. Body validation on write endpoints ===" -ForegroundColor Cyan
$detail = Invoke-RestMethod -Uri "$base/boards/$boardId" -Headers $A
$list = @($detail.lists)[0]
$card = @($list.cards)[0]
Write-Host "   using list='$($list.name)' card='$($card.title)'"

if ($card) {
  Probe 'PATCH card priority=SUPER (invalid enum)' 'PATCH' "$base/boards/$boardId/cards/$($card.id)" $A '{"priority":"SUPER"}'
  Probe 'PATCH card title=260 chars (> varchar 200)' 'PATCH' "$base/boards/$boardId/cards/$($card.id)" $A (@{ title = ('X' * 260) } | ConvertTo-Json)
  Probe 'PATCH card {} (no constraints, no-op)' 'PATCH' "$base/boards/$boardId/cards/$($card.id)" $A '{}'
  Probe 'PATCH move toListId=random uuid' 'PATCH' "$base/boards/$boardId/cards/$($card.id)/move" $A '{"toListId":"11111111-1111-1111-1111-111111111111","targetIndex":0}'
  Probe 'PATCH move targetIndex=999999 (clamp?)' 'PATCH' "$base/boards/$boardId/cards/$($card.id)/move" $A (@{ toListId = $list.id; targetIndex = 999999 } | ConvertTo-Json)
  Probe 'PATCH move targetIndex=-5 (negative)' 'PATCH' "$base/boards/$boardId/cards/$($card.id)/move" $A (@{ toListId = $list.id; targetIndex = -5 } | ConvertTo-Json)
  Probe 'PATCH move {} (missing toListId)' 'PATCH' "$base/boards/$boardId/cards/$($card.id)/move" $A '{}'
}
Probe 'POST card title="   " (blank)' 'POST' "$base/boards/$boardId/lists/$($list.id)/cards" $A '{"title":"   "}'
Probe 'POST card title=500 chars' 'POST' "$base/boards/$boardId/lists/$($list.id)/cards" $A (@{ title = ('Y' * 500) } | ConvertTo-Json)
Probe 'POST card description=20000 chars' 'POST' "$base/boards/$boardId/lists/$($list.id)/cards" $A (@{ title = 'long desc'; description = ('D' * 20000) } | ConvertTo-Json)
Probe 'POST board name="  a  " (trim after valid.)' 'POST' "$base/boards" $A '{"name":"  a  "}'
Probe 'POST list name="  b  " (trim after valid.)' 'POST' "$base/boards/$boardId/lists" $A '{"name":"  b  "}'
Probe 'GET activity page=-1&size=99999' 'GET' "$base/boards/$boardId/activity?page=-1&size=99999" $A $null
Probe 'GET activity page=999999 (out of range)' 'GET' "$base/boards/$boardId/activity?page=999999" $A $null
Probe 'GET activity size=abc (not a number)' 'GET' "$base/boards/$boardId/activity?size=abc" $A $null

Write-Host "`n=== 5. Cross-board / authorization checks ===" -ForegroundColor Cyan
$attackerEmail = "qa.attacker.$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@example.com"
$attackerPass = 'Passw0rd!23'
try {
  $att = Invoke-RestMethod -Method Post -Uri "$base/auth/signup" -ContentType 'application/json' `
    -Body (@{ email = $attackerEmail; displayName = 'QA Attacker'; password = $attackerPass } | ConvertTo-Json)
  Write-Host '   attacker: signed up'
} catch {
  $att = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' `
    -Body (@{ email = $attackerEmail; password = $attackerPass } | ConvertTo-Json)
  Write-Host '   attacker: logged in'
}
$B = @{ Authorization = "Bearer $($att.token)"; 'Content-Type' = 'application/json' }
$att | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $PSScriptRoot '..\.uiqa\attacker.json') -Encoding utf8

Probe 'GET board as NON-member' 'GET' "$base/boards/$boardId" $B $null
Probe 'GET members as NON-member' 'GET' "$base/boards/$boardId/members" $B $null
Probe 'GET activity as NON-member' 'GET' "$base/boards/$boardId/activity" $B $null
Probe 'POST card as NON-member' 'POST' "$base/boards/$boardId/lists/$($list.id)/cards" $B '{"title":"intruder"}'
Probe 'DELETE list as NON-member' 'DELETE' "$base/boards/$boardId/lists/$($list.id)" $B $null
if ($card) { Probe 'PATCH card as NON-member' 'PATCH' "$base/boards/$boardId/cards/$($card.id)" $B '{"title":"hijacked"}' }
if ($card) { Probe 'DELETE card as NON-member' 'DELETE' "$base/boards/$boardId/cards/$($card.id)" $B $null }

$attBoard = Invoke-RestMethod -Method Post -Uri "$base/boards" -Headers $B -ContentType 'application/json' -Body '{"name":"Attacker board"}'
if ($card) {
  Probe 'MOVE victim card via attacker board (IDOR)' 'PATCH' "$base/boards/$($attBoard.id)/cards/$($card.id)/move" $B (@{ toListId = $list.id; targetIndex = 0 } | ConvertTo-Json)
  Probe 'DELETE victim card via attacker board (IDOR)' 'DELETE' "$base/boards/$($attBoard.id)/cards/$($card.id)" $B $null
}
Probe 'RENAME victim list via attacker board (IDOR)' 'PATCH' "$base/boards/$($attBoard.id)/lists/$($list.id)" $B '{"name":"pwned"}'

Write-Host "`n=== 6. Invite / membership edge cases ===" -ForegroundColor Cyan
Probe 'POST invite unknown email' 'POST' "$base/boards/$boardId/members" $A '{"email":"nobody-here@example.com"}'
Probe 'POST invite attacker (first time)' 'POST' "$base/boards/$boardId/members" $A (@{ email = $attackerEmail } | ConvertTo-Json)
Probe 'POST invite attacker (duplicate)' 'POST' "$base/boards/$boardId/members" $A (@{ email = $attackerEmail } | ConvertTo-Json)
Probe 'POST invite malformed email' 'POST' "$base/boards/$boardId/members" $A '{"email":"not-an-email"}'
Probe 'POST invite self (already OWNER)' 'POST' "$base/boards/$boardId/members" $A (@{ email = $seed.email } | ConvertTo-Json)

Write-Host "`n=== 7. Password size on login (DoS surface) ===" -ForegroundColor Cyan
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$null = Probe 'POST login password=20k chars' 'POST' "$base/auth/login" @{ 'Content-Type' = 'application/json' } (@{ email = $seed.email; password = ('A' * 20000) } | ConvertTo-Json)
$sw.Stop()
Write-Host ("   login with 20k-char password took {0} ms" -f $sw.ElapsedMilliseconds)

Write-Host "`nDone.`n" -ForegroundColor Green

Write-Host "`n=== 2. Auth / malformed-input handling ===" -ForegroundColor Cyan
Probe 'GET /api/auth/me (NO token)' 'GET' "$base/auth/me" $null $null
Probe 'POST login (malformed JSON)' 'POST' "$base/auth/login" @{ 'Content-Type' = 'application/json' } '{"email":'
Probe 'POST login (blank email)' 'POST' "$base/auth/login" @{ 'Content-Type' = 'application/json' } '{"email":"","password":""}'
Probe 'POST login (wrong password)' 'POST' "$base/auth/login" @{ 'Content-Type' = 'application/json' } ('{"email":"' + $seed.email + '","password":"nope-nope-nope"}')

Write-Host "`n=== 3. Path variable / bad identifier handling ===" -ForegroundColor Cyan
Probe 'GET /api/boards/not-a-uuid' 'GET' "$base/boards/not-a-uuid" $A $null
Probe 'GET /api/boards/<all-zero uuid>' 'GET' "$base/boards/00000000-0000-0000-0000-000000000000" $A $null
