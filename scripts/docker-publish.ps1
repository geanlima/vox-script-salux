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

function Invoke-Docker {
    param([Parameter(Mandatory)][string[]]$Args)
    & docker @Args
    if ($LASTEXITCODE -ne 0) {
        throw "Comando falhou (exit $LASTEXITCODE): docker $($Args -join ' ')"
    }
}

Write-Host "Conta Docker Hub logada deve ser exatamente: $($env:DOCKERHUB_USER)"
Write-Host "Build: $($env:DOCKERHUB_USER)/vox-script-salux:$Tag e api..."
Invoke-Docker compose, build, --no-cache, vox-script-salux
Invoke-Docker compose, build, api

Write-Host "Push para Docker Hub..."
Invoke-Docker compose, push, vox-script-salux, api

Write-Host "Publicado com sucesso. Tag: $Tag"
Write-Host "No servidor: docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d"
