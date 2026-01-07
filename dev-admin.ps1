# chcp 65001
chcp 65001 > $null

# 检查是否以管理员运行
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "正在请求管理员权限..." -ForegroundColor Yellow
    # 以管理员权限重新启动
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell -Verb RunAs -ArgumentList "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "cd '$PSScriptRoot'; pnpm run dev"
    exit
}

# 已经是管理员，直接运行
Write-Host "已获得管理员权限，启动开发服务器..." -ForegroundColor Green
Set-Location $PSScriptRoot
pnpm run dev
