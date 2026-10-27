# Packages the browser extension into public/:
#   drops-hub-extension.zip          — Chromium build (manifest without Firefox-only keys)
#   drops-hub-extension-firefox.zip  — Firefox / Zen build (manifest as is)
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/package-extension.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root "extension"
$public = Join-Path $root "public"
$tmpRoot = Join-Path $root ".tmp"

if (-not (Test-Path $source)) { throw "extension folder not found: $source" }

New-Item -ItemType Directory -Force $public | Out-Null
if (Test-Path $tmpRoot) { Remove-Item -Recurse -Force $tmpRoot }
New-Item -ItemType Directory -Force (Join-Path $tmpRoot "chrome") | Out-Null

$chromeCopy = Join-Path $tmpRoot "chrome\extension"
Copy-Item $source $chromeCopy -Recurse -Force

$chromeManifestPath = Join-Path $chromeCopy "manifest.json"
$manifest = Get-Content $chromeManifestPath -Raw | ConvertFrom-Json
$manifest.PSObject.Properties.Remove("browser_specific_settings")
$json = $manifest | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($chromeManifestPath, $json, (New-Object System.Text.UTF8Encoding($false)))

$chromeZip = Join-Path $public "drops-hub-extension.zip"
$firefoxZip = Join-Path $public "drops-hub-extension-firefox.zip"
foreach ($zip in @($chromeZip, $firefoxZip)) {
  if (Test-Path $zip) { Remove-Item $zip -Force }
}

Compress-Archive -Path $chromeCopy -DestinationPath $chromeZip -CompressionLevel Optimal
Compress-Archive -Path $source -DestinationPath $firefoxZip -CompressionLevel Optimal

Remove-Item -Recurse -Force $tmpRoot

Get-Item $chromeZip, $firefoxZip | Select-Object Name, Length
