@echo off
setlocal enabledelayedexpansion
echo ==============================
echo   小熊记账 - 开发服务器
echo ==============================
echo.

:: 使用 Codex 自带的 Node.js
set NODE_PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe

if exist "%NODE_PATH%" (
    echo [✓] 找到 Node.js
    echo [i] 启动服务器...
    echo.
    "%NODE_PATH%" "%~dp0server.js"
    if errorlevel 1 (
        echo [x] 服务器异常退出 (错误码: !errorlevel!)
        pause
    )
) else (
    echo [!] 未找到 Codex 自带的 Node.js
    echo [!] %NODE_PATH%
    echo.
    :: 尝试使用系统 Node.js
    where node >nul 2>&1
    if not errorlevel 1 (
        echo [i] 使用系统 Node.js...
        node "%~dp0server.js"
    ) else (
        echo [x] 系统中也没有找到 Node.js
        echo [x] 请安装 Node.js 后重试
        pause
    )
)
