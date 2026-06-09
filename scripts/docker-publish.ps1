param(
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $env:DOCKERHUB_USER) {
    if (Test-Path .env) {
        Get-Content .env | ForEach-Object {
            if ($_ -match '^\s*DOCKERHUB_USER\s*=\s*(.+)\s*$') {
                $env:DOCKERHUB_USER = $Matches[1].Trim().Trim('"').Trim("'")
            }
        }
    }
}

if (-not $env:DOCKERHUB_USER) {
    Write-Error "Defina DOCKERHUB_USER no arquivo .env (ex.: DOCKERHUB_USER=seu-usuario)"
}

$env:IMAGE_TAG = $Tag

Write-Host "Build: $($env:DOCKERHUB_USER)/vox-script-salux:$Tag e api..."
docker compose build

Write-Host "Push para Docker Hub..."
docker compose push

Write-Host "Publicado com sucesso. Tag: $Tag"
Write-Host "No servidor: docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d"
